import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { sendCustomerBubble, sendBotBubble } from "../../services/botChatService";

interface BotWelcomeOptionsProps {
  chatId: string;
  customerName?: string;
  customerUid?: string;
  currentUser?: any;
  orderStatus?: string;
  hasActiveOrder?: boolean;
  messages?: any[];
  onNavigateCatalog?: (cat: string) => void;
}

export default function BotWelcomeOptions({
  chatId,
  customerName = "Kak",
  customerUid,
  currentUser,
  orderStatus,
  hasActiveOrder,
  messages = [],
  onNavigateCatalog
}: BotWelcomeOptionsProps) {
  const [shouldShow, setShouldShow] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    // 1. Anti-spam 24 jam via localStorage
    const lastShown = localStorage.getItem(`bot_shown_${chatId}`);
    if (lastShown && Date.now() - Number(lastShown) < 86400000) {
      setShouldShow(false);
      return;
    }

    // 2. Jika ada order aktif yang sedang berjalan, sembunyikan opsi sambutan
    if (hasActiveOrder) {
      setShouldShow(false);
      return;
    }

    // 3. Periksa riwayat chat messages: jika customer sudah pernah chat atau merespons setelah pesan bot, sembunyikan
    if (Array.isArray(messages) && messages.length > 0) {
      const hasCustomerMsg = messages.some(
        (m: any) => m.sender === "customer" || m.sender_role === "CUSTOMER" || m.senderRole === "PELANGGAN"
      );
      if (hasCustomerMsg) {
        setShouldShow(false);
        return;
      }
    }

    // 4. Query Firestore untuk memeriksa apakah ada order aktif di server
    const checkOrders = async () => {
      if (!chatId && !customerUid) return;
      try {
        const snap = await getDocs(
          query(
            collection(db, "orders"),
            where("customerId", "==", customerUid || chatId),
            where("status", "in", ["BOOKING", "READY", "DIORDER", "PROSES", "DIPROSES", "LOGUL"])
          )
        );
        if (!snap.empty) {
          setShouldShow(false);
        }
      } catch (e) {}
    };
    checkOrders();
  }, [chatId, customerUid, hasActiveOrder, messages]);

  if (!shouldShow) return null;

  const handleBotOption = async (option: string) => {
    if (isProcessing || !chatId) return;
    setIsProcessing(true);
    setShouldShow(false);
    localStorage.setItem(`bot_shown_${chatId}`, Date.now().toString());

    try {
      if (option === 'Sudah jajan dari WA') {
        await sendCustomerBubble(chatId, 'Sudah jajan dari WA', currentUser);
        await sendBotBubble(
          chatId,
          'Halo Kak! Pilih kategori pesanan yang mau dilaporkan atau diisi form-nya ya:',
          'CHOOSE_CATEGORY'
        );
      } else if (option === 'Belum pernah jajan di Entong Store') {
        await sendCustomerBubble(chatId, 'Belum pernah jajan di Entong Store', currentUser);
        await sendBotBubble(
          chatId,
          'Sip, makasih ya udah pilih! ✨ Di Entong Store tersedia layanan utama. Silakan pilih di bawah untuk membuka katalog produk:',
          'NOT_YET_SERVICES'
        );
      } else if (option === 'Mau tanya-tanya ke Admin') {
        await sendCustomerBubble(chatId, 'Mau tanya-tanya ke Admin', currentUser);
        await sendBotBubble(
          chatId,
          'Halo kak! Silakan tulis pertanyaan atau keperluan kamu di kolom chat ya, Admin kami akan segera membalas 😊',
          'NONE'
        );
      }
    } catch (e) {
      console.warn("Gagal memproses opsi bot:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 mt-2 max-w-[320px] w-full select-none mb-3">
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => handleBotOption('Sudah jajan dari WA')}
        className="bg-[#161b22] hover:bg-[#202c33] border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-200 transition shadow-sm cursor-pointer disabled:opacity-50"
      >
        <span className="flex items-center gap-2 truncate">
          <span>💬</span>
          <span className="truncate">Sudah jajan dari WA</span>
        </span>
        <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-2">Pilih →</span>
      </button>
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => handleBotOption('Belum pernah jajan di Entong Store')}
        className="bg-[#161b22] hover:bg-[#202c33] border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-200 transition shadow-sm cursor-pointer disabled:opacity-50"
      >
        <span className="flex items-center gap-2 truncate">
          <span>🛒</span>
          <span className="truncate">Belum pernah jajan di Entong Store</span>
        </span>
        <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-2">Pilih →</span>
      </button>
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => handleBotOption('Mau tanya-tanya ke Admin')}
        className="bg-[#161b22] hover:bg-[#202c33] border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-200 transition shadow-sm cursor-pointer disabled:opacity-50"
      >
        <span className="flex items-center gap-2 truncate">
          <span>🙋</span>
          <span className="truncate">Mau tanya-tanya ke Admin</span>
        </span>
        <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-2">Pilih →</span>
      </button>
    </div>
  );
}

export { BotWelcomeOptions };
