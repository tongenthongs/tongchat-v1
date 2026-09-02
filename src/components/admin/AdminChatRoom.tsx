import React, { useState, useEffect, useRef } from "react";
import { collection, query, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

const globalMemCache = new Map<string, any[]>();

const formatTime = (timestamp: any) => {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const MemoizedMessageBubble = React.memo(({ msg }: { msg: any }) => {
  const isAdmin = msg.sender === "admin" || msg.senderRole === "ADMIN" || msg.sender_role === "ADMIN";
  return (
    <div className={`flex flex-col ${isAdmin ? "items-end" : "items-start"} mb-2`}>
      <div className={`relative max-w-[75%] px-3 py-2 rounded-xl text-[13px] transition-none ${isAdmin ? "bg-[#2b5278] text-white rounded-br-sm" : "bg-[#182533] text-white rounded-bl-sm"}`}>
        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
        {msg.imageUrl && (
          <img src={msg.imageUrl} alt="attachment" className="max-w-full rounded-lg my-1 max-h-60 object-contain" />
        )}
        <div className="text-[9px] text-[#7fa9ce] mt-1 text-right">{formatTime(msg.timestampNumber)} WIB</div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.msg.id === next.msg.id && 
         prev.msg.text === next.msg.text && 
         prev.msg.timestampNumber === next.msg.timestampNumber &&
         prev.msg.imageUrl === next.msg.imageUrl;
});

export default function AdminChatRoom({ selectedChat }: { selectedChat: any }) {
  const [messages, setMessages] = useState<any[]>(() => (selectedChat?.id ? globalMemCache.get(selectedChat.id) || [] : []));
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentChatIdRef = useRef<string>(selectedChat?.id || "");

  useEffect(() => {
    const chatId = selectedChat?.id;
    if (!chatId) return;
    currentChatIdRef.current = chatId;

    // Instant synchronous cache load for 0ms room switching
    const cached = globalMemCache.get(chatId) || [];
    setMessages(cached);
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }

    const q = query(collection(db, "chats", chatId, "messages"), limit(60));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (currentChatIdRef.current !== chatId) return;
      const loaded: any[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if ((!data.text || !data.text.trim()) && !data.imageUrl) return; 
        const timeValue = data.createdAt?.toMillis?.() || (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : (data.localTimestamp || Date.now()));
        loaded.push({ id: docSnap.id, ...data, timestampNumber: timeValue });
      });
      loaded.sort((a, b) => a.timestampNumber - b.timestampNumber);
      
      globalMemCache.set(chatId, loaded);
      setMessages(loaded);
      setTimeout(() => { 
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "auto" }); 
      }, 10);
    }, (error) => {
      console.error("Firestore Listener Error:", error);
    });

    return () => unsubscribe();
  }, [selectedChat?.id]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    const chatId = selectedChat?.id;
    if (!textToSend || !chatId) return;
    setInputText("");

    // 1. OPTIMISTIC UI: Instant update in RAM & cache
    const tempMsg = { 
      id: "temp-" + Date.now(), 
      text: textToSend, 
      sender: "admin", 
      senderRole: "ADMIN", 
      timestampNumber: Date.now() 
    };
    const newMessages = [...messages, tempMsg];
    setMessages(newMessages);
    globalMemCache.set(chatId, newMessages);
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "auto" });

    // 2. FIRESTORE SYNC: Wrap in try/catch to handle offline timeouts
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), { 
        text: textToSend, 
        sender: "admin", 
        senderRole: "ADMIN", 
        createdAt: serverTimestamp(),
        localTimestamp: Date.now()
      });
      await updateDoc(doc(db, "chats", chatId), { 
        lastMessage: textToSend, 
        lastSender: "admin", 
        updatedAt: serverTimestamp(), 
        unreadByCustomer: true,
        unreadByAdmin: false,
        unreadCount: 0
      });
    } catch (error) {
      console.error("Failed to sync message to Firestore:", error);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0e1621] overflow-hidden font-sans">
      <div className="h-16 px-4 bg-[#17212b] border-b border-[#0e1621] flex items-center shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#389ce9] flex items-center justify-center text-white font-bold text-sm mr-3">
          {(selectedChat?.resolvedName || selectedChat?.customerName || "C").charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#f5f5f5]">{selectedChat?.resolvedName || selectedChat?.customerName || "Customer"}</h3>
          <span className="text-[11px] text-[#389ce9] font-medium">@{selectedChat?.robloxUsername || selectedChat?.username || "User"}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {messages.map((msg) => (
          <MemoizedMessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 bg-[#17212b] flex gap-3 shrink-0 border-t border-[#0e1621]">
        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)} 
          className="flex-1 bg-[#242f3d] rounded-xl px-4 text-sm text-white outline-none" 
          placeholder="Ketik pesan..." 
        />
        <button 
          type="submit" 
          disabled={!inputText.trim()} 
          className="w-10 h-10 bg-[#389ce9] rounded-full text-white font-bold flex items-center justify-center transition-none disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export { AdminChatRoom };
