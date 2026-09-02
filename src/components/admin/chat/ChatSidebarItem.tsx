import React from 'react';

export interface ChatSidebarItemProps {
  chat: any;
  isSelected: boolean;
  onSelect: (chat: any) => void;
}

export const ChatSidebarItem: React.FC<ChatSidebarItemProps> = React.memo(
  ({ chat, isSelected, onSelect }) => {
    const displayName = chat.customerName || chat.customer_name || chat.name || chat.robloxUsername || chat.roblox_username || "Customer";
    const initial = (displayName || "U")[0].toUpperCase();
    const lastMsg = chat.lastMessage || chat.last_message || (typeof chat.lastChat?.message === 'string' ? chat.lastChat.message : "Lampiran formulir / pesan");
    const unread = typeof chat.unreadCount === 'number' ? chat.unreadCount : (chat.is_read_admin === false ? 1 : 0);
    const orderBadge = chat.orderBadge || chat.status || chat.orderStatus;
    const roleBadge = chat.roleBadge || (chat.isDirect ? "DIRECT" : "RESMI");

    return (
      <div
        onClick={() => onSelect(chat)}
        className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
          isSelected 
            ? "bg-slate-900 border-l-4 border-emerald-500" 
            : unread > 0
            ? "bg-emerald-950/20 border-l-4 border-emerald-500/60 hover:bg-slate-900/50"
            : "border-l-4 border-transparent hover:bg-slate-900/50"
        }`}
        style={{
          contain: "content",
          contentVisibility: "auto", // Menghentikan rendering jika item di luar layar scroll
          containIntrinsicSize: "72px"
        }}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
          {initial}
        </div>

        {/* Info Percakapan */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white truncate">
              {displayName}
            </span>
            <span className="text-[10px] text-slate-500 shrink-0 ml-1">
              {chat.lastMessageTime || "Baru saja"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            {orderBadge && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {orderBadge}
              </span>
            )}
            <span className="text-[10px] text-emerald-400 font-mono">
              {roleBadge}
            </span>
          </div>

          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-slate-400 truncate pr-2">
              {lastMsg}
            </p>
            {unread > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center justify-center shrink-0">
                {unread}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.chat?.id === next.chat?.id &&
      prev.chat?.lastMessage === next.chat?.lastMessage &&
      prev.chat?.last_message === next.chat?.last_message &&
      prev.chat?.unreadCount === next.chat?.unreadCount &&
      prev.chat?.customerName === next.chat?.customerName &&
      prev.chat?.customer_name === next.chat?.customer_name &&
      prev.chat?.orderBadge === next.chat?.orderBadge &&
      prev.chat?.status === next.chat?.status &&
      prev.chat?.orderStatus === next.chat?.orderStatus &&
      prev.chat?.updatedAt === next.chat?.updatedAt
    );
  }
);

ChatSidebarItem.displayName = 'ChatSidebarItem';
