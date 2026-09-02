import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import AdminChatRoom from "../../components/admin/AdminChatRoom";

const formatSimpleTime = (timestamp: any) => {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const MemoizedChatItem = React.memo(({ chat, isActive, onClick }: any) => {
  return (
    <div 
      onClick={() => onClick(chat.id, chat.isUnreadMarked)} 
      className={`flex items-center px-4 py-3 cursor-pointer border-b border-[#0e1621] transition-none ${isActive ? "bg-[#2b5278]" : "hover:bg-[#1a242f]"}`}
    >
      <div className="w-11 h-11 bg-[#389ce9] rounded-full flex items-center justify-center font-bold text-white text-lg mr-3 shrink-0">
        {(chat.resolvedName || "C").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <h4 className="text-[13px] font-bold text-white truncate">{chat.resolvedName}</h4>
          <span className={`text-[10px] ${chat.isUnreadMarked ? "text-[#389ce9] font-bold" : "text-[#7fa9ce]"}`}>
            {formatSimpleTime(chat.updatedAt)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className={`text-[11px] truncate pr-2 ${chat.isUnreadMarked ? "text-white font-bold" : "text-[#7fa9ce]"}`}>
            {chat.lastMessage || "Attachment"}
          </p>
          {chat.isUnreadMarked && (
            <div className="px-1.5 py-0.5 min-w-[20px] rounded-full bg-[#389ce9] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              {chat.unreadCount || 1}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.isActive === next.isActive && 
         prev.chat.updatedAt?.toMillis?.() === next.chat.updatedAt?.toMillis?.() &&
         prev.chat.isUnreadMarked === next.chat.isUnreadMarked &&
         prev.chat.lastMessage === next.chat.lastMessage &&
         prev.chat.unreadCount === next.chat.unreadCount;
});

export default function AdminChatPage() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // STRICT LIMIT 40: Zero lag query
    const q = query(collection(db, "chats"), orderBy("updatedAt", "desc"), limit(40));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (!data.lastMessage && !data.lockedCustomerName && !data.customerName) return; 
        const isUnread = data.unreadByAdmin === true || (data.unreadCount && data.unreadCount > 0) || data.lastSender === "customer";
        const lockedName = data.lockedCustomerName || data.customerName || data.name || data.robloxUsername || `Cust-${d.id.slice(0, 6)}`;
        list.push({ id: d.id, ...data, resolvedName: lockedName, isUnreadMarked: isUnread });
      });
      setChats(list);
    }, (error) => {
      console.error("Firestore Error in AdminChatPage:", error);
    });
    return () => unsubscribe();
  }, []);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);
  
  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      const match = (c.resolvedName || "").toLowerCase().includes(searchQuery.toLowerCase());
      return filterTab === "ALL" ? match : (match && c.isUnreadMarked);
    });
  }, [chats, filterTab, searchQuery]);

  const handleChatClick = useCallback((id: string, isUnread: boolean) => {
    setActiveChatId(id);
    if (isUnread) {
      updateDoc(doc(db, "chats", id), { unreadByAdmin: false, unreadCount: 0 }).catch(console.error);
    }
  }, []);

  return (
    <div className="w-full h-[calc(100vh-64px)] bg-[#0e1621] text-white flex overflow-hidden font-sans">
      <div className="w-80 md:w-96 bg-[#17212b] border-r border-[#0e1621] flex flex-col shrink-0">
        <div className="p-3 border-b border-[#0e1621]">
          <h2 className="text-sm font-bold mb-3">Pesan Masuk</h2>
          <div className="bg-[#242f3d] rounded-lg flex items-center px-3 py-2 mb-3">
            <span className="text-[#7fa9ce] mr-2 text-xs">🔍</span>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Cari chat..." 
              className="w-full bg-transparent text-xs text-[#f5f5f5] outline-none" 
            />
          </div>
          <div className="flex gap-1 bg-[#0e1621] p-1 rounded-lg">
            <button 
              onClick={() => setFilterTab("ALL")} 
              className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-none ${filterTab === "ALL" ? "bg-[#2b5278]" : "text-[#7fa9ce] hover:bg-[#17212b]"}`}
            >
              Semua
            </button>
            <button 
              onClick={() => setFilterTab("UNREAD")} 
              className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-none ${filterTab === "UNREAD" ? "bg-[#2b5278]" : "text-[#7fa9ce] hover:bg-[#17212b]"}`}
            >
              Belum Dibaca
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredChats.map((c) => (
            <MemoizedChatItem 
              key={c.id} 
              chat={c} 
              isActive={c.id === activeChatId} 
              onClick={handleChatClick} 
            />
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#0e1621] flex flex-col overflow-hidden">
        {activeChatId && activeChat ? (
          <AdminChatRoom selectedChat={activeChat} />
        ) : (
          <div className="m-auto text-[#7fa9ce] font-bold text-sm">Pilih chat untuk memulai percakapan</div>
        )}
      </div>
    </div>
  );
}

export { AdminChatPage };
