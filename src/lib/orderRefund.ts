import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  setDoc, 
  updateDoc, 
  increment, 
  writeBatch,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { resolveUserWithData } from '../services/tongCoinService';

/**
 * Helper strictly detecting dummy, bot, and junk orders.
 */
export const isJunkBotOrder = (order: any): boolean => {
  if (!order) return true;

  // Never flag manual WA orders as junk
  if (order.source === 'manual_wa' || order.isManualWA === true) {
    return false;
  }
  
  const idStr = String(order.id || order.docUniqueId || order.orderId || order.order_id || '').toLowerCase();
  const price = Number(order.price ?? order.totalPrice ?? order.amount ?? order.total_price ?? 0);
  const customerName = (order.customerName || order.customer_name || order.name || order.userName || order.customer || '').trim().toLowerCase();
  const robloxUser = (order.robloxUsername || order.game_username || order.targetUsername || order.username || order.roblox_username || order.game_user_id || '').trim().toLowerCase();
  const phone = (order.customer_phone || order.customerPhone || order.whatsapp || order.phone || '').trim();
  const pkgName = (order.package_name || order.packageName || order.item_name || order.game_name || order.gameName || order.title || '').trim().toLowerCase();
  
  // 1. Explicit bot or dummy flags
  if (
    order.isDummy === true || 
    order.isBot === true || 
    order.isFictional === true || 
    order.isDraft === true
  ) {
    return true;
  }

  // 2. Dummy ID signatures (such as #Ero1Q2, test-dummy, mock-)
  if (
    idStr.includes('ero1q2') || 
    idStr.includes('dummy') || 
    idStr.includes('mock') || 
    idStr.includes('test-seed')
  ) {
    return true;
  }
  
  // 3. Orders with 0 / negative / NaN price
  if (isNaN(price) || price <= 0) return true;
  
  // 4. Anonymous placeholder order with dummy data
  const isAnonymousCust = !customerName || customerName === 'customer' || customerName === '(customer)' || customerName === '-' || customerName === 'cust-manual';
  const isAnonymousRoblox = !robloxUser || robloxUser === '-' || robloxUser === 'user roblox';
  const isNoPhone = !phone || phone === '-' || phone === '081234567890';
  const isGenericPkg = !pkgName || pkgName === '-' || pkgName === 'item joko/gift' || pkgName === 'gamepass / joko';

  if (isAnonymousCust && isAnonymousRoblox && isGenericPkg) return true;

  return false;
};

/**
 * Helper strictly detecting Top Up TongCoins transactions
 * to prevent mixing with product/game orders (Joko & Gift)
 */
export const isTopUpTcOrder = (order: any): boolean => {
  if (!order) return false;
  const cat = (order.category || order.service_type || order.serviceType || order.order_type || order.orderType || order.type || '').toString().toLowerCase();
  const game = (order.game_name || order.gameName || '').toString().toLowerCase();
  const pkg = (order.package_name || order.packageName || order.item_name || '').toString().toLowerCase();
  const docId = (order.id || order.docUniqueId || order.orderId || order.order_id || '').toString().toUpperCase();

  if (cat === 'topup_tc' || cat === 'tongcoins' || cat.includes('topup_tc') || cat.includes('tongcoin')) return true;
  if (game.includes('tongcoin') || game === 'tc' || game === 'tongcoins (tc)') return true;
  if (pkg.includes('top up tc') || pkg.includes('topup tc') || pkg.includes('top up tongcoin')) return true;
  if (docId.startsWith('TC-') || docId.startsWith('#TC-') || docId.startsWith('TOPUP-TC')) return true;

  return false;
};

export interface CancelRefundResult {
  success: boolean;
  refunded: boolean;
  nominalRefunded: number;
  userId?: string;
  orderId: string;
  message: string;
}

/**
 * Atomic handler for Order Cancel & Auto-Refund to TongCoins (TC)
 */
export const executeCancelOrderWithAutoRefund = async (order: any): Promise<CancelRefundResult> => {
  const nowIso = new Date().toISOString();
  const rawPrice = order.price ?? order.totalPrice ?? order.total_price ?? order.total ?? order.amount ?? 0;
  const refundAmount = Number(rawPrice);
  let docId = order.firestore_id || order.docUniqueId || order.firestoreId || order.id || order.orderId;
  const displayOrderId = order.orderId || order.order_id || docId || 'ORDER';
  const itemName = order.itemName || order.serviceName || order.packageName || order.package_name || order.item_name || order.game_name || "Item Gift/Joko";

  if (!docId) {
    throw new Error('ID Dokumen pesanan tidak ditemukan');
  }

  // 1. Prepare target order reference - Resolve true Firestore ID if it's a display ID
  if (docId.startsWith('#ORD-') || docId.startsWith('ORD-') || docId.startsWith('room_') || docId.startsWith('direct-')) {
    const cleanId = docId.replace(/^#/, '').replace(/^room_/, '').replace(/^direct-/, '');
    const snap = await getDocs(query(collection(db, 'orders'), where('orderId', 'in', [docId, cleanId, `#${cleanId}`])));
    if (!snap.empty) {
      docId = snap.docs[0].id;
    } else {
      const snap2 = await getDocs(query(collection(db, 'orders'), where('id', 'in', [docId, cleanId, `#${cleanId}`])));
      if (!snap2.empty) docId = snap2.docs[0].id;
    }
  }

  const orderRef = doc(db, 'orders', docId);

  // 2. Identify customer account for TC refund with robust multi-identifier lookup
  let targetUserId = order.userId || order.uid || order.customerId || order.customer_id;
  let userSnap: any = null;

  if (targetUserId && targetUserId !== 'manual-admin' && targetUserId !== 'GUEST') {
    try {
      const uRef = doc(db, 'users', targetUserId);
      const snap = await getDoc(uRef);
      if (snap.exists()) {
        userSnap = snap;
      }
    } catch (e) {
      console.warn('Direct user lookup error:', e);
    }
  }

  // Fallback with multi-identifier resolver (roblox username, whatsapp, email, phone)
  if (!userSnap) {
    const candidates = [
      order.robloxUsername || order.roblox_username || order.game_username,
      order.whatsapp || order.customerPhone || order.customer_phone || order.phone,
      order.customer_email || order.email,
      order.customerName || order.customer || order.customer_name || order.name
    ].filter(Boolean);

    for (const candidate of candidates) {
      try {
        const resolved = await resolveUserWithData(String(candidate));
        if (resolved) {
          userSnap = { data: () => resolved.data, id: resolved.id, ref: resolved.ref };
          targetUserId = resolved.id;
          break;
        }
      } catch (e) {
        console.warn('Resolver candidate lookup error:', e);
      }
    }
  }

  let isRefundSuccessful = false;

  // 3. If refundAmount > 0 and user is found, execute Atomic Increment and record ledger transactions
  if (refundAmount > 0 && targetUserId && userSnap) {
    const userData = userSnap.data() || {};
    const uRef = doc(db, 'users', targetUserId);

    const curBal = Number(userData.tongCoins ?? userData.tc_balance ?? userData.tongcoins ?? userData.balance ?? 0);
    const newBal = curBal + refundAmount;

    // Atomic update to user balance across all compatibility fields
    await updateDoc(uRef, {
      tongCoins: newBal,
      tc_balance: newBal,
      tongcoins: newBal,
      balance: newBal,
      updatedAt: serverTimestamp()
    }).catch(async () => {
      await setDoc(uRef, {
        tongCoins: newBal,
        tc_balance: newBal,
        tongcoins: newBal,
        balance: newBal,
        updatedAt: nowIso
      }, { merge: true });
    });

    const formattedAmountStr = `+${refundAmount.toLocaleString("id-ID")} TC`;

    const mutationData = {
      userId: targetUserId,
      userDocId: targetUserId,
      userEmail: userData.email || order.customer_email || order.email || '',
      userName: userData.name || userData.customer_name || order.customer_name || order.customerName || 'Customer',
      robloxUsername: userData.robloxUsername || order.robloxUsername || '',
      whatsapp: userData.whatsapp || userData.phone || order.customer_phone || '',
      orderId: displayOrderId,
      type: "REFUND",
      isIncoming: true,
      title: `Refund Pembatalan Order #${displayOrderId}: ${itemName}`,
      description: `Refund Pembatalan Order #${displayOrderId}`,
      amount: refundAmount,
      amountFormatted: formattedAmountStr,
      delta: refundAmount,
      previousBalance: curBal,
      currentBalance: newBal,
      status: "Berhasil",
      paymentMethod: "REFUND SYSTEM",
      createdAt: serverTimestamp(),
      timestamp: Date.now()
    };

    // Record in global tongcoin_transactions
    try {
      await addDoc(collection(db, 'tongcoin_transactions'), mutationData);
    } catch (err) {
      console.warn('Global tongcoin_transactions addDoc error:', err);
    }

    // Record in global coin_transactions ledger
    try {
      await addDoc(collection(db, 'coin_transactions'), mutationData);
    } catch (err) {
      console.warn('Global coin_transactions addDoc error:', err);
    }

    // Record in user's subcollection tc_transactions
    try {
      await addDoc(collection(db, 'users', targetUserId, 'tc_transactions'), {
        ...mutationData,
        createdAt: serverTimestamp()
      });
    } catch (subErr) {
      console.warn('tc_transactions subcollection write warning:', subErr);
    }

    // Record in user's subcollection mutations
    try {
      await addDoc(collection(db, 'users', targetUserId, 'mutations'), {
        ...mutationData,
        createdAt: serverTimestamp()
      });
    } catch (subErr) {
      console.warn('mutations subcollection write warning:', subErr);
    }

    isRefundSuccessful = true;
  }

  // 4. Update order status to Cancel (Refund TC) in Firestore
  const updatePayload: any = {
    status: 'Cancel (Refund TC)',
    orderStatus: 'Cancel (Refund TC)',
    updated: nowIso,
    updated_at: nowIso,
    updatedAt: nowIso,
    statusUpdatedAt: nowIso
  };

  if (isRefundSuccessful) {
    updatePayload.isRefunded = true;
    updatePayload.refundAmount = refundAmount;
    updatePayload.refundedAmount = refundAmount;
    updatePayload.refundedAt = serverTimestamp();
  }

  await setDoc(orderRef, updatePayload, { merge: true });

  const rupiahFormatted = refundAmount.toLocaleString('id-ID');

  return {
    success: true,
    refunded: isRefundSuccessful,
    nominalRefunded: isRefundSuccessful ? refundAmount : 0,
    userId: targetUserId,
    orderId: displayOrderId,
    message: isRefundSuccessful
      ? `Pesanan dibatalkan & dana Rp ${rupiahFormatted} otomatis dikembalikan ke TongCoins customer.`
      : `Pesanan #${displayOrderId} berhasil dibatalkan.`
  };
};

export { markOrderAsHangus } from '../utils/orderUtils';

/**
 * Permanently purge all junk / bot / dummy orders from Firestore
 */
export const purgeAllBotAndDummyOrders = async (): Promise<{ deletedCount: number }> => {
  const ordersRef = collection(db, 'orders');
  const snap = await getDocs(ordersRef);
  let deletedCount = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (isJunkBotOrder({ ...data, id: docSnap.id, docUniqueId: docSnap.id })) {
      batch.delete(doc(db, 'orders', docSnap.id));
      deletedCount++;
      batchCount++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return { deletedCount };
};
