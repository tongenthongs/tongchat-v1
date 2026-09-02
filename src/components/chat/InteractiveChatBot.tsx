import React, { useState } from "react";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface InteractiveChatBotProps {
  chatId: string;
  customerName: string;
  robloxUsername?: string;
  onOpenProductModal?: (category: "GIFT" | "JOKI") => void; // Prop untuk memicu panel produk di halaman customer
}

type BotStep = 
  | "WELCOME" 
  | "NOT_YET_SERVICES" 
  | "CHOOSE_CATEGORY" 
  | "FILL_GIFT_FORM" 
  | "FILL_JOKI_FORM" 
  | "WAITING_FEEDBACK" 
  | "FINISHED";

export default function InteractiveChatBot({ chatId, customerName, robloxUsername, onOpenProductModal }: InteractiveChatBotProps) {
  const [step, setStep] = useState<BotStep>("WELCOME");
  const [formData, setFormData] = useState({
    username: robloxUsername || "",
    gamepass: "",
    password: "",
    uangTerakhir: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper kirim pesan bot / user ke subkoleksi messages Firestore
  const sendBubble = async (text: string, sender: "admin" | "customer" | "bot") => {
    if (!chatId) return;
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text,
        sender: sender === "bot" ? "admin" : sender,
        senderRole: sender === "bot" ? "RESMI" : (sender === "admin" ? "RESMI" : "PELANGGAN"),
        senderName: sender === "bot" ? "Bot Entong Store" : (sender === "admin" ? "Admin" : (customerName || "Customer")),
        isOfficialBot: sender === "bot",
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Gagal kirim bubble bot:", err);
    }
  };

  // Handler klik pilihan tombol interaktif
  const handleOptionClick = async (actionType: string) => {
    if (actionType === "BELUM_PERNAH") {
      await sendBubble("Belum pernah jajan di Entong Store", "customer");
      setStep("NOT_YET_SERVICES");
      await sendBubble("Sip, makasih ya udah pilih! ✨ Di Entong Store tersedia layanan utama. Silakan pilih di bawah untuk langsung membuka katalog produk:", "bot");
    } 
    else if (actionType === "SUDAH_PERNAH") {
      await sendBubble("Sudah pernah jajan di Entong Store", "customer");
      setStep("CHOOSE_CATEGORY");
      await sendBubble("Halo Kak! Pilih kategori pesanan yang mau dilaporkan atau diisi form-nya ya:", "bot");
    }
    else if (actionType === "NOT_YET_GIFT") {
      await sendBubble("Gift Ingame", "customer");
      await sendBubble("Mimin buka panel katalog Gift In Game buat kamu ya! Silakan pilih produknya di layar.", "bot");
      if (onOpenProductModal) onOpenProductModal("GIFT");
    }
    else if (actionType === "NOT_YET_JOKI") {
      await sendBubble("Joki Game", "customer");
      await sendBubble("Mimin buka panel katalog Joki Game buat kamu ya! Silakan pilih paketnya di layar.", "bot");
      if (onOpenProductModal) onOpenProductModal("JOKI");
    }
    else if (actionType === "CAT_GIFT") {
      await sendBubble("1. Gift In Game", "customer");
      setStep("FILL_GIFT_FORM");
      await sendBubble(`Silakan isi form Gift In Game berikut:\n\nForm Gamepass (wajib isi)\nUsername: \nGamepass:`, "bot");
    }
    else if (actionType === "CAT_JOKI") {
      await sendBubble("2. Joki", "customer");
      setStep("FILL_JOKI_FORM");
      await sendBubble(`Silakan isi form Joki berikut:\n\nForm Joki\nUsername:\nPassword: \nUang Terakhir: (uang terakhir di game kamu!)`, "bot");
    }
    else if (actionType === "FEEDBACK_SABAR") {
      await sendBubble("1. Oke min aku sabar nunggu", "customer");
      setStep("FINISHED");
      await sendBubble("Wihh terimakasih ya kak udah mau nunggu, nanti pasti di info lagi", "bot");
    }
    else if (actionType === "FEEDBACK_LAMA") {
      await sendBubble("2. Kok lama banget min!", "customer");
      setStep("FINISHED");
      await sendBubble("Maaf ya kak prosesnya lama, karena yang beli ada ratusan orang, bukan cuma kamu aja. Jadi di proses sesuai urutan order ya!", "bot");
    }
  };

  // Handler Submit Form Draft
  const handleFormSubmit = async (e: React.FormEvent, type: "GIFT" | "JOKI") => {
    e.preventDefault();
    setIsSubmitting(true);

    let summaryText = "";
    if (type === "GIFT") {
      summaryText = `[FORM GIFT IN GAME]\nUsername: ${formData.username}\nGamepass: ${formData.gamepass}`;
    } else {
      summaryText = `[FORM JOKI]\nUsername: ${formData.username}\nPassword: ${formData.password}\nUang Terakhir: ${formData.uangTerakhir}`;
    }

    await sendBubble(summaryText, "customer");
    await sendBubble(
      `*Pesanan kamu sudah mimin catat.*\nSilahkan menunggu di proses oleh admin yaa, jangan lupa nyalain fitur notif website agar bisa langsung proses nantinya!`, 
      "bot"
    );

    setStep("WAITING_FEEDBACK");
    setIsSubmitting(false);
  };

  return (
    <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
      {step === "WELCOME" && (
        <div className="space-y-2 mt-2">
          {/* Tombol 1: Sudah Jajan dari WA */}
          <button
            type="button"
            onClick={() => handleOptionClick("SUDAH_PERNAH")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-400 hover:text-cyan-300 text-xs font-bold transition-all text-left shadow-md active:scale-98 cursor-pointer"
          >
            <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-xs shrink-0">
              💬
            </span>
            <span>Sudah jajan dari WA</span>
          </button>

          {/* Tombol 2: Belum Pernah Jajan (Ikon Keranjang Belanja 🛒) */}
          <button
            type="button"
            onClick={() => handleOptionClick("BELUM_PERNAH")}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-400 hover:text-cyan-300 text-xs font-bold transition-all text-left shadow-md active:scale-98 cursor-pointer"
          >
            <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-xs shrink-0">
              🛒
            </span>
            <span>Belum pernah jajan di Entong Store</span>
          </button>
        </div>
      )}

      {/* CABANG 1: BELUM PERNAH (DIRECT TO PRODUCT MODAL) */}
      {step === "NOT_YET_SERVICES" && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-slate-400 font-medium">Pilih produk untuk membuka katalog:</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleOptionClick("NOT_YET_GIFT")}
              className="flex-1 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold text-xs hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              🎁 Buka Gift Ingame
            </button>
            <button
              onClick={() => handleOptionClick("NOT_YET_JOKI")}
              className="flex-1 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold text-xs hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              ⚡ Buka Joki Game
            </button>
          </div>
        </div>
      )}

      {step === "CHOOSE_CATEGORY" && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-slate-400 font-medium">Pilih Kategori Pesanan:</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleOptionClick("CAT_GIFT")}
              className="flex-1 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold text-xs hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              1. Gift In Game
            </button>
            <button
              onClick={() => handleOptionClick("CAT_JOKI")}
              className="flex-1 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold text-xs hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              2. Joki
            </button>
          </div>
        </div>
      )}

      {step === "FILL_GIFT_FORM" && (
        <form onSubmit={(e) => handleFormSubmit(e, "GIFT")} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2.5">
          <div className="text-xs font-bold text-cyan-400">Form Gamepass (Wajib Isi)</div>
          <div>
            <label className="text-[10px] text-slate-400">Username:</label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Contoh: MamadV2123"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Gamepass:</label>
            <input
              type="text"
              required
              value={formData.gamepass}
              onChange={(e) => setFormData({ ...formData, gamepass: e.target.value })}
              placeholder="Nama / Link Gamepass"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            {isSubmitting ? "Mengirim..." : "Kirim Form Gift"}
          </button>
        </form>
      )}

      {step === "FILL_JOKI_FORM" && (
        <form onSubmit={(e) => handleFormSubmit(e, "JOKI")} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2.5">
          <div className="text-xs font-bold text-purple-400">Form Joki</div>
          <div>
            <label className="text-[10px] text-slate-400">Username:</label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Username Roblox"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Password:</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Password akun"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">Uang Terakhir: (uang terakhir di game kamu!)</label>
            <input
              type="text"
              required
              value={formData.uangTerakhir}
              onChange={(e) => setFormData({ ...formData, uangTerakhir: e.target.value })}
              placeholder="Contoh: 500.000 cash"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            {isSubmitting ? "Mengirim..." : "Kirim Form Joki"}
          </button>
        </form>
      )}

      {step === "WAITING_FEEDBACK" && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-slate-400 font-medium">Bagaimana perasaanmu sekarang?</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleOptionClick("FEEDBACK_SABAR")}
              className="flex-1 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-xs hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              1. Oke min aku sabar nunggu
            </button>
            <button
              onClick={() => handleOptionClick("FEEDBACK_LAMA")}
              className="flex-1 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold text-xs hover:bg-rose-500/20 transition-all cursor-pointer"
            >
              2. Kok lama banget min!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { InteractiveChatBot };
