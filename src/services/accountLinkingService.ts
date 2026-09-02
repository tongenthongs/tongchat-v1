import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  getDoc,
  setDoc,
  updateDoc,
  increment
} from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * 1. Helper Normalisasi Nomor HP ke Semua Kemungkinan Format Variasi
 * Mendukung format: 08xx, 628xx, +628xx, 8xx, +62 8xx-xxxx
 */
export const normalizePhoneVariants = (phoneInput: string | number | undefined | null): string[] => {
  if (!phoneInput) return [];
  const rawStr = phoneInput.toString();
  const clean = rawStr.replace(/[^0-9]/g, '');
  if (clean.length < 8) return [];

  const variants = new Set<string>();
  variants.add(clean);

  // Format 08xx -> 628xx, +628xx, 8xx
  if (clean.startsWith('0')) {
    const withoutZero = clean.slice(1);
    variants.add('62' + withoutZero);
    variants.add('+62' + withoutZero);
    variants.add(withoutZero);
  }
  // Format 628xx -> 08xx, +628xx, 8xx
  else if (clean.startsWith('62')) {
    const without62 = clean.slice(2);
    variants.add('0' + without62);
    variants.add('+' + clean);
    variants.add(without62);
  }
  // Format 8xx -> 08xx, 628xx, +628xx
  else if (clean.startsWith('8')) {
    variants.add('0' + clean);
    variants.add('62' + clean);
    variants.add('+62' + clean);
  }

  return Array.from(variants);
};

/**
 * Mendapatkan format standar tunggal (628xxx) untuk konsistensi database
 */
export const getCanonicalPhone = (phoneInput: string | number | undefined | null): string => {
  const variants = normalizePhoneVariants(phoneInput);
  if (variants.length === 0) return '';
  const canonical = variants.find(v => v.startsWith('62') && !v.startsWith('+'));
  return canonical || variants[0];
};

/**
 * 2. Eksekusi Auto-Link Orderan & Merge Akun Berdasarkan No HP Secara Atomik
 * - Menghubungkan seluruh orderan guest / POS ke UID akun yang baru login / terdaftar
 * - Menggabungkan saldo TongCoins / balance dari akun bayangan lama
 * - Memperbarui status chat room yang terkait
 */
export const linkGuestOrdersToAccount = async (
  currentUserId: string,
  userPhone: string,
  userName?: string,
  robloxUsername?: string
): Promise<{ success: boolean; linkedCount: number; coinsMerged: number }> => {
  if (!currentUserId || !userPhone) return { success: false, linkedCount: 0, coinsMerged: 0 };

  const phoneVariants = normalizePhoneVariants(userPhone);
  if (phoneVariants.length === 0) return { success: false, linkedCount: 0, coinsMerged: 0 };

  const canonicalPhone = getCanonicalPhone(userPhone) || phoneVariants[0];

  try {
    const batch = writeBatch(db);
    let totalLinkedOrders = 0;
    let accumulatedCoins = 0;
    let batchOperations = 0;

    // A. Cari Semua Orderan Lama yang Menggunakan Variasi No HP Ini
    const ordersRef = collection(db, "orders");
    const linkedOrderIds: string[] = [];

    // Cari di kolom customerWhatsapp, whatsapp, phone, customerPhone, customer_phone
    const searchFields = ["customerWhatsapp", "whatsapp", "phone", "customerPhone", "customer_phone", "whatsappNumber"];

    for (const phone of phoneVariants) {
      for (const field of searchFields) {
        try {
          const q = query(ordersRef, where(field, "==", phone));
          const snap = await getDocs(q);
          
          snap.docs.forEach(docSnap => {
            if (!linkedOrderIds.includes(docSnap.id)) {
              linkedOrderIds.push(docSnap.id);
              const orderData = docSnap.data();

              // Update kepemilikan order ke UID yang sedang aktif jika belum terhubung, dengan menjaga status aslinya
              if (orderData.userId !== currentUserId || orderData.customerUid !== currentUserId || !orderData.isRegistered) {
                const preservedStatus = orderData.status || orderData.orderStatus || "Booking";
                const preservedOrderStatus = orderData.orderStatus || orderData.status || "Booking";
                
                batch.update(docSnap.ref, {
                  userId: currentUserId,
                  userUid: currentUserId,
                  customerUid: currentUserId,
                  customerId: currentUserId,
                  customer_id: currentUserId,
                  customerWhatsapp: canonicalPhone,
                  whatsapp: canonicalPhone,
                  phone: canonicalPhone,
                  customerPhone: canonicalPhone,
                  customer_phone: canonicalPhone,
                  status: preservedStatus,
                  orderStatus: preservedOrderStatus,
                  isGuest: false,
                  isRegistered: true,
                  isCustomerRegistered: true,
                  isClaimed: true,
                  claimedAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                totalLinkedOrders++;
                batchOperations++;
              }
            }
          });
        } catch (queryErr) {
          console.warn(`Query orders field ${field} warning:`, queryErr);
        }
      }
    }

    // B. Cari Dokumen User Lama / Shadow Account yang Memiliki No HP Sama (Merge TongCoins)
    const usersRef = collection(db, "users");
    const mergedUserIds: string[] = [];

    for (const phone of phoneVariants) {
      const userPhoneFields = ["whatsapp", "phone", "whatsappNumber", "customer_phone"];
      for (const uField of userPhoneFields) {
        try {
          const qUser = query(usersRef, where(uField, "==", phone));
          const userSnap = await getDocs(qUser);

          userSnap.docs.forEach(uDoc => {
            // Jika menemukan dokumen user lama yang BUKAN dokumen saat ini
            if (uDoc.id !== currentUserId && !mergedUserIds.includes(uDoc.id)) {
              mergedUserIds.push(uDoc.id);
              const oldData = uDoc.data();
              const oldCoins = Number(oldData.tongCoins || oldData.balance || oldData.coins || 0);
              if (oldCoins > 0 && !oldData.isMerged) {
                accumulatedCoins += oldCoins;
              }

              // Tandai akun lama telah digabungkan agar tidak double claim
              batch.update(uDoc.ref, {
                tongCoins: 0,
                balance: 0,
                coins: 0,
                isMerged: true,
                mergedTo: currentUserId,
                mergedAt: serverTimestamp()
              });
              batchOperations++;
            }
          });
        } catch (uQueryErr) {
          console.warn(`Query users field ${uField} warning:`, uQueryErr);
        }
      }
    }

    // C. Sinkronisasi Chat Rooms Terkait
    const chatsRef = collection(db, "chats");
    const syncedChatIds: string[] = [];
    for (const phone of phoneVariants) {
      for (const cField of ["whatsapp", "customerPhone", "customer_phone"]) {
        try {
          const qChat = query(chatsRef, where(cField, "==", phone));
          const chatSnap = await getDocs(qChat);
          chatSnap.docs.forEach(cDoc => {
            if (!syncedChatIds.includes(cDoc.id)) {
              syncedChatIds.push(cDoc.id);
              const cData = cDoc.data();
              if (cData.userId !== currentUserId || !cData.isRegistered) {
                batch.update(cDoc.ref, {
                  userId: currentUserId,
                  userUid: currentUserId,
                  customerId: currentUserId,
                  customer_id: currentUserId,
                  isRegistered: true,
                  isCustomerRegistered: true,
                  isGuest: false,
                  updatedAt: serverTimestamp()
                });
                batchOperations++;
              }
            }
          });
        } catch (chatErr) {
          console.warn(`Query chats warning:`, chatErr);
        }
      }
    }

    // D. Update / Buat Dokumen Profil User Utama di `users/{currentUserId}`
    const currentUserRef = doc(db, "users", currentUserId);
    const currentUserSnap = await getDoc(currentUserRef);

    if (!currentUserSnap.exists()) {
      batch.set(currentUserRef, {
        userId: currentUserId,
        id: currentUserId,
        uid: currentUserId,
        whatsapp: canonicalPhone,
        phone: canonicalPhone,
        whatsappNumber: canonicalPhone,
        name: userName || "Customer",
        robloxUsername: robloxUsername || "",
        tongCoins: accumulatedCoins,
        balance: accumulatedCoins,
        isGuest: false,
        role: "CUSTOMER",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      batchOperations++;
    } else {
      const updatePayload: any = {
        whatsapp: canonicalPhone,
        phone: canonicalPhone,
        whatsappNumber: canonicalPhone,
        updatedAt: serverTimestamp()
      };

      if (accumulatedCoins > 0) {
        updatePayload.tongCoins = increment(accumulatedCoins);
        updatePayload.balance = increment(accumulatedCoins);
      }
      if (robloxUsername && !currentUserSnap.data().robloxUsername) {
        updatePayload.robloxUsername = robloxUsername;
      }
      if (userName && (!currentUserSnap.data().name || currentUserSnap.data().name === 'Customer')) {
        updatePayload.name = userName;
      }

      batch.update(currentUserRef, updatePayload);
      batchOperations++;
    }

    // Commit seluruh mutasi secara bersamaan (Atomic)
    if (batchOperations > 0) {
      await batch.commit();
      console.log(`⚡ [AutoLink] ${totalLinkedOrders} orderan berhasil ditautkan ke akun UID: ${currentUserId}, TongCoins merged: ${accumulatedCoins}`);
    }

    return { success: true, linkedCount: totalLinkedOrders, coinsMerged: accumulatedCoins };
  } catch (error) {
    console.error("Gagal mengeksekusi linkGuestOrdersToAccount:", error);
    return { success: false, linkedCount: 0, coinsMerged: 0 };
  }
};

/**
 * 3. Handler Post-Login / Post-Register Sync
 * Dipanggil saat user selesai login, registrasi, Google Auth, atau mengupdate profil nomor WhatsApp
 */
export const handlePostLoginSync = async (user: any, inputPhone?: string): Promise<{ success: boolean; linkedCount: number; coinsMerged: number }> => {
  if (!user || (!user.uid && !user.id)) return { success: false, linkedCount: 0, coinsMerged: 0 };
  const uid = user.uid || user.id;

  try {
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);
    const existingData = userSnap.exists() ? userSnap.data() : {};
    const existingPhone = existingData.whatsapp || existingData.phone || existingData.whatsappNumber;

    const targetPhone = existingPhone || inputPhone || user.phoneNumber || user.phone || user.whatsapp;

    if (targetPhone) {
      return await linkGuestOrdersToAccount(
        uid,
        targetPhone,
        user.displayName || existingData.name || existingData.username || "Customer",
        user.robloxUsername || existingData.robloxUsername || existingData.roblox_username
      );
    }
    return { success: true, linkedCount: 0, coinsMerged: 0 };
  } catch (error) {
    console.error("Gagal menjalankan handlePostLoginSync:", error);
    return { success: false, linkedCount: 0, coinsMerged: 0 };
  }
};
