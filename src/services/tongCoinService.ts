import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc, 
  increment, 
  setDoc,
  serverTimestamp, 
  runTransaction,
  limit,
  DocumentReference
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface AddTongCoinParams {
  identifier: string; // Bisa UID, No WA (08xx/62xx), Username Roblox, Email, atau Username
  amount: number;
  type: "REFUND" | "TOPUP" | "MANUAL_ADD" | "CASHBACK" | "DEDUCT";
  reason: string;
  orderId?: string;
  adminEmail?: string;
}

export interface ResolvedUser {
  ref: DocumentReference;
  id: string;
  data: any;
}

/**
 * 1. CARI USER DENGAN PENCARIAN FLEKSIBEL (MULTI-IDENTIFIER RESOLVER)
 * Mendukung UID, Username Roblox, Nomor WhatsApp (08xx / 62xx / +62xx), Email, dan Username
 */
export const resolveUserDocRef = async (identifier: string): Promise<DocumentReference | null> => {
  const res = await resolveUserWithData(identifier);
  return res ? res.ref : null;
};

export const resolveUserWithData = async (identifier: string): Promise<ResolvedUser | null> => {
  if (!identifier || typeof identifier !== 'string') return null;
  const cleanId = identifier.trim();
  if (!cleanId) return null;

  const cleanUser = cleanId.toLowerCase().replace(/^@/, '');
  const cleanPhone = cleanId.replace(/[^0-9]/g, '');
  const usersRef = collection(db, "users");

  // A. Cek langsung jika identifier adalah Document ID (UID)
  try {
    const directDocRef = doc(db, "users", cleanId);
    const directSnap = await getDoc(directDocRef);
    if (directSnap.exists()) {
      return { ref: directDocRef, id: directSnap.id, data: directSnap.data() };
    }
  } catch (e) {
    // Lanjut ke query pencarian
  }

  // B. Cari berdasarkan field uid / id
  try {
    const uidSnap = await getDocs(query(usersRef, where("uid", "==", cleanId), limit(1)));
    if (!uidSnap.empty) {
      return { ref: uidSnap.docs[0].ref, id: uidSnap.docs[0].id, data: uidSnap.docs[0].data() };
    }
  } catch (e) {}

  // C. Cari berdasarkan Username Roblox
  try {
    const robloxSnap = await getDocs(query(usersRef, where("robloxUsername", "==", cleanUser), limit(1)));
    if (!robloxSnap.empty) {
      return { ref: robloxSnap.docs[0].ref, id: robloxSnap.docs[0].id, data: robloxSnap.docs[0].data() };
    }

    const robloxLowerSnap = await getDocs(query(usersRef, where("roblox_username", "==", cleanUser), limit(1)));
    if (!robloxLowerSnap.empty) {
      return { ref: robloxLowerSnap.docs[0].ref, id: robloxLowerSnap.docs[0].id, data: robloxLowerSnap.docs[0].data() };
    }
  } catch (e) {}

  // D. Cari berdasarkan Nomor WhatsApp / Phone dengan varian normalisasi
  if (cleanPhone.length >= 8) {
    const phoneVariants = [
      cleanPhone,
      cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone,
      cleanPhone.startsWith('62') ? '0' + cleanPhone.slice(2) : cleanPhone,
      `+${cleanPhone}`,
      cleanPhone.startsWith('62') ? `+${cleanPhone}` : `+62${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}`
    ];

    for (const phone of phoneVariants) {
      try {
        const waSnap = await getDocs(query(usersRef, where("whatsapp", "==", phone), limit(1)));
        if (!waSnap.empty) {
          return { ref: waSnap.docs[0].ref, id: waSnap.docs[0].id, data: waSnap.docs[0].data() };
        }

        const phoneSnap = await getDocs(query(usersRef, where("phone", "==", phone), limit(1)));
        if (!phoneSnap.empty) {
          return { ref: phoneSnap.docs[0].ref, id: phoneSnap.docs[0].id, data: phoneSnap.docs[0].data() };
        }

        const waNumSnap = await getDocs(query(usersRef, where("whatsappNumber", "==", phone), limit(1)));
        if (!waNumSnap.empty) {
          return { ref: waNumSnap.docs[0].ref, id: waNumSnap.docs[0].id, data: waNumSnap.docs[0].data() };
        }
      } catch (e) {}
    }
  }

  // E. Cari berdasarkan Email
  if (cleanId.includes('@')) {
    try {
      const emailSnap = await getDocs(query(usersRef, where("email", "==", cleanId.toLowerCase()), limit(1)));
      if (!emailSnap.empty) {
        return { ref: emailSnap.docs[0].ref, id: emailSnap.docs[0].id, data: emailSnap.docs[0].data() };
      }
    } catch (e) {}
  }

  // F. Cari berdasarkan Username atau Nama
  try {
    const usernameSnap = await getDocs(query(usersRef, where("username", "==", cleanUser), limit(1)));
    if (!usernameSnap.empty) {
      return { ref: usernameSnap.docs[0].ref, id: usernameSnap.docs[0].id, data: usernameSnap.docs[0].data() };
    }

    const usernameLowerSnap = await getDocs(query(usersRef, where("usernameLower", "==", cleanUser), limit(1)));
    if (!usernameLowerSnap.empty) {
      return { ref: usernameLowerSnap.docs[0].ref, id: usernameLowerSnap.docs[0].id, data: usernameLowerSnap.docs[0].data() };
    }

    const nameSnap = await getDocs(query(usersRef, where("name", "==", cleanId), limit(1)));
    if (!nameSnap.empty) {
      return { ref: nameSnap.docs[0].ref, id: nameSnap.docs[0].id, data: nameSnap.docs[0].data() };
    }
  } catch (e) {}

  return null;
};

/**
 * 2. EKSEKUSI MUTASI TONGCOINS ATOMIK & RIWAYAT TRANSAKSI (SINKRON 100%)
 * Menjalankan Firestore runTransaction agar tidak ada race condition atau selisih saldo.
 */
export const mutateTongCoins = async ({
  identifier,
  amount,
  type,
  reason,
  orderId = "-",
  adminEmail = "Admin"
}: AddTongCoinParams) => {
  if (!identifier) {
    throw new Error("Identifier customer tidak boleh kosong.");
  }
  if (isNaN(amount) || amount < 0) {
    throw new Error("Jumlah koin harus berupa angka positif.");
  }

  const resolved = await resolveUserWithData(identifier);

  if (!resolved || !resolved.ref) {
    throw new Error(`Customer dengan identifier "${identifier}" tidak ditemukan di database users.`);
  }

  const userRef = resolved.ref;
  const nowIso = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw new Error("Dokumen user tidak ditemukan di database.");
    }

    const userData = userDoc.data() || {};
    const currentBalance = Number(
      userData.tongCoins ?? 
      userData.tc_balance ?? 
      userData.tongcoins ?? 
      userData.balance ?? 
      0
    );

    const delta = type === "DEDUCT" ? -Math.abs(amount) : Math.abs(amount);
    const newBalance = Math.max(0, currentBalance + delta);

    // Update Saldo Utama Akun Customer di semua kompatibilitas field
    transaction.update(userRef, {
      tongCoins: newBalance,
      tc_balance: newBalance,
      tongcoins: newBalance,
      balance: newBalance,
      updatedAt: serverTimestamp(),
      lastCoinMutation: {
        type,
        amount: Math.abs(amount),
        delta,
        reason,
        orderId,
        at: nowIso,
        by: adminEmail
      }
    });

    // Catat Mutasi ke Koleksi `tongcoin_transactions`
    const historyRef = doc(collection(db, "tongcoin_transactions"));
    const transactionRecord = {
      id: historyRef.id,
      userId: userRef.id,
      userDocId: userRef.id,
      customerName: userData.name || userData.robloxUsername || userData.username || identifier,
      robloxUsername: userData.robloxUsername || userData.roblox_username || "",
      whatsapp: userData.whatsapp || userData.phone || userData.whatsappNumber || "",
      email: userData.email || "",
      amount: Math.abs(amount),
      type: type,
      delta: delta,
      previousBalance: currentBalance,
      currentBalance: newBalance,
      reason: reason || `Mutasi ${type} oleh ${adminEmail}`,
      orderId: orderId,
      processedBy: adminEmail,
      createdAt: serverTimestamp(),
      timestamp: Date.now()
    };
    transaction.set(historyRef, transactionRecord);

    // Catat juga ke `coin_transactions` untuk kompatibilitas penuh dengan sistem legacy
    const legacyTxRef = doc(collection(db, "coin_transactions"));
    transaction.set(legacyTxRef, {
      id: legacyTxRef.id,
      userId: userRef.id,
      userName: userData.name || userData.robloxUsername || userData.username || identifier,
      userEmail: userData.email || '',
      userPhone: userData.phone || userData.whatsapp || '',
      type: delta >= 0 ? 'MANUAL_ADD' : 'MANUAL_SUB',
      amount: Math.abs(amount),
      orderId: orderId || 'MANUAL_MUTATION',
      description: reason || `Mutasi TongCoins (${type})`,
      status: 'SUCCESS',
      adminNote: `Diproses oleh ${adminEmail}. Saldo awal: ${currentBalance.toLocaleString('id-ID')} TC -> Saldo baru: ${newBalance.toLocaleString('id-ID')} TC`,
      createdAt: nowIso,
      updatedAt: nowIso,
      serverCreatedAt: serverTimestamp()
    });

    return { 
      success: true, 
      newBalance, 
      previousBalance: currentBalance,
      delta,
      userId: userRef.id,
      userName: userData.name || userData.robloxUsername || identifier
    };
  });
};
