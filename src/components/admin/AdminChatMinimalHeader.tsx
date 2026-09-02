import React, { useState, useRef, useEffect, useMemo } from "react";
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { syncOrderStatusEverywhere } from "../../services/adminStatusSyncService";
import { ChevronLeft, Info, Receipt, AlertTriangle, FileText, Star, Trash2, Settings } from "lucide-react";

export interface AdminChatHeaderProps {
  selectedChat: any;
  onOpenBuktiTF?: (chat: any) => void;
  onToggleShowInfo?: (chat: any) => void;
  onStatusChange?: (status: string) => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function AdminChatInlineHeader({
  selectedChat,
  onOpenBuktiTF,
  onToggleShowInfo,
  onStatusChange,
  showBackButton = false,
  onBack
}: AdminChatHeaderProps) {
  const [isActionOpen, setIsActionOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // 1. Sanitasi Username Roblox
  const cleanRobloxUser = String(
    selectedChat?.robloxUsername || selectedChat?.username || ""
  ).replace(/^@+/, "").trim();

  // 2. Detail Item Pesanan Singkat
  const formattedItem = useMemo(() => {
    if (Array.isArray(selectedChat?.items) && selectedChat.items.length > 0) {
      return selectedChat.items.map((i: any) => i.name || i.title || i).join(", ");
    }
    return String(
      selectedChat?.packageName || 
      selectedChat?.itemGift || 
      selectedChat?.lastOrderedItem || 
      selectedChat?.gamepassInfo ||
      selectedChat?.package_name ||
      "Orderan"
    ).trim();
  }, [selectedChat]);

  const isMultiItem = formattedItem.includes(",") || formattedItem.length > 20;

  // 3. Status Order Badge
  const currentStatus = (
    selectedChat?.orderBadge || 
    selectedChat?.status || 
    selectedChat?.orderStatus || 
    "BOOKING"
  ).toUpperCase();

  // Tutup dropdown saat klik luar
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsActionOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSelectStatus = async (newStatus: string) => {
    if (!selectedChat?.id) return;

    if (newStatus === "HANGUS") {
      const confirmHangus = window.confirm(
        `⚠️ Peringatan: Status HANGUS akan menutup pesanan tanpa refund dan mengirim pesan rincian hangus ke customer.\n\nLanjutkan?`
      );
      if (!confirmHangus) return;

      try {
        await syncOrderStatusEverywhere(selectedChat, "HANGUS");
        if (onStatusChange) onStatusChange("HANGUS");
      } catch (err: any) {
        alert("Gagal set hangus: " + (err?.message || err));
      }
      return;
    }

    try {
      await syncOrderStatusEverywhere(selectedChat, newStatus);
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err: any) {
      console.error("Gagal update status chat & order:", err);
      alert("Gagal sinkronisasi status: " + (err?.message || err));
    }
  };

  const sendQuickChat = async (text: string) => {
    if (!selectedChat?.id) return;
    setIsActionOpen(false);
    try {
      await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
        text,
        sender: "admin",
        senderRole: "RESMI",
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "chats", selectedChat.id), {
        lastMessage: text.slice(0, 80),
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Gagal kirim pesan cepat:", err);
    }
  };

  return (
    <div className="h-16 px-5 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between gap-3 shrink-0 relative z-30 select-none">
      
      {/* SISI KIRI: SEMUA ELEMEN SEJAJAR 1 BARIS */}
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        {showBackButton && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] rounded-xl text-xs shrink-0 border border-[#3f3f46] flex items-center justify-center md:hidden cursor-pointer"
            title="Kembali ke Daftar Chat"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Avatar Bulat */}
        <div className="w-9 h-9 rounded-full bg-[#27272a] border border-[#3f3f46] text-white flex items-center justify-center font-bold text-xs shrink-0">
          {(() => {
            const raw = selectedChat?.customerName || selectedChat?.customer_name || cleanRobloxUser || "Pelanggan";
            return (typeof raw === 'string' && raw.trim().length > 0) ? raw.trim().charAt(0).toUpperCase() : 'P';
          })()}
        </div>

        {/* Nama Customer */}
        <span className="font-bold text-[#f4f4f5] text-xs md:text-sm shrink-0 truncate max-w-[130px] md:max-w-[170px]">
          {selectedChat?.customerName || selectedChat?.customer_name || "Customer"}
        </span>

        {/* Username Roblox Badge */}
        {cleanRobloxUser && (
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold flex items-center gap-1 shrink-0">
            <span>🎮</span> @{cleanRobloxUser}
          </span>
        )}

        {/* Status Pembayaran / Verifikasi Badge */}
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
          currentStatus === "HANGUS"
            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
            : currentStatus === "SELESAI"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            : currentStatus === "DIORDER" || currentStatus === "READY"
            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
            : currentStatus === "PROSES" || currentStatus === "PROSES WORKER"
            ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
        }`}>
          {currentStatus}
        </span>

        {/* Item Orderan Singkat */}
        <div className="max-w-[180px] md:max-w-[240px] overflow-hidden bg-[#121214] border border-[#27272a] px-3 py-1 rounded-full flex items-center gap-1.5 shrink-0 hidden sm:flex">
          <span className="text-[10px] shrink-0">📦</span>
          {isMultiItem ? (
            <div className="overflow-hidden whitespace-nowrap relative w-full">
              <div className="inline-block text-[10px] font-medium text-[#f4f4f5] truncate">
                {formattedItem}
              </div>
            </div>
          ) : (
            <span className="text-[10px] font-medium text-[#f4f4f5] truncate">{formattedItem}</span>
          )}
        </div>
      </div>

      {/* SISI KANAN: SELECTOR STATUS & DROPDOWN TINDAKAN */}
      <div className="flex items-center gap-2 shrink-0 relative" ref={dropdownRef}>
        <select
          value={currentStatus}
          onChange={(e) => handleSelectStatus(e.target.value)}
          className="bg-[#27272a] border border-[#3f3f46] hover:border-[#52525b] text-[#f4f4f5] font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer shadow-sm transition-colors"
        >
          <option value="BOOKING">⏳ BOOKING</option>
          <option value="READY">⚡ READY</option>
          <option value="PROSES">🔄 PROSES</option>
          <option value="SELESAI">✅ SELESAI</option>
          <option value="HANGUS">❌ HANGUS</option>
        </select>

        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsActionOpen(!isActionOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-sm ${
            isActionOpen
              ? "bg-blue-600 text-white border-blue-500"
              : "bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] border-[#3f3f46]"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Tindakan</span>
          <span className={`text-[8px] transition-transform ${isActionOpen ? "rotate-180" : ""}`}>▼</span>
        </button>

        {/* Popover Menu Dropdown */}
        {isActionOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl p-1.5 space-y-1 z-50">
            <button
              onClick={() => { setIsActionOpen(false); if (onOpenBuktiTF) onOpenBuktiTF(selectedChat); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#f4f4f5] hover:bg-[#27272a] hover:text-emerald-400 text-left cursor-pointer transition-colors"
            >
              <Receipt className="w-4 h-4 text-emerald-400" /> Lihat Bukti TF
            </button>
            <button
              onClick={() => sendQuickChat("⚠️ PERINGATAN: Mohon segera konfirmasi pesanan/data akun kamu agar orderan tidak hangus.")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-amber-400 hover:bg-amber-500/10 text-left cursor-pointer transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Peringatan Terakhir
            </button>
            <button
              onClick={() => sendQuickChat("Silakan lengkapi data joki ya kak:\nUsername:\nPassword:\nUang Terakhir:")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-blue-400 hover:bg-blue-500/10 text-left cursor-pointer transition-colors"
            >
              <FileText className="w-4 h-4 text-blue-400" /> Minta Kredensial Joki
            </button>
            <button
              onClick={() => sendQuickChat("Pesanan kamu sudah selesai ya! Jangan lupa tinggalkan ulasan bintang 5 di website kami ⭐")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-yellow-400 hover:bg-yellow-500/10 text-left cursor-pointer transition-colors"
            >
              <Star className="w-4 h-4 text-yellow-400" /> Minta Ulasan
            </button>
            <button
              onClick={() => { setIsActionOpen(false); if (onToggleShowInfo) onToggleShowInfo(selectedChat); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-sky-400 hover:bg-sky-500/10 text-left cursor-pointer transition-colors"
            >
              <Info className="w-4 h-4 text-sky-400" /> Info Lengkap Panel
            </button>
            <div className="border-t border-[#27272a] my-1" />
            <button
              onClick={async () => {
                setIsActionOpen(false);
                if (!selectedChat?.id) return;
                if (window.confirm("Hapus percakapan ini?")) {
                  await deleteDoc(doc(db, "chats", selectedChat.id));
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 text-left cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-400" /> Hapus Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
