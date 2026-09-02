import { doc, updateDoc, addDoc, collection, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface SetOrderHangusParams {
  orderId: string;
  chatId: string;
  orderType?: "GIFT" | "JOKI" | string;
  customReason?: string;
}

export const executeSetOrderHangus = async ({
  orderId,
  chatId,
  orderType,
  customReason
}: SetOrderHangusParams) => {
  if (!orderId || !chatId) throw new Error("Order ID dan Chat ID wajib diisi.");

  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    const orderData = orderSnap.exists() ? orderSnap.data() : null;

    const isJoki = orderType === "JOKI" || 
                   orderData?.type === "JOKI" || 
                   orderData?.category === "JOKI" ||
                   String(orderData?.packageName || "").toLowerCase().includes("joki");

    let hangusMessage = "";
    if (isJoki) {
      hangusMessage = `❌ *PESANAN JOKI HANGUS (TIDAK ADA REFUND)*\n\nHalo kak, pesanan joki kamu dinyatakan *HANGUS* dan ditutup secara otomatis.\n\n📌 *Alasan:* ${customReason || "Tidak mematuhi rules yang berlaku / tidak ada respon saat proses login, logout, atau verifikasi kode keamanan akun."}\n\n⚠️ *Catatan:* Sesuai ketentuan dan syarat Entong Store, pesanan yang telah hangus *tidak dapat di-refund (dana/koin hangus)*.`;
    } else {
      hangusMessage = `❌ *PESANAN HANGUS (TIDAK ADA REFUND)*\n\nHalo kak, pesanan kamu dinyatakan *HANGUS* dan ditutup secara otomatis.\n\n📌 *Alasan:* ${customReason || "Tidak ada respon / konfirmasi sama sekali di website setelah admin siap memproses pesananmu."}\n\n⚠️ *Catatan:* Sesuai kebijakan Entong Store, pesanan yang dinyatakan hangus *tidak dapat di-refund*.`;
    }

    // 1. Update status order ke HANGUS
    if (orderSnap.exists()) {
      await updateDoc(orderRef, {
        status: "Hangus",
        orderStatus: "HANGUS",
        statusCode: "HANGUS",
        isForfeited: true,
        isRefundable: false,
        hangusReason: customReason || (isJoki ? "Pelanggaran rules / No response login" : "No response di website"),
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // 2. Kirim Pesan Otomatis ke Chat
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: hangusMessage,
      sender: "admin",
      senderRole: "RESMI",
      isHangusNotice: true,
      createdAt: serverTimestamp()
    });

    // 3. Update Status Room Chat
    await updateDoc(doc(db, "chats", chatId), {
      orderBadge: "HANGUS",
      status: "HANGUS",
      orderStatus: "HANGUS",
      statusCode: "HANGUS",
      isForfeited: true,
      isRefundable: false,
      lastMessage: "❌ Pesanan dinyatakan Hangus (No Refund).",
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Gagal menyetel status hangus:", error);
    throw error;
  }
};
