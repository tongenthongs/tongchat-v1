import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface CheckOrderEligibilityParams {
  robloxUsername: string;
  packageName?: string;
  itemGift?: string;
  category?: string;
  catalogId?: string;
}

/**
 * ULTRA-FAST REALTIME ORDERS LISTENER:
 * Mengambil 150 transaksi terbaru seketika tanpa membebani browser atau memblokir thread JavaScript.
 */
export const subscribeFastOrders = (onData: (orders: any[]) => void) => {
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc"),
    limit(150)
  );

  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map(d => ({
      id: d.id,
      orderId: d.data().orderId || d.id,
      ...d.data()
    }));
    onData(orders);
  }, (err) => {
    console.warn("Orders listener error:", err);
  });
};

/**
 * ATURAN VALIDASI ORDER MULTI-PRODUK (ORDER CONCURRENCY RULE):
 * 1. DIPERBOLEHKAN: Jika username Roblox yang sama memesan produk yang BERBEDA.
 * 2. DITOLAK: Jika username Roblox yang sama mencoba memesan produk yang SAMA
 *    saat pesanan produk tersebut sebelumnya masih AKTIF (Booking, Antrean, Diorder, Proses, Menunggu Pembayaran, Pending).
 */
export const validateOrderEligibility = async ({
  robloxUsername,
  packageName = '',
  itemGift = '',
  category = '',
  catalogId = ''
}: CheckOrderEligibilityParams): Promise<{ allowed: boolean; reason?: string }> => {
  try {
    const cleanUser = (robloxUsername || '').toLowerCase().trim().replace(/^@/, '');
    const currentTargetProduct = (packageName || itemGift || '').toLowerCase().trim();
    const currentCatalogId = (catalogId || '').toLowerCase().trim();

    if (!cleanUser) {
      return { allowed: false, reason: "Username Roblox wajib diisi." };
    }

    // Query semua pesanan milik username tersebut
    const ordersRef = collection(db, "orders");
    const q = query(
      ordersRef,
      where("robloxUsername", "==", cleanUser)
    );

    const snapshot = await getDocs(q);
    
    // Status yang dianggap masih berjalan / aktif
    const activeStatuses = [
      "booking", 
      "antrean", 
      "diorder", 
      "proses", 
      "menunggu pembayaran", 
      "menunggu verifikasi",
      "menunggu konfirmasi",
      "pending",
      "pending_verification",
      "ready",
      "logul"
    ];

    const hasDuplicateActiveProduct = snapshot.docs.some(doc => {
      const data = doc.data();
      const orderStatus = (data.status || data.orderStatus || '').toLowerCase().trim();
      const existingProduct = (data.packageName || data.package_name || data.itemGift || data.item_name || '').toLowerCase().trim();
      const existingCatalogId = (data.catalogId || data.catalog_id || data.packageId || data.itemId || '').toLowerCase().trim();

      // Cek apakah status masih aktif (bukan selesai / batal / hangus)
      const isFinished = 
        data.isCompleted === true || 
        data.isHangus === true || 
        orderStatus === 'selesai' || 
        orderStatus === 'completed' || 
        orderStatus === 'batal' || 
        orderStatus === 'dibatalkan' || 
        orderStatus === 'hangus' || 
        orderStatus === 'refund' || 
        orderStatus === 'ditolak';

      const isActive = activeStatuses.includes(orderStatus) && !isFinished;

      if (!isActive) return false;

      // Cek apakah memesan produk yang SAMA
      // 1. Cek kesamaan nama produk (exact match atau contains)
      const isSameProductName = Boolean(
        existingProduct && currentTargetProduct && (
          existingProduct === currentTargetProduct ||
          existingProduct.includes(currentTargetProduct) ||
          currentTargetProduct.includes(existingProduct)
        )
      );

      // 2. Cek kesamaan catalogId jika tersedia
      const isSameCatalogId = Boolean(
        existingCatalogId && currentCatalogId && (existingCatalogId === currentCatalogId)
      );

      return isSameProductName || isSameCatalogId;
    });

    if (hasDuplicateActiveProduct) {
      return {
        allowed: false,
        reason: `Username "${cleanUser}" masih memiliki pesanan aktif untuk "${packageName || itemGift || 'produk ini'}". Silakan tunggu pesanan selesai sebelum memesan item yang sama kembali.`
      };
    }

    // Jika beda produk, perbolehkan!
    return { allowed: true };
  } catch (error: any) {
    console.error("Gagal validasi order eligibility:", error);
    // Fallback: jangan halangi jika terjadi error jaringan tak terduga
    return { allowed: true };
  }
};

export const saveOrderWithRetry = async (
  dbRef: any,
  payload: any,
  options: any,
  maxAttempts: number = 3,
  timeoutMs: number = 10000
): Promise<void> => {
  const { setDoc } = await import("firebase/firestore");
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const promise = setDoc(dbRef, payload, options);
      
      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("FIRESTORE_TIMEOUT"));
        }, timeoutMs);
      });

      await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      
      // Success
      return;
    } catch (error: any) {
      if (attempt < maxAttempts) {
        const backoff = attempt === 1 ? 700 : 1500;
        console.warn(`Gagal menyimpan order (Attempt ${attempt}/${maxAttempts}). Retrying in ${backoff}ms... Error:`, error.message);
        await sleep(backoff);
      } else {
        console.error("Gagal total menyimpan order setelah retry:", error);
        
        // Persist to localStorage on total failure
        try {
          const guestId = payload.userUid || payload.customerId || 'GUEST';
          const localKey = `entong_pending_order_${guestId}`;
          localStorage.setItem(localKey, JSON.stringify({
            payload,
            failedAt: new Date().toISOString(),
            error: error.message
          }));
        } catch (e) {
          console.error("Gagal simpan lokal:", e);
        }
        
        throw new Error(
          error.message === "FIRESTORE_TIMEOUT"
            ? "Timeout koneksi Firestore saat menyimpan order. Simpan data sementara dan coba lagi."
            : `Gagal menyimpan order: ${error.message}`
        );
      }
    }
  }
};

