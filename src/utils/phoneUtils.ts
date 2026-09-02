import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  normalizePhoneVariants, 
  linkGuestOrdersToAccount, 
  handlePostLoginSync, 
  getCanonicalPhone 
} from '../services/accountLinkingService';

export { 
  normalizePhoneVariants, 
  linkGuestOrdersToAccount, 
  handlePostLoginSync, 
  getCanonicalPhone 
};

/**
 * Standardize and normalize phone number to WhatsApp international standard:
 * - 0812... -> 62812...
 * - 812...  -> 62812...
 * - +628... -> 628...
 * Removes all non-digit characters.
 */
export const normalizePhone = (phone: string | number | undefined | null): string => {
  if (!phone) return '';
  return getCanonicalPhone(phone);
};

/**
 * Formats normalized number for local human display (e.g. 6281234 -> 081234)
 */
export const formatPhoneDisplay = (phone: string | number | undefined | null): string => {
  const norm = normalizePhone(phone);
  if (!norm) return '-';
  if (norm.startsWith('62')) {
    return '0' + norm.slice(2);
  }
  return norm;
};

/**
 * Auto-claims manual WA / guest orders when a customer registers or logs in with their phone number.
 * Updates order documents in batch to bind userUid & customerUid so they instantly appear in customer order history.
 */
export const syncOrdersOnAuth = async (userUid: string, userPhone: string): Promise<number> => {
  if (!userPhone || !userUid) return 0;
  try {
    const res = await linkGuestOrdersToAccount(userUid, userPhone);
    return res.linkedCount;
  } catch (err) {
    console.error('Error in syncOrdersOnAuth:', err);
    return 0;
  }
};

/**
 * Backward-compatible wrapper for syncOrdersOnAuth
 */
export const syncGuestOrdersToUser = async (userId: string, phoneOrWhatsapp: string): Promise<number> => {
  return syncOrdersOnAuth(userId, phoneOrWhatsapp);
};


export const runAdminAutoLinkSync = async (): Promise<{ linked: number, errors: number, totalChecked: number }> => {
  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const userByPhoneMap = new Map();
    
    usersSnap.forEach(doc => {
      const data = doc.data();
      const phone = normalizePhone(data.whatsapp || data.phone || data.whatsappNumber || data.customer_phone || '');
      if (phone) {
        userByPhoneMap.set(phone, {
          uid: doc.id,
          displayName: data.displayName || data.name || data.fullName || data.username || 'Customer Resmi',
          email: data.email
        });
      }
    });

    const ordersRef = collection(db, 'orders');
    const ordersSnap = await getDocs(ordersRef);
    
    let linked = 0;
    let errors = 0;
    let totalChecked = 0;
    
    // Chunking per 400 documents
    let currentBatch = writeBatch(db);
    let batchCount = 0;
    
    for (const orderDoc of ordersSnap.docs) {
      const data = orderDoc.data();
      totalChecked++;
      
      if (!data.userId || data.isManualWA === true || data.customerName === 'Customer') {
        const orderPhone = normalizePhone(data.whatsapp || data.phone || data.customer_phone || data.customerPhone || '');
        if (orderPhone && userByPhoneMap.has(orderPhone)) {
          const matchedUser = userByPhoneMap.get(orderPhone);
          
          if (data.userId !== matchedUser.uid) {
            currentBatch.update(orderDoc.ref, {
               userId: matchedUser.uid,
               userUid: matchedUser.uid,
               customerUid: matchedUser.uid,
               customerId: matchedUser.uid,
               customer_id: matchedUser.uid,
               customerName: matchedUser.displayName,
               displayName: matchedUser.displayName,
               isRegistered: true,
               isClaimed: true,
               status: data.status || data.orderStatus || 'Booking',
               orderStatus: data.orderStatus || data.status || 'Booking',
               ...(data.statusCode ? { statusCode: data.statusCode } : {}),
               claimedAt: serverTimestamp(),
               updatedAt: serverTimestamp(),
               syncedAt: new Date().toISOString()
            });
            linked++;
            batchCount++;

            // Sync chat room juga
            const qChatAdmin = query(collection(db, 'chats'), where('whatsapp', '==', orderPhone));
            const chatSnapAdmin = await getDocs(qChatAdmin);
            chatSnapAdmin.docs.forEach(cDoc => {
               if (!cDoc.data().userId || cDoc.data().userId !== matchedUser.uid) {
                 currentBatch.update(cDoc.ref, {
                   userId: matchedUser.uid,
                   userUid: matchedUser.uid,
                   customerId: matchedUser.uid,
                   customer_id: matchedUser.uid,
                   customerName: matchedUser.displayName,
                   isRegistered: true,
                   isCustomerRegistered: true,
                   status: cDoc.data().status || 'BOOKING',
                   orderStatus: cDoc.data().orderStatus || 'BOOKING'
                 });
                 batchCount++;
               }
            });
            
            if (batchCount >= 400) {
               await currentBatch.commit();
               currentBatch = writeBatch(db);
               batchCount = 0;
            }
          }
        }
      }
    }
    
    if (batchCount > 0) {
       await currentBatch.commit();
    }
    
    return { linked, errors, totalChecked };
  } catch (err) {
    console.error("Admin auto link sync error:", err);
    return { linked: 0, errors: 1, totalChecked: 0 };
  }
};
