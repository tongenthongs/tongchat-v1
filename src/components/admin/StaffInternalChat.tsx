import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Shield, Send, Users } from 'lucide-react';

interface StaffMessage {
  id?: string;
  senderName: string;
  senderRole: string; // 'ADMIN' / 'STAFF' / 'OWNER'
  senderUid: string;
  message: string;
  createdAt: string;
  timestamp: number;
}

export const StaffInternalChat: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 1. SINKRONISASI REALTIME CHAT STAFF
  useEffect(() => {
    const staffChatRef = collection(db, 'staff_chats');
    const q = query(staffChatRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMsgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StaffMessage[];

      setMessages(fetchedMsgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => console.error("Staff Chat Error:", err));

    return () => unsubscribe();
  }, []);

  // 2. KIRIM PESAN STAFF (Direct Value from Ref & Instant Send)
  const handleSendStaffMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = inputRef.current ? inputRef.current.value : inputText;
    const directText = (rawVal || '').trim();
    if (!directText) return;

    if (inputRef.current) inputRef.current.value = '';
    setInputText('');

    const currentUid = currentUser?.id || currentUser?.uid || 'ADMIN_GENERIC';
    const messagePayload: StaffMessage = {
      senderName: currentUser?.name || currentUser?.username || 'Admin Entong',
      senderRole: currentUser?.role || 'ADMIN',
      senderUid: currentUid,
      message: directText,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    addDoc(collection(db, 'staff_chats'), messagePayload).catch((err) => {
      console.error("Gagal mengirim pesan staff:", err);
    });
  };

  return (
    <div className="w-full h-[calc(100vh-110px)] min-h-[550px] bg-slate-950 border border-slate-800/80 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
      {/* HEADER PANEL CHAT STAFF */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <i className="fa-solid fa-user-shield text-lg"></i>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full animate-pulse" title="Live Realtime Sync Active"></span>
          </div>

          <div>
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              Lounge Internal Staff
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-black px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Private Admin
              </span>
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Ruang Koordinasi Realtime Multi-Device Admin & Owner Entong Store
            </p>
          </div>
        </div>
      </div>

      {/* AREA MESSAGE LIST (FULL SCROLLABLE AREA) */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-950/60">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Users className="w-8 h-8 text-slate-600" />
            <p className="text-xs font-semibold">Belum ada obrolan di Lounge Staff. Mulai diskusi pertama!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMyMsg = msg.senderUid === (currentUser?.id || currentUser?.uid);
            const msgKey = msg.id || (msg as any).docUniqueId || `staff-msg-${idx}`;
            return (
              <div key={msgKey} className={`flex flex-col ${isMyMsg ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-xs font-bold text-slate-300">{msg.senderName}</span>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${
                    msg.senderRole === 'OWNER' 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {msg.senderRole || 'ADMIN'}
                  </span>
                </div>

                <div className={`max-w-[80%] md:max-w-[65%] px-4 py-3 rounded-2xl text-xs leading-relaxed font-medium whitespace-pre-wrap ${
                  isMyMsg 
                    ? 'bg-emerald-500 text-slate-950 font-semibold rounded-tr-none shadow-lg shadow-emerald-500/10' 
                    : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                }`}>
                  {msg.message}
                </div>

                <span className="text-[10px] text-slate-500 mt-1 px-1 font-mono">{msg.createdAt}</span>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT FORM FULL WIDTH DI BAGIAN BOWA */}
      <form onSubmit={handleSendStaffMessage} className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
        <div className="flex-1 bg-slate-950 border border-slate-800 focus-within:border-emerald-500/50 rounded-2xl px-4 py-2 flex items-center transition min-h-[44px]">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendStaffMessage(e);
              }
            }}
            rows={1}
            placeholder="Tulis pesan internal ke sesama staff/admin..."
            className="flex-1 bg-transparent text-slate-100 text-xs focus:outline-none resize-none overflow-y-auto max-h-32 leading-relaxed whitespace-pre-wrap py-1 px-0.5"
          />
        </div>
        <button
          type="submit"
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs transition active:scale-95 flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer shrink-0"
        >
          <i className="fa-solid fa-paper-plane"></i>
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );
};
