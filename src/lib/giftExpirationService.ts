import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, extractTimeMs } from './firebase';
import { isJunkBotOrder } from './orderRefund';

export interface ExpirationWarningResult {
  success: boolean;
  message: string;
  orderId?: string;
}

// In-Memory Lock untuk mencegah pengiriman berulang / spam loop dalam satu session
const processedOrdersInMemory = new Set<string>();

/**
 * Format string pesan peringatan terakhir expired same-day
 */
export function buildExpiredWarningText(order: any): { displayId: string; gameName: string; itemName: string; text: string } {
  const rawOrderId = order?.orderId || order?.id || 'ORDER';
  const cleanId = String(rawOrderId).replace(/^#/, '').replace(/^room_/, '').slice(-6).toUpperCase();
  const displayId = order?.orderId ? String(order.orderId).replace(/^#/, '') : cleanId;
  const gameName = order?.game_name || order?.game || order?.product_name || 'Roblox';
  const rawItem = order?.package_name || order?.item_name || order?.packageName || 'Gift In-Game';
  const itemTitle = (gameName && !rawItem.toLowerCase().includes(gameName.toLowerCase())) ? `${gameName} - ${rawItem}` : rawItem;

  const text = `🚨 PERINGATAN TERAKHIR - BATAS WAKTU HARI INI

Halo Kak, ini adalah PERINGATAN TERAKHIR untuk pesanan Gift In-Game Anda.

⚠️ PENTING: Mohon segera join ke private server / admin HARI INI JUGA. Jika sampai hari ini Kakak tidak join/klaim, maka pesanan dianggap HANGUS / EXPIRED, dana tidak dapat dikembalikan, dan pesanan tidak dapat diproses lagi.

📋 ID Order: #${displayId}
🎁 Item Gift: ${itemTitle}
⏰ Status: Menunggu Konfirmasi Join Pelanggan`;

  return { displayId, gameName, itemName: itemTitle, text };
}

/**
 * Mengirimkan pesan peringatan batas waktu (expired warning) ke room chat customer
 * dan menandai flag expiredWarningSent: true pada dokumen order di Firestore.
 */
export async function sendExpiredWarningMessage(
  order: any, 
  isAuto: boolean = false,
  allChats?: any[]
): Promise<ExpirationWarningResult> {
  if (!order) {
    return { success: false, message: 'Data pesanan tidak ditemukan.' };
  }

  const orderDocId = String(order.docUniqueId || order.firestoreId || order.id || '');
  if (!orderDocId) {
    return { success: false, message: 'ID Dokumen pesanan tidak valid.' };
  }

  // Wajib pasang guard sebelum kirim:
  // if (order.expiredWarningSent || order.category !== 'Gift In Game' || order.status === 'Selesai' || order.status === 'Cancel') return;
  const statusStr = (order.status || order.orderStatus || '').toString().toLowerCase();
  if (
    order.expiredWarningSent === true || 
    statusStr === 'selesai' || 
    statusStr === 'batal' || 
    statusStr === 'cancel' || 
    statusStr === 'batal_tolak' ||
    isJunkBotOrder(order)
  ) {
    return { success: false, message: 'Pesanan tidak memenuhi syarat pengiriman peringatan (sudah dikirim / sudah selesai / dibatalkan).' };
  }

  // Cek in-memory lock
  if (processedOrdersInMemory.has(orderDocId)) {
    return { success: false, message: 'Peringatan untuk pesanan ini sudah diproses.' };
  }
  processedOrdersInMemory.add(orderDocId);

  const { displayId, gameName, itemName, text } = buildExpiredWarningText(order);

  // Cari roomId yang tepat
  let targetRoomId = orderDocId;
  if (allChats && allChats.length > 0) {
    const existingChat = allChats.find(c => 
      c.id === orderDocId || 
      c.order_id === orderDocId || 
      c.customer_id === order.customer_id || 
      c.customerId === order.customer_id ||
      c.id === `room_${order.customer_id}` ||
      c.id === `room_${orderDocId}` ||
      c.id === String(orderDocId).replace(/^room_/, '')
    );
    if (existingChat && existingChat.id) {
      targetRoomId = existingChat.id;
    }
  }

  // Fallback room ID format
  if (!targetRoomId.startsWith('room_') && order.customer_id) {
    targetRoomId = `room_${order.customer_id}`;
  }

  try {
    const nowIso = new Date().toISOString();

    // 1. Kunci flag expiredWarningSent pada order di Firestore secara langsung
    await setDoc(doc(db, 'orders', orderDocId), {
      expiredWarningSent: true,
      expiredWarningDate: nowIso,
      expiredWarningTimestamp: Date.now(),
      updatedAt: nowIso
    }, { merge: true });

    // 2. Simpan pesan peringatan ke subkoleksi messages: chats/${targetRoomId}/messages
    const msgsRef = collection(db, 'chats', targetRoomId, 'messages');
    await addDoc(msgsRef, {
      text: text,
      message: text,
      sender: 'system',
      senderId: 'system',
      senderType: 'system',
      senderRole: 'system',
      sender_role: 'system',
      senderName: 'Sistem Entong Store',
      sender_name: 'Sistem Entong Store',
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(),
      isSystem: true,
      type: 'system_warning',
      orderId: order.orderId || displayId,
      gameName,
      itemName,
      isAutoDispatched: isAuto
    });

    // 3. Update metadata dokumen chat parent agar chat langsung aktif di kedua sisi (admin & customer)
    try {
      await setDoc(doc(db, 'chats', targetRoomId), {
        lastMessage: text,
        last_message: text,
        lastMessageTime: serverTimestamp(),
        last_message_time: serverTimestamp(),
        updatedAt: nowIso,
        updated: nowIso
      }, { merge: true });
    } catch (chatDocErr) {
      console.warn("Parent chat update warning:", chatDocErr);
    }

    console.log(`[ExpiredWarning] Berhasil mengirim peringatan ${isAuto ? '(AUTO)' : '(MANUAL)'} untuk Order #${displayId}`);
    return { 
      success: true, 
      message: 'Pesan peringatan terakhir berhasil dikirim ke customer.',
      orderId: displayId 
    };
  } catch (err: any) {
    console.error(`[ExpiredWarning] Gagal mengirim pesan peringatan:`, err);
    // Hapus dari lock jika gagal agar bisa diulang
    processedOrdersInMemory.delete(orderDocId);
    return { 
      success: false, 
      message: err?.message || 'Gagal mengirim pesan peringatan.' 
    };
  }
}

/**
 * Cek apakah order memenuhi syarat auto-dispatch peringatan 2 hari (48 jam)
 */
export function isEligibleForAuto2DayWarning(order: any): boolean {
  if (!order || isJunkBotOrder(order)) return false;

  const docId = String(order.docUniqueId || order.firestoreId || order.id || '');
  if (docId && processedOrdersInMemory.has(docId)) return false;

  // 1. Kategori: Bukan Joki / Joko / Leveling dan Bukan TopUp TC (harus Gift In-Game)
  const categoryStr = (order.category || order.service_type || order.game_name || order.game || '').toLowerCase();
  const pkgStr = (order.package_name || order.item_name || order.product_name || '').toLowerCase();
  
  const isJoki = categoryStr.includes('joki') || categoryStr.includes('joko') || categoryStr.includes('leveling') ||
                 pkgStr.includes('joki') || pkgStr.includes('joko') || pkgStr.includes('leveling');
  if (isJoki) return false;

  const isTopUpTc = categoryStr.includes('topup_tc') || categoryStr.includes('tongcoin') || categoryStr.includes('tc');
  if (isTopUpTc) return false;

  // 2. Status: Belum Selesai (Booking / Diorder / PROSES_WORKER / NEW / dll)
  const statusStr = (order.status || order.orderStatus || '').toString().toLowerCase();
  const isFinished = statusStr === 'selesai' || statusStr === 'batal' || statusStr === 'cancel' || statusStr === 'batal_tolak';
  if (isFinished) return false;

  // 3. Flag: Belum pernah dikirim peringatan
  if (order.expiredWarningSent === true) return false;

  // 4. Usia: Sudah >= 2 Hari (48 Jam = 172.800.000 ms)
  const timeMs = extractTimeMs(order) || 
                 (order.createdAt ? new Date(order.createdAt).getTime() : 0) || 
                 (order.orderDate ? new Date(order.orderDate).getTime() : 0) || 
                 (order.created ? new Date(order.created).getTime() : 0);

  if (!timeMs || isNaN(timeMs)) return false;

  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 jam
  const ageMs = Date.now() - timeMs;

  return ageMs >= TWO_DAYS_MS;
}

/**
 * Memeriksa seluruh daftar pesanan dan mengirimkan peringatan otomatis untuk pesanan yang melewati 2 hari
 */
export async function checkAndDispatchAuto2DayWarnings(
  orders: any[], 
  allChats?: any[]
): Promise<{ dispatchedCount: number }> {
  if (!orders || orders.length === 0) return { dispatchedCount: 0 };

  let count = 0;
  for (const ord of orders) {
    if (isEligibleForAuto2DayWarning(ord)) {
      try {
        const res = await sendExpiredWarningMessage(ord, true, allChats);
        if (res.success) {
          count++;
        }
      } catch (e) {
        console.error("Auto dispatch warning error for order:", ord?.id, e);
      }
    }
  }

  return { dispatchedCount: count };
}

