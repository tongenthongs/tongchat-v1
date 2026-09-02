import React, { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, addDoc, setDoc, doc, serverTimestamp, query, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import BotWelcomeOptions from "./BotWelcomeOptions";

export default function CustomerLiveChatWidget({ chatId, customerName = "Pelanggan", customerUid, isOpen, onClose }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [persistentId] = useState<string>(() => {
    if (chatId) return chatId;
    if (customerUid) return customerUid;
    const cached = localStorage.getItem("entong_customer_chat_id");
    if (cached) return cached;
    const newId = "cust_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("entong_customer_chat_id", newId);
    return newId;
  });

  useEffect(() => {
    if (!isOpen || !persistentId) return;

    setDoc(doc(db, "chats", persistentId), {
      id: persistentId, 
      customerName: customerName, 
      lockedCustomerName: customerName, 
      customerId: customerUid || persistentId, 
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});

    const q = query(collection(db, "chats", persistentId, "messages"), limit(60));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: any[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if ((!data.text || !data.text.trim()) && !data.imageUrl) return; 
        const timeValue = data.createdAt?.toMillis?.() || (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now());
        loaded.push({ id: docSnap.id, ...data, timestampNumber: timeValue });
      });
      loaded.sort((a, b) => a.timestampNumber - b.timestampNumber);
      setMessages(loaded);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 10);
    });

    return () => unsubscribe();
  }, [isOpen, persistentId, customerName, customerUid]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !persistentId) return;
    setInputText("");

    const localMsg = { 
      id: "temp-" + Date.now(), 
      text: textToSend, 
      sender: "customer", 
      senderRole: "PELANGGAN", 
      timestampNumber: Date.now() 
    };
    setMessages((prev) => [...prev, localMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 5);

    await addDoc(collection(db, "chats", persistentId, "messages"), { 
      text: textToSend, 
      sender: "customer", 
      senderRole: "PELANGGAN", 
      createdAt: serverTimestamp() 
    });
    await setDoc(doc(db, "chats", persistentId), { 
      lastMessage: textToSend, 
      lastSender: "customer", 
      unreadByAdmin: true, 
      updatedAt: serverTimestamp() 
    }, { merge: true });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed z-[9999] bottom-6 right-6 w-[380px] h-[540px] bg-[#0e1621] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#242f3d]">
      <div className="px-4 py-3 bg-[#17212b] border-b border-[#242f3d] flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#389ce9] rounded-full flex items-center justify-center text-white font-bold">ES</div>
          <div>
            <h3 className="text-xs font-bold text-white">CS Entong Store</h3>
            <p className="text-[10px] text-[#389ce9]">Online</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[#7fa9ce] hover:text-white p-1">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* EXACTLY ONE BOT INSTANCE RENDERED HERE AT TOP */}
        <BotWelcomeOptions 
          chatId={persistentId} 
          customerName={customerName} 
          customerUid={customerUid} 
          onNavigateCatalog={(cat) => { 
            onClose?.(); 
            window.location.href = cat === "gamepass" ? "/#produk" : "/#joki"; 
          }}
        />

        {messages.map((msg: any) => {
          const isCustomer = msg.sender === "customer";
          return (
            <div key={msg.id} className={`flex flex-col ${isCustomer ? "items-end" : "items-start"} mb-2`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-[13px] ${isCustomer ? "bg-[#2b5278] text-white rounded-br-sm" : "bg-[#182533] text-white rounded-bl-sm"}`}>
                {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                <div className="text-[9px] text-[#7fa9ce] mt-1 text-right">{formatTime(msg.timestampNumber)} WIB</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 bg-[#17212b] flex items-center gap-2 border-t border-[#242f3d]">
        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)} 
          placeholder="Ketik pesan..." 
          className="flex-1 bg-[#242f3d] text-sm text-white px-4 py-2 rounded-xl outline-none" 
        />
        <button 
          type="submit" 
          disabled={!inputText.trim()} 
          className="w-9 h-9 bg-[#389ce9] rounded-full text-white flex items-center justify-center disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export { CustomerLiveChatWidget };
