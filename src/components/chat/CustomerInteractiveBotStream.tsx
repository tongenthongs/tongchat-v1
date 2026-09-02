import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { dispatchCatalogActionBubble } from "../../services/botWelcomeService";
import StrictOrderValidatedForm from "./StrictOrderValidatedForm";

interface Props {
  chatId: string;
  customerName: string;
  robloxUsername?: string;
  onOpenProductModal?: (category: "GIFT" | "JOKI") => void;
}

export default function CustomerInteractiveBotStream({
  chatId,
  customerName,
  robloxUsername,
  onOpenProductModal
}: Props) {
  const [canShowBot, setCanShowBot] = useState<boolean>(false);
  const [step, setStep] = useState<string>("WELCOME");

  // 1. SVG Ikon WhatsApp
  const WhatsAppIcon = () => (
    <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 flex items-center justify-center shrink-0 shadow-md">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.12 3.65.58.25 1.02.4 1.38.52.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28s-1.44-.71-1.66-.82-.39-.16-.55.16-.64.82-.78.98-.29.18-.53.06c-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.01-.37.11-.49.11-.11.24-.29.36-.43.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.41-.41-.56-.42h-.48z"/>
      </svg>
    </div>
  );

  // 2. SVG Ikon Bot
  const BotAvatarIcon = () => (
    <div className="w-8 h-8 rounded-full bg-slate-900 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0 shadow-md">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5" />
      </svg>
    </div>
  );

  // 3. ATURAN LIFECYCLE CHAT BOT (1x Per Siklus Order, Reset saat Selesai/Cancel)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setCanShowBot(true);
      return;
    }

    // Ambil status pesanan aktif user
    const ordersQuery = query(collection(db, "orders"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      if (snapshot.empty) {
        // Belum pernah punya order -> Tampilkan bot
        setCanShowBot(true);
      } else {
        // Cek apakah ada pesanan yang MASIH BERJALAN (Booking / Diorder / Proses)
        const hasActivePendingOrder = snapshot.docs.some((docSnap) => {
          const rawSt = (docSnap.data().status || docSnap.data().orderStatus || '').toLowerCase();
          return !['selesai', 'hangus', 'batal', 'dibatalkan'].includes(rawSt);
        });

        // Jika semua orderan sudah SELESAI atau CANCEL, bot diizinkan muncul lagi untuk order baru
        setCanShowBot(!hasActivePendingOrder);
      }
    });

    return () => unsubscribe();
  }, [chatId]);

  // Helper kirim pesan chat customer
  const sendCustomerMessage = async (text: string) => {
    if (!chatId) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      message: text,
      sender: "customer",
      senderRole: "PELANGGAN",
      sender_role: "CUSTOMER",
      senderName: customerName || "Customer",
      sender_name: customerName || "Customer",
      createdAt: serverTimestamp(),
      createdAtMillis: Date.now()
    });
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: text,
      last_message: text,
      lastSender: "customer",
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const handleAction = async (action: string) => {
    if (action === "BELUM_PERNAH") {
      await sendCustomerMessage("Belum pernah jajan di Entong Store");
      setStep("NOT_YET_SERVICES");
      
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "Sip, makasih ya udah pilih! ✨ Di Entong Store tersedia layanan utama. Silakan pilih di bawah untuk membuka katalog produk:",
        message: "Sip, makasih ya udah pilih! ✨ Di Entong Store tersedia layanan utama. Silakan pilih di bawah untuk membuka katalog produk:",
        sender: "admin",
        senderRole: "RESMI",
        sender_role: "ADMIN",
        senderName: "Bot Entong Store",
        sender_name: "Bot Entong Store",
        isOfficialBot: true,
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now()
      });
    } 
    else if (action === "SUDAH_DARI_WA") {
      await sendCustomerMessage("Sudah jajan dari WA");
      setStep("CHOOSE_CATEGORY");
      
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "Halo Kak! Pilih kategori pesanan WA yang mau dilaporkan atau diisi form-nya ya:",
        message: "Halo Kak! Pilih kategori pesanan WA yang mau dilaporkan atau diisi form-nya ya:",
        sender: "admin",
        senderRole: "RESMI",
        sender_role: "ADMIN",
        senderName: "Bot Entong Store",
        sender_name: "Bot Entong Store",
        isOfficialBot: true,
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now()
      });
    }
    else if (action === "NOT_YET_GIFT") {
      await sendCustomerMessage("Gift Ingame");
      setStep("FINISHED");
      await dispatchCatalogActionBubble(chatId, "GIFT");
      if (onOpenProductModal) onOpenProductModal("GIFT");
    }
    else if (action === "NOT_YET_JOKI") {
      await sendCustomerMessage("Joki Game");
      setStep("FINISHED");
      await dispatchCatalogActionBubble(chatId, "JOKI");
      if (onOpenProductModal) onOpenProductModal("JOKI");
    }
    else if (action === "FEEDBACK_SABAR") {
      await sendCustomerMessage("1. Oke min aku sabar nunggu");
      setStep("FINISHED");
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "Wihh terimakasih ya kak udah mau nunggu, nanti pasti di info lagi",
        message: "Wihh terimakasih ya kak udah mau nunggu, nanti pasti di info lagi",
        sender: "admin",
        senderRole: "RESMI",
        sender_role: "ADMIN",
        senderName: "Bot Entong Store",
        sender_name: "Bot Entong Store",
        isOfficialBot: true,
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now()
      });
    }
    else if (action === "FEEDBACK_LAMA") {
      await sendCustomerMessage("2. Kok lama banget min!");
      setStep("FINISHED");
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "Maaf ya kak prosesnya lama, karena yang beli ada ratusan orang, bukan cuma kamu aja. Jadi di proses sesuai urutan order ya!",
        message: "Maaf ya kak prosesnya lama, karena yang beli ada ratusan orang, bukan cuma kamu aja. Jadi di proses sesuai urutan order ya!",
        sender: "admin",
        senderRole: "RESMI",
        sender_role: "ADMIN",
        senderName: "Bot Entong Store",
        sender_name: "Bot Entong Store",
        isOfficialBot: true,
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now()
      });
    }
  };

  // Jangan render jika sedang ada orderan aktif yang belum selesai atau step sudah FINISHED
  if (!canShowBot || step === "FINISHED") {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-1.5 my-1.5 select-none">
      {/* 1. OPSI SAMBUTAN AWAL (Kini ditangani eksklusif oleh BotWelcomeOptions) */}
      {step === "WELCOME" && null}

      {/* 2. CABANG BELUM PERNAH (KATALOG) */}
      {step === "NOT_YET_SERVICES" && (
        <div className="flex flex-col gap-1.5 max-w-[260px]">
          <div className="flex items-center gap-2">
            <BotAvatarIcon />
            <button
              onClick={() => handleAction("NOT_YET_GIFT")}
              className="bg-slate-900/95 hover:bg-slate-800 text-sky-400 font-bold text-[10.5px] px-3 py-1.5 rounded-full border border-sky-500/40 shadow-sm transition-all active:scale-95 text-left cursor-pointer"
            >
              🎁 Gift Ingame
            </button>
          </div>
          <div className="flex items-center gap-2">
            <BotAvatarIcon />
            <button
              onClick={() => handleAction("NOT_YET_JOKI")}
              className="bg-slate-900/95 hover:bg-slate-800 text-cyan-400 font-bold text-[10.5px] px-3 py-1.5 rounded-full border border-cyan-500/40 shadow-sm transition-all active:scale-95 text-left cursor-pointer"
            >
              ⚡ Joki Game
            </button>
          </div>
        </div>
      )}

      {/* 3. CABANG SUDAH JAJAN DARI WA (PILIH FORM GIFT / JOKI) */}
      {step === "CHOOSE_CATEGORY" && (
        <div className="flex flex-col items-start gap-1.5 mt-1.5 max-w-[260px]">
          <button
            type="button"
            onClick={() => setStep("FILL_GIFT_FORM")}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 hover:bg-slate-800/90 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-[10.5px] font-bold transition-all text-left shadow-sm active:scale-95 cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-[9px] shrink-0">
              🎁
            </span>
            <span className="truncate">1. Form Gift In Game (WA)</span>
          </button>

          <button
            type="button"
            onClick={() => setStep("FILL_JOKI_FORM")}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 hover:bg-slate-800/90 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-[10.5px] font-bold transition-all text-left shadow-sm active:scale-95 cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-[9px] shrink-0">
              ⚡
            </span>
            <span className="truncate">2. Form Joki (WA)</span>
          </button>
        </div>
      )}

      {/* 4. FORM BUBBLE GIFT DENGAN VALIDASI STRICT ZERO BYPASS */}
      {step === "FILL_GIFT_FORM" && (
        <StrictOrderValidatedForm
          chatId={chatId}
          formType="GIFT"
          onOpenProductModal={onOpenProductModal}
          onSuccessSubmitted={() => setStep("WAITING_FEEDBACK")}
        />
      )}

      {/* 5. FORM BUBBLE JOKI DENGAN VALIDASI STRICT ZERO BYPASS */}
      {step === "FILL_JOKI_FORM" && (
        <StrictOrderValidatedForm
          chatId={chatId}
          formType="JOKI"
          onOpenProductModal={onOpenProductModal}
          onSuccessSubmitted={() => setStep("WAITING_FEEDBACK")}
        />
      )}

      {/* 6. OPSI FEEDBACK SETELAH FORM SUBMIT */}
      {step === "WAITING_FEEDBACK" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <BotAvatarIcon />
            <button
              onClick={() => handleAction("FEEDBACK_SABAR")}
              className="bg-slate-900/90 hover:bg-slate-800 text-sky-400 font-medium text-xs md:text-sm px-4 py-2.5 rounded-full border border-sky-500/30 shadow-sm transition-all hover:scale-[1.02] active:scale-95 text-left flex items-center gap-2 cursor-pointer"
            >
              1. Oke min aku sabar nunggu
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <BotAvatarIcon />
            <button
              onClick={() => handleAction("FEEDBACK_LAMA")}
              className="bg-slate-900/90 hover:bg-slate-800 text-cyan-400 font-medium text-xs md:text-sm px-4 py-2.5 rounded-full border border-cyan-500/30 shadow-sm transition-all hover:scale-[1.02] active:scale-95 text-left flex items-center gap-2 cursor-pointer"
            >
              2. Kok lama banget min!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CustomerInteractiveBotStream };
