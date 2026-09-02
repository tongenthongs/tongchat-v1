import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  limitToLast, 
  endBefore, 
  getDocs, 
  onSnapshot 
} from "firebase/firestore";
import { db } from "../../lib/firebase";

interface Props {
  chatId: string;
  adminMode?: boolean;
}

// Komponen Balon Pesan dengan React.memo (Mencegah Re-render Balon Lama)
const MemoizedBubble = React.memo(({ msg, isAdminView }: { msg: any; isAdminView: boolean }) => {
  const isMe = isAdminView 
    ? (msg.sender === "admin" || msg.senderRole === "RESMI")
    : (msg.sender === "customer" || msg.senderRole === "PELANGGAN");

  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} my-1.5 px-2`}>
      <div
        className={`max-w-[85%] md:max-w-md rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
          isMe
            ? "bg-emerald-600 text-white rounded-br-none"
            : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed select-text">{msg.text}</p>
        <span className={`text-[9px] block text-right mt-1 font-mono ${isMe ? "text-emerald-100/70" : "opacity-60"}`}>
          {msg.timeStr || (msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "")}
        </span>
      </div>
    </div>
  );
});

export default function LazyMessageStream({ chatId, adminMode = false }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState<any | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isFirstLoadRef = useRef<boolean>(true);
  const prevScrollHeightRef = useRef<number>(0);

  // 1. STREAM 15 PESAN TERBARU SAJA (TIDAK LOAD SEMUA SAMPAI ATAS)
  useEffect(() => {
    if (!chatId) return;

    setMessages([]);
    setFirstVisibleDoc(null);
    setHasMoreOlder(false);
    isFirstLoadRef.current = true;

    // Kueri batas ketat: hanya 15 pesan terakhir
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(15)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      setMessages(msgs);

      if (snapshot.docs.length > 0) {
        setFirstVisibleDoc(snapshot.docs[0]);
      }

      // Jika jumlah pesan yang didapat mencapai limit (15), berarti kemungkinan masih ada riwayat lebih lama
      if (snapshot.docs.length >= 15) {
        setHasMoreOlder(true);
      } else {
        setHasMoreOlder(false);
      }

      // Auto-scroll ke paling bawah hanya saat pertama kali room terbuka atau ada pesan baru
      if (isFirstLoadRef.current) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          isFirstLoadRef.current = false;
        }, 50);
      }
    }, (err) => {
      console.warn("Message stream warning:", err);
    });

    return () => unsubscribe();
  }, [chatId]);

  // 2. FUNGSI AMBIL RIWAYAT PESAN SEBELUMNYA (PAGINASI KE ATAS)
  const handleLoadOlderMessages = async () => {
    if (!chatId || !firstVisibleDoc || isLoadingOlder || !hasMoreOlder) return;

    setIsLoadingOlder(true);

    // Rekam posisi tinggi scroll container sebelum pesan lama diselipkan
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
    }

    try {
      const olderQuery = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("createdAt", "asc"),
        endBefore(firstVisibleDoc),
        limitToLast(15)
      );

      const snap = await getDocs(olderQuery);

      if (!snap.empty) {
        const olderMsgs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        setFirstVisibleDoc(snap.docs[0]);
        setMessages((prev) => [...olderMsgs, ...prev]);

        if (snap.docs.length < 15) {
          setHasMoreOlder(false);
        }

        // Pertahankan posisi scroll agar layar tidak mental ke bawah
        setTimeout(() => {
          if (containerRef.current) {
            const newScrollHeight = containerRef.current.scrollHeight;
            containerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
          }
        }, 20);
      } else {
        setHasMoreOlder(false);
      }
    } catch (err) {
      console.error("Gagal memuat pesan sebelumnya:", err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-3 space-y-1 select-none bg-[#070b14]"
    >
      {/* TOMBOL / UI "MUAT PESAN SEBELUMNYA" (PERSIS CONTOH GAMBAR) */}
      {hasMoreOlder && (
        <div className="flex flex-col items-center justify-center my-3">
          <button
            type="button"
            onClick={handleLoadOlderMessages}
            disabled={isLoadingOlder}
            className="text-xs text-slate-400 hover:text-white font-semibold py-1.5 px-4 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isLoadingOlder ? "Memuat pesan..." : "Muat pesan sebelumnya"}
          </button>
        </div>
      )}

      {/* GARIS PEMISAH TANGGAL / KEMARIN */}
      {messages.length > 0 && (
        <div className="relative flex py-2 items-center justify-center my-2">
          <div className="flex-grow border-t border-slate-800/80"></div>
          <span className="flex-shrink mx-4 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            Riwayat Pesan
          </span>
          <div className="flex-grow border-t border-slate-800/80"></div>
        </div>
      )}

      {/* RENDER BUBBLE PESAN TEROPTIMASI */}
      {messages.map((msg) => (
        <MemoizedBubble key={msg.id} msg={msg} isAdminView={adminMode} />
      ))}

      {/* ANCHOR BAWAH SCROLL */}
      <div ref={messagesEndRef} />
    </div>
  );
}
