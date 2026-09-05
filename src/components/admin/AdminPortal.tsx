import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp, formatDate, formatChatTime } from '../../context/AppContext';
import { GameOrder, OrderStatus, ChatMessage, GameItem, QuickReplyTemplate, UserProfile, UserRole, resolveChatRoomId } from '../../types';
import { arrayUnion, getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, collectionGroup } from 'firebase/firestore';
import { runAdminAutoLinkSync } from '../../utils/phoneUtils';
import { db, getSafeTimestamp, getInitialCreationTimestamp, getPureCreationTime, extractTimeMs, applySmartSearch } from '../../lib/firebase';
import { SafeImage } from '../common/SafeImage';
import { HighlightText } from '../common/HighlightText';
import { subscribeStoreSchedule, saveBannerConfig, DEFAULT_BANNER, BannerConfig } from '../../services/storeScheduleService';
import { 
  MessageSquare, ShoppingBag, Users, Settings, LogOut, Send, Plus, Search, Zap, 
  DollarSign, Calendar, UserCheck, FileText, Lock, ShieldCheck, CheckCircle2, 
  Clock, AlertCircle, AlertTriangle, Gamepad2, Smartphone, Laptop, Eye, EyeOff, Check, Edit2, Trash2, History,
  Filter, CheckCheck, ShoppingCart, User, Paperclip, RefreshCw, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Database, CreditCard, Star, Copy, Phone, Server, Gift, Coins, Package, LogIn
} from 'lucide-react';
import { compressImage, compressVideo } from '../../lib/mediaUtils';
import { AdminCatalogManager } from './AdminCatalogManager';
import { AdminReviewsManager } from './AdminReviewsManager';
import { StaffInternalChat } from './StaffInternalChat';
import { StaffManagement } from './StaffManagement';
import { CloudMonitor } from './CloudMonitor';
import { AttendancePanel } from './AttendancePanel';
import { ManualWAOrderModal } from './ManualWAOrderModal';
import { StoreScheduleSettingModal } from './StoreScheduleSettingModal';
import { GiftOrdersPanel } from './GiftOrdersPanel';
import { AdminTongCoinsPanel } from './AdminTongCoinsPanel';
import { JokiOrdersPanel } from './JokiOrdersPanel';
import { OrderanPanel } from './OrderanPanel';
import { AdminPaymentPending } from './AdminPaymentPending';
import { AdminLoginPanel } from './AdminLoginPanel';
import { ChatMessageRenderer } from '../common/ChatMessageRenderer';
import { useOrders } from '../../hooks/useOrders';
import { executeCancelOrderWithAutoRefund, purgeAllBotAndDummyOrders, isJunkBotOrder } from '../../lib/orderRefund';
import { sendExpiredWarningMessage, checkAndDispatchAuto2DayWarnings, isEligibleForAuto2DayWarning } from '../../lib/giftExpirationService';
import { JokiCredentialFormMessage } from '../chat/JokiCredentialFormMessage';
import { triggerForceSystemRefresh } from '../../hooks/useAutoUpdateWatcher';
import { isOrderPaymentPending } from '../../utils/orderFilters';
import AdminChatMinimalHeader from './AdminChatMinimalHeader';

export function getCustomerDisplayName(conv: any, usersList: any[] = [], ordersList: any[] = []): string {
  if (!conv) return 'Pelanggan';
  if (typeof conv === 'string') return conv;

  // 1. Cari data user terdaftar di database users/customers berdasarkan customerId/uid/email
  const targetCustId = conv.customerId || conv.customer_id || (conv.id && (String(conv.id).startsWith('room_') || String(conv.id).startsWith('direct-')) ? String(conv.id).replace(/^room_/, '').replace(/^direct-/, '') : conv.id);
  const targetEmail = conv.customerEmail || conv.email;

  if (Array.isArray(usersList) && usersList.length > 0) {
    const matchedUser = usersList.find((u: any) => 
      (targetCustId && (u.uid === targetCustId || u.id === targetCustId)) || 
      (targetEmail && u.email === targetEmail)
    );
    const webAccountName = matchedUser?.displayName || matchedUser?.fullName || matchedUser?.name || matchedUser?.username;
    if (webAccountName && !webAccountName.startsWith('Guest_') && webAccountName.trim() !== '') {
      return webAccountName;
    }
  }

  // 2. Prioritas field display name langsung
  const directName = conv.customerName || conv.customer_name || conv.userName || conv.username || conv.displayName || conv.senderName || conv.name;
  if (directName && !directName.startsWith('Guest_') && directName.trim() !== '') {
    return directName;
  }

  // 3. Fallback matching order
  if (Array.isArray(ordersList) && ordersList.length > 0) {
    const ord = ordersList.find((o: any) => o.id === conv.id || (targetCustId && o.customer_id === targetCustId) || (conv.customer_id && o.customer_id === conv.customer_id));
    if (ord && ord.customer_name && !ord.customer_name.startsWith('Guest_') && ord.customer_name.trim() !== '') {
      return ord.customer_name;
    }
  }

  if (conv.id) {
    const safeId = String(targetCustId || conv.id);
    return `Customer #${safeId.replace(/[^0-9a-zA-Z]/g, '').slice(-4).toUpperCase()}`;
  }

  return 'Pelanggan';
}

export function getSafeInitial(val: any, fallback = 'A'): string {
  if (!val || typeof val !== 'string' || val.trim().length === 0) return fallback;
  return val.trim().charAt(0).toUpperCase();
}

const renderMessageText = (text: string) => {
  if (!text) return null;
  return <ChatMessageRenderer text={text} />;
};

const RobloxUsernameBadge: React.FC<{ username?: string }> = ({ username }) => {
  const [copied, setCopied] = useState(false);

  const cleanName = (username || '').trim();

  if (!cleanName || cleanName === '-' || cleanName.toLowerCase() === 'user roblox') {
    return <span className="text-slate-500 italic text-[11px] block truncate">-</span>;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      title="Klik 1-Click untuk copy Username Roblox"
      className="inline-flex items-center gap-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 active:scale-95 text-cyan-300 border border-cyan-500/30 font-mono font-bold px-2.5 py-1 rounded-lg text-[11px] cursor-pointer max-w-full group"
    >
      <span className="truncate">🎮 {cleanName}</span>
      {copied ? (
        <span className="text-emerald-400 font-sans text-[10px] ml-0.5 font-semibold flex-shrink-0">✓ Copied!</span>
      ) : (
        <Copy className="w-3 h-3 text-cyan-400 group-hover:scale-110 opacity-75 group-hover:opacity-100 flex-shrink-0" />
      )}
    </button>
  );
};

const WhatsAppCopyBadge: React.FC<{ phone?: string }> = ({ phone }) => {
  const [copied, setCopied] = useState(false);

  const cleanPhone = (phone || '').trim();

  if (!cleanPhone || cleanPhone === '-' || cleanPhone === '0') {
    return <span className="text-slate-500 italic text-[11px] block truncate">-</span>;
  }

  const numericDigits = cleanPhone.replace(/[^0-9]/g, '');
  const formattedWa = numericDigits ? (numericDigits.startsWith('0') ? '62' + numericDigits.slice(1) : numericDigits) : '';
  const waUrl = formattedWa ? `https://wa.me/${formattedWa}` : '#';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        onClick={handleCopy}
        type="button"
        title="Klik untuk menyalin Nomor WA"
        className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold px-2 py-0.5 rounded text-xs active:scale-95 cursor-pointer"
      >
        <span>📱 {cleanPhone}</span>
        {copied ? (
          <span className="text-emerald-300 text-[10px] font-extrabold ml-0.5">✓ Copied</span>
        ) : (
          <Copy className="w-3 h-3 text-emerald-400 text-[10px]" />
        )}
      </button>
      {formattedWa && (
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded text-[10px] flex items-center justify-center shadow active:scale-90"
          title="Chat langsung di WhatsApp"
        >
          <Phone className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};

// 🚀 ISOLATED CHAT INPUT AREA (ANTI-FREEZE SAAT MENGETIK & STABIL TANPA MENTAL)
const ChatInputArea = React.memo(({ onSend, quickReplies, isUploadingAdminMedia, fileInputAdminRef, handleAdminMediaUpload, handleAdminPasteImage }: any) => {
  const [localInput, setLocalInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const directVal = (textareaRef.current ? textareaRef.current.value : localInput).trim();
    if (!directVal) return;
    if (textareaRef.current) textareaRef.current.value = '';
    setLocalInput('');
    onSend(directVal);
  };

  return (
    <div className="relative flex-none z-10 flex flex-col">
      {/* Quick Reply Toolbar */}
      {quickReplies && quickReplies.length > 0 && (
        <div className="bg-[#111b21] px-4 py-2 border-t border-slate-800 flex gap-2 flex-wrap items-center shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3 text-[#00E676]" /> Quick Reply:
          </span>
          {quickReplies.map((qr: any, idx: number) => (
            <button
              key={qr.id ? `qr-bar-${qr.id}-${idx}` : `qr-bar-${idx}`}
              type="button"
              onClick={() => {
                setLocalInput(qr.message);
                textareaRef.current?.focus();
              }}
              className="px-3 py-1 bg-[#202c33] hover:bg-slate-700 text-[#00E676] rounded-xl text-xs whitespace-nowrap border border-slate-700 cursor-pointer"
            >
              {qr.shortcut} - {qr.title}
            </button>
          ))}
        </div>
      )}

      {localInput.includes('/') && quickReplies && quickReplies.length > 0 && (() => {
        const slashQuery = localInput.split('/').pop()?.toLowerCase() || '';
        const filteredQRs = quickReplies.filter((qr: any) => 
          qr.shortcut.toLowerCase().includes(slashQuery) || 
          qr.title.toLowerCase().includes(slashQuery) ||
          qr.message.toLowerCase().includes(slashQuery)
        );
        if (filteredQRs.length === 0) return null;
        return (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-[#111b21] border border-emerald-500/50 rounded-2xl shadow-2xl p-2 z-50 max-h-48 overflow-y-auto space-y-1">
            <div className="text-[10px] font-bold text-emerald-400 px-2 py-1 uppercase tracking-wider flex items-center justify-between border-b border-slate-800">
              <span>⚡ Quick Reply (Ketik / untuk memicu)</span>
              <span>{filteredQRs.length} tersedia</span>
            </div>
            {filteredQRs.map((qr: any, idx: number) => (
              <button
                key={qr.id ? `qr-pop-${qr.id}-${idx}` : `qr-pop-${idx}`}
                type="button"
                onClick={() => {
                  setLocalInput(qr.message);
                  textareaRef.current?.focus();
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-950/40 text-xs text-slate-200 flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="font-bold text-[#00E676] mr-2">/{qr.shortcut}</span>
                  <span className="font-semibold text-slate-100">{qr.title}</span>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 whitespace-pre-line">{qr.message}</p>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 group-hover:bg-emerald-500/20">Pilih ⚡</span>
              </button>
            ))}
          </div>
        );
      })()}

      <form onSubmit={handleSubmit} className="bg-[#202c33] p-3 border-t border-slate-700 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputAdminRef}
          onChange={handleAdminMediaUpload}
          accept="image/*,video/*"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputAdminRef.current?.click()}
          disabled={isUploadingAdminMedia}
          className="p-3 bg-[#111b21] hover:bg-slate-700 text-slate-300 hover:text-[#00E676] rounded-xl border border-slate-700 shrink-0"
          title="Kirim Foto / Video (Dikompres)"
        >
          {isUploadingAdminMedia ? <RefreshCw className="w-4 h-4 animate-spin text-[#00E676]" /> : <Paperclip className="w-4 h-4" />}
        </button>
        <div className="flex-1 bg-[#111b21] border border-slate-700 focus-within:border-[#00E676] rounded-xl px-3 py-1.5 flex items-center min-h-[44px]">
          <textarea
            ref={textareaRef}
            value={localInput}
            onChange={e => setLocalInput(e.target.value)}
            onKeyDown={e => {
              // Tekan Enter untuk mengirim, Shift + Enter untuk baris baru
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            onPaste={handleAdminPasteImage}
            rows={1}
            placeholder="Ketik pesan, Paste (Ctrl+V) Gambar, atau ketik '/' untuk Quick Reply..."
            className="flex-1 bg-transparent text-slate-100 text-xs sm:text-sm focus:outline-none resize-none overflow-y-auto max-h-32 leading-relaxed whitespace-pre-wrap py-1 px-0.5"
          />
        </div>
        <button
          type="submit"
          disabled={!localInput.trim()}
          className="px-5 py-3 bg-[#00E676] hover:bg-[#00c853] disabled:opacity-50 disabled:cursor-not-allowed text-[#111b21] font-bold rounded-xl text-xs shadow-lg flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>Kirim</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
});

// 🚀 STANDALONE HELPERS & MEMOIZED CHAT LIST ITEM (Top-Level for Zero-Lag & Proper React.memo)
const getStatusBadgeConfig = (statusStr: string) => {
  const s = (statusStr || 'NEW').toUpperCase();
  if (s === 'NEW' || s === 'BELUM_ORDER' || s === 'BELUM ORDER') {
    return { label: 'NEW', colorClass: 'bg-blue-500/15 text-blue-400 border-blue-500/40 shadow-blue-500/5' };
  }
  if (s === 'BOOKING' || s === 'PENDING') {
    return { label: 'BOOKING', colorClass: 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-amber-500/5' };
  }
  if (s === 'PROSES' || s === 'PROCESSING' || s === 'PROSES_WORKER') {
    return { label: 'PROSES', colorClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40 shadow-indigo-500/5' };
  }
  if (s === 'READY') {
    return { label: 'READY', colorClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-cyan-500/5' };
  }
  if (s === 'LOGUL' || s === 'ANTRIAN_LOGIN' || s === 'BUTUH_LOGIN_ULANG') {
    return { label: 'LOGUL', colorClass: 'bg-orange-500/15 text-orange-400 border-orange-500/40 shadow-orange-500/5' };
  }
  if (s === 'DIORDER') {
    return { label: 'DIORDER', colorClass: 'bg-teal-500/15 text-teal-400 border-teal-500/40 shadow-teal-500/5' };
  }
  if (s === 'SELESAI' || s === 'COMPLETED' || s === 'DONE') {
    return { label: 'SELESAI', colorClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-emerald-500/5' };
  }
  if (s === 'HANGUS' || s === 'EXPIRED') {
    return { label: 'HANGUS', colorClass: 'bg-rose-900/40 text-rose-300 border-rose-600/40 shadow-rose-500/5' };
  }
  if (s === 'CANCEL' || s === 'BATAL' || s === 'DIBATALKAN' || s === 'REJECTED') {
    return { label: 'CANCEL', colorClass: 'bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-rose-500/5' };
  }
  return { label: s, colorClass: 'bg-slate-700/50 text-slate-300 border-slate-600/50' };
};

const renderWaStatusBadge = (statusStr: string) => {
  const config = getStatusBadgeConfig(statusStr);
  return (
    <div className={`flex-shrink-0 w-[80px] min-w-[80px] max-w-[80px] h-[20px] inline-flex items-center justify-center text-[10px] font-black uppercase tracking-wider rounded-full border shadow-sm whitespace-nowrap overflow-hidden my-0.5 ${config.colorClass}`}>
      <span className="truncate px-1">
        {config.label}
      </span>
    </div>
  );
};

const renderCustomerBadge = (nameStr: string, isGuestFlag?: boolean) => {
  if (!nameStr) return null;
  const isGuest = isGuestFlag === true || nameStr.toLowerCase().includes('guest') || /^cust[_\-0-9]/i.test(nameStr);
  if (isGuest) {
    return null;
  }
  return <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-black rounded uppercase tracking-wider shadow-sm flex-shrink-0" title="Verified Account">👤 RESMI</span>;
};

const ChatListItem = React.memo(({ 
  conv, 
  isSelected, 
  onSelect, 
  currentUser, 
  isUserMuted, 
  getMuteRemainingSeconds, 
  formatCountdown, 
  formatChatTime, 
  getConvStatus, 
  chatSearchQuery 
}: any) => {
  const customerId = (conv.id || '').replace('direct-', '').replace('room_', '');

  const muteKey1 = customerId;
  const muteKey2 = conv.phone || '';
  const isConvMuted = isUserMuted ? (isUserMuted(muteKey1) || isUserMuted(muteKey2)) : false;
  const convMuteSecs = getMuteRemainingSeconds ? Math.max(getMuteRemainingSeconds(muteKey1), getMuteRemainingSeconds(muteKey2)) : 0;
  const roomName = conv.name || 'Pelanggan Entong Store';
  const unreadCount = conv.unreadCount || 0;
  const statusStr = getConvStatus ? getConvStatus(conv) : 'NEW';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(conv);
      }}
      className={`p-3.5 cursor-pointer select-none flex items-center gap-3 relative border-l-4 ${
        isSelected
          ? 'bg-[#202c33] border-[#00E676]'
          : unreadCount > 0
          ? 'bg-emerald-950/20 border-emerald-500/60 hover:bg-emerald-900/30'
          : 'border-transparent hover:bg-[#202c33]/50'
      }`}
      style={{
        contain: 'content',
        contentVisibility: 'auto',
        containIntrinsicSize: '72px'
      }}
    >
      <div className="w-10 h-10 rounded-full bg-[#005C4B] text-white font-bold flex items-center justify-center shrink-0 relative">
        {getSafeInitial(roomName, 'P')}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#111b21]" />
        )}
        {isConvMuted && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-700 rounded-full border border-[#111b21] flex items-center justify-center text-[9px] text-white font-black" title="Sedang Muted">
            🚫
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5 gap-1">
          <div className="flex flex-col truncate">
            <div className="flex items-center gap-1.5 truncate">
              <h4 className={`text-xs truncate ${unreadCount > 0 ? 'font-black text-emerald-300' : 'font-bold text-slate-100'}`}>
                <HighlightText text={roomName} highlight={chatSearchQuery} />
              </h4>
              {renderCustomerBadge(roomName)}
              {isConvMuted && formatCountdown && (
                <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-black rounded shrink-0">
                  🚫 Muted ({formatCountdown(convMuteSecs)})
                </span>
              )}
            </div>
            {renderWaStatusBadge(statusStr)}
          </div>
          <span className="text-[10px] text-slate-400 shrink-0">
            {conv.lastChat && formatChatTime ? formatChatTime(conv.lastChat.created) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          {(() => {
            const isMe = conv.lastChat?.sender_role === 'ADMIN' || conv.lastChat?.sender_role === 'admin' || conv.lastChat?.sender_uid === currentUser?.uid;
            const isSystem = conv.lastChat?.sender_role === 'SYSTEM' || conv.lastChat?.sender_role === 'system';
            const displayMsg = conv.lastChat?.message || (conv.tag && conv.tag !== 'Direct Chat' ? conv.tag : 'Mulai chat baru...');

            return (
              <p className={`text-[11px] truncate flex items-center gap-1 ${unreadCount > 0 ? 'font-bold text-slate-200' : 'text-slate-400'}`}>
                {isMe && <i className="fa-solid fa-check-double text-[10px] text-blue-400 shrink-0"></i>}
                {isSystem && <i className="fa-solid fa-robot text-[10px] text-amber-400 shrink-0"></i>}
                <span className="truncate">
                  <HighlightText text={displayMsg} highlight={chatSearchQuery} />
                </span>
              </p>
            );
          })()}
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-full shrink-0 shadow-lg">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.conv.id === nextProps.conv.id &&
    prevProps.conv.lastMessage === nextProps.conv.lastMessage &&
    prevProps.conv.lastChat?.message === nextProps.conv.lastChat?.message &&
    prevProps.conv.unreadCount === nextProps.conv.unreadCount &&
    prevProps.conv.status === nextProps.conv.status &&
    prevProps.conv.rawUpdatedTime === nextProps.conv.rawUpdatedTime &&
    prevProps.chatSearchQuery === nextProps.chatSearchQuery
  );
});

export const AdminPortal: React.FC = () => {
  const { 
    currentUser, logout, orders, chats, setChats, unreadChats, loadMoreChats, hasMoreChats, isLoadingMoreChats, activeMessages, selectedChatId, setSelectedChatId, items, quickReplies, users, attendance, finance,
    updateOrderStatus, sendMessage, clearOrderChats, markChatAsRead, saveItem, deleteItem, saveQuickReply, deleteQuickReply,
    banUser, unbanUser,
    saveUser, deleteUser, updateOrder, deleteOrder,
    checkInStaff, checkOutStaff, addFinanceRecord, createOrder,
    adminStatus, qrisImageUrl, danaNumber, danaName, updatePaymentSettings, storeAvatarUrl, adminWhatsappNumber,
    storeOpenHour, storeCloseHour, storeAutoHours, storeForceStatus, storeClosedNoticeText, isStoreClosed, updateStoreSettings,
    custCounter, getNextCustCode, isUserMuted, getMuteRemainingSeconds, muteUser, unmuteUser,
    optimizeDatabase, resetQuotaExceeded, chatNotes, saveChatNote, purgeEmptyChats,
    clouds, assignOrderToCloud, releaseOrderFromCloud
  } = useApp();

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER';
  const isOwner = (currentUser?.role || '').toString().toUpperCase() === 'OWNER';

  // Live timer tick for mute countdowns
  const [nowTick, setNowTick] = useState(Date.now());
  
  
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const [activeMenu, setActiveMenu] = useState<'chat' | 'staff_chat' | 'pos' | 'orders' | 'orderan' | 'joki-orders' | 'gift-orders' | 'tongcoins' | 'payment_pending' | 'cloud_monitor' | 'customers' | 'staff' | 'items' | 'reviews' | 'qrs' | 'attendance' | 'admin_login' | 'finance' | 'settings' | 'database-quota'>('chat');
  // Mobile bottom dock tab for small screens (< 768px)
  const [mobileTab, setMobileTab] = useState<'chat' | 'orders' | 'payment_pending' | 'cloud_monitor' | 'pos' | 'manage' | 'customers' | 'items' | 'reviews' | 'qrs' | 'attendance' | 'finance' | 'settings' | 'staff_chat' | 'joki-orders' | 'gift-orders' | 'orderan' | 'staff'>('chat');
  const [isManualWAOrderModalOpen, setIsManualWAOrderModalOpen] = useState<boolean>(false);
  const [isStoreScheduleModalOpen, setIsStoreScheduleModalOpen] = useState<boolean>(false);

  // Local state for settings to prevent per-keystroke Firestore writes
  const [localSettings, setLocalSettings] = React.useState({
    qrisImageUrl: qrisImageUrl || '',
    danaNumber: danaNumber || '',
    danaName: danaName || '',
    adminWhatsappNumber: adminWhatsappNumber || '',
    storeAvatarUrl: storeAvatarUrl || ''
  });
  
  React.useEffect(() => {
    setLocalSettings({
      qrisImageUrl: qrisImageUrl || '',
      danaNumber: danaNumber || '',
      danaName: danaName || '',
      adminWhatsappNumber: adminWhatsappNumber || '',
      storeAvatarUrl: storeAvatarUrl || ''
    });
  }, [qrisImageUrl, danaNumber, danaName, adminWhatsappNumber, storeAvatarUrl]);

  // Banner settings state — di level component untuk menghindari Rules of Hooks violation
  const [bannerCfg, setBannerCfg] = React.useState<BannerConfig | null>(null);
  const [bannerSaving, setBannerSaving] = React.useState(false);
  const [bannerSaved, setBannerSaved] = React.useState(false);

  React.useEffect(() => {
    const unsub = subscribeStoreSchedule((cfg) => {
      setBannerCfg({ ...DEFAULT_BANNER, ...(cfg.banner || {}) });
    });
    return () => unsub();
  }, []);

  const handleSaveBanner = async () => {
    if (!bannerCfg) return;
    setBannerSaving(true);
    try {
      await saveBannerConfig(bannerCfg);
      setBannerSaved(true);
      setTimeout(() => setBannerSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setBannerSaving(false); }
  };

  const handleSavePaymentSettings = async () => {
    await updatePaymentSettings(localSettings);
    alert('✅ Pengaturan berhasil disimpan ke server!');
  };

  
  // Global Keyboard Shortcut (Alt + N) to open Manual WA Order Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Trigger: Alt + N (or Option + N on Mac)
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setIsManualWAOrderModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Strict Owner Access Guard for Keuangan Toko
  useEffect(() => {
    if ((activeMenu === 'finance' || mobileTab === 'finance') && !isOwner) {
      alert("Akses Terbatas: Hanya Owner yang dapat mengakses Keuangan Toko");
      setActiveMenu('orderan');
      setMobileTab('orderan');
    }
    if ((activeMenu === 'staff' || activeMenu === 'attendance' || mobileTab === 'staff' || mobileTab === 'attendance') && !isOwner) {
      alert('Akses Khusus Owner. Mengalihkan ke Dashboard Kerja...');
      setActiveMenu('orderan');
      setMobileTab('orderan');
    }
    // Guard: admin_login hanya untuk ADMIN/OWNER (bukan staff/worker biasa)
    if (activeMenu === 'admin_login' && !isAdmin) {
      setActiveMenu('chat');
    }
    // Guard: items, customers, reviews, settings hanya untuk ADMIN/OWNER
    if ((activeMenu === 'items' || activeMenu === 'customers' || activeMenu === 'reviews' || activeMenu === 'settings') && !isAdmin) {
      setActiveMenu('chat');
    }
  }, [activeMenu, mobileTab, isOwner, isAdmin]);

  // Selected order for chat / detail view
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [activeSelectedConv, setActiveSelectedConv] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openAccordionGroups, setOpenAccordionGroups] = useState<{ [key: string]: boolean }>({
    orders: true,
    communication: true,
    management: true,
    system: true
  });

  const toggleAccordionGroup = (groupKey: string) => {
    setOpenAccordionGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };
  const [isItemLoading, setIsItemLoading] = useState(false);
  const [isJokoLoading, setIsJokoLoading] = useState(false);
  const [isPosLoading, setIsPosLoading] = useState(false);
  
  // USER REQUESTED REALTIME LISTENER TABEL DATABASE ORDERAN
  const { rawOrders, cleanOrders, isLoading: isLoadingOrders } = useOrders();
  const [renderLimitDatabase, setRenderLimitDatabase] = useState(30);
  const [renderLimitHistory, setRenderLimitHistory] = useState(30);

  // 🚀 ANTI-LAG PROCESSOR: Memetakan cleanOrders menjadi format yang dikenali oleh UI AdminPortal
  const adminLiveOrders = useMemo(() => {
    return cleanOrders.map((ord: any) => ({
      ...ord,
      status: ord.status || ord.orderStatus || 'NEW',
      orderStatus: ord.status || ord.orderStatus || 'NEW',
      game_name: ord.game_name || ord.gameName || ord.packageName || 'Gamepass / Joko',
      package_name: ord.package_name || ord.packageName || '-',
      customer_name: ord.customerName || ord.customer_name || ord.robloxUsername || 'Customer',
      customer_phone: ord.customer_phone || ord.customerPhone || ord.whatsapp || '',
      price: ord.totalPrice || ord.price || 0,
      robloxUsername: ord.robloxUsername || ord.game_username || ord.targetUsername || '-',
      robloxPassword: ord.robloxPassword || ord.game_password || '',
      game_password: ord.game_password || ord.robloxPassword || '',
      targetUsername: ord.targetUsername || ord.robloxUsername || ord.game_username || '-',
      uangSebelumJoko: ord.uangSebelumJoko || ord.initialGameMoney || '',
      login_method: ord.loginMethod || ord.login_method || ord.login_provider || ((ord.email || '').includes('gmail.com') ? 'GOOGLE' : 'MANUAL'),
      catatanWorker: ord.catatanWorker || ord.workerNote || ord.note || '',
      payment_proof: ord.proofUrl || ord.proofOfPayment || ord.payment_proof || '',
      orderId: ord.orderId || (ord.docUniqueId?.startsWith('ORD-') ? ord.docUniqueId : `#ORD-${(ord.docUniqueId || '0000').slice(-6).toUpperCase()}`),
    }));
  }, [cleanOrders]);

  // Realtime Pending Payments Counter for sidebar badge (Shared strict filter)
  const pendingPaymentsCount = useMemo(() => {
    const listToFilter = (orders && orders.length > 0) ? orders : (adminLiveOrders || []);
    return listToFilter.filter(isOrderPaymentPending).length;
  }, [orders, adminLiveOrders]);

  const [isCleaningGhostData, setIsCleaningGhostData] = useState(false);

  const handleCleanGhostData = async () => {
    if (!window.confirm('⚠️ PERINGATAN: Aksi ini akan menghapus permanen semua data pesanan ganda (Ghost Data) di database. Anda yakin?')) return;
    
    setIsCleaningGhostData(true);
    try {
      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const uniqueOrdersMap = new Map<string, any>();
      const toDeleteDocs: any[] = [];

      rawOrders.forEach((ord: any) => {
        if (!ord) return;
        const custIdentifier = ord.userUid || ord.customerId || ord.customer_id || ord.customer_phone || ord.customerPhone || ord.customerName || ord.customer_name || 'GUEST';
        const pkgIdentifier = (ord.packageName || ord.package_name || ord.gameName || ord.game_name || '').trim().toLowerCase();
        const pureTime = ord.pureTime || ord.initialCreationTime || getPureCreationTime(ord);
        
        const orderDate = new Date(pureTime || Date.now()).toLocaleDateString('id-ID');
        const strictKey = `${custIdentifier}_${pkgIdentifier}_${orderDate}`;

        if (!uniqueOrdersMap.has(strictKey)) {
          uniqueOrdersMap.set(strictKey, ord);
        } else {
          const existing = uniqueOrdersMap.get(strictKey);
          const ordProof = ord.proofUrl || ord.payment_proof || ord.proofOfPayment;
          const existProof = existing.proofUrl || existing.payment_proof || existing.proofOfPayment;

          if (ordProof && !existProof) {
            if (existing.docUniqueId && existing.source !== 'chats_fallback') toDeleteDocs.push(existing);
            uniqueOrdersMap.set(strictKey, ord);
          } else if ((ordProof && existProof) || (!ordProof && !existProof)) {
            const timeOrd = pureTime;
            const timeExisting = existing.pureTime || existing.initialCreationTime || getPureCreationTime(existing);
            if (timeOrd > timeExisting) {
              if (existing.docUniqueId && existing.source !== 'chats_fallback') toDeleteDocs.push(existing);
              uniqueOrdersMap.set(strictKey, ord);
            } else {
              if (ord.docUniqueId && ord.source !== 'chats_fallback') toDeleteDocs.push(ord);
            }
          } else {
            if (ord.docUniqueId && ord.source !== 'chats_fallback') toDeleteDocs.push(ord);
          }
        }
      });

      if (toDeleteDocs.length === 0) {
        alert("🎉 Bersih! Tidak ditemukan Ghost Data pesanan.");
        setIsCleaningGhostData(false);
        return;
      }

      let deleteCount = 0;
      for (const ghost of toDeleteDocs) {
        if (ghost.docUniqueId && typeof ghost.docUniqueId === 'string' && !ghost.docUniqueId.startsWith('room_')) {
          batch.delete(doc(db, 'orders', ghost.docUniqueId));
          deleteCount++;
        }
      }

      if (deleteCount > 0) {
         await batch.commit();
         alert(`🧹 Sukses menghapus ${deleteCount} Ghost Data secara permanen dari Firestore!`);
      } else {
         alert("🎉 Bersih! Tidak ada Ghost Data yang dihapus.");
      }
    } catch (err: any) {
      console.error("Gagal sapu data ganda:", err);
      alert("Terjadi kesalahan saat menyapu data ganda.");
    } finally {
      setIsCleaningGhostData(false);
    }
  };

  // Realtime Audio & Visual Notification Toast state
  const [orderToastNotification, setOrderToastNotification] = useState<{
    id: string;
    orderId: string;
    custName: string;
    type: 'ORDER' | 'PAYMENT';
    orderData?: any;
    message: string;
  } | null>(null);
  const isInitialLoadRef = useRef(true);
  
  // Persistent Set of notified unique event keys (orders, payments, incoming messages)
  const notifiedKeysRef = useRef<Set<string>>((() => {
    try {
      const saved = sessionStorage.getItem('entong_admin_notified_keys');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {}
    return new Set<string>();
  })());

  const saveNotifiedKey = (key: string) => {
    if (!key) return;
    notifiedKeysRef.current.add(key);
    try {
      const arr = Array.from(notifiedKeysRef.current).slice(-500);
      sessionStorage.setItem('entong_admin_notified_keys', JSON.stringify(arr));
    } catch {}
  };

  const lastSoundPlayedAtRef = useRef<number>(0);

  const playNotificationSound = () => {
    const now = Date.now();
    // 🛑 Debounce Global Sound Trigger: Minimal 5-second cooldown damping
    if (now - lastSoundPlayedAtRef.current < 5000) {
      return;
    }
    lastSoundPlayedAtRef.current = now;

    try {
      // 1. Web Audio API synthesized "Ding" sound (Instant, crisp & works without network delay)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        // 1046.50 Hz is C6 (Crisp bell/ding tone)
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      }

      // 2. Play audio element as backup
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  // Request Browser Notification Permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((err) => {
        console.log('Browser notification permission error:', err);
      });
    }
  }, []);

  // Auto-Refresh Version Control
  useEffect(() => {
    let initialVersion: string | null = null;
    const unsubVersion = onSnapshot(doc(db, 'settings', 'appVersion'), (docSnap) => {
      if (docSnap.exists()) {
        const v = docSnap.data().version;
        if (initialVersion === null) {
          initialVersion = v;
        } else if (v !== initialVersion) {
          window.location.reload();
        }
      }
    });
    return () => unsubVersion();
  }, []);

  const triggerNativeEntongNotification = (title: string, bodyText: string, imageProofUrl?: string, deduplicationKey?: string) => {
    if (deduplicationKey) {
      if (notifiedKeysRef.current.has(deduplicationKey)) {
        return;
      }
      saveNotifiedKey(deduplicationKey);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const entongLogoUrl = 'https://ui-avatars.com/api/?name=Entong+Store&background=00E676&color=111b21&bold=true&size=256';

      const notificationOptions: any = {
        body: bodyText,
        icon: entongLogoUrl,           // Logo Entong Store (kiri)
        badge: entongLogoUrl,          // Badge icon Entong
        image: imageProofUrl || undefined, // Gambar preview jika ada
        tag: deduplicationKey || 'entong-admin-notification',
        renotify: true,
        silent: false,
      };

      try {
        const notif = new Notification(title || 'Entong Store Admin', notificationOptions);

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.error('Browser Notification error:', err);
      }
    }

    // Play debounced audio alert
    playNotificationSound();
  };

  // Auto dismiss toast notification after 5 seconds
  useEffect(() => {
    if (!orderToastNotification) return;
    const timer = setTimeout(() => {
      setOrderToastNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [orderToastNotification]);

  // =========================================================
  // REALTIME UNREAD MESSAGE TRACKER UNTUK CHAT STAFF INTERNAL
  // =========================================================
  const [unreadStaffCount, setUnreadStaffCount] = useState<number>(0);
  const [lastReadStaffTimestamp, setLastReadStaffTimestamp] = useState<number>(() => {
    return Number(localStorage.getItem('entong_last_read_staff_chat') || Date.now());
  });

  // LISTENER REALTIME MEMANTAU PESAN BARU STAFF
  useEffect(() => {
    const activeUserUid = currentUser?.id || currentUser?.uid;
    if (!activeUserUid) return;

    const staffChatRef = collection(db, 'staff_chats');
    const q = query(staffChatRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let unreadCount = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const msgTime = data.timestamp || (data.createdAt ? new Date(data.createdAt).getTime() : 0);
        if (data.senderUid !== activeUserUid && msgTime > lastReadStaffTimestamp) {
          unreadCount++;
        }
      });

      setUnreadStaffCount(unreadCount);

      // Mainkan suara notifikasi jika ada pesan baru saat sedang membuka menu lain
      if (unreadCount > 0 && activeMenu !== 'staff_chat' && mobileTab !== 'staff_chat') {
        try {
          const audio = new Audio('/sounds/notification.mp3');
          audio.play().catch(() => {
            playNotificationSound();
          });
        } catch (e) {
          playNotificationSound();
        }
      }
    }, (err) => console.error("Staff chat notification listener error:", err));

    return () => unsubscribe();
  }, [activeMenu, mobileTab, lastReadStaffTimestamp, currentUser]);

  // RESET NOTIFIKASI KETIKA TAB CHAT STAFF DIBUKA
  useEffect(() => {
    if (activeMenu === 'staff_chat' || mobileTab === 'staff_chat') {
      setUnreadStaffCount(0);
      const now = Date.now();
      setLastReadStaffTimestamp(now);
      localStorage.setItem('entong_last_read_staff_chat', now.toString());
    }
  }, [activeMenu, mobileTab]);

  const handleOpenStaffChatTab = () => {
    setActiveMenu('staff_chat');
    setMobileTab('staff_chat');
    setUnreadStaffCount(0);
    const now = Date.now();
    setLastReadStaffTimestamp(now);
    localStorage.setItem('entong_last_read_staff_chat', now.toString());
  };

  // =========================================================
  // REALTIME INCOMING CHAT NOTIFICATION FOR ADMIN (DEDUPLICATED)
  // =========================================================
  const isChatsInitialLoadRef = useRef(true);
  const lastKnownChatTimestampsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const qChats = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'), limit(35));
    const unsub = onSnapshot(qChats, (snap) => {
      if (isChatsInitialLoadRef.current) {
        snap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const t = (() => {
            const raw = d.lastMessageTime || d.updatedAt || d.createdAt;
            if (!raw) return Date.now();
            if (raw.toDate) return raw.toDate().getTime();
            if (raw.seconds) return raw.seconds * 1000;
            const parsed = new Date(raw).getTime();
            return isNaN(parsed) ? Date.now() : parsed;
          })();
          lastKnownChatTimestampsRef.current[docSnap.id] = t;
          saveNotifiedKey(`chat_${docSnap.id}_${t}`);
        });
        isChatsInitialLoadRef.current = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docSnap = change.doc;
          const data = docSnap.data();
          const docId = docSnap.id;

          const newTimestamp = (() => {
            const raw = data.lastMessageTime || data.updatedAt || data.createdAt;
            if (!raw) return Date.now();
            if (raw.toDate) return raw.toDate().getTime();
            if (raw.seconds) return raw.seconds * 1000;
            const parsed = new Date(raw).getTime();
            return isNaN(parsed) ? Date.now() : parsed;
          })();

          const oldTimestamp = lastKnownChatTimestampsRef.current[docId] || 0;
          const lastSender = (
            data.lastSender || 
            data.last_sender || 
            data.last_sender_role || 
            data.lastSenderRole || 
            ''
          ).toLowerCase();
          const isCustomer = lastSender === 'customer';
          const isUnread = (
            data.is_read_admin === false || 
            data.isReadByAdmin === false || 
            data.unreadByAdmin === true || 
            data.unread_by_admin === true || 
            (data.unreadAdminCount && data.unreadAdminCount > 0) ||
            (data.unreadCount && data.unreadCount > 0)
          );

          const notifKey = `chat_${docId}_${newTimestamp}`;
          const isAlreadyNotified = notifiedKeysRef.current.has(notifKey);

          // Update tracked timestamp
          if (newTimestamp > oldTimestamp) {
            lastKnownChatTimestampsRef.current[docId] = newTimestamp;
          }

          // Trigger ONLY IF:
          // 1. Last sender is customer
          // 2. Document is marked unread for Admin
          // 3. Timestamp is strictly newer than previous known timestamp
          // 4. This specific (docId + timestamp) key has NOT been notified yet
          // 5. Admin is not actively viewing this room right now (or window is hidden/minimized)
          if (
            isCustomer && 
            isUnread && 
            newTimestamp > oldTimestamp && 
            !isAlreadyNotified &&
            (selectedOrderId !== docId || document.hidden)
          ) {
            saveNotifiedKey(notifKey);
            const custName = data.customerName || data.customer_name || 'Pelanggan';
            const msgSnippet = data.lastMessage || data.last_message || 'Mengirim pesan baru...';

            triggerNativeEntongNotification(
              `💬 Chat Baru dari ${custName}`,
              msgSnippet,
              undefined,
              notifKey
            );
          }
        }
      });
    }, (err) => console.warn("Admin chat notification listener warning:", err));

    return () => unsub();
  }, [selectedOrderId]);

  // States for Order Filtering (Sub-Tab Status, Sub-Tab Jenis Order, Catalog Dropdown, Search Input, Date Filter)
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedTypeTab, setSelectedTypeTab] = useState<'ALL' | 'GIFT' | 'JOKO'>('ALL');
  const [selectedCatalogFilter, setSelectedCatalogFilter] = useState<string>('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [debouncedOrderSearchQuery, setDebouncedOrderSearchQuery] = useState<string>('');
  const [dateFilterType, setDateFilterType] = useState<'ALL' | 'TODAY' | 'CUSTOM'>('ALL');
  const [customSelectedDate, setCustomSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [debouncedHistorySearchQuery, setDebouncedHistorySearchQuery] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOrderSearchQuery(orderSearchQuery);
      setRenderLimitDatabase(30);
    }, 300);
    return () => clearTimeout(timer);
  }, [orderSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHistorySearchQuery(historySearchQuery);
      setRenderLimitHistory(30);
    }, 300);
    return () => clearTimeout(timer);
  }, [historySearchQuery]);

  // Helper Format Tanggal Indonesia
  const formatIndonesianDateTime = (val: any) => {
    if (!val) return { date: '-', time: '-' };
    try {
      const pureTime = extractTimeMs(val);
      if (!pureTime || isNaN(pureTime) || pureTime <= 0) {
        return { date: '-', time: '-' };
      }

      const d = new Date(pureTime);
      if (isNaN(d.getTime())) return { date: '-', time: '-' };

      const dateStr = d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\./g, ':');

      return { date: dateStr, time: timeStr };
    } catch {
      return { date: '-', time: '-' };
    }
  };

  useEffect(() => {
    // 1. Baca Koleksi 'orders' secara Murni (Tanpa orderBy Firestore agar tidak crash!)
    const ordersRef = query(collection(db, 'orders'), limit(150));
    
    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      // Populate notified keys on initial load to avoid firing notifications for existing orders
      if (isInitialLoadRef.current) {
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          saveNotifiedKey(`${doc.id}_new`);
          const proofUrl = data.proofOfPayment || data.payment_proof || data.proofUrl || '';
          if (proofUrl || data.paymentStatus === 'PENDING_VERIFICATION' || data.orderStatus === 'VERIFY_PAYMENT') {
            saveNotifiedKey(`${doc.id}_payment_${proofUrl || 'pending'}`);
          }
        });
        isInitialLoadRef.current = false;
      } else {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const docId = change.doc.id;
            const formattedOrderId = data.orderId || `#ORD-${docId.slice(-6).toUpperCase()}`;
            const custName = data.customerName || data.customer_name || data.robloxUsername || 'Customer';
            
            // Strictly check if new order key hasn't been notified yet
            const newOrderKey = `${docId}_new`;
            const isNewOrder = (change.type === 'added') && !notifiedKeysRef.current.has(newOrderKey);

            // Strictly check if new payment verification key hasn't been notified yet
            const proofUrl = data.proofOfPayment || data.payment_proof || data.proofUrl || '';
            const isPendingVerification = data.paymentStatus === 'PENDING_VERIFICATION' || data.orderStatus === 'VERIFY_PAYMENT' || data.orderStatus === 'PENDING_VERIFICATION';
            const paymentKey = `${docId}_payment_${proofUrl || (isPendingVerification ? 'pending' : '')}`;
            const isNewPaymentVerification = (isPendingVerification || Boolean(proofUrl)) && !notifiedKeysRef.current.has(paymentKey);

            if (isNewOrder || isNewPaymentVerification) {
              const notifDeduplicationKey = isNewOrder ? newOrderKey : paymentKey;
              saveNotifiedKey(notifDeduplicationKey);

              // Strict Bot & Placeholder Order Blocker
              const orderPrice = Number(data.totalPrice || data.price || 0);
              const isBotOrDraftOrZero = isJunkBotOrder(data) ||
                custName === '(Customer)' || 
                custName === 'Customer' || 
                custName.trim() === '(Customer)' || 
                custName.trim() === 'Customer' ||
                orderPrice <= 0 ||
                data.isDraft === true ||
                data.isBot === true ||
                data.isDummy === true ||
                data.isFictional === true;

              if (!isBotOrDraftOrZero) {
                const notifTitle = 'Entong Store Admin';
                const notifBody = isNewPaymentVerification 
                  ? `📷 Bukti Pembayaran Baru dari ${custName} (${formattedOrderId})`
                  : `🛒 Orderan Baru dari ${custName} (${formattedOrderId})`;

                triggerNativeEntongNotification(
                  notifTitle, 
                  notifBody, 
                  isNewPaymentVerification ? proofUrl : undefined, 
                  notifDeduplicationKey
                );

                const mappedOrder = {
                  id: docId,
                  source: 'orders_collection',
                  orderId: formattedOrderId,
                  customer_id: data.customerId || data.customer_id || '',
                  customerName: custName,
                  customer_name: custName,
                  customer_phone: data.customer_phone || data.customerPhone || data.whatsapp || '',
                  whatsapp: data.whatsapp || data.customer_phone || data.customerPhone || '',
                  gameName: data.gameName || data.game_name || data.packageName || 'Gamepass / Joko',
                  game_name: data.gameName || data.game_name || data.packageName || 'Gamepass / Joko',
                  packageName: data.packageName || data.package_name || '-',
                  package_name: data.packageName || data.package_name || '-',
                  totalPrice: orderPrice,
                  price: orderPrice,
                  proofOfPayment: proofUrl,
                  payment_proof: proofUrl,
                  paymentStatus: data.paymentStatus || 'PENDING_VERIFICATION',
                  orderStatus: data.status || data.orderStatus || 'NEW',
                  status: data.status || data.orderStatus || 'NEW',
                  robloxUsername: data.robloxUsername || data.game_username || data.targetUsername || '-',
                  targetUsername: data.targetUsername || data.robloxUsername || data.game_username || '-',
                  orderType: data.orderType || data.category || '',
                };

                setOrderToastNotification({
                  id: docId,
                  orderId: formattedOrderId,
                  custName: custName,
                  type: isNewPaymentVerification ? 'PAYMENT' : 'ORDER',
                  orderData: mappedOrder,
                  message: isNewPaymentVerification 
                    ? `🔔 [BUTUH CEK] Order ${formattedOrderId} (${custName}) telah mengunggah bukti pembayaran!`
                    : `🔔 [ORDER BARU] Order ${formattedOrderId} (${custName}) baru saja masuk!`
                });
              }
            }
          }
        });
      }

      // 🛑 The rendering and state population logic has been moved to useOrders custom hook.
      // This listener is now ONLY used for dispatching realtime push notifications for new orders/payments.
    }, (error) => {
      console.error("Orders listener error:", error);
    });

    return () => unsubscribeOrders();
  }, []);

  // Extract & sanitize unique game/catalog names for Dropdown Filter
  const validCatalogOptions = useMemo(() => {
    // A. Ambil daftar game resmi dari items/katalog
    const officialGames = (items || []).map((i: any) => i.game_name || i.gameName || i.category || i.title || i.name).filter(Boolean);

    // B. Kata kunci terlarang (blacklist trash words)
    const trashKeywords = [
      'chat', 'langsung', 'order', 'tes', 'test', 'null', 'undefined', '-', 
      'booking', 'jasa joko', 'gamepass / joko', 'gp - dds', 'pesanan baru',
      'form gamepass', 'menunggu', 'grup multi-game', 'grup paket', 'tanpa foto'
    ];

    // C. Kumpulkan dan normalisasi dari orders
    const extractedFromOrders = (adminLiveOrders || []).map((o: any) => o.game_name || o.gameName || o.packageName || o.package_name || '').filter(Boolean);

    const allCombined = [...officialGames, ...extractedFromOrders];

    const cleanList = Array.from(new Set(allCombined))
      .map((name: string) => name.trim())
      .filter((name: string) => {
        if (!name || name.length < 3) return false;
        const lower = name.toLowerCase();
        // Buang jika mengandung kata sampah
        return !trashKeywords.some(trash => lower.includes(trash));
      })
      .sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));

    return cleanList;
  }, [items, adminLiveOrders]);

  // Counter for Status Sub-Tabs
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: 0,
      NEW: 0,
      BOOKING: 0,
      PROSES: 0,
      SELESAI: 0,
      BATAL: 0,
      CANCEL: 0,
      HANGUS: 0,
    };

    adminLiveOrders.forEach((ord: any) => {
      if (ord.status === 'BELUM_ORDER') return;
      counts.ALL++;

      const st = (ord.status || ord.orderStatus || '').toUpperCase();
      if (st === 'NEW' || st === 'PENDING_VERIFICATION') {
        counts.NEW++;
      } else if (st === 'BOOKING' || st === 'ANTRIAN_LOGIN') {
        counts.BOOKING++;
      } else if (st === 'PROSES_WORKER' || st === 'PROSES' || st === 'BUTUH_LOGIN_ULANG') {
        counts.PROSES++;
      } else if (st === 'SELESAI') {
        counts.SELESAI++;
      } else if (st === 'CANCEL') {
        counts.CANCEL++;
        counts.BATAL++; // keep BATAL backward compat
      } else if (st === 'BATAL' || st === 'DIBATALKAN' || st === 'REJECTED') {
        counts.BATAL++;
      } else if (st === 'HANGUS' || st === 'EXPIRED') {
        counts.HANGUS++;
      }
    });

    return counts;
  }, [adminLiveOrders]);

  const handleCleanupBotOrders = async () => {
    if (!window.confirm("⚠️ KONFIRMASI: Apakah Anda yakin ingin menghapus seluruh orderan bot sampah (Rp 0, dummy, tanpa username/paket) secara permanen dari database Firestore?")) return;
    
    try {
      const { deletedCount } = await purgeAllBotAndDummyOrders();
      if (deletedCount > 0) {
        alert(`🧹 Sukses! Berhasil membersihkan ${deletedCount} orderan sampah / bot dari database Firestore.`);
      } else {
        alert(`🎉 Database sudah bersih! Tidak ada orderan bot / Rp 0 yang ditemukan.`);
      }
    } catch (err: any) {
      console.error("Gagal membersihkan bot orders:", err);
      alert("Terjadi kesalahan saat membersihkan data bot / orderan Rp 0.");
    }
  };

  // Integrated Filter logic for Order Table
  const filteredOrdersResult = useMemo(() => {
    const baseFiltered = adminLiveOrders.filter((order: any) => {
      if (order.status === 'BELUM_ORDER') return false;

      // Filter Status
      if (selectedStatusFilter !== 'ALL') {
        const st = (order.status || order.orderStatus || '').toUpperCase();
        if (selectedStatusFilter === 'NEW' && st !== 'NEW' && st !== 'PENDING_VERIFICATION') return false;
        if (selectedStatusFilter === 'BOOKING' && st !== 'BOOKING' && st !== 'ANTRIAN_LOGIN') return false;
        if (selectedStatusFilter === 'PROSES' && st !== 'PROSES_WORKER' && st !== 'PROSES' && st !== 'BUTUH_LOGIN_ULANG') return false;
        if (selectedStatusFilter === 'SELESAI' && st !== 'SELESAI') return false;
        if (selectedStatusFilter === 'BATAL' && st !== 'BATAL' && st !== 'CANCEL') return false;
        if (selectedStatusFilter === 'HANGUS' && st !== 'HANGUS' && st !== 'EXPIRED') return false;
        if (selectedStatusFilter === 'CANCEL' && st !== 'CANCEL') return false;
      }

      // Filter Jenis Orderan (Gift vs Joko)
      const orderType = (
        order.orderType || 
        order.category || 
        order.serviceType || 
        order.login_method || 
        order.loginMethod || 
        ''
      ).toString().toLowerCase();

      const pkgName = (order.package_name || order.packageName || '').toString().toLowerCase();
      
      const hasJokoCreds = Boolean(
        (order.robloxPassword && order.robloxPassword !== '-') || 
        (order.game_password && order.game_password !== '-') || 
        (order.jokoPassword && order.jokoPassword !== '-') || 
        (order.uangSebelumJoko && order.uangSebelumJoko !== '-')
      );

      const isGift = orderType.includes('gift') || orderType.includes('item') || orderType.includes('gamepass') || pkgName.includes('gift') || pkgName.includes('gamepass');
      const isJoko = orderType.includes('joko') || orderType.includes('push') || orderType.includes('service') || orderType.includes('login') || pkgName.includes('joko') || pkgName.includes('push') || hasJokoCreds;

      if (selectedTypeTab === 'GIFT') {
        if (!isGift && isJoko) return false;
        if (!isGift && hasJokoCreds) return false;
        if (orderType.includes('roblox login') || orderType.includes('joko')) return false;
      }

      if (selectedTypeTab === 'JOKO') {
        if (!isJoko && isGift && !hasJokoCreds) return false;
        if (orderType.includes('direct gift') && !hasJokoCreds) return false;
      }

      // Filter Katalog Game
      if (selectedCatalogFilter !== 'ALL') {
        const gName = (order.game_name || order.gameName || order.package_name || order.packageName || order.catalogName || '').toString().toLowerCase();
        if (!gName.includes(selectedCatalogFilter.toLowerCase())) return false;
      }

      // Filter Tanggal Order (Hari Ini / Pilih Tanggal Manual / Semua Tanggal)
      if (dateFilterType !== 'ALL') {
        const timeMs = extractTimeMs(order);
        if (!timeMs) return false;
        const d = new Date(timeMs);
        if (isNaN(d.getTime())) return false;

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const orderDateISO = `${year}-${month}-${day}`;

        if (dateFilterType === 'TODAY') {
          const today = new Date();
          const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          if (orderDateISO !== todayISO) return false;
        } else if (dateFilterType === 'CUSTOM' && customSelectedDate) {
          if (orderDateISO !== customSelectedDate) return false;
        }
      }

      return true;
    });

    // Multi-Keyword Smart Search
    const searched = applySmartSearch(baseFiltered, debouncedOrderSearchQuery);

    return searched.map((o: any) => ({
      ...o,
      pureTime: extractTimeMs(o) || getPureCreationTime(o)
    })).sort((a: any, b: any) => (extractTimeMs(b) || b.pureTime || 0) - (extractTimeMs(a) || a.pureTime || 0));
  }, [adminLiveOrders, selectedStatusFilter, selectedTypeTab, selectedCatalogFilter, debouncedOrderSearchQuery, dateFilterType, customSelectedDate]);
  
  const [currentChatNoteInput, setCurrentChatNoteInput] = useState('');
  useEffect(() => {
    if (selectedOrderId) {
      setCurrentChatNoteInput(chatNotes[selectedOrderId] || '');
    } else {
      setCurrentChatNoteInput('');
    }
  }, [selectedOrderId, chatNotes]);
  const [chatInput, setChatInput] = useState('');

  // Admin chat media upload
  const fileInputAdminRef = useRef<HTMLInputElement>(null);
  const adminChatEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    setTimeout(() => {
      adminChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  const [isUploadingAdminMedia, setIsUploadingAdminMedia] = useState(false);
  const [expandedMediaUrl, setExpandedMediaUrl] = useState<string | null>(null);

  // Unread chat filter & search (Anti-Lag Debounced)
  const [chatFilterTab, setChatFilterTab] = useState<'all' | 'unread'>('all');
  const [chatSearchInput, setChatSearchInput] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(25);

  useEffect(() => {
    setDisplayLimit(25);
  }, [chatFilterTab, chatSearchQuery]);

  // 🚀 ANTI-LAG DEBOUNCER: Tunggu 300ms setelah admin berhenti mengetik baru eksekusi pencarian
  useEffect(() => {
    const handler = setTimeout(() => {
      setChatSearchQuery(chatSearchInput);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [chatSearchInput]);

  // Global Deep Index for Chat Messages Search (Full-Text WhatsApp Style Search Engine)
  const [chatMessagesIndex, setChatMessagesIndex] = useState<Record<string, string[]>>({});

  // Populate message index when active room messages update
  useEffect(() => {
    if (selectedOrderId && Array.isArray(activeMessages) && activeMessages.length > 0) {
      const textList = activeMessages
        .map((m: any) => (m.text || m.content || m.message || '').toLowerCase().trim())
        .filter(Boolean);
      if (textList.length > 0) {
        setChatMessagesIndex(prev => {
          const existing = prev[selectedOrderId] || [];
          const combined = Array.from(new Set([...existing, ...textList]));
          return { ...prev, [selectedOrderId]: combined };
        });
      }
    }
  }, [selectedOrderId, activeMessages]);

  // Real-time listener for indexing messages across all chat rooms
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const msgsQuery = query(collectionGroup(db, 'messages'), limit(500));
      unsubscribe = onSnapshot(msgsQuery, (snapshot) => {
        const indexMap: Record<string, Set<string>> = {};

        snapshot.docs.forEach((doc) => {
          const data = doc.data() || {};
          const text = (data.text || data.content || data.message || '').toLowerCase().trim();
          if (!text) return;

          const parentPath = doc.ref.parent?.parent?.id; // e.g., room_xxx or direct-xxx
          const custId = data.customerId || data.customer_id;
          const ordId = data.orderId || data.order_id;

          const keys = [parentPath, custId, ordId, `room_${custId}`, `direct-${custId}`].filter(Boolean);

          keys.forEach((k: any) => {
            if (!indexMap[k]) indexMap[k] = new Set();
            indexMap[k].add(text);
          });
        });

        setChatMessagesIndex(prev => {
          const updated = { ...prev };
          Object.keys(indexMap).forEach(k => {
            const newTexts = Array.from(indexMap[k]);
            const existing = updated[k] || [];
            updated[k] = Array.from(new Set([...existing, ...newTexts]));
          });
          return updated;
        });
      }, (err) => {
        console.warn('collectionGroup messages listener warning:', err);
      });
    } catch (e) {
      console.warn('Failed to attach collectionGroup listener:', e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const indexedChatsRef = useRef<Set<string>>(new Set());

  // Function to index old message history for existing chats (Lazy Backfill Indexer)
  const indexHistoricalMessages = async (chatId: string) => {
    if (!chatId || indexedChatsRef.current.has(chatId)) return;
    indexedChatsRef.current.add(chatId);

    try {
      const { db } = await import('../../lib/firebase');

      const cleanChatId = chatId.replace(/^direct-/, '').replace(/^room_/, '');
      const targets = Array.from(new Set([chatId, `room_${cleanChatId}`, cleanChatId])).filter(Boolean);

      for (const targetId of targets) {
        const msgsRef = collection(db, 'chats', targetId, 'messages');
        const snapshot = await getDocs(msgsRef).catch(() => null);

        if (snapshot && !snapshot.empty) {
          const historicalTexts = snapshot.docs
            .map(d => {
              const data = d.data() || {};
              return (data.text || data.content || data.message || '').toLowerCase().trim();
            })
            .filter(Boolean);

          if (historicalTexts.length > 0) {
            await setDoc(doc(db, 'chats', targetId), {
              chatHistoryText: arrayUnion(...historicalTexts)
            }, { merge: true }).catch(() => {});

            setChatMessagesIndex(prev => {
              const existing = prev[targetId] || [];
              const combined = Array.from(new Set([...existing, ...historicalTexts]));
              return { ...prev, [targetId]: combined };
            });
          }
        }
      }
    } catch (err) {
      console.error("Error backfilling old messages:", err);
    }
  };

  // Lazy backfill when chat is opened
  useEffect(() => {
    if (selectedOrderId) {
      indexHistoricalMessages(selectedOrderId);
    }
  }, [selectedOrderId]);

  // Auto mark chat as read when opened and sync selectedChatId with AppContext
  useEffect(() => {
    if (selectedOrderId) {
      markChatAsRead(selectedOrderId, currentUser?.role || 'ADMIN');
      setSelectedChatId(selectedOrderId);
      scrollToBottom();
    } else {
      setSelectedChatId(null);
    }
  }, [selectedOrderId, setSelectedChatId, activeMessages.length]);

  const processAdminMediaFile = async (file: File) => {
    if (!file || !selectedOrderId) return;

    setIsUploadingAdminMedia(true);
    try {
      if (file.type.startsWith('image/')) {
        const compressedUrl = await compressImage(file, 800, 0.7);
        await sendMessage(selectedOrderId, '', compressedUrl, 'IMAGE');
      } else if (file.type.startsWith('video/')) {
        const compressedUrl = await compressVideo(file);
        await sendMessage(selectedOrderId, '', compressedUrl, 'VIDEO');
      } else {
        alert('Format file tidak didukung. Harap pilih foto atau video.');
      }
    } catch (err: any) {
      alert(err?.message || 'Gagal memproses file media.');
    } finally {
      setIsUploadingAdminMedia(false);
      if (fileInputAdminRef.current) fileInputAdminRef.current.value = '';
    }
  };

  const handleAdminMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAdminMediaFile(file);
  };

  const handleAdminPasteImage = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processAdminMediaFile(file);
          break;
        }
      }
    }
  };

  const [isPurgingChats, setIsPurgingChats] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const handlePurgeEmptyChats = async () => {
    if (!window.confirm('Apakah Anda yakin ingin membersihkan semua room chat kosong/ghost ("Chat dimulai") dari database?')) {
      return;
    }
    setIsPurgingChats(true);
    try {
      const count = await purgeEmptyChats();
      alert(`✅ Berhasil membersihkan ${count} room chat kosong/ghost dari database!`);
    } catch (err: any) {
      alert(`Gagal membersihkan chat kosong: ${err.message || 'Error'}`);
    } finally {
      setIsPurgingChats(false);
    }
  };

  const handleMarkAllChatsRead = async () => {
    setIsMarkingAllRead(true);
    try {
      const { collection, getDocs, writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      let count = 0;

      // 1. Reset collection 'chats'
      const chatsSnap = await getDocs(collection(db, 'chats')).catch(() => ({ docs: [] } as any));
      chatsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        if (
          d.is_read_admin === false || 
          d.isReadByAdmin === false || 
          d.unreadByAdmin === true || 
          d.unread_by_admin === true || 
          (d.unreadAdminCount && d.unreadAdminCount > 0) || 
          (d.unreadCount && d.unreadCount > 0) || 
          (d.unread_count && d.unread_count > 0)
        ) {
          batch.update(docSnap.ref, {
            unreadCount: 0,
            unread_count: 0,
            unreadAdminCount: 0,
            unreadByAdmin: false,
            unread_by_admin: false,
            unreadCountByAdmin: 0,
            adminUnread: 0,
            is_read_admin: true,
            isReadByAdmin: true
          });
          count++;
        }
      });

      // 2. Reset collection 'rooms'
      const roomsSnap = await getDocs(collection(db, 'rooms')).catch(() => ({ docs: [] } as any));
      roomsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        if (
          d.is_read_admin === false || 
          d.isReadByAdmin === false || 
          d.unreadByAdmin === true || 
          d.unread_by_admin === true || 
          (d.unreadAdminCount && d.unreadAdminCount > 0) || 
          (d.unreadCount && d.unreadCount > 0) || 
          (d.unread_count && d.unread_count > 0)
        ) {
          batch.update(docSnap.ref, {
            unreadCount: 0,
            unread_count: 0,
            unreadAdminCount: 0,
            unreadByAdmin: false,
            unread_by_admin: false,
            unreadCountByAdmin: 0,
            adminUnread: 0,
            is_read_admin: true,
            isReadByAdmin: true
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit().catch(() => {});
      }

      // Optimistically clear local chats state
      setChats(prev => prev.map(c => ({ 
        ...c, 
        unreadCount: 0, 
        unreadAdminCount: 0, 
        unreadByAdmin: false, 
        unread_by_admin: false, 
        is_read_admin: true, 
        isReadByAdmin: true 
      })));
      alert(`✅ Semua chat berhasil ditandai sudah dibaca!`);
    } catch (err: any) {
      console.error("Gagal tandai semua dibaca:", err);
      alert(`Gagal menandai chat: ${err.message || 'Error'}`);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // ⚡ Fast O(1) Indexed Maps for anti-freeze customer/order resolution
  const usersLookupMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const u of (users || [])) {
      if (u.id) map.set(u.id, u);
      if (u.uid) map.set(u.uid, u);
      if (u.phone) map.set(u.phone, u);
      if (u.username) map.set(u.username.toLowerCase(), u);
      if (u.name) map.set(u.name.toLowerCase(), u);
      if (u.email) map.set(u.email.toLowerCase(), u);
    }
    return map;
  }, [users]);

  const ordersLookupMap = useMemo(() => {
    const byId = new Map<string, any>();
    const byCustId = new Map<string, any>();
    for (const o of (orders || [])) {
      if (o.id) byId.set(o.id, o);
      if (o.customer_id && !byCustId.has(o.customer_id)) byCustId.set(o.customer_id, o);
    }
    return { byId, byCustId };
  }, [orders]);

  const staffIdSet = useMemo(() => {
    const s = new Set<string>(['own', 'admin', 'owner']);
    for (const u of (users || [])) {
      if (u.role === 'ADMIN' || u.role === 'OWNER' || u.role === 'WORKER' || u.username === 'own' || u.username === 'admin') {
        if (u.id) s.add(u.id);
        if (u.uid) s.add(u.uid);
        if (u.username) s.add(u.username.toLowerCase());
        if (u.email) s.add(u.email.toLowerCase());
      }
    }
    return s;
  }, [users]);

  // Filter and deduplicate chats for Admin Chat list (Full Realtime List)
  const uniqueChats = useMemo(() => {
    const combined = [...(unreadChats || []), ...(chats || [])];
    const seen = new Set<string>();
    const result: any[] = [];

    for (const room of combined) {
      const id = room.id || room.roomId;
      if (!id || seen.has(id)) continue;

      const cId = room.customer_id || room.customerId || room.id;
      if (cId && (staffIdSet.has(cId) || staffIdSet.has(cId.toLowerCase?.() || ''))) continue;
      if (typeof cId === 'string' && (cId.startsWith('admin_') || cId.startsWith('owner_'))) continue;
      if (room.customer_role === 'ADMIN' || room.customer_role === 'OWNER' || room.customer_role === 'WORKER' || room.role === 'admin' || room.role === 'owner') continue;

      seen.add(id);
      result.push(room);
    }
    return result;
  }, [chats, unreadChats, staffIdSet]);

  // 🗓️ Helper Format Pembatas Tanggal Chat (Date Divider)
  const formatChatDividerDate = (timestamp: any): string => {
    if (!timestamp) return 'Hari ini';
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp?.seconds ? timestamp.seconds * 1000 : timestamp);
    } else if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date();
    }
    if (isNaN(date.getTime())) return 'Hari ini';

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hari ini';
    if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
    
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Build clean list of all chat conversations with strict customer display name resolver
  const allChatConversations = useMemo(() => {
    const getSafeTime = (ts: any) => {
      if (!ts) return Date.now();
      if (ts.toDate) return ts.toDate().getTime();
      if (ts.seconds) return ts.seconds * 1000;
      const d = new Date(ts);
      return isNaN(d.getTime()) ? Date.now() : d.getTime();
    };

    return uniqueChats.map((room) => {
      const orderId = room.id;
      let name = getCustomerDisplayName(room, users, orders);
      let phone = '';
      let tag = 'Direct Chat';
      let type: 'direct' | 'order' = 'direct';

      // Fast O(1) matching order or user
      const ord = ordersLookupMap.byId.get(orderId) || ordersLookupMap.byCustId.get(room.customer_id) || ordersLookupMap.byCustId.get(room.customerId);
      const uId = (orderId.startsWith('direct-') || orderId.startsWith('room_')) ? orderId.replace('direct-', '').replace('room_', '') : (room.customer_id || room.customerId || '');
      const user = usersLookupMap.get(uId) || (room.customer_id ? usersLookupMap.get(room.customer_id) : undefined) || (room.customerId ? usersLookupMap.get(room.customerId) : undefined);

      if (ord) {
        tag = `#${ord.id.slice(-6)} - ${ord.game_name}`;
        type = 'order';
        phone = ord.customer_phone || (user ? user.phone : '');
      } else if (user) {
        phone = user.phone || '';
      }

      // Check admin read flags and unread counts strictly
      const isReadAdmin = room.is_read_admin === true || room.isReadByAdmin === true;
      const rawAdminUnread = typeof room.unreadAdminCount === 'number' 
        ? room.unreadAdminCount 
        : (typeof room.unreadCount === 'number' ? room.unreadCount : 0);
      const isUnreadByAdminFlag = room.unreadByAdmin === true || room.unread_by_admin === true;
      
      const lastSenderRole = (
        room.lastSender || 
        room.last_sender || 
        room.last_sender_role || 
        room.lastSenderRole || 
        room.lastSender?.role || 
        ''
      ).toLowerCase();
      const isCustomerSender = lastSenderRole === 'customer';

      let unreadCount = 0;
      if (isReadAdmin && !isUnreadByAdminFlag && rawAdminUnread === 0) {
        unreadCount = 0;
      } else if (rawAdminUnread > 0) {
        unreadCount = rawAdminUnread;
      } else if (isUnreadByAdminFlag) {
        unreadCount = 1;
      } else if (isCustomerSender && !isReadAdmin) {
        unreadCount = 1;
      } else {
        unreadCount = 0;
      }

      // Extract last message dynamically with comprehensive fallbacks
      let messageText = '';
      if (typeof room.last_message === 'string' && room.last_message.trim()) {
        messageText = room.last_message.trim();
      } else if (typeof room.lastMessage === 'string' && room.lastMessage.trim()) {
        messageText = room.lastMessage.trim();
      } else if (room.lastMessage && typeof room.lastMessage.message === 'string' && room.lastMessage.message.trim()) {
        messageText = room.lastMessage.message.trim();
      } else if (room.lastMessage && typeof room.lastMessage.text === 'string' && room.lastMessage.text.trim()) {
        messageText = room.lastMessage.text.trim();
      } else if (typeof room.lastMessageText === 'string' && room.lastMessageText.trim()) {
        messageText = room.lastMessageText.trim();
      } else if (typeof room.text === 'string' && room.text.trim()) {
        messageText = room.text.trim();
      } else if (typeof room.message === 'string' && room.message.trim()) {
        messageText = room.message.trim();
      }

      // Check indexed messages if still empty
      if (!messageText && chatMessagesIndex) {
        const msgs = chatMessagesIndex[orderId] || chatMessagesIndex[room.id] || chatMessagesIndex[uId] || chatMessagesIndex[`room_${uId}`] || [];
        if (msgs.length > 0) {
          messageText = msgs[msgs.length - 1] || '';
        }
      }

      const lastSenderUid = room.last_sender_uid || room.lastSenderUid || room.lastSender?.uid || room.last_sender_id || '';

      const lastChat = {
        message: messageText,
        created: room.updatedAt || room.lastMessage?.created || room.createdAt || new Date().toISOString(),
        sender_name: room.last_sender_name || '',
        sender_role: lastSenderRole,
        sender_uid: lastSenderUid
      };

      const robloxUser = String(
        room.robloxUsername || 
        room.targetUsername || 
        room.gameUsername || 
        room.game_username || 
        (ord as any)?.robloxUsername || 
        (ord as any)?.targetUsername || 
        (ord as any)?.game_username || 
        (ord as any)?.gameUsername || 
        (user as any)?.robloxUsername || ''
      );

      return { 
        id: orderId, 
        name, 
        tag, 
        lastChat, 
        unreadCount, 
        type, 
        phone, 
        rawUpdatedTime: getSafeTime(lastChat.created),
        robloxUser,
        roomObj: room,
        ordObj: ord,
        userObj: user
      };

    }).filter(Boolean).sort((a, b) => b.rawUpdatedTime - a.rawUpdatedTime);
  }, [uniqueChats, usersLookupMap, ordersLookupMap, users, orders, chatMessagesIndex]);

  // Background lazy backfill for list of conversations
  useEffect(() => {
    if (allChatConversations && allChatConversations.length > 0) {
      const timeout = setTimeout(() => {
        allChatConversations.slice(0, 10).forEach((conv: any) => {
          if (conv.id) indexHistoricalMessages(conv.id);
        });
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [allChatConversations.length]);

  // 🎯 STRICT UNREAD CHAT FILTERING (MURNI BERDASARKAN STATUS BELUM DIBACA)
  const isConvUnread = (conv: any) => {
    if (!conv) return false;
    const room = conv.roomObj || {};
    
    const isReadByAdmin = room.is_read_admin === true || room.isReadByAdmin === true;
    const unreadAdminCount = typeof room.unreadAdminCount === 'number' 
      ? room.unreadAdminCount 
      : (typeof room.unreadCount === 'number' ? room.unreadCount : 0);
    const unreadCount = typeof conv.unreadCount === 'number' ? conv.unreadCount : 0;
    const unreadByAdmin = room.unreadByAdmin === true || room.unread_by_admin === true;
    
    const lastSender = (
      conv.lastChat?.sender_role || 
      room.lastSender || 
      room.last_sender || 
      room.last_sender_role || 
      room.lastSenderRole || 
      ''
    ).toLowerCase();
    const isCustomer = lastSender === 'customer';

    // Strict exclusion: jika admin sudah membaca / membalas (isReadByAdmin true & counter 0 & unreadByAdmin false)
    if (isReadByAdmin && !unreadByAdmin && unreadAdminCount === 0 && unreadCount === 0) {
      return false;
    }

    // Strict inclusion criteria (Kriteria Murni Belum Dibaca):
    // 1. Nilai counter unread lebih dari 0
    if (unreadAdminCount > 0 || unreadCount > 0) {
      return true;
    }

    // 2. Flag unread aktif: chat.unreadByAdmin === true
    if (unreadByAdmin) {
      return true;
    }

    // 3. Pesan terakhir berasal dari customer dan belum dibalas admin
    if (isCustomer && !isReadByAdmin) {
      return true;
    }

    return false;
  };

  const unreadConversations = useMemo(() => {
    return allChatConversations.filter(isConvUnread);
  }, [allChatConversations]);

  // Total unread messages from customers across all chats (accurate database wide)
  const totalUnreadMessages = useMemo(() => {
    return unreadConversations.reduce((acc, c) => acc + (c.unreadCount || 1), 0);
  }, [unreadConversations]);

  const getConvStatus = (convItem: { id: string; name?: string; phone?: string; ordObj?: any; roomObj?: any }) => {
    if (convItem.ordObj?.orderStatus || convItem.ordObj?.status) {
      return convItem.ordObj.orderStatus || convItem.ordObj.status;
    }
    if (convItem.roomObj?.orderStatus || convItem.roomObj?.status) {
      return convItem.roomObj.orderStatus || convItem.roomObj.status;
    }
    return 'NEW';
  };

  const handleDeleteChat = async (activeChatId: string) => {
    if (!activeChatId) return;
    if (window.confirm('Yakin ingin menghapus semua riwayat chat dan room chat ini? Data customer akan tetap aman di Kelola Customer.')) {
      try {
        await clearOrderChats(activeChatId);
        setSelectedOrderId('');
        setMobileChatView('LIST');
        alert('Chat berhasil dihapus');
      } catch (error) {
        console.error('Gagal menghapus chat:', error);
        alert('Gagal menghapus chat');
      }
    }
  };

  // Multi-field & Full-Text Message Search Filter (WhatsApp Style Search Engine)
  const renderCustomerBadge = (nameStr: string, isGuestFlag?: boolean) => {
    if (!nameStr) return null;
    const isGuest = isGuestFlag === true || nameStr.toLowerCase().includes('guest') || /^cust[_\-0-9]/i.test(nameStr);
    if (isGuest) {
      return null;
    }
    return <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-black rounded uppercase tracking-wider shadow-sm flex-shrink-0" title="Verified Account">👤 RESMI</span>;
  };

  const newCustomerSearchTargets = React.useMemo(() => {
    if (!chatSearchQuery || !chatSearchQuery.trim()) return [];
    const searchKeywords = chatSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (searchKeywords.length === 0) return [];

    return users.filter(u => {
      if (u.role === 'ADMIN') return false;
      const omniUser = `
        ${u.name || ''} 
        ${u.username || ''} 
        ${u.phone || ''} 
        ${(u as any).robloxUsername || ''}
      `.toLowerCase();

      const match = searchKeywords.every(kw => omniUser.includes(kw));
      if (!match) return false;

      // Exclude if already in allChatConversations
      const alreadyInConv = allChatConversations.some(c => 
        c.id === 'direct-' + u.id || 
        c.id === 'room_' + u.id || 
        (c.phone && u.phone && c.phone === u.phone) ||
        (c.name && (c.name.toLowerCase() === (u.name || '').toLowerCase() || c.name.toLowerCase() === (u.username || '').toLowerCase()))
      );
      return !alreadyInConv;
    }).map(u => ({
      id: 'room_' + u.id,
      name: u.name,
      tag: `Mulai Chat Baru (${u.phone || u.username})`,
      lastChat: null,
      unreadCount: 0,
      type: 'direct' as const,
      phone: u.phone || '',
      isNewCustomerTarget: true,
      userObj: u
    }));
  }, [chatSearchQuery, users, allChatConversations]);

  const displayConversations = React.useMemo(() => {
    const baseList = chatFilterTab === 'unread' ? unreadConversations : allChatConversations;

    if (!chatSearchQuery || !chatSearchQuery.trim()) {
      return baseList;
    }

    const searchKeywords = chatSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (searchKeywords.length === 0) return baseList;

    const filtered = baseList.filter((conv: any) => {
      const room = conv.roomObj;
      const ord = conv.ordObj;
      const user = conv.userObj;

      const targetCustId = (conv.id && (String(conv.id).startsWith('direct-') || String(conv.id).startsWith('room_'))) 
        ? String(conv.id).replace('direct-', '').replace('room_', '') 
        : String(conv.id || '');

      // 1. Cek Nama Customer / Display Name / Account Name
      const safeName = String(conv.name || (room ? getCustomerDisplayName(room) : '') || user?.name || user?.username || user?.displayName || '');

      // 2. Cek Username Roblox Target
      const safeRobloxUser = String(conv.robloxUser || '');

      // 3. Cek Nomor WhatsApp / Phone
      const safeWaNumber = String(
        conv.phone || 
        room?.whatsapp || 
        room?.phone || 
        room?.customer_phone ||
        ord?.customer_phone || 
        ord?.whatsapp || 
        user?.phone || 
        user?.whatsapp ||
        ''
      );

      // 4. Cek Order ID & Nama Paket / Game Name / Tag
      const safeOrderId = String(conv.id || ord?.id || room?.orderId || room?.order_id || '');
      const safePackageName = String(
        conv.tag || 
        ord?.game_name || 
        ord?.package_name || 
        room?.packageName || 
        room?.gameName || 
        ''
      );

      // 5. Cek Catatan Internal Admin (Note)
      const note = String(chatNotes[conv.id] || '');

      // 6. Cek Isi Kalimat Pesan Terakhir
      const safeLastMsg = String(
        conv.lastChat?.message || 
        room?.last_message || 
        (typeof room?.lastMessage === 'string' ? room.lastMessage : room?.lastMessage?.message) || 
        room?.lastMessageText || 
        room?.text || 
        ''
      );

      // 7. DEEP SEARCH: Cek Semua Kalimat Pesan yang Pernah Dikirim
      let deepMessagesText = '';
      const keysToLookup = [conv.id, targetCustId, `room_${targetCustId}`, `direct-${targetCustId}`, room?.id, room?.order_id, ord?.id].filter(Boolean);
      for (const k of keysToLookup) {
        const roomMessages = chatMessagesIndex[k];
        if (roomMessages && roomMessages.length > 0) {
          deepMessagesText += ' ' + roomMessages.join(' ');
        }
      }

      if (room && Array.isArray(room.chatHistoryText)) {
        deepMessagesText += ' ' + room.chatHistoryText.join(' ');
      }
      if (conv && Array.isArray(conv.chatHistoryText)) {
        deepMessagesText += ' ' + conv.chatHistoryText.join(' ');
      }
      if (room && Array.isArray(room.messages)) {
        deepMessagesText += ' ' + room.messages.map((m: any) => m?.text || m?.content || m?.message || '').join(' ');
      }
      if (selectedOrderId === conv.id && Array.isArray(activeMessages) && activeMessages.length > 0) {
        deepMessagesText += ' ' + activeMessages.map((m: any) => m?.text || m?.content || m?.message || '').join(' ');
      }

      // Gabungkan seluruh metadata room ke dalam satu wadah string omni
      const searchableOmniText = `
        ${safeName} 
        ${safeRobloxUser} 
        ${safeWaNumber} 
        ${safeOrderId} 
        ${safePackageName} 
        ${note} 
        ${safeLastMsg} 
        ${deepMessagesText}
      `.toLowerCase();

      // 🔥 KUNCI TEPAT SASARAN (STRICT MATCH): Pastikan SEMUA kata kunci ADA di dalam wadah teks omni
      return searchKeywords.every(keyword => searchableOmniText.includes(keyword));
    });

    if (chatFilterTab === 'all' && newCustomerSearchTargets.length > 0) {
      return [...filtered, ...newCustomerSearchTargets];
    }
    return filtered;
  }, [chatFilterTab, unreadConversations, allChatConversations, chatSearchQuery, chatNotes, chatMessagesIndex, selectedOrderId, activeMessages, newCustomerSearchTargets]);

  const filteredConversations = displayConversations;

  const handleSelectConversationItem = useCallback((convItem: any) => {
    if (!convItem) return;
    const targetRoomId = (convItem.isNewCustomerTarget && convItem.userObj)
      ? 'room_' + convItem.userObj.id
      : (convItem.id || convItem.chatId || convItem.roomId);

    setSelectedOrderId(targetRoomId);
    setSelectedChatId(targetRoomId);
    setActiveSelectedConv(convItem);
    setMobileChatView('ROOM');
    setChatSearchQuery('');

    // 🚨 MUTLAK: RESET NOTIFIKASI BELUM DIBACA SAAT CHAT DIBUKA (OPTIMISTIC & MEMORY)
    convItem.unreadCount = 0;
    convItem.is_read_admin = true;
    convItem.isReadByAdmin = true;
    if (convItem.roomObj) {
      convItem.roomObj.unreadAdminCount = 0;
      convItem.roomObj.unreadCount = 0;
      convItem.roomObj.unreadByAdmin = false;
      convItem.roomObj.unread_by_admin = false;
      convItem.roomObj.is_read_admin = true;
      convItem.roomObj.isReadByAdmin = true;
    }

    setChats((prevChats: any[]) => prevChats.map((c: any) => {
      if (c.id === targetRoomId || c.order_id === targetRoomId || c.customer_id === targetRoomId || `room_${c.customer_id}` === targetRoomId) {
        return { 
          ...c, 
          unreadCount: 0, 
          unreadAdminCount: 0, 
          unreadByAdmin: false, 
          unread_by_admin: false, 
          is_read_admin: true, 
          isReadByAdmin: true 
        };
      }
      return c;
    }));

    // Non-blocking background sync
    setTimeout(async () => {
      if (convItem.isNewCustomerTarget && convItem.userObj) {
        const existingChat = chats.some(c => c.order_id === targetRoomId || c.order_id === convItem.userObj.id || c.id === targetRoomId || c.order_id === `direct-${convItem.userObj.id}` || c.order_id === `room_${convItem.userObj.id}` || c.id === `room_${convItem.userObj.id}`);
        if (!existingChat) {
          await sendMessage(targetRoomId, `Halo ${convItem.userObj.name}! Ada yang bisa kami bantu?`).catch(() => {});
        }
      } else {
        indexHistoricalMessages(targetRoomId);
        markChatAsRead(targetRoomId, currentUser?.role || 'ADMIN');
      }

      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const chatRef = doc(db, 'chats', targetRoomId);
        const roomRef = doc(db, 'rooms', targetRoomId);
        
        const resetPayload = {
          unreadCount: 0,
          unreadAdminCount: 0,
          unreadByAdmin: false,
          unread_by_admin: false,
          is_read_admin: true,
          isReadByAdmin: true,
          unreadCountByAdmin: 0,
          adminUnread: 0,
          unread_count: 0
        };

        setDoc(chatRef, resetPayload, { merge: true }).catch(() => {});
        setDoc(roomRef, resetPayload, { merge: true }).catch(() => {});
      } catch (e) {
        console.warn("Gagal update unread count:", e);
      }
    }, 0);
  }, [chats, currentUser?.role, indexHistoricalMessages, markChatAsRead, sendMessage, setSelectedChatId, setSelectedOrderId, setChats]);
  
  // Mobile Chat view mode (LIST or ROOM)
  const [mobileChatView, setMobileChatView] = useState<'LIST' | 'ROOM'>('LIST');
  const [showMobileTopbar, setShowMobileTopbar] = useState<boolean>(false);
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(false);

  // 🎯 REALTIME ROOM AUTO-OPEN: Buka room chat target otomatis dari parameter / sessionStorage / event
  const lastOpenedTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const checkAndOpenTargetRoom = (explicitTarget?: string) => {
      const params = new URLSearchParams(window.location.search);
      const target = explicitTarget || params.get('room') || sessionStorage.getItem('active_chat_target');
      if (!target) return;

      if (lastOpenedTargetRef.current === target) return;

      const targetLower = target.toLowerCase();
      
      // 1. Cari di allChatConversations
      const matchedConv = allChatConversations.find((c: any) => 
        c.id === target ||
        c.id === `room_${target}` ||
        `room_${c.id}` === target ||
        c.phone === target ||
        (c.name && c.name.toLowerCase() === targetLower) ||
        (c.robloxUser && c.robloxUser.toLowerCase() === targetLower)
      );

      if (matchedConv) {
        lastOpenedTargetRef.current = target;
        sessionStorage.removeItem('active_chat_target');
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {}
        handleSelectConversationItem(matchedConv);
        setActiveMenu('chat');
        setMobileTab('chat');
        setMobileChatView('ROOM');
        return;
      }

      // 2. Cari di users atau orders
      const matchedUser = users.find((u: any) =>
        u.id === target ||
        u.phone === target ||
        (u.name && u.name.toLowerCase() === targetLower) ||
        (u.username && u.username.toLowerCase() === targetLower) ||
        (u.robloxUsername && u.robloxUsername.toLowerCase() === targetLower)
      );

      if (matchedUser) {
        lastOpenedTargetRef.current = target;
        sessionStorage.removeItem('active_chat_target');
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {}
        const roomId = `room_${matchedUser.id}`;
        setSelectedOrderId(roomId);
        setSelectedChatId(roomId);
        setActiveMenu('chat');
        setMobileTab('chat');
        setMobileChatView('ROOM');
        return;
      }

      const matchedOrder = orders.find((o: any) =>
        o.id === target ||
        o.order_id === target ||
        o.customer_id === target ||
        `room_${o.customer_id}` === target ||
        o.customer_phone === target ||
        (o.customer_name && o.customer_name.toLowerCase() === targetLower) ||
        (o.game_username && o.game_username.toLowerCase() === targetLower) ||
        ((o as any).robloxUsername && (o as any).robloxUsername.toLowerCase() === targetLower)
      );

      if (matchedOrder) {
        lastOpenedTargetRef.current = target;
        sessionStorage.removeItem('active_chat_target');
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {}
        const roomId = matchedOrder.id.startsWith('room_') ? matchedOrder.id : (matchedOrder.customer_id ? `room_${matchedOrder.customer_id}` : `room_${matchedOrder.id}`);
        setSelectedOrderId(roomId);
        setSelectedChatId(roomId);
        setActiveMenu('chat');
        setMobileTab('chat');
        setMobileChatView('ROOM');
      }
    };

    checkAndOpenTargetRoom();

    const handleCustomOrderChatEvent = (e: any) => {
      const order = e.detail;
      if (!order) return;
      const targetId = order.customer_phone || order.whatsapp || order.room_id || order.chat_id || order.id || order.order_id || order.roblox_username || order.customer_name || order.customer_id;
      if (targetId) {
        sessionStorage.setItem('active_chat_target', String(targetId));
        checkAndOpenTargetRoom(String(targetId));
      }
    };

    window.addEventListener('open-admin-chat-order', handleCustomOrderChatEvent);
    return () => {
      window.removeEventListener('open-admin-chat-order', handleCustomOrderChatEvent);
    };
  }, [allChatConversations, users, orders, handleSelectConversationItem, setSelectedOrderId, setSelectedChatId]);

  // POS Order form state
  const [posCustType, setPosCustType] = useState<'NEW' | 'EXISTING'>('NEW');
  const [selectedExistingCustId, setSelectedExistingCustId] = useState<string>('');
  const [posCustSearch, setPosCustSearch] = useState<string>('');
  const [posCustomerName, setPosCustomerName] = useState('');
  const [posCustomerPhone, setPosCustomerPhone] = useState('');
  const [posCreateAccount, setPosCreateAccount] = useState<boolean>(true);
  const [posUsername, setPosUsername] = useState<string>('');
  const [posPassword, setPosPassword] = useState<string>('');
  const [posSelectedItemId, setPosSelectedItemId] = useState(items[0]?.id || '');
  const [posGameUsername, setPosGameUsername] = useState('');
  const [posGamePassword, setPosGamePassword] = useState('');
  const [posNote, setPosNote] = useState('');
  const [posCloudNumber, setPosCloudNumber] = useState('');

  // Multi-catalog item cart state
  const [posCart, setPosCart] = useState<Array<{ id: string; itemId?: string; game_name: string; package_name: string; price: number; qty: number }>>([]);
  const [orderModalCart, setOrderModalCart] = useState<Array<{ id: string; itemId?: string; game_name: string; package_name: string; price: number; qty: number }>>([]);
  const [jokoModalCart, setJokoModalCart] = useState<Array<{ id: string; itemId?: string; game_name: string; package_name: string; price: number; qty: number }>>([]);
  const [selectedModalCatalogId, setSelectedModalCatalogId] = useState<string>('');
  const [selectedJokoCatalogId, setSelectedJokoCatalogId] = useState<string>('');

  // Helper functions for multi-catalog item carts
  const addCatalogToCartHelper = (
    cart: Array<{ id: string; itemId?: string; game_name: string; package_name: string; price: number; qty: number }>,
    item: GameItem
  ) => {
    const idx = cart.findIndex(c => c.itemId === item.id || (c.game_name === item.game_name && c.package_name === item.package_name));
    if (idx >= 0) {
      const next = [...cart];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    }
    return [
      ...cart,
      {
        id: 'ci-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        itemId: item.id,
        game_name: item.game_name,
        package_name: item.package_name,
        price: item.price,
        qty: 1
      }
    ];
  };

  const updateCartQtyHelper = (
    cart: Array<{ id: string; itemId?: string; game_name: string; package_name: string; price: number; qty: number }>,
    id: string,
    delta: number
  ) => {
    return cart.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c);
  };

  const removeCartItemHelper = (
    cart: Array<{ id: string; itemId?: string; game_name: string; package_name: string; price: number; qty: number }>,
    id: string
  ) => {
    return cart.filter(c => c.id !== id);
  };

  const calcCartSummaryHelper = (
    cart: Array<{ id: string; itemId?: string; game_name: string; package_name: string; price: number; qty: number }>,
    fallbackGame = 'Mobile Legends',
    fallbackPkg = 'Paket Joko',
    fallbackPrice = 50000
  ) => {
    if (!cart || cart.length === 0) {
      return {
        game_name: fallbackGame,
        package_name: fallbackPkg,
        price: fallbackPrice,
        totalQty: 1
      };
    }
    const multiGames = Array.from(new Set(cart.map(c => c.game_name))).join(', ');
    const combinedPackage = cart.map(c => `${c.qty > 1 ? `${c.qty}x ` : ''}${c.game_name} - ${c.package_name} (Rp ${(c.price * c.qty).toLocaleString('id-ID')})`).join(' + ');
    const totalPrice = cart.reduce((s, c) => s + (c.price * c.qty), 0);
    const totalQty = cart.reduce((s, c) => s + c.qty, 0);
    return {
      game_name: multiGames || fallbackGame,
      package_name: combinedPackage,
      price: totalPrice,
      totalQty
    };
  };

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GameItem | null>(null);

  // Quick Reply modal (Admin only)
  const [showQrModal, setShowQrModal] = useState(false);
  const [editingQr, setEditingQr] = useState<QuickReplyTemplate | null>(null);

  // Customer modal
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCust, setEditingCust] = useState<UserProfile | null>(null);

  // Edit Paket Joko Modal (Kelola Customer)
  const [showEditJokoModal, setShowEditJokoModal] = useState(false);
  const [editingJokoOrder, setEditingJokoOrder] = useState<GameOrder | null>(null);

  // Staff modal (Admin only)
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);

  // Order modal (Edit order)
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<GameOrder | null>(null);

  // Lightbox view for payment proof
  const [viewingProofOrder, setViewingProofOrder] = useState<GameOrder | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState<boolean>(false);

  // Account details overlay modal state
  const [selectedOrderForAccount, setSelectedOrderForAccount] = useState<GameOrder | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Customer search query in admin panel
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');

  // Finance Filter & Add Modal state
  const [financeFilterMode, setFinanceFilterMode] = useState<'ALL' | 'DAILY' | 'MONTHLY' | 'CUSTOM_DATE'>('ALL');
  const [financeCustomDate, setFinanceCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showFinanceModal, setShowFinanceModal] = useState<boolean>(false);
  const [finType, setFinType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [finCategory, setFinCategory] = useState<string>('Joko Game');
  const [finAmount, setFinAmount] = useState<string>('');
  const [finDesc, setFinDesc] = useState<string>('');
  const [finDate, setFinDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // History Filter states
  const [historyFilterMode, setHistoryFilterMode] = useState<'ALL' | 'DAILY' | 'CUSTOM_DATE'>('ALL');
  const [historyCustomDate, setHistoryCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'SELESAI' | 'PROSES' | 'BATAL'>('ALL');

  // Auto-fill Customer Name in POS form according to sequence code
  useEffect(() => {
    if (posCustType === 'NEW' && !posCustomerName) {
      setPosCustomerName(getNextCustCode());
    }
  }, [posCustType, custCounter]);

  // Sync orderModalCart when editingOrder opens
  useEffect(() => {
    if (showOrderModal && editingOrder) {
      if (orderModalCart.length === 0) {
        setOrderModalCart([{
          id: 'ci-exist-' + Date.now(),
          itemId: '',
          game_name: editingOrder.game_name || 'Mobile Legends',
          package_name: editingOrder.package_name || 'Paket Joko',
          price: editingOrder.price || 0,
          qty: 1
        }]);
      }
    } else if (!showOrderModal) {
      setOrderModalCart([]);
    }
  }, [showOrderModal, editingOrder?.id]);

  // Sync jokoModalCart when editingJokoOrder opens
  useEffect(() => {
    if (showEditJokoModal && editingJokoOrder) {
      if (jokoModalCart.length === 0) {
        setJokoModalCart([{
          id: 'ci-joko-exist-' + Date.now(),
          itemId: '',
          game_name: editingJokoOrder.game_name || 'Mobile Legends',
          package_name: editingJokoOrder.package_name || 'Paket Joko',
          price: editingJokoOrder.price || 0,
          qty: 1
        }]);
      }
    } else if (!showEditJokoModal) {
      setJokoModalCart([]);
    }
  }, [showEditJokoModal, editingJokoOrder?.id]);

  const todayStr = new Date().toISOString().split('T')[0];

  const extractCustCode = (name?: string) => {
    if (!name) return '';
    const match = name.match(/Cust-\d+/i);
    return match ? match[0].toUpperCase() : '';
  };

  const filteredHistoryOrders = useMemo(() => {
    const baseFiltered = adminLiveOrders.filter(o => {
      if (o.status === 'BELUM_ORDER') return false;

      // Date filter
      if (historyFilterMode !== 'ALL') {
        const timeMs = extractTimeMs(o);
        if (!timeMs) return false;
        const d = new Date(timeMs);
        if (isNaN(d.getTime())) return false;

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const oDate = `${year}-${month}-${day}`;

        if (historyFilterMode === 'DAILY') {
          const today = new Date();
          const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          if (oDate !== todayISO) return false;
        } else if (historyFilterMode === 'CUSTOM_DATE' && historyCustomDate) {
          if (oDate !== historyCustomDate) return false;
        }
      }

      // Status filter
      if (historyStatusFilter !== 'ALL') {
        const st = (o.status || o.orderStatus || '').toUpperCase();
        if (historyStatusFilter === 'SELESAI' && st !== 'SELESAI') return false;
        if (historyStatusFilter === 'BATAL' && st !== 'BATAL' && st !== 'CANCEL') return false;
        if (historyStatusFilter === 'PROSES' && (st === 'SELESAI' || st === 'BATAL' || st === 'CANCEL')) return false;
      }

      return true;
    });

    const searched = applySmartSearch(baseFiltered, debouncedHistorySearchQuery);
    return searched.sort((a: any, b: any) => (extractTimeMs(b) || b.pureTime || 0) - (extractTimeMs(a) || a.pureTime || 0));
  }, [adminLiveOrders, historyFilterMode, historyCustomDate, historyStatusFilter, debouncedHistorySearchQuery]);

  const directCustId = (selectedOrderId?.startsWith('direct-') || selectedOrderId?.startsWith('room_')) ? selectedOrderId.replace('direct-', '').replace('room_', '') : null;
  const directCust = directCustId ? users.find(u => u.id === directCustId) : null;

  let foundOrder = orders.find(o => o.id === selectedOrderId || o.customer_id === selectedOrderId || o.id === selectedOrderId.replace(/^room_/, ''));
  const foundConv = allChatConversations.find(c => c.id === selectedOrderId || c.id === `room_${selectedOrderId}` || c.id === selectedOrderId.replace(/^room_/, '')) || 
    (activeSelectedConv && (activeSelectedConv.id === selectedOrderId || activeSelectedConv.id === `room_${selectedOrderId}` || activeSelectedConv.id === selectedOrderId.replace(/^room_/, '') || activeSelectedConv.roomId === selectedOrderId) ? activeSelectedConv : null);

  if (activeMenu === 'chat' && foundOrder && (foundOrder.status === 'SELESAI' || foundOrder.status === 'BATAL' || foundOrder.status === 'CANCEL')) {
    foundOrder = undefined;
  }

  let fallbackOrderFromUser: GameOrder | null = null;
  if (!foundOrder && foundConv) {
    const activeRoom = chats.find(c => c.id === selectedOrderId || c.order_id === selectedOrderId || c.customer_id === selectedOrderId || c.id === `room_${selectedOrderId}`) || (unreadChats || []).find(c => c.id === selectedOrderId || c.order_id === selectedOrderId || c.customer_id === selectedOrderId || c.id === `room_${selectedOrderId}`);
    const targetUserId = activeRoom?.customer_id || activeRoom?.customerId || foundConv.customerId || foundConv.customer_id;
    if (targetUserId) {
      fallbackOrderFromUser = orders.find(o => o.customer_id === targetUserId && o.status !== 'SELESAI' && o.status !== 'BATAL' && o.status !== 'CANCEL') || null;
    } else {
      const matchedUser = users.find(u => (foundConv.name && u.name?.toLowerCase() === foundConv.name?.toLowerCase()) || (foundConv.phone && u.phone === foundConv.phone));
      if (matchedUser) {
        fallbackOrderFromUser = orders.find(o => (o.customer_id === matchedUser.id || o.customer_phone === matchedUser.phone) && o.status !== 'SELESAI' && o.status !== 'BATAL' && o.status !== 'CANCEL') || null;
      }
    }
  }  const activeOrder = foundOrder || fallbackOrderFromUser || (directCust ? {
    id: 'room_' + directCust.id,
    customer_id: directCust.id,
    customer_name: directCust.name,
    customer_phone: directCust.phone || '',
    game_name: 'Chat Langsung',
    package_name: 'Tanpa Order',
    price: 0,
    status: 'BELUM_ORDER',
    created: directCust.created,
    game_username: '',
    updated: Date.now()
  } as unknown as GameOrder : (foundConv ? {
    id: foundConv.id,
    customer_id: foundConv.customerId || foundConv.customer_id || '',
    customer_name: foundConv.name,
    customer_phone: foundConv.phone || '',
    game_name: foundConv.type === 'order' ? (foundConv.tag.includes(' - ') ? foundConv.tag.split(' - ').slice(1).join(' - ') : 'Order Joko') : 'Chat Langsung',
    package_name: 'Proses Admin',
    price: 0,
    status: 'BOOKING',
    created: Date.now(),
    game_username: '',
    updated: Date.now()
  } as unknown as GameOrder : (selectedOrderId ? {
    id: selectedOrderId,
    customer_id: directCustId || '',
    customer_name: activeSelectedConv?.name || 'Customer',
    customer_phone: activeSelectedConv?.phone || '',
    game_name: 'Chat Langsung',
    package_name: 'Proses Admin',
    price: 0,
    status: 'BOOKING',
    created: Date.now(),
    game_username: '',
    updated: Date.now()
  } as unknown as GameOrder : null)));
  const targetCustId = activeOrder?.customer_id || ((selectedOrderId.startsWith('direct-') || selectedOrderId.startsWith('room_')) ? selectedOrderId.replace('direct-', '').replace('room_', '') : '');
  const targetCustPhone = activeOrder?.customer_phone || '';
  const targetCustName = activeOrder?.customer_name || '';

  // Pilar 3: Idle disconnect listener for Admin (5 minutes = 300,000 ms)
  const [isAdminIdle, setIsAdminIdle] = useState(false);
  const adminIdleTimerRef = useRef<NodeJS.Timeout | null>(null);
  

  useEffect(() => {
    const resetAdminIdle = () => {
      setIsAdminIdle(false);
      if (adminIdleTimerRef.current) clearTimeout(adminIdleTimerRef.current);
      adminIdleTimerRef.current = setTimeout(() => {
        setIsAdminIdle(true);
      }, 5 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetAdminIdle));
    resetAdminIdle();

    return () => {
      if (adminIdleTimerRef.current) clearTimeout(adminIdleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, resetAdminIdle));
    };
  }, []);

  // Compute target room IDs associated with selected conversation using canonical room resolver
  

  // Subcollection real-time room chat listener across all customer room aliases for Admin
  

  
  // PILAR 1: CENTRALIZED STATE - Use activeMessages from AppContext directly
  const orderChats = useMemo(() => {
    return activeMessages || [];
  }, [activeMessages]);


  // Auto scroll to bottom when room messages update
  useEffect(() => {
    if (selectedOrderId && orderChats.length > 0) {
      scrollToBottom();
    }
  }, [selectedOrderId, orderChats.length]);

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'BELUM_ORDER':
        return <span className="px-2.5 py-1 bg-slate-500/20 text-slate-300 border border-slate-500/40 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">⏳ Belum Order</span>;
      case 'BOOKING':
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">⏳ Booking</span>;
      case 'ANTRIAN_LOGIN':
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">🕒 Antrian Login</span>;
      case 'PROSES_WORKER':
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-[#00E676] border border-[#00E676]/40 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">⚡ Proses Worker</span>;
      case 'BUTUH_LOGIN_ULANG':
        return <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">⚠️ Butuh Login Ulang</span>;
      case 'SELESAI':
        return <span className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">✓ Selesai</span>;
      case 'BATAL':
        return <span className="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/40 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">✕ Batal / Tolak</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full text-[11px] font-bold">{status}</span>;
    }
  };

  const activeCustId = activeOrder?.customer_id || ((selectedOrderId.startsWith('direct-') || selectedOrderId.startsWith('room_')) ? selectedOrderId.replace('direct-', '').replace('room_', '') : '');
  const activeCustPhone = activeOrder?.customer_phone || '';
  const isMutedActive = isUserMuted(activeCustId) || (activeCustPhone ? isUserMuted(activeCustPhone) : false);
  const muteSecsActive = Math.max(getMuteRemainingSeconds(activeCustId), activeCustPhone ? getMuteRemainingSeconds(activeCustPhone) : 0);

  const selectedChatRoom = chats.find(c => c.id === selectedOrderId || c.order_id === selectedOrderId || c.customer_id === selectedOrderId || c.id === `room_${selectedOrderId}`) || 
    (unreadChats || []).find(c => c.id === selectedOrderId || c.order_id === selectedOrderId || c.customer_id === selectedOrderId || c.id === `room_${selectedOrderId}`) || 
    (activeSelectedConv?.roomObj || (activeSelectedConv && (activeSelectedConv.id === selectedOrderId || activeSelectedConv.id === `room_${selectedOrderId}`) ? activeSelectedConv : null)) || 
    null;

  const activeUser = users.find(u => 
    u.id === activeCustId || 
    (activeCustPhone && u.phone === activeCustPhone) || 
    (u.name && activeOrder?.customer_name && u.name.toLowerCase() === activeOrder.customer_name.toLowerCase())
  );

  const activeCustomerName = getCustomerDisplayName(selectedChatRoom || activeOrder || { customerId: activeCustId });
  const rawUsername = selectedChatRoom?.robloxUsername || activeUser?.username || '';
  const isAutoUsername = !rawUsername || /^cust[_\-0-9]/i.test(rawUsername);
  const activeUsername = (!isAutoUsername && rawUsername) ? `@${rawUsername.replace(/^@/, '')}` : '';
  const displayHeaderUsername = activeUsername ? `${activeCustomerName} (${activeUsername})` : activeCustomerName;

  const isStatusUpdatingRef = useRef(false);

  const handleUpdateChatStatusHeader = async (chatId: string, newStatus: string) => {
    if (!chatId) return;
    try {
      const { db } = await import('../../lib/firebase');

      const targetChatId = selectedChatRoom?.firestoreDocId || selectedChatRoom?.id || chatId;

      // A. Hanya update status dokumen chat dan order terkait menggunakan helper global
      let finalOrderId = chatId;
      const cleanOrderId = chatId.replace(/^room_/, '').replace(/^direct-/, '');
      
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      if (cleanOrderId.startsWith('#ORD-') || cleanOrderId.startsWith('ORD-') || cleanOrderId.startsWith('room_') || cleanOrderId.startsWith('direct-')) {
        const cleanHashId = cleanOrderId.replace(/^#/, '');
        const snap = await getDocs(query(collection(db, 'orders'), where('orderId', 'in', [cleanOrderId, cleanHashId, `#${cleanHashId}`])));
        if (!snap.empty) {
          finalOrderId = snap.docs[0].id;
        } else {
          const snap2 = await getDocs(query(collection(db, 'orders'), where('id', 'in', [cleanOrderId, cleanHashId, `#${cleanHashId}`])));
          if (!snap2.empty) finalOrderId = snap2.docs[0].id;
        }
      } else {
        finalOrderId = cleanOrderId;
      }

      const { updateOrderStatusGlobal } = await import('../../utils/orderUtils');
      await updateOrderStatusGlobal(finalOrderId, newStatus);

      // B. Kirim pesan sistem otomatis tanpa merusak array/listener messages yang ada

      // B. Kirim pesan sistem otomatis tanpa merusak array/listener messages yang ada
      const messagesRef = collection(db, 'chats', targetChatId, 'messages');
      await addDoc(messagesRef, {
        text: `📑 [STATUS UPDATE] Status pesanan telah diperbarui menjadi: ${newStatus}`,
        message: `📑 [STATUS UPDATE] Status pesanan telah diperbarui menjadi: ${newStatus}`,
        sender: 'system',
        senderType: 'system',
        senderRole: 'system',
        sender_role: 'system',
        senderName: 'System',
        sender_name: 'System',
        createdAt: serverTimestamp(),
        isSystem: true
      });

      if (newStatus === 'SELESAI') {
        await addDoc(messagesRef, {
          text: 'Mohon tinggalkan ulasan untuk pelayanan kami!',
          message: 'Mohon tinggalkan ulasan untuk pelayanan kami!',
          sender: 'system',
          senderType: 'system',
          senderRole: 'system',
          sender_role: 'system',
          senderName: 'System',
          sender_name: 'System',
          createdAt: serverTimestamp(),
          isSystem: true,
          type: 'review_prompt'
        }).catch(() => {});
      }

      // C. JAGA AGAR STATE MESSAGES LOKAL TIDAK DI-RESET / TERHAPUS
    } catch (err) {
      console.error("Gagal update status chat:", err);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!orderId) return;
    try {
      const { updateOrderStatusGlobal } = await import('../../utils/orderUtils');
      await updateOrderStatusGlobal(orderId, newStatus);
      
      const cleanOrderId = orderId.replace(/^room_/, '').replace(/^direct-/, '');
      const { db } = await import('../../lib/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const messagesRef = collection(db, 'chats', orderId.startsWith('room_') ? orderId : (orderId.startsWith('direct-') ? orderId : `room_${cleanOrderId}`), 'messages');
      await addDoc(messagesRef, {
        text: `📑 [STATUS UPDATE] Status pesanan telah diperbarui menjadi: ${newStatus}`,
        message: `📑 [STATUS UPDATE] Status pesanan telah diperbarui menjadi: ${newStatus}`,
        sender: 'system',
        senderType: 'system',
        senderRole: 'system',
        sender_role: 'system',
        senderName: 'System',
        sender_name: 'System',
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        isSystem: true,
        type: 'status_update'
      }).catch(() => {});
    } catch (err) {
      console.error("Gagal update status:", err);
    }
  };

  const handleOrderStatusChange = async (firestoreDocId: string, newStatus: string) => {
    if (!firestoreDocId) return;
    try {
      const { updateOrderStatusGlobal } = await import('../../utils/orderUtils');
      await updateOrderStatusGlobal(firestoreDocId, newStatus);
    } catch (err) {
      console.error("Gagal update status order:", err);
    }
  };

  // Add-on handler to append custom package name and price to an existing order
  const handleAddonOrder = async (orderId: string, currentPackage: string, currentPrice: number) => {
    const addonName = window.prompt("Nama Tambahan (Contoh: +100JT):");
    if (!addonName || !addonName.trim()) return;

    const addonPriceInput = window.prompt("Harga Tambahan (Rp):", "0");
    if (addonPriceInput === null) return;
    const addonPrice = Number(addonPriceInput.replace(/[^0-9]/g, '')) || 0;

    const updatedPackage = `${currentPackage || 'Paket Joki'} | ${addonName.trim()}`;
    const updatedPrice = (Number(currentPrice) || 0) + addonPrice;

    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        package_name: updatedPackage,
        packageName: updatedPackage,
        item_name: updatedPackage,
        product_name: updatedPackage,
        price: updatedPrice,
        totalPrice: updatedPrice,
        order_price: updatedPrice,
        updatedAt: serverTimestamp()
      });

      alert(`Berhasil menambahkan add-on "${addonName.trim()}" (Rp ${addonPrice.toLocaleString('id-ID')}) ke pesanan #${orderId.slice(-6)}`);
    } catch (err: any) {
      console.error("Gagal update add-on order:", err);
      alert("Gagal menambahkan add-on: " + (err?.message || 'Error'));
    }
  };

  const handleVerifyPayment = async (orderId: string, currentOrder: any) => {
    if (!orderId) return;
    try {
      const { updateOrderStatusGlobal } = await import('../../utils/orderUtils');
      await updateOrderStatusGlobal(orderId, 'BOOKING');
      
      const cleanOrderId = orderId.replace(/^room_/, '').replace(/^direct-/, '');
      const { db } = await import('../../lib/firebase');
      const { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const orderRef = doc(db, 'orders', cleanOrderId);
      await setDoc(orderRef, {
        isPaymentVerified: true,
        paymentStatus: 'VERIFIED',
        verifiedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
      
      const targetChatId = currentOrder?.chatId || currentOrder?.customer_id || currentOrder?.customerId || currentOrder?.id || orderId;
      if (targetChatId) {
        const cleanChatId = targetChatId.startsWith('room_') || targetChatId.startsWith('guest_') ? targetChatId : `room_${targetChatId}`;
        await setDoc(doc(db, 'chats', cleanChatId), {
          isPaymentVerified: true,
          paymentStatus: 'PAID'
        }, { merge: true }).catch(() => {});
        
        await addDoc(collection(db, 'chats', cleanChatId, 'messages'), {
          text: `✅ Pembayaran berhasil diverifikasi! Pesanan grup Anda telah masuk antrean [BOOKING]. Mohon tunggu proses pengerjaan oleh tim Entong Store.`,
          senderId: 'system',
          type: 'status_update',
          createdAt: serverTimestamp()
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Payment Verification Failed:", err);
    }
  };

  const handleRequestReview = async () => {
    if (!selectedOrderId) return;
    try {
      await sendMessage(selectedOrderId, 'Mohon tinggalkan ulasan untuk pelayanan kami!', undefined, undefined, true, 'review_prompt');
      alert('Permintaan ulasan telah dikirim ke customer.');
    } catch (err: any) {
      alert("Gagal meminta ulasan: " + (err.message || 'Silakan coba lagi.'));
    }
  };

  const handleSendFinalWarning = async (targetOrderParam?: any) => {
    const currentOrd = targetOrderParam || activeOrder || (orders || []).find((o: any) => o.id === selectedOrderId || o.customer_id === activeCustId);
    if (!currentOrd) {
      setOrderToastNotification({
        id: `warn_err_${Date.now()}`,
        orderId: 'ERROR',
        custName: 'System',
        type: 'ORDER',
        message: '⚠️ Silakan pilih room / orderan terlebih dahulu.'
      });
      return;
    }

    try {
      const res = await sendExpiredWarningMessage(currentOrd, false, chats);
      if (res.success) {
        setOrderToastNotification({
          id: `warn_ok_${Date.now()}`,
          orderId: currentOrd.orderId || currentOrd.id || 'ORDER',
          custName: currentOrd.customer_name || 'Customer',
          type: 'ORDER',
          message: '🚨 Pesan peringatan terakhir berhasil dikirim ke chat customer!'
        });
      } else {
        setOrderToastNotification({
          id: `warn_fail_${Date.now()}`,
          orderId: currentOrd.orderId || currentOrd.id || 'ORDER',
          custName: currentOrd.customer_name || 'Customer',
          type: 'ORDER',
          message: `⚠️ Gagal mengirim peringatan: ${res.message}`
        });
      }
    } catch (err: any) {
      console.error("Gagal mengirim peringatan terakhir:", err);
      setOrderToastNotification({
        id: `warn_exc_${Date.now()}`,
        orderId: currentOrd.orderId || currentOrd.id || 'ORDER',
        custName: currentOrd.customer_name || 'Customer',
        type: 'ORDER',
        message: `⚠️ Gagal mengirim peringatan: ${err?.message || 'Silakan coba lagi.'}`
      });
    }
  };

  // 📝 SEND JOKI CREDENTIAL FORM TO ROOM CHAT
  const handleSendJokiCredentialForm = async (targetOrderParam?: any) => {
    const currentOrd = targetOrderParam || activeOrder || (orders || []).find((o: any) => o.id === selectedOrderId || o.customer_id === activeCustId);
    const targetChatId = selectedChatRoom?.firestoreDocId || selectedChatRoom?.id || (currentOrd ? `room_${currentOrd.customer_id || currentOrd.id}` : selectedOrderId);
    
    if (!currentOrd && !selectedOrderId) {
      setOrderToastNotification({
        id: `form_err_${Date.now()}`,
        orderId: 'ERROR',
        custName: 'System',
        type: 'ORDER',
        message: '⚠️ Silakan pilih room / orderan terlebih dahulu.'
      });
      return;
    }

    const rawCat = ((currentOrd as any)?.category || (currentOrd as any)?.service_type || '').toLowerCase();
    const pkg = (currentOrd?.package_name || (currentOrd as any)?.packageName || '').toLowerCase();
    const game = (currentOrd?.game_name || '').toLowerCase();
    const isJoki = rawCat.includes('joki') || rawCat.includes('joko') || rawCat.includes('leveling') || (currentOrd as any)?.isJoko === true || (currentOrd as any)?.isJoki === true || pkg.includes('joko') || pkg.includes('joki') || game.includes('joko') || game.includes('joki');

    if (!isJoki && currentOrd) {
      alert('Formulir ini khusus untuk pesanan Joki / Joko.');
      return;
    }

    const ordId = currentOrd?.id || currentOrd?.orderId || selectedOrderId;
    const pkgName = currentOrd?.package_name || (currentOrd as any)?.packageName || 'Layanan Joki';
    const defaultUsername = currentOrd?.robloxUsername || currentOrd?.roblox_username || currentOrd?.game_username || '';
    const cleanRoomId = String(targetChatId || '').replace(/^chats\//, '');

    try {
      const formPayload = {
        order_id: ordId,
        orderId: ordId,
        orderPackage: pkgName,
        package_name: pkgName,
        sender: 'admin',
        sender_id: 'admin',
        sender_name: currentUser?.name || currentUser?.username || 'Admin Entong Store',
        sender_role: 'ADMIN',
        senderName: currentUser?.name || currentUser?.username || 'Admin Entong Store',
        senderRole: 'ADMIN',
        message: 'Silakan lengkapi form data akun untuk proses pengerjaan joki di bawah ini.',
        text: 'Silakan lengkapi form data akun untuk proses pengerjaan joki di bawah ini.',
        type: 'JOKI_CREDENTIAL_FORM',
        status: 'PENDING_FILL',
        formData: {
          username: defaultUsername,
          password: '',
          initialMoney: ''
        },
        is_read: false,
        created: new Date().toISOString(),
        createdAt: serverTimestamp(),
        timestamp: Date.now()
      };

      await addDoc(collection(db, 'chats', cleanRoomId, 'messages'), formPayload);

      await updateDoc(doc(db, 'chats', cleanRoomId), {
        lastMessage: '📝 [FORM KREDENSIAL JOKI] Silakan lengkapi data akun Roblox & Uang Awal.',
        last_message: '📝 [FORM KREDENSIAL JOKI] Silakan lengkapi data akun Roblox & Uang Awal.',
        last_sender_role: 'ADMIN',
        is_read_customer: false,
        updatedAt: serverTimestamp()
      }).catch(() => {});

      setOrderToastNotification({
        id: `form_ok_${Date.now()}`,
        orderId: String(ordId),
        custName: currentOrd?.customer_name || 'Customer',
        type: 'ORDER',
        message: '📝 Form kredensial joki berhasil dikirim ke room chat customer!'
      });
    } catch (err: any) {
      console.error('Gagal mengirim form kredensial joki:', err);
      setOrderToastNotification({
        id: `form_fail_${Date.now()}`,
        orderId: String(ordId),
        custName: 'Error',
        type: 'ORDER',
        message: `⚠️ Gagal mengirim form: ${err?.message || 'Silakan coba lagi.'}`
      });
    }
  };

  // 🕒 AUTO-SEND PERINGATAN EXPIRED KETIKA PESANAN GIFT SUDAH >= 2 HARI (48 JAM)
  const isCheckingWarningsRef = useRef(false);
  const warnedOrdersMemoryRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!orders || orders.length === 0) return;
    
    // Cegah overlapping concurrent checks
    if (isCheckingWarningsRef.current) return;

    const timeoutId = setTimeout(async () => {
      if (isCheckingWarningsRef.current) return;
      isCheckingWarningsRef.current = true;
      try {
        const eligibleOrders = orders.filter((o: any) => {
          const docId = String(o.docUniqueId || o.firestoreId || o.id || '');
          if (!docId || warnedOrdersMemoryRef.current.has(docId)) return false;
          return isEligibleForAuto2DayWarning(o);
        });

        if (eligibleOrders.length > 0) {
          eligibleOrders.forEach((o: any) => {
            const docId = String(o.docUniqueId || o.firestoreId || o.id || '');
            if (docId) warnedOrdersMemoryRef.current.add(docId);
          });

          const { dispatchedCount } = await checkAndDispatchAuto2DayWarnings(eligibleOrders, chats);
          if (dispatchedCount > 0) {
            console.log(`[AutoExpiredWatcher] Berhasil mengirimkan ${dispatchedCount} peringatan otomatis (2 hari belum join).`);
          }
        }
      } catch (err) {
        console.error("[AutoExpiredWatcher] Error during auto warning check:", err);
      } finally {
        isCheckingWarningsRef.current = false;
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [orders?.length, chats?.length]);

  const handleDeleteOrder = async (firestoreDocId: string, orderDisplayId: string) => {
    if (!firestoreDocId) {
      alert("ID Dokumen tidak valid untuk dihapus.");
      return;
    }

    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus permanen orderan ${orderDisplayId || firestoreDocId || ''}?`);
    if (!confirmDelete) return;

    try {
      // ✅ GUNAKAN ID DOKUMEN FIRESTORE UNIK ASLI
      const orderDocRef = doc(db, 'orders', firestoreDocId);
      await deleteDoc(orderDocRef);

      // Bersihkan juga rujukan fallback di chat jika order ini berasal/terhubung dengan chat
      if (chats && chats.length > 0) {
        const matchingChats = chats.filter((c: any) => 
          c.id === firestoreDocId || 
          c.orderId === orderDisplayId || 
          c.orderId === firestoreDocId ||
          c.chatId === firestoreDocId
        );
        for (const chatItem of matchingChats) {
          try {
            await updateDoc(doc(db, 'chats', chatItem.id), {
              orderId: '',
              hasOrder: false,
              packageName: '',
              totalPrice: 0,
              price: 0
            });
          } catch (e) {
            // ignore error
          }
        }
      }

      alert("Orderan berhasil dihapus permanen dari Database!");

    } catch (error: any) {
      console.error("Gagal menghapus orderan dari Firestore:", error);
      alert(`Gagal menghapus orderan: ${error.message}`);
    }
  };

  // TOGGLE BAN USER
  const handleToggleBan = async (userId: string, currentBanStatus: boolean) => {
    if (!userId) return;
    const newBanStatus = !currentBanStatus;
    const actionText = newBanStatus ? 'Memblokir (BAN)' : 'Membuka Blokir (UNBAN)';

    if (!window.confirm(`Apakah Anda yakin ingin ${actionText} akun ini?`)) return;

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isBanned: newBanStatus,
        bannedAt: newBanStatus ? new Date().toISOString() : null
      });
      if (newBanStatus) {
        if (typeof banUser === 'function') banUser(userId);
      } else {
        if (typeof unbanUser === 'function') unbanUser(userId);
      }
      alert(`Akun berhasil di-${newBanStatus ? 'BAN' : 'UNBAN'}!`);
    } catch (err: any) {
      console.error("Gagal update status Ban:", err);
      alert(`Gagal: ${err.message}`);
    }
  };

  // SET MUTE 15 MENIT
  const handleMuteUser = async (userId: string, currentMutedUntil: string | null) => {
    if (!userId) return;

    const isCurrentlyMuted = currentMutedUntil && new Date(currentMutedUntil).getTime() > Date.now();
    
    try {
      const userRef = doc(db, 'users', userId);
      if (isCurrentlyMuted) {
        await updateDoc(userRef, { mutedUntil: null });
        if (typeof unmuteUser === 'function') unmuteUser(userId);
        alert("Status Mute berhasil dicabut!");
      } else {
        const muteDurationMs = 15 * 60 * 1000; // 15 Menit
        const mutedUntilTime = new Date(Date.now() + muteDurationMs).toISOString();

        await updateDoc(userRef, { mutedUntil: mutedUntilTime });
        if (typeof muteUser === 'function') muteUser(userId, 15);
        alert("User berhasil di-Mute selama 15 menit!");
      }
    } catch (err: any) {
      console.error("Gagal update Mute:", err);
      alert(`Gagal Mute: ${err.message}`);
    }
  };

  const handleSendDirectMessage = useCallback((msgText: string, targetIdOverride?: string) => {
    const trimmed = (msgText || '').trim();
    if (!trimmed) return;
    const targetRoomId = targetIdOverride || selectedOrderId;
    if (!targetRoomId) return;

    const matchedQr = quickReplies.find(qr => 
      qr.shortcut.toLowerCase() === trimmed.toLowerCase() || 
      `/${qr.shortcut.toLowerCase()}` === trimmed.toLowerCase()
    );
    if (matchedQr) {
      sendMessage(targetRoomId, matchedQr.message, undefined, undefined, true).catch((err: any) => {
        console.error("Gagal mengirim pesan quick reply:", err);
      });
    } else {
      sendMessage(targetRoomId, trimmed).catch((err: any) => {
        console.error("Gagal mengirim pesan:", err);
      });
    }
  }, [selectedOrderId, quickReplies, sendMessage]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !chatInput.trim()) return;
    const trimmed = chatInput.trim();
    setChatInput('');
    await handleSendDirectMessage(trimmed, selectedOrderId);
  };

  const handleSendFromInput = useCallback((msg: string) => {
    handleSendDirectMessage(msg);
  }, [handleSendDirectMessage]);

  const handleApplyQuickReply = async (qrMessage: string, targetIdOverride?: string) => {
    if (!isAdmin) {
      alert('Akses Quick Reply hanya untuk Admin.');
      return;
    }
    const targetRoomId = targetIdOverride || selectedOrderId;
    if (!targetRoomId) return;
    try {
      await sendMessage(targetRoomId, qrMessage, undefined, undefined, true);
    } catch (err: any) {
      alert("Gagal mengirim pesan: " + (err.message || 'Silakan coba lagi.'));
    }
  };

  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPosLoading) return;
    
    let effectiveCart = [...posCart];
    if (effectiveCart.length === 0) {
      const selected = items.find(i => i.id === posSelectedItemId) || items[0];
      if (selected) {
        effectiveCart = [{
          id: 'pos-' + Date.now(),
          itemId: selected.id,
          game_name: selected.game_name,
          package_name: selected.package_name,
          price: selected.price,
          qty: 1
        }];
      }
    }

    if (effectiveCart.length === 0) {
      alert('Silakan pilih minimal 1 item katalog joko!');
      return;
    }

    const summary = calcCartSummaryHelper(effectiveCart);

    setIsPosLoading(true);
    try {
      let custUserId = 'cust-manual-' + Date.now();
      let finalCustName = posCustomerName;
      let finalCustPhone = posCustomerPhone;
      let newUserObj: any = null;

      if (posCustType === 'EXISTING') {
        const existingUser = users.find(u => u.id === selectedExistingCustId);
        if (existingUser) {
          custUserId = existingUser.id;
          finalCustName = existingUser.name;
          finalCustPhone = existingUser.phone || posCustomerPhone || '081234567890';
        } else {
          alert('Silakan pilih customer terdaftar terlebih dahulu!');
          setIsPosLoading(false);
          return;
        }
      } else {
        const rawName = posCustomerName.trim() || 'Pelanggan Baru';
        if (posCreateAccount) {
          const custCode = getNextCustCode();
          finalCustName = rawName.startsWith('Cust-') ? rawName : `${custCode} - ${rawName}`;
          const cleanUsername = posUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || `cust_${custCode.replace('Cust-', '')}`;
          const finalPassword = posPassword.trim() || '123456';
          finalCustPhone = posCustomerPhone.trim() || '081234567890';
          
          newUserObj = {
            id: 'u-cust-' + Date.now(),
            username: cleanUsername,
            password: finalPassword,
            name: finalCustName,
            email: `${cleanUsername}@entongchat.local`,
            phone: finalCustPhone,
            role: 'CUSTOMER',
            created: new Date().toISOString()
          };
          custUserId = newUserObj.id;

          // Save new customer account into Context and Firestore database
          await saveUser(newUserObj);
        } else {
          const custCode = getNextCustCode();
          finalCustName = rawName.startsWith('Cust-') ? rawName : `${custCode} - ${rawName}`;
        }
      }

      // Create new order using AppContext createOrder handler (Grouped under 1 Order ID)
      await createOrder({
        customer_id: custUserId,
        customer_name: finalCustName || 'Pelanggan POS',
        customer_phone: finalCustPhone || '081234567890',
        game_name: summary.game_name,
        package_name: summary.package_name,
        price: summary.price,
        status: 'PROSES_WORKER',
        game_username: posGameUsername || '',
        game_password: posGamePassword || '',
        login_method: 'Moonton',
        note: posNote || '',
        cloud_number: posCloudNumber.trim() || '',
        worker_id: currentUser?.id || '',
        worker_name: currentUser?.name || 'Admin'
      });

      // Record income entry in finance log
      await addFinanceRecord({
        type: 'INCOME',
        category: `Joko ${summary.game_name}`,
        amount: summary.price,
        description: `POS Order (${summary.totalQty} item) oleh ${currentUser?.name || 'Admin'} untuk ${finalCustName}`,
        date: new Date().toISOString().split('T')[0],
        created_by: currentUser?.name || 'Admin'
      });

      alert(`✓ Order POS Berhasil Disimpan!\nCustomer: ${finalCustName}\nTotal Katalog: ${summary.totalQty} item\nTotal Harga: Rp ${summary.price.toLocaleString('id-ID')}\n${posCustType === 'NEW' && posCreateAccount && newUserObj ? `\n🔑 INFORMASI AKUN LOGIN CUSTOMER:\n• Username: ${newUserObj.username}\n• Password: ${newUserObj.password}\n(Silakan berikan informasi ini kepada customer agar bisa login)` : ''}`);

      setPosCart([]);
      setPosCustomerName(getNextCustCode());
      setPosCustomerPhone('');
      setPosCreateAccount(false);
      setPosUsername('');
      setPosPassword('');
      setPosGameUsername('');
      setPosGamePassword('');
      setPosNote('');
      setPosCloudNumber('');
      setActiveMenu('chat');
    } catch (err) {
      console.error('POS Submit Error:', err);
      alert('Gagal memproses order POS. Coba lagi.');
    } finally {
      setIsPosLoading(false);
    }
  };


  const rejectPaymentVerification = async (orderId: string, reason: string, orderData: any) => {
    try {
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, 'orders', orderId), {
        status: "Cancel",
        statusCode: "CANCEL",
        paymentStatus: "DITOLAK",
        isPaid: false,
        isPaymentVerified: false,
        refundStatus: "NONE",
        isRefunded: false,
        rejectionReason: reason,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const targetCustId = orderData?.customer_id || orderData?.id;
      let targetRoomId = targetCustId ? (targetCustId.startsWith('room_') ? targetCustId : `room_${targetCustId}`) : `room_${orderId}`;
      if (targetRoomId.startsWith('room_room_')) targetRoomId = targetRoomId.replace('room_room_', 'room_');

      const rejectionMessage = {
        text: `❌ **VERIFIKASI PEMBAYARAN DITOLAK**\n\nPembayaran sebesar Rp ${Number(orderData?.price || orderData?.totalAmount || 0).toLocaleString('id-ID')} untuk order #${orderId} ditolak oleh admin karena dana belum masuk ke mutasi atau bukti transfer tidak valid.\n\nPesanan telah dibatalkan secara otomatis tanpa penambahan saldo. Silakan kirimkan ulang bukti mutasi/struk transfer yang sah melalui chat ini. Terima kasih!`,
        message: `❌ **VERIFIKASI PEMBAYARAN DITOLAK**\n\nPembayaran sebesar Rp ${Number(orderData?.price || orderData?.totalAmount || 0).toLocaleString('id-ID')} untuk order #${orderId} ditolak oleh admin karena dana belum masuk ke mutasi atau bukti transfer tidak valid.\n\nPesanan telah dibatalkan secara otomatis tanpa penambahan saldo. Silakan kirimkan ulang bukti mutasi/struk transfer yang sah melalui chat ini. Terima kasih!`,
        senderRole: "system",
        sender_role: "system",
        senderName: "Sistem Verifikasi Pembayaran",
        sender_name: "Sistem Verifikasi Pembayaran",
        sender_id: "system",
        createdAt: serverTimestamp(),
        created: nowIso,
        isSystem: true,
        order_id: orderId
      };

      const msgRef = doc(collection(db, 'chats', targetRoomId, 'messages'));
      await setDoc(msgRef, { id: msgRef.id, ...rejectionMessage });
      await setDoc(doc(db, 'chats', targetRoomId), {
        status: 'Cancel',
        orderStatus: 'Cancel',
        updatedAt: serverTimestamp(),
        lastMessage: { message: rejectionMessage.message, created: nowIso }
      }, { merge: true });

      alert('Pembayaran ditolak dan order dibatalkan (TANPA REFUND).');
    } catch (err) {
      console.error('Error rejecting payment:', err);
      alert('Gagal menolak pembayaran: ' + err);
    }
  };

  return (
    <div className="h-[100dvh] bg-[#0e1621] text-slate-100 flex flex-col md:flex-row font-sans selection:bg-[#2b5278] selection:text-white overflow-hidden">
      
      {/* ========================================================= */}
      {/* DESKTOP LEFT SIDEBAR (Screen >= 768px)                     */}
      {/* ========================================================= */}
      <aside className={`hidden md:flex ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-[#17212b] border-r border-[#242f3d] flex-col shrink-0 relative`}>
        
        {/* Brand Header */}
        <div className={`p-4 border-b border-[#242f3d] flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} bg-[#2b5278]/20`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#389ce9] text-white font-black flex items-center justify-center text-lg shadow shrink-0">
              EC
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-black tracking-wider text-[#389ce9] truncate">ENTONG STORE</h1>
                <p className="text-[10px] text-[#7fa9ce] font-medium truncate">Standard Android Portal</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 bg-[#242f3d] hover:bg-slate-700 text-slate-300 hover:text-[#389ce9] rounded-lg shadow shrink-0"
            title={isSidebarCollapsed ? "Luaskan Sidebar" : "Kecilkan Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Menu (Accordion Groups) */}
        <nav className="flex-1 p-3 space-y-3 overflow-y-auto text-xs font-semibold select-none custom-scrollbar">
          
          {/* ========================================================= */}
          {/* 1. GRUP PESANAN & TRANSAKSI */}
          {/* ========================================================= */}
          <div className="space-y-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordionGroup('orders')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#202c33]/50"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#00E676]" />
                  <span>Pesanan & Transaksi</span>
                </span>
                {openAccordionGroups.orders ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="w-full h-px bg-slate-800 my-2" />
            )}

            {(openAccordionGroups.orders || isSidebarCollapsed) && (
              <div className="space-y-1 pl-0 sm:pl-1">
                <button
                  onClick={() => setActiveMenu('orderan')}
                  title="Panel Orderan (GP & Joki)"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'orderan' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Orderan</span>}
                </button>

                <button
                  onClick={() => setActiveMenu('pos')}
                  title="Tambah Order"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'pos' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Tambah Order</span>}
                </button>

                <button
                  onClick={() => setActiveMenu('orders')}
                  title="Database Orderan"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'orders' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Database Orderan</span>}
                </button>

                <button
                  onClick={() => setActiveMenu('payment_pending')}
                  title="Payment Pending (Verifikasi Pembayaran)"
                  className={`w-full relative flex items-center justify-between ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2'} rounded-xl  ${activeMenu === 'payment_pending' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className={`w-4 h-4 shrink-0 ${activeMenu === 'payment_pending' ? 'text-[#111b21]' : 'text-amber-400'}`} />
                    {!isSidebarCollapsed && <span>Payment Pending</span>}
                  </div>
                  {!isSidebarCollapsed && pendingPaymentsCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeMenu === 'payment_pending' ? 'bg-[#111b21] text-amber-400' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 '}`}>
                      {pendingPaymentsCount}
                    </span>
                  )}
                  {isSidebarCollapsed && pendingPaymentsCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-400 rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => setActiveMenu('tongcoins')}
                  title="Kelola TongCoins (TC)"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'tongcoins' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <Coins className="w-4 h-4 shrink-0 text-amber-400" />
                  {!isSidebarCollapsed && <span>Kelola TongCoins (TC)</span>}
                </button>

                {isOwner && (
                  <button
                    onClick={() => setActiveMenu('finance')}
                    title="Keuangan Toko (Owner)"
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2'} rounded-xl  ${activeMenu === 'finance' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4 shrink-0" />
                      {!isSidebarCollapsed && <span>Keuangan Toko</span>}
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 2. GRUP KOMUNIKASI */}
          {/* ========================================================= */}
          <div className="space-y-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordionGroup('communication')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#202c33]/50"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>Komunikasi</span>
                </span>
                {openAccordionGroups.communication ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="w-full h-px bg-slate-800 my-2" />
            )}

            {(openAccordionGroups.communication || isSidebarCollapsed) && (
              <div className="space-y-1 pl-0 sm:pl-1">
                <button
                  onClick={() => setActiveMenu('chat')}
                  title="Chat"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2'} rounded-xl  ${activeMenu === 'chat' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    {!isSidebarCollapsed && <span>Chat</span>}
                  </div>
                  {!isSidebarCollapsed && totalUnreadMessages > 0 && (
                    <span className="px-2 py-0.5 bg-rose-500 text-white font-black text-[10px] rounded-full shadow-md">
                      {totalUnreadMessages}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleOpenStaffChatTab}
                  title="Chat Staff Internal"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2'} rounded-xl  relative ${activeMenu === 'staff_chat' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    {!isSidebarCollapsed && <span>Chat Staff Internal</span>}
                  </div>

                  {unreadStaffCount > 0 && activeMenu !== 'staff_chat' && (
                    <span className="relative flex h-5 w-5 items-center justify-center shrink-0">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500 text-white text-[10px] font-black items-center justify-center shadow-md">
                        {unreadStaffCount > 9 ? '9+' : unreadStaffCount}
                      </span>
                    </span>
                  )}
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setActiveMenu('qrs')}
                    title="Quick Reply"
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'qrs' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                  >
                    <Zap className="w-4 h-4 shrink-0" />
                    {!isSidebarCollapsed && <span>Quick Reply</span>}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 3. GRUP MANAJEMEN & LAYANAN */}
          {/* ========================================================= */}
          <div className="space-y-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordionGroup('management')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#202c33]/50"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>Manajemen & Layanan</span>
                </span>
                {openAccordionGroups.management ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="w-full h-px bg-slate-800 my-2" />
            )}

            {(openAccordionGroups.management || isSidebarCollapsed) && (
              <div className="space-y-1 pl-0 sm:pl-1">
                {isAdmin && (
                <button
                  onClick={() => setActiveMenu('items')}
                  title="Kelola Paket Joko"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'items' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <Gamepad2 className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Kelola Paket Joko</span>}
                </button>
                )}

                {isAdmin && (
                <button
                  onClick={() => setActiveMenu('customers')}
                  title="Kelola Customer"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'customers' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Kelola Customer</span>}
                </button>
                )}

                {isOwner && (
                <button
                  onClick={() => setActiveMenu('staff')}
                  title="Kelola Staf"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'staff' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Kelola Staf</span>}
                </button>
              )}

                {isOwner && (
                <button
                  onClick={() => setActiveMenu('attendance')}
                  title="Absensi Staf"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'attendance' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Absensi Staf</span>}
                </button>
              )}

                {isAdmin && (
                <button
                  onClick={() => setActiveMenu('admin_login')}
                  title="Admin Login"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'admin_login' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Admin Login</span>}
                </button>
              )}

                {isAdmin && (
                <button
                  onClick={() => setActiveMenu('reviews')}
                  title="Kelola Ulasan"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'reviews' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <Star className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Kelola Ulasan</span>}
                </button>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4. GRUP SISTEM & PENGATURAN */}
          {/* ========================================================= */}
          <div className="space-y-1">
            {!isSidebarCollapsed ? (
              <button
                type="button"
                onClick={() => toggleAccordionGroup('system')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#202c33]/50"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sistem & Pengaturan</span>
                </span>
                {openAccordionGroups.system ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            ) : (
              <div className="w-full h-px bg-slate-800 my-2" />
            )}

            {(openAccordionGroups.system || isSidebarCollapsed) && (
              <div className="space-y-1 pl-0 sm:pl-1">
                <button
                  id="nav-cloud-monitor"
                  onClick={() => setActiveMenu('cloud_monitor')}
                  title="Cloud Monitor"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'cloud_monitor' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <Server className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Cloud Monitor</span>}
                </button>

                {isAdmin && (
                <button
                  onClick={() => setActiveMenu('settings')}
                  title="Pengaturan QRIS & Status"
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2'} rounded-xl  ${activeMenu === 'settings' ? 'bg-[#00E676] text-[#111b21] font-bold shadow-lg shadow-[#00E676]/20' : 'text-slate-300 hover:bg-[#202c33]'}`}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>Pengaturan QRIS & Status</span>}
                </button>
                )}
              </div>
            )}
          </div>

        </nav>

        {/* User Info & Logout */}
        <div className={`p-3.5 border-t border-[#242f3d] bg-[#17212b] flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <div className="truncate">
              <span className="text-xs font-bold text-slate-100 block truncate">{currentUser?.name}</span>
              <span className="text-[10px] text-[#389ce9] font-semibold uppercase">{currentUser?.role}</span>
            </div>
          )}
          <button
            onClick={logout}
            className="p-2 bg-[#242f3d] hover:bg-red-950/60 hover:text-red-400 text-slate-300 rounded-xl"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MOBILE VIEW (Standard Android / iOS Layout - No Sidebars)   */}
      {/* ========================================================= */}
      <div className="md:hidden flex flex-col h-[100dvh] overflow-hidden shrink-0 w-full bg-[#0e1621]">
        
        {/* Mobile Header */}
        <header className="bg-[#17212b] border-b border-[#242f3d] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] flex items-center justify-between shrink-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              {storeAvatarUrl ? (
                <img src={storeAvatarUrl} alt="Store Avatar" className="w-8 h-8 rounded-full object-cover border border-[#389ce9]/60 shadow" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#389ce9] text-white font-extrabold flex items-center justify-center text-xs shadow">
                  EC
                </div>
              )}
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#17212b] ${!isStoreClosed ? 'bg-[#00E676]' : 'bg-amber-400'}`} />
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-100">Entong Store Admin</h1>
              <p className="text-[10px] text-[#389ce9]">{currentUser?.name} ({currentUser?.role})</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            
            
            <button
              type="button"
              onClick={() => setIsManualWAOrderModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#389ce9] hover:bg-[#2b5278] text-white text-xs font-bold shadow-lg shadow-blue-950/40 whitespace-nowrap"
              title="Input Pesanan Manual WhatsApp"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">+ Input WA</span>
            </button>
            <button onClick={logout} className="p-1.5 bg-[#242f3d] hover:text-rose-400 text-slate-300 rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Content Area */}
        <div className={`flex-1 overflow-hidden min-h-0 flex flex-col ${mobileTab === 'chat' && mobileChatView === 'ROOM' ? 'p-0 bg-[#0e1621]' : 'p-3 overflow-y-auto'}`}>
          
          {/* Back button for Manage Sub-views */}
          {['customers', 'items', 'qrs', 'attendance', 'finance', 'settings', 'staff_chat', 'cloud_monitor'].includes(mobileTab) && (
            <button
              onClick={() => setMobileTab('manage')}
              className="mb-3 px-3 py-1.5 bg-[#202c33] hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 w-fit shadow"
            >
              ← Kembali ke Menu Manage
            </button>
          )}

          {mobileTab === 'chat' && (
            <div className={mobileChatView === 'ROOM' ? "flex flex-col flex-1 min-h-0 w-full bg-[#0e1621] overflow-hidden" : "flex flex-col flex-1 min-h-0 w-full overflow-hidden"}>
              {mobileChatView === 'LIST' || !activeOrder ? (
                /* LIST CHAT VIEW (TELEGRAM STYLE FOR MOBILE) */
                <div className="flex-1 flex flex-col bg-[#17212b] rounded-2xl border border-[#242f3d] overflow-hidden">
                  {/* Top Search & Filter Bar */}
                  <div className="p-3 border-b border-[#242f3d] space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#7fa9ce] absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={chatSearchInput}
                        onChange={e => setChatSearchInput(e.target.value)}
                        placeholder="Cari chat atau customer..."
                        className="w-full pl-9 pr-3 py-2 bg-[#242f3d] border border-slate-700/50 rounded-xl text-xs text-slate-100 placeholder:text-[#7fa9ce]/70 focus:outline-none focus:border-[#389ce9]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#242f3d] rounded-xl border border-slate-700/50 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setChatFilterTab('all')}
                        className={`py-1.5 px-2 rounded-lg text-center ${
                          chatFilterTab === 'all'
                            ? 'bg-[#389ce9] text-white font-extrabold shadow'
                            : 'text-[#7fa9ce] hover:text-slate-100'
                        }`}
                      >
                        Semua ({allChatConversations.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatFilterTab('unread')}
                        className={`py-1.5 px-2 rounded-lg  text-center flex items-center justify-center gap-1.5 ${
                          chatFilterTab === 'unread'
                            ? 'bg-rose-500 text-white font-extrabold shadow'
                            : 'text-slate-300 hover:text-rose-400'
                        }`}
                      >
                        <span>Belum Dibaca</span>
                        {unreadConversations.length > 0 && (
                          <span className="px-1.5 py-0.2 bg-white text-rose-600 font-extrabold text-[10px] rounded-full">
                            {unreadConversations.length}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleMarkAllChatsRead}
                        disabled={isMarkingAllRead}
                        title="Reset semua notifikasi menjadi 0"
                        className="flex-1 py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95"
                      >
                        {isMarkingAllRead ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                        ) : (
                          <>
                            <CheckCheck className="w-4 h-4" />
                            <span>Tandai Dibaca</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handlePurgeEmptyChats}
                        disabled={isPurgingChats}
                        className="py-1.5 px-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 shrink-0"
                        title="Bersihkan Chat Kosong"
                      >
                        {isPurgingChats ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                        ) : (
                          <span>🧹 Bersihkan</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Conversation List */}
                  <div 
                    className="flex-1 overflow-y-auto divide-y divide-slate-800/60 touch-pan-y overscroll-contain" 
                    style={{ WebkitOverflowScrolling: 'touch', contain: 'content' }}
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 300) {
                        if (displayLimit < filteredConversations.length) {
                          setDisplayLimit(prev => Math.min(prev + 100, filteredConversations.length));
                        }
                        if (hasMoreChats && !isLoadingMoreChats && chatFilterTab === 'all') {
                          loadMoreChats();
                        }
                      }
                    }}
                  >
                    {filteredConversations.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        {chatFilterTab === 'unread' ? 'Semua pesan sudah dibaca Admin ✨' : 'Belum ada obrolan chat.'}
                      </div>
                    ) : (
                      <>
                        {filteredConversations.slice(0, displayLimit).map((conv: any, idx: number) => {
                          const isSelected = conv.id === selectedOrderId;
                          const convKey = conv.id || conv.docUniqueId || `mob-conv-${idx}`;

                          return (
                            <ChatListItem
                              key={convKey}
                              conv={conv}
                              isSelected={isSelected}
                              onSelect={handleSelectConversationItem}
                              currentUser={currentUser}
                              isUserMuted={isUserMuted}
                              getMuteRemainingSeconds={getMuteRemainingSeconds}
                              formatCountdown={formatCountdown}
                              formatChatTime={formatChatTime}
                              getConvStatus={getConvStatus}
                              chatSearchQuery={chatSearchQuery}
                            />
                          );
                        })}
                        {displayLimit < filteredConversations.length && (
                          <div className="p-3 text-center flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDisplayLimit(prev => Math.min(prev + 100, filteredConversations.length))}
                              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-[#00E676] rounded-xl text-xs font-bold border border-slate-700 shadow cursor-pointer"
                            >
                              +100 Chat ({filteredConversations.length - displayLimit} tersisa)
                            </button>
                            <button
                              type="button"
                              onClick={() => setDisplayLimit(filteredConversations.length)}
                              className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/40 shadow cursor-pointer"
                            >
                              Tampilkan Semua ({filteredConversations.length})
                            </button>
                          </div>
                        )}
                        {hasMoreChats && chatFilterTab === 'all' && (
                          <div className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => loadMoreChats()}
                              disabled={isLoadingMoreChats}
                              className="w-full py-2 px-3 bg-[#242f3d] hover:bg-[#2b5278] text-[#7fa9ce] hover:text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-2 shadow transition-all"
                            >
                              {isLoadingMoreChats ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#389ce9]" />
                                  <span>Memuat chat database lama...</span>
                                </>
                              ) : (
                                <span>📥 Muat Lebih Banyak Chat Lama</span>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col bg-[#0b141a] w-full h-[calc(100vh-130px)] md:h-full overflow-hidden pb-12 md:pb-0">
                  {/* Header Topbar Chat Aktif (Mobile View) */}
                  <AdminChatMinimalHeader
                    showBackButton={true}
                    onBack={() => setMobileChatView('LIST')}
                    selectedChat={{
                      id: selectedChatRoom?.firestoreDocId || selectedChatRoom?.id || activeOrder?.id || selectedOrderId,
                      customerName: activeCustomerName || activeOrder?.customer_name || 'Customer',
                      robloxUsername: rawUsername || activeUser?.username || activeOrder?.robloxUsername || '',
                      orderBadge: activeOrder?.orderStatus || activeOrder?.status || selectedChatRoom?.orderStatus || selectedChatRoom?.status || 'BOOKING',
                      status: activeOrder?.orderStatus || activeOrder?.status || selectedChatRoom?.orderStatus || selectedChatRoom?.status || 'BOOKING',
                      packageName: activeOrder?.package_name || activeOrder?.game_name || selectedChatRoom?.packageName || 'Orderan',
                      customerWhatsapp: activeOrder?.customer_phone || activeCustPhone || selectedChatRoom?.customerWhatsapp || '',
                      items: (activeOrder as any)?.items || selectedChatRoom?.items
                    }}
                    onOpenBuktiTF={() => {
                      const matchingOrder = orders.find(o => o.id === selectedOrderId || o.customer_id === activeCustId);
                      const targetOrderForProof = foundOrder || matchingOrder || activeOrder;
                      setViewingProofOrder(
                        (targetOrderForProof || {
                          id: selectedOrderId || activeOrder?.id || 'CHAT',
                          customer_name: activeCustomerName,
                          customer_phone: activeOrder?.customer_phone || activeCustPhone || '',
                          price: activeOrder?.price || 0,
                          game_name: activeOrder?.game_name || 'Roblox',
                          package_name: activeOrder?.package_name || 'Transaksi'
                        }) as any
                      );
                    }}
                    onToggleShowInfo={() => setShowRightSidebar(!showRightSidebar)}
                    onStatusChange={(val) => handleStatusChange(activeOrder?.id || selectedOrderId, val)}
                  />

                  {/* Mobile Dropdown Info Details */}
                  {showMobileTopbar && (
                    <div className="sm:hidden flex flex-col gap-2 p-3 bg-slate-900 border-b border-slate-800 text-xs shrink-0 z-10 flex-none">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[9px] shrink-0">
                            #{activeOrder.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="truncate text-[11px] font-semibold text-slate-200">
                            {activeOrder.game_name} - {activeOrder.package_name}
                          </span>
                        </div>
                        <span className="text-[11px] font-black text-emerald-400 shrink-0">
                          Rp {(activeOrder.price ?? 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-xl w-full text-[10px] text-slate-300 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-400 font-bold flex items-center gap-1"><Edit2 className="w-3 h-3"/> Catatan Order:</span>
                          <button 
                            onClick={() => {
                              saveChatNote(selectedOrderId, currentChatNoteInput);
                              alert('Catatan pelanggan berhasil disimpan!');
                            }}
                            className="text-[#00E676] font-bold px-2 py-0.5 bg-[#00E676]/10 rounded hover:bg-[#00E676]/20"
                          >
                            Simpan
                          </button>
                        </div>
                        <textarea
                          value={currentChatNoteInput}
                          onChange={e => setCurrentChatNoteInput(e.target.value)}
                          placeholder="Tulis detail catatan khusus di sini..."
                          rows={2}
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Desktop Catatan Order Pane */}
                  <div className="hidden sm:flex p-2 bg-slate-900 border-b border-slate-800 items-start gap-2">
                    <span className="text-amber-400 font-bold flex items-center gap-1 text-[10px] shrink-0 pt-1.5 whitespace-nowrap"><Edit2 className="w-3.5 h-3.5"/> Catatan:</span>
                    <input
                      type="text"
                      value={currentChatNoteInput}
                      onChange={e => setCurrentChatNoteInput(e.target.value)}
                      placeholder="Tulis catatan order/login..."
                      className="flex-1 min-w-0 bg-slate-900/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button 
                      onClick={() => {
                        saveChatNote(selectedOrderId, currentChatNoteInput);
                        alert('Catatan pelanggan berhasil disimpan!');
                      }}
                      className="text-[#00E676] font-bold px-3 py-1.5 bg-[#00E676]/10 rounded-lg hover:bg-[#00E676]/20 text-xs shrink-0 border border-[#00E676]/20 shadow"
                    >
                      Simpan
                    </button>
                  </div>
                  {/* Chat Bubbles */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#070b14]">
                    {activeOrder.status === 'SELESAI' && (
                      <div className="bg-emerald-950/90 border border-emerald-500/50 p-2.5 rounded-xl text-center text-xs text-emerald-200 font-bold mb-2 shadow-lg flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00E676] shrink-0" />
                        <span>✅ ORDER SELESAI — Riwayat chat pesanan ini tersimpan aman & utuh 100% di database.</span>
                      </div>
                    )}
                    {orderChats.map((c: any, idx: number) => {
                      const messageText = c.message || (c as any).text || '';
                      const isSystemMsg = !!(messageText && (messageText.includes('STATUS UPDATE') || messageText.includes('UPDATE STATUS') || messageText.includes('STATUS ORDER') || messageText.includes('[STATUS]')));
                      const cleanMsg = messageText.replace(/^📋\s*STATUS\s*(UPDATE|ORDER)\s*#[^\n]*\n?/gi, '').trim() || messageText;
                      const msgTime = c.created || (c as any).createdAt || (c as any).timestamp || (c as any).orderTimestamp || new Date();
                      const cKey = (c as any).docUniqueId || c.id ? `${c.id || (c as any).docUniqueId}-${idx}` : `mob-chat-${idx}`;

                      // 🚨 Evaluasi Pengirim Pesan (Admin vs Customer)
                      const roleStr = String(c.senderRole || c.sender_role || c.senderRoleFull || c.role || c.sender || '').toLowerCase().trim();
                      const nameStr = String(c.senderName || c.sender_name || '').toLowerCase();

                      const isExplicitCustomer = 
                        c.isCustomer === true ||
                        c.is_customer === true ||
                        roleStr === 'customer' ||
                        roleStr === 'user' ||
                        roleStr === 'pelanggan' ||
                        nameStr.includes('(customer)') ||
                        nameStr.includes('(pelanggan)');

                      const isExplicitAdmin = 
                        c.isAdmin === true ||
                        c.is_admin === true ||
                        roleStr === 'admin' ||
                        roleStr === 'owner' ||
                        roleStr === 'staff' ||
                        roleStr === 'worker' ||
                        c.sender === 'admin' ||
                        c.sender_id === 'admin' ||
                        c.senderId === 'admin' ||
                        nameStr.includes('(admin)') ||
                        nameStr.includes('(owner)') ||
                        nameStr.includes('(staff)');

                      let isMe = false;
                      if (isExplicitCustomer) {
                        isMe = false;
                      } else if (isExplicitAdmin) {
                        isMe = true;
                      } else {
                        if (c.sender_id === 'admin' || c.sender_uid === 'admin' || roleStr === 'admin') {
                          isMe = true;
                        } else {
                          isMe = false;
                        }
                      }

                      const isOwner = roleStr === 'owner' || c.sender_role === 'OWNER' || c.senderRole === 'OWNER' || nameStr.includes('ceo') || nameStr.includes('owner') || c.sender_id === 'u-owner-own';

                      let customerDisplayName = c.sender_name || c.senderName || 'Customer';
                      if (c.sender_role === 'CUSTOMER' || !isMe) {
                        const matched = users.find(u => 
                          u.id === c.sender_id || 
                          (u.username && c.sender_name && u.username.toLowerCase() === c.sender_name.toLowerCase()) ||
                          (u.name && c.sender_name && u.name.toLowerCase() === c.sender_name.toLowerCase())
                        );
                        if (matched) {
                          customerDisplayName = matched.name || matched.username;
                        }
                      }
                      const cleanCustomerDisplayName = customerDisplayName.replace(/\s*\((customer|pelanggan)\)/gi, '').trim() || 'Customer';

                      const bubbleBg = c.is_quick_reply
                        ? 'bg-gradient-to-r from-emerald-950 to-teal-950 border border-emerald-500/70 text-emerald-50 shadow-xl rounded-br-sm'
                        : (isMe ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-sm');

                      // 🗓️ Deteksi Pergantian Hari untuk Date Divider
                      const currentMsgDate = new Date(msgTime).toDateString();
                      const prevMsg = idx > 0 ? (orderChats[idx - 1] as any) : null;
                      const prevMsgTime = prevMsg ? (prevMsg.created || prevMsg.createdAt || prevMsg.timestamp || prevMsg.orderTimestamp || new Date()) : null;
                      const prevMsgDate = prevMsgTime ? new Date(prevMsgTime).toDateString() : null;
                      const showDateDivider = idx === 0 || (currentMsgDate !== prevMsgDate);

                      return (
                        <React.Fragment key={cKey}>
                          {showDateDivider && (
                            <div className="flex justify-center my-2 w-full">
                              <span className="bg-slate-800/90 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full shadow-md border border-slate-700/60 backdrop-blur-sm">
                                {formatChatDividerDate(msgTime)}
                              </span>
                            </div>
                          )}

                          {(c.type === 'JOKI_CREDENTIAL_FORM' || (c as any).type === 'joki_credential_form') ? (
                            <div className="w-full flex my-2 justify-start sm:justify-center">
                              <JokiCredentialFormMessage
                                message={c as any}
                                chatId={selectedChatRoom?.firestoreDocId || selectedChatRoom?.id || selectedOrderId || ''}
                                isCustomer={false}
                                currentUser={currentUser}
                              />
                            </div>
                          ) : isSystemMsg ? (
                            <div className="flex justify-center my-1.5 px-2 w-full">
                              <div className="bg-[#111b21] border border-emerald-500/30 rounded-xl px-3 py-1.5 max-w-xs sm:max-w-sm text-center shadow-sm">
                                <div className="flex items-center justify-center gap-1.5 text-[#00E676] font-bold text-[10px] uppercase tracking-wider mb-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
                                  <span>STATUS ORDER</span>
                                </div>
                                <div className="text-slate-200 text-[11px] font-medium leading-snug whitespace-pre-wrap">
                                  {renderMessageText(cleanMsg || c.message)}
                                </div>
                                <div className="text-[9px] text-emerald-400/60 mt-1">
                                  {formatChatTime(msgTime)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className={`w-full flex my-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`relative group max-w-[85%] rounded-2xl p-3 text-xs shadow-md  ${bubbleBg}`}>
                                {/* Header Nama Pengirim */}
                                <div className={`text-[11px] font-semibold mb-1 ${
                                  isMe 
                                    ? (isOwner ? 'text-amber-200 font-bold' : 'text-white/90') 
                                    : 'text-emerald-400'
                                }`}>
                                  {isMe ? (isOwner ? '👑 Ceo Entong (Owner)' : 'Admin (Anda)') : `${cleanCustomerDisplayName} (Pelanggan)`}
                                </div>

                                <ChatMessageRenderer text={c.message || (c as any).text || ''} />

                                {c.is_quick_reply && (
                                  <div className="text-[9px] font-bold text-emerald-300 mt-1 uppercase tracking-wider flex items-center gap-1 border-t border-emerald-500/30 pt-1">
                                    <span>⚡ Sistem • Pesan Otomatis</span>
                                  </div>
                                )}
                                
                                {/* Media Attachments */}
                                {c.media_url && (
                                  <div className="my-1.5 max-w-xs cursor-pointer" onClick={() => setExpandedMediaUrl(c.media_url!)}>
                                    {c.media_type === 'IMAGE' ? (
                                      <SafeImage
                                        src={c.media_url}
                                        alt="Foto Chat"
                                        className="w-full max-h-52 rounded-xl border border-slate-700/80 shadow hover:opacity-90"
                                      />
                                    ) : (
                                      <video
                                        src={c.media_url}
                                        controls
                                        className="w-full max-h-52 rounded-xl border border-slate-700/80 bg-black shadow"
                                      />
                                    )}
                                  </div>
                                )}

                                <div className="text-[10px] text-right mt-1 flex items-center justify-end gap-1">
                                  <span className={isMe ? 'text-emerald-200' : 'text-slate-400'}>
                                    {formatChatTime(msgTime)}
                                  </span>
                                  {isMe && (
                                    <span className={`font-bold flex items-center gap-0.5 ${c.is_read ? 'text-emerald-200' : 'text-emerald-300/70'}`} title={c.is_read ? 'Pesan telah dibaca customer' : 'Pesan terkirim'}>
                                      {c.is_read ? '✓✓' : '✓'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                    <div ref={adminChatEndRef} />
                  </div>

                  {/* Quick Reply (Admin only) */}
                  {isAdmin && quickReplies.length > 0 && (
                    <div className="bg-[#111b21] px-2 py-1.5 border-t border-slate-800 flex gap-1.5 overflow-x-auto shrink-0 z-10 flex-none">
                      {quickReplies.map((qr, idx) => (
                        <button
                          key={qr.id ? `mob-qr-${qr.id}-${idx}` : `mob-qr-${idx}`}
                          onClick={() => handleApplyQuickReply(qr.message)}
                          className="px-2.5 py-1 bg-[#202c33] hover:bg-slate-700 text-[#00E676] rounded-lg text-[10px] whitespace-nowrap border border-slate-700 shrink-0 font-medium"
                        >
                          ⚡ {qr.title}
                        </button>
                      ))}
                    </div>
                  )}

                  <ChatInputArea
                    onSend={handleSendFromInput}
                    quickReplies={quickReplies}
                    isUploadingAdminMedia={isUploadingAdminMedia}
                    fileInputAdminRef={fileInputAdminRef}
                    handleAdminMediaUpload={handleAdminMediaUpload}
                    handleAdminPasteImage={handleAdminPasteImage}
                  />
                </div>
              )}
            </div>
          )}

          {mobileTab === 'orders' && (
            <div className="space-y-3 pb-20">
              <h2 className="text-sm font-bold text-slate-100">Database Orderan Joko</h2>
              {filteredOrdersResult.slice(0, renderLimitDatabase).map((o: any, idx: number) => {
                const uniqueKey = o.docUniqueId || o.firestoreId || `${o.id || o.orderId || 'ord'}-${idx}`;
                return (
                  <div key={uniqueKey} className="bg-[#111b21] border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#00E676]">{o.orderId || (o.id?.startsWith('ORD-') ? o.id : `#${o.id?.substring(0, 8)}`)}</span>
                    <div>{renderStatusBadge(o.status)}</div>
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-1 mb-1">
                      <span className="font-semibold text-slate-100">{o.customer_name}</span> 
                      {renderCustomerBadge(o.customer_name, (o as any).isGuest)}
                      <span className="text-slate-400">({o.customer_phone})</span>
                    </div>
                    <p className="text-slate-400">{o.game_name} - {o.package_name}</p>
                    <p className="text-emerald-400 font-bold mt-1">Rp {(o?.price ?? 0)?.toLocaleString?.('id-ID')}</p>
                  </div>
                  {isOwner && (
                    <div className="flex gap-2 pt-1">
                      <select
                        value={o.status}
                        onChange={e => updateOrderStatus(o.id, e.target.value as OrderStatus)}
                        className="flex-1 bg-[#202c33] border border-slate-700 text-xs rounded-xl p-2 text-emerald-400 font-bold shadow"
                      >
                        <option value="BOOKING">⏳ BOOKING</option>
                        <option value="ANTRIAN_LOGIN">🕒 ANTRIAN LOGIN</option>
                        <option value="PROSES_WORKER">⚡ PROSES WORKER</option>
                        <option value="BUTUH_LOGIN_ULANG">⚠️ BUTUH LOGIN ULANG</option>
                        <option value="SELESAI">✓ SELESAI</option>
                        <option value="BATAL">✕ BATAL</option>
                      </select>
                      <button
                        onClick={() => {
                          setEditingOrder(o);
                          setShowOrderModal(true);
                        }}
                        className="px-3 py-1.5 bg-[#202c33] text-amber-400 rounded-lg font-bold"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredOrdersResult.length > renderLimitDatabase && (
              <div className="flex justify-center p-6">
                <button 
                  onClick={() => setRenderLimitDatabase(prev => prev + 50)}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 font-bold px-8 py-3 rounded-full text-xs shadow-lg shadow-emerald-500/10 active:scale-95"
                >
                  Muat Lebih Banyak ({filteredOrdersResult.length - renderLimitDatabase} orderan tersisa)
                </button>
              </div>
            )}
            </div>
          )}

          {mobileTab === 'payment_pending' && (
            <div className="space-y-3 pb-20">
              <AdminPaymentPending 
                onOpenChatWithOrder={(orderId) => {
                  setSelectedOrderId(orderId);
                  setActiveMenu('chat');
                  setMobileTab('chat');
                }}
              />
            </div>
          )}

          {/* Manage Hub Screen on Mobile */}
          {mobileTab === 'manage' && (
            <div className="space-y-4 pb-20">
              <div className="bg-[#111b21] border border-slate-800 p-4 rounded-2xl shadow-lg">
                <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#00E676]" /> Kelola Toko & Fitur Staf
                </h2>
                <p className="text-xs text-slate-400 mt-1">Pilih menu manajemen di bawah untuk mengoperasikan toko.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMobileTab('customers')}
                  className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95"
                >
                  <div className="p-3 bg-[#00E676]/20 text-[#00E676] rounded-xl border border-[#00E676]/30">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-100">Database Pelanggan</span>
                  <span className="text-[10px] text-slate-400">{uniqueChats.length} Terdaftar</span>
                </button>

                {isOwner ? (
                  <button
                    onClick={() => setMobileTab('items')}
                    className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95"
                  >
                    <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                      <Gamepad2 className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-100">Paket Joko</span>
                    <span className="text-[10px] text-slate-400">{items.length} Katalog</span>
                  </button>
                ) : (
                  <button
                    onClick={() => alert('Akses Ditolak: Fitur Kelola Katalog Joko hanya diperuntukkan bagi OWNER (Ceo Entong)!')}
                    className="bg-[#111b21]/40 border border-slate-800/60 p-4 rounded-2xl flex flex-col items-center text-center gap-2 opacity-50 cursor-not-allowed"
                  >
                    <div className="p-3 bg-slate-800 text-slate-400 rounded-xl">
                      <Lock className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">Paket Joko</span>
                    <span className="text-[10px] text-slate-500">Akses Terkunci</span>
                  </button>
                )}

                <button
                  onClick={() => setMobileTab('reviews')}
                  className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95"
                >
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                    <Star className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-100">Kelola & Bot Ulasan</span>
                  <span className="text-[10px] text-slate-400">Generator Testimoni</span>
                </button>

                <button
                  onClick={() => setMobileTab('qrs')}
                  className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95"
                >
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                    <Zap className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-100">Quick Reply Chat</span>
                  <span className="text-[10px] text-slate-400">{quickReplies.length} Template</span>
                </button>

                <button
                  onClick={() => setMobileTab('attendance')}
                  className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95"
                >
                  <div className="p-3 bg-emerald-500/20 text-[#00E676] rounded-xl border border-emerald-500/30">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-100">Absensi Staff</span>
                  <span className="text-[10px] text-slate-400">Check-In Harian</span>
                </button>

                {isOwner && (
                  <button
                    onClick={() => setMobileTab('finance')}
                    className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95 col-span-2"
                  >
                    <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-100">Keuangan Toko</span>
                    <span className="text-[10px] text-slate-400">Laporan Pemasukan, Pengeluaran & Profit</span>
                  </button>
                )}

                <button
                  onClick={() => setMobileTab('cloud_monitor')}
                  className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95 col-span-2"
                >
                  <div className="p-3 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
                    <Server className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-100">Cloud Monitor Joko</span>
                  <span className="text-[10px] text-slate-400">Monitoring & Manajemen Slot Instance Cloud Server</span>
                </button>

                <button
                  onClick={handleOpenStaffChatTab}
                  className="bg-[#111b21] hover:bg-[#202c33] border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-md active:scale-95 col-span-2 relative"
                >
                  <div className="p-3 bg-emerald-500/20 text-[#00E676] rounded-xl border border-emerald-500/30 relative">
                    <ShieldCheck className="w-6 h-6" />
                    {unreadStaffCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500 text-white text-[10px] font-black items-center justify-center shadow-md">
                          {unreadStaffCount > 9 ? '9+' : unreadStaffCount}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100">Chat Staff Internal</span>
                    {unreadStaffCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full">
                        {unreadStaffCount} Baru
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">Lounge Obrolan & Koordinasi Khusus Admin/Staff</span>
                </button>
              </div>
            </div>
          )}

          {mobileTab === 'cloud_monitor' && (
            <div className="space-y-3 pb-20">
              <CloudMonitor />
            </div>
          )}

          {mobileTab === 'staff_chat' && (
            <div className="space-y-3 pb-20">
              <StaffInternalChat currentUser={currentUser} />
            </div>
          )}

          {mobileTab === 'customers' && (
            <div className="space-y-3 pb-20">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00E676]" /> Database Pelanggan Toko
              </h2>
              <div className="space-y-2">
                {users.filter(u => u.role === 'CUSTOMER').map((u, idx) => (
                  <div key={u.id ? `cust-${u.id}-${idx}` : `cust-${idx}`} className="bg-[#111b21] p-3.5 rounded-xl border border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-100">{u.name}</span>
                      <span className="text-[10px] bg-[#202c33] text-emerald-400 px-2 py-0.5 rounded-full font-mono">{u.username}</span>
                    </div>
                    <div className="text-slate-400">WhatsApp: {u.phone || '—'}</div>
                    <div className="text-slate-500 text-[10px]">Terdaftar: {formatDate(u.created)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mobileTab === 'items' && (
            <div className="space-y-3 pb-20">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-[#00E676]" /> Kelola Paket Joko Game
              </h2>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id ? `item-${item.id}-${idx}` : `item-${idx}`} className="bg-[#111b21] p-3.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-100">{item.game_name}</div>
                      <div className="text-slate-400">{item.package_name}</div>
                      <div className="text-[#00E676] font-bold mt-0.5">Rp {(item?.price ?? 0)?.toLocaleString?.('id-ID')}</div>
                    </div>
                    <span className="px-2 py-1 bg-[#202c33] text-slate-300 rounded text-[10px] font-bold">{item.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mobileTab === 'reviews' && (
            <div className="pb-20">
              <AdminReviewsManager />
            </div>
          )}

          {mobileTab === 'qrs' && (
            <div className="space-y-3 pb-20">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#00E676]" /> Template Quick Reply
              </h2>
              <div className="space-y-2">
                {quickReplies.map((qr, idx) => (
                  <div key={qr.id ? `qr-${qr.id}-${idx}` : `qr-${idx}`} className="bg-[#111b21] p-3.5 rounded-xl border border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-100">{qr.title}</span>
                      <span className="text-[10px] bg-[#202c33] text-[#00E676] px-2 py-0.5 rounded font-mono">{qr.shortcut}</span>
                    </div>
                    <p className="text-slate-300 bg-[#202c33]/50 p-2 rounded-lg text-[11px] whitespace-pre-wrap">{qr.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mobileTab === 'attendance' && (
            <div className="pb-20">
              <AttendancePanel currentUser={currentUser} />
            </div>
          )}

          {mobileTab === 'finance' && (
            currentUser?.role !== 'OWNER' ? (
              <div className="bg-[#111b21] p-6 rounded-2xl border border-rose-500/40 text-center space-y-3 shadow-xl my-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-950 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/50">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Akses Terbatas Keuangan Toko</h3>
                <p className="text-xs text-slate-400">
                  Laporan Keuangan Toko hanya dapat diakses oleh <strong className="text-rose-400">Role OWNER</strong> (Ceo Entong).
                </p>
                <div className="p-2 bg-[#202c33] rounded-xl text-xs text-slate-400">
                  Role Anda: <span className="font-bold text-[#00E676]">{currentUser?.role || 'CUSTOMER'}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pb-20">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#00E676]" /> Keuangan Toko
                  </h2>
                  <button
                    onClick={() => setShowFinanceModal(true)}
                    className="px-3 py-1.5 bg-[#00E676] text-[#111b21] font-bold text-xs rounded-xl shadow"
                  >
                    + Catat
                  </button>
                </div>

                <div className="bg-[#111b21] p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="text-[#00E676] font-bold">Total Record: {finance.length} Transaksi</div>
                </div>
              </div>
            )
          )}

          {mobileTab === 'pos' && (
            <div className="pb-20">
              <h2 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#00E676]" /> Tambah Order (POS)
              </h2>
              <form onSubmit={handlePosSubmit} className="space-y-3 bg-[#111b21] p-4 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Nama Customer</label>
                  <input
                    type="text"
                    required
                    value={posCustomerName}
                    onChange={e => setPosCustomerName(e.target.value)}
                    placeholder="Nama Pelanggan"
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">No WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={posCustomerPhone}
                    onChange={e => setPosCustomerPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                {/* Multi-Catalog Item Cart Mobile */}
                <div className="p-3 bg-[#202c33]/90 border border-[#00E676]/40 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-extrabold text-[#00E676]">
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="w-3.5 h-3.5" /> Daftar Katalog ({posCart.length})
                    </span>
                    <span className="text-emerald-400 font-mono">
                      Rp {posCart.reduce((s, c) => s + (c.price * c.qty), 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {posCart.length > 0 ? (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {posCart.map((item, idx) => (
                        <div key={item.id ? `pos-${item.id}-${idx}` : `pos-${idx}`} className="flex justify-between items-center bg-[#111b21] p-1.5 rounded-lg border border-slate-700 text-[11px]">
                          <div className="truncate pr-1">
                            <div className="font-bold text-slate-100">{item.game_name} - {item.package_name}</div>
                            <div className="text-[10px] text-[#00E676]">
                              Rp {item.price.toLocaleString('id-ID')} x {item.qty}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPosCart(prev => updateCartQtyHelper(prev, item.id, -1))}
                              className="w-4 h-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-[10px] flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="text-[11px] font-extrabold px-1 text-slate-100">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => setPosCart(prev => updateCartQtyHelper(prev, item.id, 1))}
                              className="w-4 h-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-[10px] flex items-center justify-center"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => setPosCart(prev => removeCartItemHelper(prev, item.id))}
                              className="w-4 h-4 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded font-bold text-[10px] flex items-center justify-center ml-0.5"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 bg-[#111b21] rounded-lg border border-dashed border-slate-700 text-center text-slate-400 text-[11px]">
                      Belum ada katalog. Pilih di bawah lalu klik <span className="text-[#00E676] font-bold">+ Tambah</span>
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    <select
                      value={posSelectedItemId}
                      onChange={e => setPosSelectedItemId(e.target.value)}
                      className="flex-1 p-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-100 text-[11px] font-semibold"
                    >
                      <option value="">-- Pilih Paket Katalog --</option>
                      {items.map((i, idx) => (
                        <option key={i.id ? `opt-${i.id}-${idx}` : `opt-${idx}`} value={i.id}>{(i?.game_name || '')} - {(i?.package_name || '')} (Rp {(i?.price ?? 0)?.toLocaleString?.('id-ID')})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const selected = items.find(i => i.id === posSelectedItemId) || items[0];
                        if (selected) setPosCart(prev => addCatalogToCartHelper(prev, selected));
                      }}
                      className="px-2.5 py-1.5 bg-[#00E676] text-[#111b21] font-bold text-[11px] rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" /> + Tambah
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Username / Email Akun Game</label>
                  <input
                    type="text"
                    required
                    value={posGameUsername}
                    onChange={e => setPosGameUsername(e.target.value)}
                    placeholder="Username game"
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Password Game</label>
                  <input
                    type="password"
                    required
                    value={posGamePassword}
                    onChange={e => setPosGamePassword(e.target.value)}
                    placeholder="Password"
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <button type="submit" disabled={isPosLoading} className="w-full py-3 bg-[\#00E676] hover:bg-[\#00c853] text-[\#111b21] font-bold rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  {isPosLoading ? "Menyimpan..." : "Simpan Order"} POS
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Mobile Bottom Dock (Hidden when inside a chat room to let admin type & reply easily) */}
        {!(mobileTab === 'chat' && mobileChatView === 'ROOM') && (
          <div className="flex-none bg-[#111b21] border-t border-slate-800 flex justify-around py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] z-40 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold relative ${mobileTab === 'chat' ? 'text-[#00E676]' : 'text-slate-400'}`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {totalUnreadMessages > 0 && (
                <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-rose-500 text-white font-extrabold text-[9px] rounded-full shadow">
                  {totalUnreadMessages}
                </span>
              )}
            </div>
            <span>Chat</span>
          </button>

          <button
            onClick={() => setMobileTab('orders')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${mobileTab === 'orders' ? 'text-[#00E676]' : 'text-slate-400'}`}
          >
            <FileText className="w-5 h-5" />
            <span>Orderan</span>
          </button>

          <button
            onClick={() => setMobileTab('payment_pending')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold relative ${mobileTab === 'payment_pending' ? 'text-[#00E676]' : 'text-slate-400'}`}
          >
            <div className="relative">
              <CreditCard className="w-5 h-5 text-amber-400" />
              {pendingPaymentsCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-[8px]">
                  {pendingPaymentsCount}
                </span>
              )}
            </div>
            <span>Pending</span>
          </button>

          <button
            onClick={() => setMobileTab('pos')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${mobileTab === 'pos' ? 'text-[#00E676]' : 'text-slate-400'}`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Tambah</span>
          </button>

          <button
            onClick={() => setMobileTab('manage')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold relative ${
              ['manage', 'customers', 'items', 'qrs', 'attendance', 'finance', 'settings', 'staff_chat', 'cloud_monitor'].includes(mobileTab)
                ? 'text-[#00E676]'
                : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Settings className="w-5 h-5" />
              {unreadStaffCount > 0 && mobileTab !== 'staff_chat' && (
                <span className="absolute -top-1 -right-1.5 w-3 h-3 rounded-full bg-rose-500 border border-slate-950" />
              )}
            </div>
            <span>Manage</span>
          </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* DESKTOP MULTI-PANE SPLIT SCREEN (Screen >= 768px)          */}
      {/* ========================================================= */}
      <main className="hidden md:flex flex-1 overflow-hidden">
        
        {activeMenu === 'chat' && (
          <div className="flex-1 flex overflow-hidden bg-[#0a0a0a]">
            {/* Left Pane: Chat List (Column 1) */}
            <div className="w-80 sm:w-88 bg-[#18181b] border-r border-[#27272a] flex flex-col shrink-0">
              <div className="p-3.5 border-b border-[#27272a] space-y-2.5">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#a1a1aa]">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={chatSearchInput}
                    onChange={e => setChatSearchInput(e.target.value)}
                    placeholder="Cari chat atau customer..."
                    className="w-full pl-9 pr-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-[#f4f4f5] placeholder:text-[#a1a1aa]/60 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* UI Filter Tabs: Semua vs Belum Dibaca */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#121214] rounded-xl border border-[#27272a] text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChatFilterTab('all')}
                    className={`py-1.5 px-2 rounded-lg text-center ${
                      chatFilterTab === 'all'
                        ? 'bg-[#27272a] text-white font-extrabold shadow-sm border border-[#3f3f46]'
                        : 'text-[#a1a1aa] hover:text-white'
                    }`}
                  >
                    Semua ({allChatConversations.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setChatFilterTab('unread')}
                    className={`py-1.5 px-2 rounded-lg text-center flex items-center justify-center gap-1.5 ${
                      chatFilterTab === 'unread'
                        ? 'bg-rose-600 text-white font-extrabold shadow-sm'
                        : 'text-[#a1a1aa] hover:text-rose-400'
                    }`}
                  >
                    <span>Belum Dibaca</span>
                    {unreadConversations.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-white text-rose-600 font-extrabold text-[10px] rounded-full">
                        {unreadConversations.length}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleMarkAllChatsRead}
                    disabled={isMarkingAllRead}
                    title="Reset semua notifikasi menjadi 0"
                    className="flex-1 py-1.5 px-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] border border-[#3f3f46] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    {isMarkingAllRead ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    ) : (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                        <span>Tandai Dibaca</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePurgeEmptyChats}
                    disabled={isPurgingChats}
                    className="py-1.5 px-2 bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-rose-400 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 shrink-0 cursor-pointer"
                    title="Bersihkan Chat Kosong"
                  >
                    {isPurgingChats ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                    ) : (
                      <span>🧹 Bersihkan</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Chat Conversation Items */}
              <div 
                className="flex-1 overflow-y-auto divide-y divide-slate-800/60 touch-pan-y overscroll-contain" 
                style={{ WebkitOverflowScrolling: 'touch', contain: 'content' }}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 300) {
                    if (displayLimit < filteredConversations.length) {
                      setDisplayLimit(prev => Math.min(prev + 100, filteredConversations.length));
                    }
                    if (hasMoreChats && !isLoadingMoreChats && chatFilterTab === 'all') {
                      loadMoreChats();
                    }
                  }
                }}
              >
                {filteredConversations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    {chatFilterTab === 'unread' ? 'Semua pesan sudah dibaca Admin ✨' : 'Belum ada obrolan chat.'}
                  </div>
                ) : (
                  <>
                    {filteredConversations.slice(0, displayLimit).map((conv: any, idx: number) => {
                      const isSelected = conv.id === selectedOrderId;
                      const convKey = conv.id || conv.docUniqueId || `desk-conv-${idx}`;

                      return (
                        <ChatListItem
                          key={convKey}
                          conv={conv}
                          isSelected={isSelected}
                          onSelect={handleSelectConversationItem}
                          currentUser={currentUser}
                          isUserMuted={isUserMuted}
                          getMuteRemainingSeconds={getMuteRemainingSeconds}
                          formatCountdown={formatCountdown}
                          formatChatTime={formatChatTime}
                          getConvStatus={getConvStatus}
                          chatSearchQuery={chatSearchQuery}
                        />
                      );
                    })}
                    {displayLimit < filteredConversations.length && (
                      <div className="p-3 text-center flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDisplayLimit(prev => Math.min(prev + 100, filteredConversations.length))}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-[#00E676] rounded-xl text-xs font-bold border border-slate-700 shadow cursor-pointer"
                        >
                          +100 Chat ({filteredConversations.length - displayLimit} tersisa)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisplayLimit(filteredConversations.length)}
                          className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/40 shadow cursor-pointer"
                        >
                          Tampilkan Semua ({filteredConversations.length})
                        </button>
                      </div>
                    )}
                    {hasMoreChats && chatFilterTab === 'all' && (
                      <div className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => loadMoreChats()}
                          disabled={isLoadingMoreChats}
                          className="w-full py-2 px-3 bg-[#121214] hover:bg-[#27272a] text-[#a1a1aa] hover:text-white rounded-xl text-xs font-bold border border-[#27272a] flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                        >
                          {isLoadingMoreChats ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                              <span>Memuat chat database lama...</span>
                            </>
                          ) : (
                            <span>📥 Muat Lebih Banyak Chat Lama</span>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Center Pane: Telegram Chat Room */}
            <div className="flex-1 min-w-0 flex flex-col bg-[#0e1621]">
              {activeOrder ? (
                <>
                  {/* Header Topbar Chat Aktif (Desktop View) */}
                  <AdminChatMinimalHeader
                    selectedChat={{
                      id: selectedChatRoom?.firestoreDocId || selectedChatRoom?.id || activeOrder?.id || selectedOrderId,
                      customerName: activeCustomerName || activeOrder?.customer_name || 'Customer',
                      robloxUsername: rawUsername || activeUser?.username || activeOrder?.robloxUsername || '',
                      orderBadge: activeOrder?.orderStatus || activeOrder?.status || selectedChatRoom?.orderStatus || selectedChatRoom?.status || 'BOOKING',
                      status: activeOrder?.orderStatus || activeOrder?.status || selectedChatRoom?.orderStatus || selectedChatRoom?.status || 'BOOKING',
                      packageName: activeOrder?.package_name || activeOrder?.game_name || selectedChatRoom?.packageName || 'Orderan',
                      customerWhatsapp: activeOrder?.customer_phone || activeCustPhone || selectedChatRoom?.customerWhatsapp || '',
                      items: (activeOrder as any)?.items || selectedChatRoom?.items
                    }}
                    onOpenBuktiTF={() => {
                      const matchingOrder = orders.find(o => o.id === selectedOrderId || o.customer_id === activeCustId);
                      const targetOrderForProof = foundOrder || matchingOrder || activeOrder;
                      setViewingProofOrder(
                        (targetOrderForProof || {
                          id: selectedOrderId || activeOrder?.id || 'CHAT',
                          customer_name: activeCustomerName,
                          customer_phone: activeOrder?.customer_phone || activeCustPhone || '',
                          price: activeOrder?.price || 0,
                          game_name: activeOrder?.game_name || 'Roblox',
                          package_name: activeOrder?.package_name || 'Transaksi'
                        }) as any
                      );
                    }}
                    onToggleShowInfo={() => setShowRightSidebar(!showRightSidebar)}
                    onStatusChange={(val) => handleStatusChange(activeOrder?.id || selectedOrderId, val)}
                  />
                        {/* Chat Bubbles */}
                        <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-[#0e1621]">
                          {orderChats?.map((c: any, idx: number) => {
                            if (!c) return null;
                            const messageText = c.message || (c as any).text || '';
                            const isSystemMsg = !!(messageText && (messageText.includes('STATUS UPDATE') || messageText.includes('UPDATE STATUS') || messageText.includes('STATUS ORDER') || messageText.includes('[STATUS]')));
                            const cleanMsg = messageText.replace(/^📋\s*STATUS\s*(UPDATE|ORDER)\s*#[^\n]*\n?/gi, '').trim() || messageText;
                            
                            const msgTime = c.created || (c as any).createdAt || (c as any).timestamp || (c as any).orderTimestamp || new Date();
                            const timeStr = formatChatTime(msgTime);
                            const cKey = (c as any).docUniqueId || c.id ? `${c.id || (c as any).docUniqueId}-${idx}` : `desk-chat-${idx}`;

                            // 🚨 Evaluasi Pengirim Pesan (Admin vs Customer)
                            const roleStr = String(c.senderRole || c.sender_role || c.senderRoleFull || c.role || c.sender || '').toLowerCase().trim();
                            const nameStr = String(c.senderName || c.sender_name || '').toLowerCase();

                            const isExplicitCustomer = 
                              c.isCustomer === true ||
                              c.is_customer === true ||
                              roleStr === 'customer' ||
                              roleStr === 'user' ||
                              roleStr === 'pelanggan' ||
                              nameStr.includes('(customer)') ||
                              nameStr.includes('(pelanggan)');

                            const isExplicitAdmin = 
                              c.isAdmin === true ||
                              c.is_admin === true ||
                              roleStr === 'admin' ||
                              roleStr === 'owner' ||
                              roleStr === 'staff' ||
                              roleStr === 'worker' ||
                              c.sender === 'admin' ||
                              c.sender_id === 'admin' ||
                              c.senderId === 'admin' ||
                              nameStr.includes('(admin)') ||
                              nameStr.includes('(owner)') ||
                              nameStr.includes('(staff)');

                            let isMe = false;
                            if (isExplicitCustomer) {
                              isMe = false;
                            } else if (isExplicitAdmin) {
                              isMe = true;
                            } else {
                              if (c.sender_id === 'admin' || c.sender_uid === 'admin' || roleStr === 'admin') {
                                isMe = true;
                              } else {
                                isMe = false;
                              }
                            }

                            const isOwner = roleStr === 'owner' || c.sender_role === 'OWNER' || c.senderRole === 'OWNER' || nameStr.includes('ceo') || nameStr.includes('owner') || c.sender_id === 'u-owner-own';

                            let customerDisplayName = c.sender_name || c.senderName || 'Customer';
                            if (c.sender_role === 'CUSTOMER' || !isMe) {
                              const matched = users.find(u => 
                                u.id === c.sender_id || 
                                (u.username && c.sender_name && u.username.toLowerCase() === c.sender_name.toLowerCase()) ||
                                (u.name && c.sender_name && u.name.toLowerCase() === c.sender_name.toLowerCase())
                              );
                              if (matched) {
                                customerDisplayName = matched.name || matched.username;
                              }
                            }
                            const cleanCustomerDisplayName = customerDisplayName.replace(/\s*\((customer|pelanggan)\)/gi, '').trim() || 'Customer';

                            const bubbleBg = c.is_quick_reply
                              ? 'bg-gradient-to-r from-emerald-950 to-teal-950 border border-emerald-500/70 text-emerald-50 shadow-xl rounded-br-sm'
                              : (isMe ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-sm');

                            // 🗓️ Deteksi Pergantian Hari untuk Date Divider
                            const currentMsgDate = new Date(msgTime).toDateString();
                            const prevMsg = idx > 0 ? (orderChats[idx - 1] as any) : null;
                            const prevMsgTime = prevMsg ? (prevMsg.created || prevMsg.createdAt || prevMsg.timestamp || prevMsg.orderTimestamp || new Date()) : null;
                            const prevMsgDate = prevMsgTime ? new Date(prevMsgTime).toDateString() : null;
                            const showDateDivider = idx === 0 || (currentMsgDate !== prevMsgDate);

                            return (
                              <React.Fragment key={cKey}>
                                {showDateDivider && (
                                  <div className="flex justify-center my-3 w-full">
                                    <span className="bg-slate-800/90 text-slate-300 text-[10px] font-bold px-3.5 py-1 rounded-full shadow-md border border-slate-700/60 backdrop-blur-sm">
                                      {formatChatDividerDate(msgTime)}
                                    </span>
                                  </div>
                                )}

                                {(c.type === 'JOKI_CREDENTIAL_FORM' || (c as any).type === 'joki_credential_form') ? (
                                  <div className="w-full flex my-2 justify-start sm:justify-center">
                                    <JokiCredentialFormMessage
                                      message={c as any}
                                      chatId={selectedChatRoom?.firestoreDocId || selectedChatRoom?.id || selectedOrderId || ''}
                                      isCustomer={false}
                                      currentUser={currentUser}
                                    />
                                  </div>
                                ) : isSystemMsg ? (
                                  <div className="flex justify-center my-1.5 px-2 w-full">
                                    <div className="bg-[#111b21] border border-emerald-500/30 rounded-xl px-3 py-1.5 max-w-xs sm:max-w-sm text-center shadow-sm">
                                      <div className="flex items-center justify-center gap-1.5 text-[#00E676] font-bold text-[10px] uppercase tracking-wider mb-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
                                        <span>STATUS ORDER</span>
                                      </div>
                                      <div className="text-slate-200 text-[11px] font-medium leading-snug whitespace-pre-wrap">
                                        {renderMessageText(cleanMsg || messageText)}
                                      </div>
                                      <div className="text-[9px] text-emerald-400/60 mt-1">
                                        {timeStr}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`w-full flex my-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`relative group max-w-[75%] md:max-w-[60%] rounded-2xl p-3 text-xs shadow-md  ${bubbleBg}`}>
                                      {/* Header Nama Pengirim */}
                                      <div className={`text-[11px] font-semibold mb-1 ${
                                        isMe 
                                          ? (isOwner ? 'text-amber-200 font-bold' : 'text-white/90') 
                                          : 'text-emerald-400 font-semibold'
                                      }`}>
                                        {isMe ? (isOwner ? '👑 Ceo Entong (Owner)' : 'Admin (Anda)') : `${cleanCustomerDisplayName} (Pelanggan)`}
                                      </div>

                                      <ChatMessageRenderer text={messageText} />
                                
                                      {/* MEDIA ATTACHMENT */}
                                      {c.media_url && (
                                        <div className="my-1.5 max-w-xs cursor-pointer" onClick={() => setExpandedMediaUrl(c.media_url!)}>
                                          {c.media_type === 'IMAGE' ? (
                                            <SafeImage
                                              src={c.media_url}
                                              alt="Foto Chat"
                                              className="w-full max-h-60 rounded-xl border border-slate-700/80 shadow hover:opacity-90"
                                            />
                                          ) : (
                                            <video
                                              src={c.media_url}
                                              controls
                                              className="w-full max-h-60 rounded-xl border border-slate-700/80 bg-black shadow"
                                            />
                                          )}
                                        </div>
                                      )}

                                      <div className={`text-[10px] text-right mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-emerald-200' : 'text-slate-400'}`}>
                                        <span>{timeStr}</span>
                                        {isMe && (
                                          <span className={`font-bold flex items-center gap-0.5 ${c.is_read ? 'text-emerald-200' : 'text-emerald-300/70'}`} title={c.is_read ? 'Pesan telah dibaca customer' : 'Pesan terkirim'}>
                                            {c.is_read ? '✓✓' : '✓'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>

                  <ChatInputArea
                    onSend={handleSendDirectMessage}
                    quickReplies={quickReplies}
                    isUploadingAdminMedia={isUploadingAdminMedia}
                    fileInputAdminRef={fileInputAdminRef}
                    handleAdminMediaUpload={handleAdminMediaUpload}
                    handleAdminPasteImage={handleAdminPasteImage}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">Pilih percakapan di panel kiri.</div>
              )}
            </div>

            {/* Right Pane: Credentials & Order Details */}
            {showRightSidebar && (
              <div className="w-80 bg-[#111b21] border-l border-slate-800 p-4 overflow-y-auto space-y-4 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Kredensial & Detail Order</h3>
                <span className="text-[10px] text-[#00E676] font-mono bg-[#00E676]/10 px-2 py-0.5 rounded-full border border-[#00E676]/30 font-bold">
                  Chat Active
                </span>
              </div>

              {/* Action Button & Catalog Selector: Catat / Tambah Order Baru dari Chat Ini */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const matchedUser = users.find(u => 
                      u.id === activeCustId || 
                      (activeCustPhone && u.phone === activeCustPhone) || 
                      (u.name && activeOrder?.customer_name && u.name.toLowerCase() === activeOrder.customer_name.toLowerCase())
                    );
                    
                    let custId = matchedUser ? matchedUser.id : (activeCustId || ('u-cust-' + Date.now()));
                    let rawName = matchedUser ? matchedUser.name : (activeOrder?.customer_name || 'Customer');
                    let custPhone = matchedUser ? matchedUser.phone : (activeOrder?.customer_phone || '');

                    if (!rawName.startsWith('Cust-')) {
                      const nextCode = getNextCustCode();
                      const clean = rawName.replace(/^Cust-\d+\s*-?\s*/i, '').trim();
                      rawName = `${nextCode} - ${clean || 'Customer'}`;
                    }

                    const defaultItem = items[0];

                    setEditingOrder({
                      id: 'ord-' + Date.now(),
                      customer_id: custId,
                      customer_name: rawName,
                      customer_phone: custPhone,
                      game_name: defaultItem ? defaultItem.game_name : 'Mobile Legends',
                      package_name: defaultItem ? defaultItem.package_name : 'Paket Joko',
                      price: defaultItem ? defaultItem.price : 50000,
                      status: 'BOOKING',
                      game_username: '',
                      game_password: '',
                      login_method: 'Moonton',
                      cloud_number: '',
                      created: new Date().toISOString(),
                      updated: new Date().toISOString()
                    });
                    setShowOrderModal(true);
                  }}
                  className="w-full py-2.5 px-3 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 border border-emerald-400/50 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Order Baru dari Chat</span>
                </button>

                {/* Quick Catalog / Paket Joko Selector */}
                <div className="bg-[#202c33] p-3 rounded-xl border border-slate-700 space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#00E676] flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" /> Pilih Paket Joko / Katalog ({items.length})
                  </label>
                  <select
                    onChange={(e) => {
                      const selectedItem = items.find(i => i.id === e.target.value);
                      if (selectedItem) {
                        const matchedUser = users.find(u => 
                          u.id === activeCustId || 
                          (activeCustPhone && u.phone === activeCustPhone) || 
                          (u.name && activeOrder?.customer_name && u.name.toLowerCase() === activeOrder.customer_name.toLowerCase())
                        );
                        let custId = matchedUser ? matchedUser.id : (activeCustId || ('u-cust-' + Date.now()));
                        let rawName = matchedUser ? matchedUser.name : (activeOrder?.customer_name || 'Customer');
                        let custPhone = matchedUser ? matchedUser.phone : (activeOrder?.customer_phone || '');

                        if (!rawName.startsWith('Cust-')) {
                          const nextCode = getNextCustCode();
                          const clean = rawName.replace(/^Cust-\d+\s*-?\s*/i, '').trim();
                          rawName = `${nextCode} - ${clean || 'Customer'}`;
                        }

                        setEditingOrder({
                          id: 'ord-' + Date.now(),
                          customer_id: custId,
                          customer_name: rawName,
                          customer_phone: custPhone,
                          game_name: selectedItem.game_name,
                          package_name: selectedItem.package_name,
                          price: selectedItem.price,
                          status: 'BOOKING',
                          game_username: '',
                          game_password: '',
                          login_method: 'Moonton',
                          cloud_number: '',
                          created: new Date().toISOString(),
                          updated: new Date().toISOString()
                        });
                        setOrderModalCart(addCatalogToCartHelper([], selectedItem));
                        setShowOrderModal(true);
                      }
                    }}
                    className="w-full p-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-100 text-xs font-semibold focus:border-[#00E676]"
                  >
                    <option value="">-- Pilih Paket Joko dari Katalog --</option>
                    {items.map((i, idx) => (
                      <option key={i.id ? `opt-act-${i.id}-${idx}` : `opt-act-${idx}`} value={i.id}>
                        {i.game_name} - {i.package_name} (Rp {i.price.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeOrder ? (
                <div className="space-y-4 text-xs">
                  <div className="bg-[#202c33] p-3.5 rounded-xl border border-slate-700 space-y-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Nama Customer</span>
                      <span className="font-bold text-slate-100">{activeCustomerName}</span>
                    </div>
                    {activeUsername && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Username Akun</span>
                        <span className="font-bold text-[#00E676]">{activeUsername}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">No WhatsApp</span>
                      <span className="font-bold text-[#00E676]">{activeOrder.customer_phone || 'Belum diisi'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Game & Paket</span>
                      <span className="font-bold text-slate-100">{activeOrder.game_name} - {activeOrder.package_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Harga</span>
                      <span className="font-bold text-emerald-400">Rp {(activeOrder?.price ?? 0)?.toLocaleString?.('id-ID')}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrder(activeOrder);
                        setShowOrderModal(true);
                      }}
                      className="w-full mt-2 py-2 px-3 bg-[#00E676]/20 hover:bg-[#00E676]/30 text-[#00E676] rounded-lg font-bold border border-[#00E676]/40 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Edit / Tambah Katalog (ID #{activeOrder.id})
                    </button>

                    <div className="pt-2.5 border-t border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Instance Cloud Pengerjaan</span>
                        <button
                          type="button"
                          onClick={() => setActiveMenu('cloud_monitor')}
                          className="text-[10px] text-[#00E676] hover:underline flex items-center gap-0.5"
                        >
                          <span>Buka Panel Cloud</span>
                          <Server className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Dropdown Selector */}
                      <div className="flex items-center gap-1.5">
                        <select
                          value={
                            clouds.find(c => c.assignedOrderId === activeOrder.id)?.id || 
                            activeOrder.assignedCloudId || 
                            ''
                          }
                          onChange={async (e) => {
                            const selectedId = e.target.value;
                            if (selectedId === '') {
                              // Release
                              const currentCloud = clouds.find(c => c.assignedOrderId === activeOrder.id || c.id === activeOrder.assignedCloudId);
                              if (currentCloud) {
                                await releaseOrderFromCloud(currentCloud.id);
                              } else {
                                updateOrder({ ...activeOrder, assignedCloudId: null, assignedCloudName: null, cloud_number: null });
                              }
                            } else {
                              // Assign
                              await assignOrderToCloud(selectedId, activeOrder.id);
                            }
                          }}
                          className="flex-1 bg-[#111b21] border border-slate-700 rounded-lg text-xs font-semibold text-sky-300 p-2 focus:outline-none focus:border-[#00E676]"
                        >
                          <option value="">-- Tidak Dipasang ke Cloud --</option>
                          {clouds.map((c, idx) => {
                            const isThisOrder = c.assignedOrderId === activeOrder.id;
                            const isOccupiedByOther = Boolean(c.assignedOrderId) && !isThisOrder;
                            return (
                              <option 
                                key={c.id ? `cloud-opt-${c.id}-${idx}` : `cloud-opt-${idx}`} 
                                value={c.id}
                                disabled={isOccupiedByOther}
                              >
                                {c.name} ({isThisOrder ? '✅ Sedang Dipakai Order Ini' : isOccupiedByOther ? `⛔ Terisi oleh #${c.assignedOrderId}` : '🟢 KOSONG - Siap'})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#202c33] p-3.5 rounded-xl border border-slate-700 space-y-2">
                    <h4 className="font-bold text-[#00E676] uppercase text-[10px]">Kredensial Akun Game</h4>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Username / Email</span>
                      <span className="font-mono text-slate-100 bg-[#111b21] p-1.5 rounded block mt-0.5">{activeOrder.game_username || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Password</span>
                      <span className="font-mono text-slate-100 bg-[#111b21] p-1.5 rounded block mt-0.5">{activeOrder.game_password || '••••••••'}</span>
                    </div>
                    {activeOrder.note && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">Catatan</span>
                        <span className="text-amber-300 italic">{activeOrder.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Tidak ada order dipilih.</p>
              )}
            </div>
          )}
          </div>
        )}

        {activeMenu === 'staff_chat' && (
          <div className="flex-1 p-2 md:p-4 w-full h-full flex flex-col min-h-0">
            <StaffInternalChat currentUser={currentUser} />
          </div>
        )}

        {activeMenu === 'pos' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#00E676]" /> POS Catat Order & Registrasi Customer
              </h2>
              <p className="text-xs text-slate-400">
                Catat orderan joko baru atau pilih pelanggan lama. Semua akun baru otomatis mendapat format ID <span className="text-[#00E676] font-mono font-bold">Cust-XXXX</span> (mulai 3000) dan tersinkron ke database.
              </p>
            </div>

            <form onSubmit={handlePosSubmit} className="bg-[#111b21] border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl text-xs">
              
              {/* Customer Type Selector */}
              <div>
                <label className="block font-bold text-slate-200 mb-2">Pilih Jenis Pelanggan</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#202c33] border border-slate-700 rounded-xl font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setPosCustType('NEW');
                      setPosCustomerName(getNextCustCode());
                      setPosCustomerPhone('');
                    }}
                    className={`py-2 px-3 rounded-lg  text-center flex items-center justify-center gap-1.5 ${
                      posCustType === 'NEW'
                        ? 'bg-[#00E676] text-[#111b21] shadow font-black'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <span>+ Pelanggan Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosCustType('EXISTING')}
                    className={`py-2 px-3 rounded-lg  text-center flex items-center justify-center gap-1.5 ${
                      posCustType === 'EXISTING'
                        ? 'bg-[#00E676] text-[#111b21] shadow font-black'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <span>Pelanggan Lama</span>
                  </button>
                </div>
              </div>

              {/* Pelanggan Lama Selector */}
              {posCustType === 'EXISTING' ? (
                <div className="p-3.5 bg-[#202c33]/80 border border-slate-700 rounded-xl space-y-2.5">
                  <label className="block font-bold text-slate-200">Pilih / Cari Akun Customer Terdaftar</label>
                  
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari nama, WA, atau Cust-XXXX..."
                      value={posCustSearch}
                      onChange={e => setPosCustSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#111b21] border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-[#00E676]"
                    />
                  </div>

                  <select
                    value={selectedExistingCustId}
                    onChange={e => {
                      const uid = e.target.value;
                      setSelectedExistingCustId(uid);
                      const u = users.find(usr => usr.id === uid);
                      if (u) {
                        setPosCustomerName(u.name);
                        setPosCustomerPhone(u.phone || '');
                      }
                    }}
                    required={posCustType === 'EXISTING'}
                    className="w-full p-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-slate-100 font-semibold text-xs"
                  >
                    <option value="">-- Pilih Pelanggan ({users.filter(u => u.role === 'CUSTOMER').length} Terdaftar) --</option>
                    {users
                      .filter(u => u.role === 'CUSTOMER')
                      .filter(c => {
                        if (!posCustSearch.trim()) return true;
                        const q = (posCustSearch || '')?.toLowerCase?.();
                        return (c.name || '')?.toLowerCase?.().includes(q) || (c.phone && c.phone.includes(q)) || (c.username || '')?.toLowerCase?.().includes(q);
                      })
                      .map((c, idx) => (
                        <option key={c.id ? `opt-cust-${c.id}-${idx}` : `opt-cust-${idx}`} value={c.id}>
                          {c.name} - WA: {c.phone || '-'} (@{c.username})
                        </option>
                      ))}
                  </select>
                  {posCustomerName && (
                    <div className="text-[11px] text-[#00E676] font-semibold pt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Terpilih: <span className="font-bold">{posCustomerName}</span> (WA: {posCustomerPhone})
                    </div>
                  )}
                </div>
              ) : (
                /* Pelanggan Baru Fields & Registrasi Akun */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Nama Customer <span className="text-slate-500 font-normal">(Otomatis Cust-{custCounter})</span>
                      </label>
                      <input
                        type="text"
                        required={posCustType === 'NEW'}
                        value={posCustomerName}
                        onChange={e => setPosCustomerName(e.target.value)}
                        placeholder={`Misal: Cust-${custCounter} - Budi`}
                        className="w-full px-4 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">No WhatsApp Customer</label>
                      <input
                        type="tel"
                        required={posCustType === 'NEW'}
                        value={posCustomerPhone}
                        onChange={e => setPosCustomerPhone(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-4 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Account Creation Box */}
                  <div className="p-3.5 bg-[#202c33]/70 border border-[#00E676]/30 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 text-slate-200 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={posCreateAccount}
                        onChange={e => setPosCreateAccount(e.target.checked)}
                        className="w-4 h-4 accent-[#00E676] rounded cursor-pointer"
                      />
                      <span className="text-xs text-[#00E676]">Daftarkan Akun Login Web Ini (Singkron ke Database)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 pl-6">
                      Bisa langsung dipakai login oleh customer untuk cek progres joko & riwayat order.
                    </p>

                    {posCreateAccount && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 pl-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Username Login Web</label>
                          <input
                            type="text"
                            required={posCreateAccount}
                            value={posUsername}
                            onChange={e => setPosUsername(e.target.value)}
                            placeholder={`cust_${custCounter}`}
                            className="w-full px-3 py-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-100 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Password Login Web</label>
                          <input
                            type="text"
                            required={posCreateAccount}
                            value={posPassword}
                            onChange={e => setPosPassword(e.target.value)}
                            placeholder="Password (misal: 123456)"
                            className="w-full px-3 py-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-100 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Multi-Catalog Item Cart Desktop (Group 1 Order ID) */}
              <div className="p-3.5 bg-[#202c33]/90 border border-[#00E676]/40 rounded-2xl space-y-2.5 shadow-md">
                <div className="flex justify-between items-center text-xs font-extrabold text-[#00E676]">
                  <span className="flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Daftar Katalog Order POS ({posCart.length} Jenis)
                  </span>
                  <span className="text-emerald-400 font-mono">
                    Total: Rp {posCart.reduce((s, c) => s + (c.price * c.qty), 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {posCart.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {posCart.map((item, idx) => (
                      <div key={item.id ? `pos-dt-${item.id}-${idx}` : `pos-dt-${idx}`} className="flex justify-between items-center bg-[#111b21] p-2 rounded-xl border border-slate-700/80 text-xs">
                        <div className="truncate pr-2">
                          <div className="font-bold text-slate-100">{item.game_name} - {item.package_name}</div>
                          <div className="text-[11px] text-[#00E676] font-semibold">
                            Rp {item.price.toLocaleString('id-ID')} x {item.qty} = Rp {(item.price * item.qty).toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPosCart(prev => updateCartQtyHelper(prev, item.id, -1))}
                            className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-extrabold px-1 text-slate-100">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => setPosCart(prev => updateCartQtyHelper(prev, item.id, 1))}
                            className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setPosCart(prev => removeCartItemHelper(prev, item.id))}
                            className="w-5 h-5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded font-bold flex items-center justify-center text-xs ml-1"
                            title="Hapus Katalog"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-[#111b21] rounded-xl border border-dashed border-slate-700/70 text-center text-slate-400 text-xs">
                    Belum ada katalog ditambahkan. Pilih katalog lalu klik <span className="text-[#00E676] font-bold">+ Tambah Katalog</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={posSelectedItemId}
                    onChange={e => setPosSelectedItemId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#111b21] border border-slate-700 rounded-xl text-slate-100 font-semibold text-xs focus:border-[#00E676]"
                  >
                    <option value="">-- Pilih Paket Katalog dari Toko --</option>
                    {items.map((i, idx) => (
                      <option key={i.id ? `opt-pos-${i.id}-${idx}` : `opt-pos-${idx}`} value={i.id}>
                        {i.game_name} - {i.package_name} (Rp {i.price.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const selected = items.find(i => i.id === posSelectedItemId) || items[0];
                      if (selected) {
                        setPosCart(prev => addCatalogToCartHelper(prev, selected));
                      }
                    }}
                    className="px-3 py-2 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-bold text-xs rounded-xl shadow active:scale-95 flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Tambah Katalog
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">User/Email Game</label>
                  <input
                    type="text"
                    required
                    value={posGameUsername}
                    onChange={e => setPosGameUsername(e.target.value)}
                    placeholder="Username/Email Game"
                    className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Pass Akun Game</label>
                  <input
                    type="text"
                    required
                    value={posGamePassword}
                    onChange={e => setPosGamePassword(e.target.value)}
                    placeholder="Password Game"
                    className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nomor Cloud (Joko Cloud)</label>
                  <input
                    type="text"
                    value={posCloudNumber}
                    onChange={e => setPosCloudNumber(e.target.value)}
                    placeholder="Contoh: Cloud 01 / Cloud 05"
                    className="w-full px-4 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Catatan Tambahan</label>
                  <input
                    type="text"
                    value={posNote}
                    onChange={e => setPosNote(e.target.value)}
                    placeholder="Catatan pengerjaan"
                    className="w-full px-4 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> Catat Order & Daftarkan Customer
              </button>
            </form>
          </div>
        )}

        {activeMenu === 'orders' && (
          <div className="flex-1 p-3 md:p-6 overflow-y-auto space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex-1">
                <h2 className="text-base md:text-lg font-bold text-slate-100">Database Seluruh Orderan Joko</h2>
                <p className="text-[10px] md:text-xs text-slate-400">Kelola, ubah status, filter katalog/jenis order, atau hapus data order.</p>
              </div>
              <button
                onClick={handleCleanupBotOrders}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold shadow shadow-red-500/10 flex items-center gap-2 uppercase tracking-wide"
                title="Hapus Semua Bot & Orderan Rp 0"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Bersihkan Bot / Rp 0</span>
              </button>
              <button
                onClick={() => {
                  setEditingOrder({
                    id: 'ord-' + Date.now(),
                    customer_id: 'cust-manual',
                    customer_name: getNextCustCode(),
                    customer_phone: '',
                    game_name: 'Mobile Legends',
                    package_name: 'Epic to Legend',
                    price: 50000,
                    status: 'BOOKING',
                    game_username: '',
                    game_password: '',
                    login_method: 'Moonton',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                  });
                  setShowOrderModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-[#00E676] text-[#111b21] font-bold rounded-xl text-xs shadow-lg flex items-center justify-center"
              >
                + Tambah Order Baru
              </button>
            </div>

            {/* SUB-TAB PEMISAH STATUS, JENIS ORDERAN & DROPDOWN FILTER KATALOG GAME */}
            <div className="flex flex-col gap-3 bg-[#111b21] p-3 md:p-4 rounded-2xl border border-slate-800 shadow-md">
              {/* Sub-Tab Filter Status (Atas Tabel) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar border-b border-slate-800/80">
                <button
                  onClick={() => setSelectedStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStatusFilter === 'ALL'
                      ? 'bg-[#00E676] text-[#111b21] shadow-md shadow-[#00E676]/20'
                      : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  📌 Semua Status ({statusCounts.ALL})
                </button>
                <button
                  onClick={() => setSelectedStatusFilter('NEW')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStatusFilter === 'NEW'
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                      : 'bg-[#202c33] text-blue-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  🆕 NEW ({statusCounts.NEW})
                </button>
                <button
                  onClick={() => setSelectedStatusFilter('BOOKING')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStatusFilter === 'BOOKING'
                      ? 'bg-amber-500 text-[#111b21] shadow-md shadow-amber-500/20'
                      : 'bg-[#202c33] text-amber-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  ⏳ BOOKING ({statusCounts.BOOKING})
                </button>
                <button
                  onClick={() => setSelectedStatusFilter('PROSES')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStatusFilter === 'PROSES'
                      ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                      : 'bg-[#202c33] text-purple-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  ⚡ PROSES ({statusCounts.PROSES})
                </button>
                <button
                  onClick={() => setSelectedStatusFilter('SELESAI')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStatusFilter === 'SELESAI'
                      ? 'bg-emerald-500 text-[#111b21] shadow-md shadow-emerald-500/20'
                      : 'bg-[#202c33] text-emerald-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  ✅ SELESAI ({statusCounts.SELESAI})
                </button>
                <button
                  onClick={() => setSelectedStatusFilter('BATAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStatusFilter === 'BATAL'
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                      : 'bg-[#202c33] text-red-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  ❌ CANCEL ({statusCounts.BATAL})
                </button>
                <button
                  onClick={() => setSelectedStatusFilter('HANGUS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 ${
                    selectedStatusFilter === 'HANGUS'
                      ? 'bg-rose-900 text-rose-200 shadow-md shadow-rose-900/20'
                      : 'bg-[#202c33] text-rose-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  ⚠️ HANGUS ({statusCounts.HANGUS || 0})
                </button>
              </div>

              {/* Sub-Tab Tombol Jenis Orderan */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                <button
                  onClick={() => setSelectedTypeTab('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedTypeTab === 'ALL'
                      ? 'bg-[#00E676] text-[#111b21] shadow-md shadow-[#00E676]/20'
                      : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  🌐 Semua Jenis Order
                </button>
                <button
                  onClick={() => setSelectedTypeTab('GIFT')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedTypeTab === 'GIFT'
                      ? 'bg-[#00E676] text-[#111b21] shadow-md shadow-[#00E676]/20'
                      : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  🎁 Gift In Game
                </button>
                <button
                  onClick={() => setSelectedTypeTab('JOKO')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold  whitespace-nowrap flex items-center gap-1.5 ${
                    selectedTypeTab === 'JOKO'
                      ? 'bg-[#00E676] text-[#111b21] shadow-md shadow-[#00E676]/20'
                      : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942] border border-slate-700/60'
                  }`}
                >
                  🎮 Joko / Push Service
                </button>
              </div>

              {/* Search Bar & Dropdown Katalog */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari ID Order, Customer, Username Roblox..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full bg-[#202c33] border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#00E676]"
                  />
                  {orderSearchQuery && (
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown Filter Katalog (Menggunakan validCatalogOptions) */}
                <div className="w-full sm:w-auto min-w-[220px]">
                  <select
                    value={selectedCatalogFilter}
                    onChange={(e) => setSelectedCatalogFilter(e.target.value)}
                    className="w-full bg-[#202c33] border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-semibold shadow cursor-pointer focus:outline-none focus:border-[#00E676]"
                  >
                    <option value="ALL">🌐 Semua Katalog / Game</option>
                    {validCatalogOptions.map((gameName, idx) => (
                      <option key={`cat-${gameName}-${idx}`} value={gameName}>
                        🎮 {gameName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CONTAINER FILTER TANGGAL */}
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mr-1">
                  <i className="fa-regular fa-calendar-days text-emerald-400"></i> Filter Tanggal:
                </span>

                <button
                  onClick={() => { setDateFilterType('ALL'); setCustomSelectedDate(''); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black  ${
                    dateFilterType === 'ALL'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Semua Tanggal
                </button>

                <button
                  onClick={() => setDateFilterType('TODAY')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black  ${
                    dateFilterType === 'TODAY'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  📅 Hari Ini
                </button>

                {/* INPUT PILIH TANGGAL MANUAL */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
                  <input
                    type="date"
                    value={customSelectedDate}
                    onChange={(e) => {
                      setCustomSelectedDate(e.target.value);
                      setDateFilterType('CUSTOM');
                    }}
                    className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
                  />
                  {customSelectedDate && (
                    <button
                      onClick={() => { setCustomSelectedDate(''); setDateFilterType('ALL'); }}
                      className="text-slate-400 hover:text-rose-400 text-xs font-bold ml-1"
                      title="Reset Tanggal"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* TOMBOL SAPU DATA GANDA (GHOST DATA) */}
                <button
                  type="button"
                  onClick={handleCleanGhostData}
                  disabled={isCleaningGhostData}
                  className="ml-auto px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap"
                  title="Bersihkan Data Orderan Ganda"
                >
                  {isCleaningGhostData ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Sapu Data Ganda</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Desktop Table View (hidden on small screens) */}
            <div className="hidden md:flex rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden flex-col max-h-[calc(100vh-220px)]">
              <div className="overflow-x-auto overflow-y-auto custom-scrollbar h-full">
                <table className="table-fixed w-full text-left text-xs border-collapse">
                  <thead className="bg-[#202c33] text-slate-300 border-b border-slate-700 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-[11%]">ID Order</th>
                      <th className="py-2.5 px-2 font-semibold w-[14%]">Customer</th>
                      <th className="py-2.5 px-2 font-semibold w-[14%]">Username Roblox</th>
                      <th className="py-2.5 px-2 font-semibold w-[18%]">Game & Paket</th>
                      <th className="py-2.5 px-2 font-semibold w-[10%]">Harga</th>
                      <th className="py-2.5 px-2 font-semibold w-[11%]">Waktu & Tanggal</th>
                      <th className="py-2.5 px-2 font-semibold w-[8%]">Bukti</th>
                      <th className="py-2.5 px-2 font-semibold w-[8%]">Status</th>
                      <th className="py-2.5 px-2 font-semibold w-[6%] text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredOrdersResult.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 italic text-xs">
                          Tidak ada orderan yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredOrdersResult.slice(0, renderLimitDatabase).map((ord: any, idx: number) => {
                        const uniqueKey = ord.docUniqueId || ord.firestoreId || `${ord.id || ord.orderId || 'ord'}-${idx}`;
                        const initTime = ord.initialCreationTime || getInitialCreationTimestamp(ord);
                        const dt = formatIndonesianDateTime(initTime || ord.createdAt || ord.created || ord.timestamp);
                        return (
                          <tr key={uniqueKey} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 truncate">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs text-[#00E676] font-bold truncate">
                                {ord.orderId || `#${ord.id.replace('ord-', '').substring(0, 8)}`}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(ord.id);
                                  alert('Copied ID: ' + ord.id);
                                }}
                                className="text-slate-400 hover:text-[#00E676] active:scale-95 flex-shrink-0"
                                title="Copy ID"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {ord.cloud_number && (
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                ☁️ {ord.cloud_number}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 truncate">
                            <div className="font-bold text-slate-200 text-xs truncate flex items-center gap-1.5 flex-wrap">
                              <span>{ord.customer_name}</span>
                              {renderCustomerBadge(ord.customer_name, ord.isGuest)}
                              {ord.loginMethod === 'GOOGLE' || ord.email?.includes('@gmail.com') || ord.customerEmail?.includes('@gmail.com') ? (
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                  <i className="fa-brands fa-google text-[9px]"></i> Google
                                </span>
                              ) : (
                                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                  <i className="fa-solid fa-user text-[9px]"></i> Manual
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {ord.customer_phone || '-'}
                            </div>
                          </td>
                          <td className="py-2 px-2 truncate">
                            <RobloxUsernameBadge username={ord.robloxUsername || ord.game_username || ord.targetUsername || ord.accountUsername} />
                          </td>
                          <td className="py-2 px-2 truncate">
                            <div className="font-bold text-emerald-400 text-xs truncate">
                              {ord.game_name}
                            </div>
                            <div className="text-[10px] text-slate-300 truncate mt-0.5" title={ord.package_name}>
                              {ord.package_name}
                            </div>
                          </td>
                          <td className="py-2 px-2 truncate">
                            <span className="text-emerald-400 font-bold truncate">
                              Rp {(ord?.price ?? 0)?.toLocaleString?.('id-ID')}
                            </span>
                          </td>
                          {/* SEL WAKTU & TANGGAL */}
                          <td className="py-2 px-2 truncate text-xs">
                            <div className="flex flex-col">
                              <span className="font-mono text-slate-200 font-extrabold">{dt.time}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{dt.date}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 truncate">
                            {ord.payment_proof || ord.proofOfPayment ? (
                              <button
                                onClick={() => setViewingProofOrder(ord)}
                                className="w-full py-1 bg-[#005C4B]/40 hover:bg-[#005C4B] text-[#00E676] rounded border border-[#00E676]/40 flex items-center justify-center gap-1 text-[10px] font-bold shadow truncate"
                              >
                                <FileText className="w-3.5 h-3.5 flex-shrink-0" /> Bukti
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic block text-center truncate">Tanpa Foto</span>
                            )}
                          </td>
                          <td className="py-2 px-2 truncate">
                            {isAdmin ? (
                              <select
                                value={ord.status || 'BOOKING'}
                                onChange={(e) => handleOrderStatusChange(ord.docUniqueId || ord.id, e.target.value)}
                                className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border outline-none cursor-pointer  ${
                                  ord.status === 'SELESAI' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                  (ord.status === 'PROSES' || ord.status === 'PROSES_WORKER' || ord.status === 'PROSES PUSH') ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                  (ord.status === 'CANCEL' || ord.status === 'BATAL') ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                                  'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                }`}
                              >
                                <option value="BOOKING" className="bg-slate-900 text-white">BOOKING</option>
                                <option value="PROSES" className="bg-slate-900 text-white">PROSES</option>
                                <option value="SELESAI" className="bg-slate-900 text-white">SELESAI</option>
                                <option value="CANCEL" className="bg-slate-900 text-white">CANCEL (Refund TC)</option>
                                <option value="HANGUS" className="bg-slate-900 text-white">HANGUS</option>
                              </select>
                            ) : (
                              <div className="scale-90 origin-left truncate">
                                {renderStatusBadge(ord.status)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 truncate">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedOrderForAccount(ord)}
                                className="p-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 rounded shadow-sm flex-shrink-0"
                                title="Data Akun"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                              {/* Add-on / Tambah Paket */}
                              <button
                                onClick={() => handleAddonOrder(ord.docUniqueId || ord.id, ord.package_name, ord.price)}
                                className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 shadow-sm flex-shrink-0"
                                title="Tambah Add-on / Paket"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              {/* 1. Direct Web Chat */}
                              <button
                                onClick={() => {
                                  const targetRoom = ord.customer_id ? (ord.customer_id.startsWith('guest_') || ord.customer_id.startsWith('room_') ? ord.customer_id : `room_${ord.customer_id}`)
                                                     : (ord.id.startsWith('room_') ? ord.id : `room_${ord.id}`);
                                  setSelectedOrderId(targetRoom.startsWith('room_') ? targetRoom : `room_${targetRoom}`);
                                  setActiveMenu('chat');
                                }}
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 shadow-sm flex-shrink-0"
                                title="Buka Chat Web Customer"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                              {/* 2. Direct WhatsApp */}
                              <button
                                type="button"
                                onClick={() => {
                                  let phone = (ord.customer_phone || ord.customer_whatsapp || ord.whatsapp || ord.phone || '').replace(/[^0-9]/g, '');
                                  if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                                  if (phone) {
                                    const customerName = ord.customer_name || ord.game_username || ord.robloxUsername || 'Customer';
                                    const itemName = ord.package_name || ord.item_name || ord.game_name || 'Gift';
                                    const orderId = ord.orderId || ord.order_id || ord.id;
                                    const text = encodeURIComponent(`Halo kak ${customerName}, mimin Entong Store mau konfirmasi orderan Gift ${itemName} (ID: ${orderId})`);
                                    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                                  } else {
                                    alert('Nomor WhatsApp customer tidak ditemukan pada order ini.');
                                  }
                                }}
                                title="Hubungi via WhatsApp"
                                className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded border border-green-500/30 flex-shrink-0"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                                </svg>
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteOrder(ord.docUniqueId || ord.id, ord.orderId)}
                                  title="Hapus Permanent Orderan"
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 active:scale-95 flex-shrink-0"
                                >
                                  <i className="fa-solid fa-trash-can text-xs"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {/* Mobile Card Grid View (visible only on small screens) */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filteredOrdersResult.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                  Tidak ada orderan yang sesuai dengan filter.
                </div>
              ) : (
                filteredOrdersResult.slice(0, renderLimitDatabase).map((ord: any, idx: number) => {
                  const uniqueKey = ord.docUniqueId || ord.firestoreId || `${ord.id || ord.orderId || 'ord'}-${idx}`;
                  const initTime = ord.initialCreationTime || getInitialCreationTimestamp(ord);
                  const dt = formatIndonesianDateTime(initTime || ord.createdAt || ord.created || ord.timestamp);
                  return (
                    <div key={uniqueKey} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-mono text-xs text-[#00E676] font-bold flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            {ord.orderId || `#${ord.id.replace('ord-', '').substring(0, 8)}`}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(ord.id);
                                alert('Copied ID: ' + ord.id);
                              }}
                              className="text-slate-400 hover:text-[#00E676]"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            🕒 {dt.date} {dt.time}
                          </span>
                        </div>
                        <div className="font-bold text-slate-200 text-[11px] truncate flex items-center gap-1.5 flex-wrap">
                          <span>{ord.customer_name}</span>
                          {renderCustomerBadge(ord.customer_name, ord.isGuest)}
                          {ord.loginMethod === 'GOOGLE' || ord.email?.includes('@gmail.com') || ord.customerEmail?.includes('@gmail.com') ? (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                              <i className="fa-brands fa-google text-[8px]"></i> Google
                            </span>
                          ) : (
                            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                              <i className="fa-solid fa-user text-[8px]"></i> Manual
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <RobloxUsernameBadge username={ord.robloxUsername || ord.game_username || ord.targetUsername || ord.accountUsername} />
                        </div>
                      </div>
                      {ord.payment_proof || ord.proofOfPayment ? (
                        <button
                          onClick={() => setViewingProofOrder(ord)}
                          className="px-2 py-1 bg-[#005C4B]/40 hover:bg-[#005C4B] text-[#00E676] rounded border border-[#00E676]/40 flex items-center justify-center gap-1 text-[10px] font-bold shadow"
                        >
                          <FileText className="w-3.5 h-3.5" /> Bukti
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-500 italic block text-center truncate">Tanpa Foto</span>
                      )}
                    </div>

                    <div className="bg-slate-800/40 rounded-xl p-2 flex flex-col gap-1 border border-slate-700/50">
                      <div className="text-[11px] font-bold text-emerald-400 truncate">{ord.game_name}</div>
                      <div className="text-[10px] text-slate-300 truncate">{ord.package_name}</div>
                      <div className="text-xs text-emerald-400 font-bold mt-0.5">
                        Rp {(ord?.price ?? 0)?.toLocaleString?.('id-ID')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {isAdmin ? (
                        <select
                          value={ord.status || 'BOOKING'}
                          onChange={(e) => handleOrderStatusChange(ord.docUniqueId || ord.id, e.target.value)}
                          className={`flex-1 text-xs font-extrabold px-3 py-1.5 rounded-xl border outline-none cursor-pointer  ${
                            ord.status === 'SELESAI' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            (ord.status === 'PROSES' || ord.status === 'PROSES_WORKER' || ord.status === 'PROSES PUSH') ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            (ord.status === 'CANCEL' || ord.status === 'BATAL') ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}
                        >
                                                    <option value="BOOKING" className="bg-slate-900 text-white">BOOKING</option>
                          <option value="PROSES" className="bg-slate-900 text-white">PROSES</option>
                          <option value="SELESAI" className="bg-slate-900 text-white">SELESAI</option>
                          <option value="CANCEL" className="bg-slate-900 text-white">CANCEL (Refund TC)</option>
                          <option value="HANGUS" className="bg-slate-900 text-white">HANGUS</option>
                        </select>
                      ) : (
                        <div className="flex-1">
                          {renderStatusBadge(ord.status)}
                        </div>
                      )}
                      <button
                        onClick={() => setSelectedOrderForAccount(ord)}
                        className="p-2 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 rounded-lg shadow-sm flex-shrink-0"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAddonOrder(ord.docUniqueId || ord.id, ord.package_name, ord.price)}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 shadow-sm flex-shrink-0"
                        title="Tambah Add-on / Paket"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {/* 1. Direct Web Chat */}
                      <button
                        onClick={() => {
                          const targetRoom = ord.customer_id ? (ord.customer_id.startsWith('guest_') || ord.customer_id.startsWith('room_') ? ord.customer_id : `room_${ord.customer_id}`)
                                              : (ord.id.startsWith('room_') ? ord.id : `room_${ord.id}`);
                          setSelectedOrderId(targetRoom.startsWith('room_') ? targetRoom : `room_${targetRoom}`);
                          setActiveMenu('chat');
                        }}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 shadow-sm flex-shrink-0"
                        title="Buka Chat Web Customer"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      {/* 2. Direct WhatsApp */}
                      <button
                        type="button"
                        onClick={() => {
                          let phone = (ord.customer_phone || ord.customer_whatsapp || ord.whatsapp || ord.phone || '').replace(/[^0-9]/g, '');
                          if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                          if (phone) {
                            const customerName = ord.customer_name || ord.game_username || ord.robloxUsername || 'Customer';
                            const itemName = ord.package_name || ord.item_name || ord.game_name || 'Gift';
                            const orderId = ord.orderId || ord.order_id || ord.id;
                            const text = encodeURIComponent(`Halo kak ${customerName}, mimin Entong Store mau konfirmasi orderan Gift ${itemName} (ID: ${orderId})`);
                            window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                          } else {
                            alert('Nomor WhatsApp customer tidak ditemukan pada order ini.');
                          }
                        }}
                        title="Hubungi via WhatsApp"
                        className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 flex-shrink-0"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                        </svg>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteOrder(ord.docUniqueId || ord.id, ord.orderId)}
                          title="Hapus Permanent Orderan"
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 active:scale-95 flex-shrink-0"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {filteredOrdersResult.length > renderLimitDatabase && (
            <div className="flex justify-center p-6">
              <button 
                onClick={() => setRenderLimitDatabase(prev => prev + 50)}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 font-bold px-8 py-3 rounded-full text-xs shadow-lg shadow-emerald-500/10 active:scale-95"
              >
                Muat Lebih Banyak ({filteredOrdersResult.length - renderLimitDatabase} orderan tersisa)
              </button>
            </div>
          )}
          </div>
        )}

        {activeMenu === 'orderan' && (
          <OrderanPanel
            onOpenChatWithOrder={(orderId, custName, custPhone) => {
              const targetPhone = (custPhone || '').trim();
              const matchedConv = allChatConversations.find((c: any) =>
                (targetPhone && (c.phone === targetPhone || c.id?.includes(targetPhone))) ||
                (orderId && (c.id === orderId || c.id === `room_${orderId}` || c.orderId === orderId))
              );
              if (matchedConv) {
                handleSelectConversationItem(matchedConv);
              } else {
                const targetRoom = targetPhone ? `room_${targetPhone}` : `room_${orderId}`;
                setSelectedOrderId(targetRoom);
                setSelectedChatId(targetRoom);
                setMobileChatView('ROOM');
              }
              setActiveMenu('chat');
              setMobileTab('chat');
            }}
          />
        )}

        {activeMenu === 'tongcoins' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <AdminTongCoinsPanel 
              currentUser={currentUser}
              onOpenChatWithUser={(userId, userName) => {
                const matchedConv = allChatConversations.find((c: any) => 
                  c.id === `room_${userId}` || c.id === userId || c.userId === userId
                );

                if (matchedConv) {
                  handleSelectConversationItem(matchedConv);
                } else {
                  const targetRoom = `room_${userId}`;
                  setSelectedOrderId(targetRoom);
                  setSelectedChatId(targetRoom);
                  setMobileChatView('ROOM');
                }
                setActiveMenu('chat');
                setMobileTab('chat');
              }}
            />
          </div>
        )}

        {activeMenu === 'payment_pending' && (
          <div className="flex-1 overflow-y-auto">
            <AdminPaymentPending 
              onOpenChatWithOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setActiveMenu('chat');
                setMobileTab('chat');
              }}
            />
          </div>
        )}

        {activeMenu === 'customers' && isAdmin && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#00E676]" /> Kelola Customer & Paket Joko
                </h2>
                <p className="text-xs text-slate-400">Semua customer terdaftar dengan nama format Cust-XXXX. Anda dapat mengedit paket joko masing-masing customer di sini.</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    placeholder="Cari nama, username, no WA..."
                    value={customerSearchQuery}
                    onChange={e => setCustomerSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676]"
                  />
                  <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
                </div>
                <button
                  onClick={() => {
                    setEditingCust({
                      id: 'cust-' + Date.now(),
                      username: '',
                      name: `Cust-${custCounter} - `,
                      email: '',
                      phone: '',
                      role: 'CUSTOMER',
                      created: new Date().toISOString()
                    });
                    setShowCustModal(true);
                  }}
                  className="px-4 py-2 bg-[#00E676] text-[#111b21] font-bold rounded-xl text-xs shadow-lg flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Tambah Customer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const allCustsMap = new Map();
                users.filter(u => u.role === 'CUSTOMER').forEach(u => {
                  allCustsMap.set(u.id, { ...u, isRegistered: true });
                });
                adminLiveOrders.forEach(o => {
                  const cid = o.customer_id;
                  if (!allCustsMap.has(cid)) {
                    allCustsMap.set(cid, { 
                      id: cid, 
                      name: o.customer_name || 'Customer', 
                      phone: o.customer_phone || '', 
                      email: '-',
                      role: 'CUSTOMER', 
                      isRegistered: false 
                    });
                  }
                });
                let allCusts = Array.from(allCustsMap.values());
                
                if (customerSearchQuery.trim()) {
                  const q = customerSearchQuery.toLowerCase();
                  allCusts = allCusts.filter(u => (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q));
                }

                return allCusts.map((u, idx) => {
                  const custOrders = adminLiveOrders.filter(o => {
                    if (o.status === 'BELUM_ORDER') return false;
                    const byId = !!(o.customer_id && u.id && o.customer_id === u.id);
                    const byName = !!(o.customer_name && u.name && o.customer_name.toLowerCase() === u.name.toLowerCase());
                    const byUsername = !!((o as any).game_username && u.username && (o as any).game_username.toLowerCase() === u.username.toLowerCase());
                    return byId || byName || byUsername;
                  });

                const isCustMuted = isUserMuted(u.id) || (u.phone && isUserMuted(u.phone));
                const custMuteSecs = Math.max(getMuteRemainingSeconds(u.id), u.phone ? getMuteRemainingSeconds(u.phone) : 0);

                return (
                  <div key={u.id ? `desk-cust-${u.id}-${idx}` : `desk-cust-${idx}`} className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-10 h-10 rounded-full bg-[#00E676]/20 text-[#00E676] font-extrabold flex items-center justify-center border border-[#00E676]/30">
                          {String(u?.name || 'U')?.charAt?.(0)?.toUpperCase?.()}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCust(u);
                              setShowCustModal(true);
                            }}
                            className="p-1.5 bg-[#202c33] text-amber-400 rounded-lg hover:bg-slate-700"
                            title="Edit Data Akun Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (confirm(`Hapus customer ${u.name}?`)) deleteUser(u.id);
                              }}
                              className="p-1.5 bg-red-950/50 text-red-400 rounded-lg hover:bg-red-900"
                              title="Hapus Customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{u.name}</h3>
                        <p className="text-xs text-[#00E676] font-mono">@{u.username}</p>
                      </div>

                      {/* Banned Controls */}
                      {u.isBanned ? (
                        <div className="p-2.5 bg-red-950/70 border border-red-500/50 rounded-xl flex items-center justify-between text-xs shadow-md mb-2">
                          <div className="flex items-center gap-1.5 text-red-300 font-extrabold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>🚫 AKUN DIBLOKIR</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleBan(u.id, true)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg shadow"
                          >
                            ✅ Unban User
                          </button>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-center justify-between text-xs shadow-md mb-2">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>✅ AKUN AKTIF</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleBan(u.id, false)}
                            className="px-2.5 py-1 bg-red-900/80 hover:bg-red-800 border border-red-700/50 text-red-100 font-bold text-[10px] rounded-lg shadow"
                          >
                            🚫 Ban User
                          </button>
                        </div>
                      )}

                      {/* Anti-Spam Mute Status Controls */}
                      {isCustMuted ? (
                        <div className="p-2.5 bg-rose-950/70 border border-rose-500/50 rounded-xl flex items-center justify-between text-xs shadow-md">
                          <div className="flex items-center gap-1.5 text-rose-300 font-extrabold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>🚫 Muted ({formatCountdown(custMuteSecs)})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMuteUser(u.id, u.mutedUntil || null)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg shadow"
                          >
                            Unmute
                          </button>
                        </div>
                      ) : (
                        <div className="p-2 bg-[#202c33]/40 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" /> Status Chat Normal
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMuteUser(u.id, null)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 font-bold text-[10px] rounded-lg"
                            title="Mute Customer ini selama 15 menit"
                          >
                            Mute 15m
                          </button>
                        </div>
                      )}

                      <div className="text-xs text-slate-300 space-y-0.5 bg-[#202c33]/50 p-2.5 rounded-xl border border-slate-800">
                        <div><span className="text-slate-500">WA:</span> {u.phone || '-'}</div>
                        <div><span className="text-slate-500">Email:</span> {u.email}</div>
                      </div>

                      {/* Section Paket Joko Customer */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-300">
                          <span className="flex items-center gap-1 text-[#00E676]">
                            <Gamepad2 className="w-3.5 h-3.5" /> Paket Joko Customer ({custOrders.length})
                          </span>
                        </div>

                        {custOrders.length > 0 ? (
                          <div className="space-y-2">
                            {custOrders.map((ord: any, idx: number) => {
                              const uniqueKey = ord.docUniqueId || ord.firestoreId || `${ord.id || ord.orderId || 'cust-ord'}-${idx}`;
                              return (
                                <div key={uniqueKey} className="p-2.5 bg-[#202c33] border border-slate-700/80 rounded-xl space-y-1.5">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="font-bold text-slate-100 text-xs">{ord.game_name}</div>
                                      <div className="text-[11px] text-slate-400">{ord.package_name}</div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-[#00E676]/20 text-[#00E676] text-[10px] font-bold rounded">
                                      {ord.status}
                                    </span>
                                  </div>

                                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                                    <span className="text-xs font-bold text-emerald-400">Rp {(ord?.price ?? 0)?.toLocaleString?.('id-ID')}</span>
                                    <button
                                      onClick={() => {
                                        setEditingJokoOrder(ord);
                                        setShowEditJokoModal(true);
                                      }}
                                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow"
                                    >
                                      <Edit2 className="w-3 h-3" /> Edit / Tambah Katalog
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            <button
                              onClick={() => {
                                const defaultItem = items[0];
                                setEditingJokoOrder({
                                  id: 'ord-' + Date.now(),
                                  customer_id: u.id,
                                  customer_name: u.name,
                                  customer_phone: u.phone || '',
                                  game_name: defaultItem ? defaultItem.game_name : 'Mobile Legends',
                                  package_name: defaultItem ? defaultItem.package_name : 'Epic to Legend (Per Star)',
                                  price: defaultItem ? defaultItem.price : 30000,
                                  status: 'PROSES_WORKER',
                                  game_username: '',
                                  game_password: '',
                                  login_method: 'Moonton',
                                  created: new Date().toISOString(),
                                  updated: new Date().toISOString()
                                });
                                if (defaultItem) {
                                  setJokoModalCart(addCatalogToCartHelper([], defaultItem));
                                }
                                setShowEditJokoModal(true);
                              }}
                              className="w-full py-1.5 bg-[#202c33] hover:bg-slate-700 text-[#00E676] border border-slate-700/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1 mt-2"
                            >
                              <Plus className="w-3.5 h-3.5" /> + Tambah Paket Joko Baru
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 bg-[#202c33]/40 border border-slate-800 rounded-xl text-center space-y-2">
                            <span className="text-[11px] text-slate-500 italic block">Belum ada riwayat orderan aktif untuk customer ini.</span>
                            <button
                              onClick={() => {
                                setEditingJokoOrder({
                                  id: 'ord-' + Date.now(),
                                  customer_id: u.id,
                                  customer_name: u.name,
                                  customer_phone: u.phone || '',
                                  game_name: 'Mobile Legends',
                                  package_name: 'Epic to Legend (Per Star)',
                                  price: 30000,
                                  status: 'PROSES_WORKER',
                                  game_username: '',
                                  game_password: '',
                                  login_method: 'Moonton',
                                  created: new Date().toISOString(),
                                  updated: new Date().toISOString()
                                });
                                setShowEditJokoModal(true);
                              }}
                              className="w-full py-1.5 bg-[#202c33] hover:bg-slate-700 text-[#00E676] border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> + Buat / Edit Paket Joko
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedOrderId('room_' + u.id);
                          setActiveMenu('chat');
                        }}
                        className="w-full py-2 bg-[#005C4B] hover:bg-[#004d40] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Chat Langsung
                      </button>
                    </div>
                  </div>
                );
              })})()}
            </div>
          </div>
        )}

        {activeMenu === 'staff' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <StaffManagement />
          </div>
        )}

        {activeMenu === 'items' && isAdmin && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <AdminCatalogManager />
          </div>
        )}

        {activeMenu === 'reviews' && isAdmin && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <AdminReviewsManager />
          </div>
        )}

        {activeMenu === 'qrs' && isAdmin && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Quick Reply Templates (Admin Only)</h2>
                <p className="text-xs text-slate-400">Template balasan cepat WhatsApp untuk admin.</p>
              </div>
              <button
                onClick={() => {
                  setEditingQr({
                    id: 'qr-' + Date.now(),
                    shortcut: '/s...',
                    title: '',
                    message: ''
                  });
                  setShowQrModal(true);
                }}
                className="px-4 py-2 bg-[#00E676] text-[#111b21] font-bold rounded-xl text-xs shadow-lg"
              >
                + Tambah Quick Reply
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickReplies.map((qr, idx) => (
                <div key={qr.id ? `qr-grid-${qr.id}-${idx}` : `qr-grid-${idx}`} className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-1 bg-[#00E676]/20 text-[#00E676] rounded font-mono text-xs font-bold">{qr.shortcut}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingQr(qr);
                          setShowQrModal(true);
                        }}
                        className="p-1 bg-[#202c33] text-amber-400 rounded hover:bg-slate-700 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteQuickReply(qr.id)}
                        className="p-1 bg-red-950/50 text-red-400 rounded hover:bg-red-900 text-xs"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{qr.title}</h3>
                  <p className="text-xs text-slate-300 bg-[#202c33] p-3 rounded-xl border border-slate-700/60">{qr.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeMenu === 'attendance' && (
          <AttendancePanel currentUser={currentUser} />
        )}

        {activeMenu === 'admin_login' && isAdmin && (
          <AdminLoginPanel currentUser={currentUser} />
        )}

        {activeMenu === 'finance' && (() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const currentMonthStr = todayStr.substring(0, 7);

          const filteredFinance = finance.filter(f => {
            const fDate = f.date || todayStr;
            if (financeFilterMode === 'DAILY') {
              return fDate === todayStr;
            }
            if (financeFilterMode === 'MONTHLY') {
              return fDate.startsWith(currentMonthStr);
            }
            if (financeFilterMode === 'CUSTOM_DATE') {
              return fDate === financeCustomDate;
            }
            return true; // 'ALL'
          });

          const totalInc = filteredFinance.filter(f => f.type !== 'EXPENSE').reduce((acc, f) => acc + f.amount, 0);
          const totalExp = filteredFinance.filter(f => f.type === 'EXPENSE').reduce((acc, f) => acc + f.amount, 0);
          const netProfit = totalInc - totalExp;

          const handleSaveFinance = (e: React.FormEvent) => {
            e.preventDefault();
            const amt = parseFloat(finAmount);
            if (isNaN(amt) || amt <= 0) {
              alert('Jumlah nominal harus berupa angka lebih dari 0.');
              return;
            }
            addFinanceRecord({
              type: finType,
              category: finCategory || 'Umum',
              amount: amt,
              description: finDesc || (finType === 'INCOME' ? 'Pemasukan Manual' : 'Pengeluaran Toko'),
              date: finDate || todayStr,
              created_by: currentUser?.name || 'Admin'
            });
            setShowFinanceModal(false);
            setFinAmount('');
            setFinDesc('');
          };

          return (
            <div className="flex-1 p-6 overflow-y-auto space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-[#00E676]" />
                    Laporan Keuangan Toko
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Filter dan pantau pendapatan, pengeluaran, serta laba bersih toko secara realtime.</p>
                </div>
                <button
                  onClick={() => setShowFinanceModal(true)}
                  className="px-4 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Catat Transaksi Manual
                </button>
              </div>

              {/* Filter Controls Bar */}
              <div className="bg-[#111b21] border border-slate-800 p-3.5 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-[#202c33] p-1 rounded-xl border border-slate-700 text-xs font-bold">
                  <button
                    onClick={() => setFinanceFilterMode('ALL')}
                    className={`px-3 py-1.5 rounded-lg  ${financeFilterMode === 'ALL' ? 'bg-[#00E676] text-[#111b21] shadow font-black' : 'text-slate-300 hover:text-slate-100'}`}
                  >
                    Semua Waktu
                  </button>
                  <button
                    onClick={() => setFinanceFilterMode('DAILY')}
                    className={`px-3 py-1.5 rounded-lg  ${financeFilterMode === 'DAILY' ? 'bg-[#00E676] text-[#111b21] shadow font-black' : 'text-slate-300 hover:text-slate-100'}`}
                  >
                    Hari Ini ({todayStr})
                  </button>
                  <button
                    onClick={() => setFinanceFilterMode('MONTHLY')}
                    className={`px-3 py-1.5 rounded-lg  ${financeFilterMode === 'MONTHLY' ? 'bg-[#00E676] text-[#111b21] shadow font-black' : 'text-slate-300 hover:text-slate-100'}`}
                  >
                    Bulan Ini ({currentMonthStr})
                  </button>
                  <button
                    onClick={() => setFinanceFilterMode('CUSTOM_DATE')}
                    className={`px-3 py-1.5 rounded-lg  ${financeFilterMode === 'CUSTOM_DATE' ? 'bg-[#00E676] text-[#111b21] shadow font-black' : 'text-slate-300 hover:text-slate-100'}`}
                  >
                    Pilih Tanggal
                  </button>
                </div>

                {financeFilterMode === 'CUSTOM_DATE' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">Pilih Tanggal:</span>
                    <input
                      type="date"
                      value={financeCustomDate}
                      onChange={e => setFinanceCustomDate(e.target.value)}
                      className="px-3 py-1.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676]"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#111b21] border border-emerald-500/30 p-5 rounded-2xl shadow-xl">
                  <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">Total Pemasukan</span>
                  <div className="text-2xl font-black text-[#00E676] mt-1">
                    Rp {(totalInc ?? 0)?.toLocaleString?.('id-ID')}
                  </div>
                </div>

                <div className="bg-[#111b21] border border-red-500/30 p-5 rounded-2xl shadow-xl">
                  <span className="text-xs text-red-400 uppercase font-bold tracking-wider">Total Pengeluaran</span>
                  <div className="text-2xl font-black text-red-400 mt-1">
                    Rp {(totalExp ?? 0)?.toLocaleString?.('id-ID')}
                  </div>
                </div>

                <div className="bg-[#111b21] border border-blue-500/30 p-5 rounded-2xl shadow-xl">
                  <span className="text-xs text-blue-400 uppercase font-bold tracking-wider">Laba Bersih Toko</span>
                  <div className={`text-2xl font-black mt-1 ${netProfit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                    Rp {(netProfit ?? 0)?.toLocaleString?.('id-ID')}
                  </div>
                </div>

                <div className="bg-[#111b21] border border-slate-800 p-5 rounded-2xl shadow-xl">
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Transaksi</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    {filteredFinance.length} Record
                  </div>
                </div>
              </div>

              {/* Finance Data Table */}
              <div className="bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden shadow-xl mt-2">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#202c33] text-slate-300 border-b border-slate-700">
                    <tr>
                      <th className="p-3.5">Tanggal</th>
                      <th className="p-3.5">Tipe</th>
                      <th className="p-3.5">Kategori</th>
                      <th className="p-3.5">Deskripsi</th>
                      <th className="p-3.5">Jumlah (Rp)</th>
                      <th className="p-3.5">Pencatat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredFinance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                          Tidak ada data transaksi keuangan untuk filter yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      filteredFinance.map((f, idx) => (
                        <tr key={f.id ? `fin-tr-${f.id}-${idx}` : `fin-tr-${idx}`} className="hover:bg-[#202c33]/40">
                          <td className="p-3.5 text-slate-300 font-mono">{f.date}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${f.type === 'EXPENSE' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-[#00E676] border border-emerald-500/30'}`}>
                              {f.type === 'EXPENSE' ? 'PENGELUARAN' : 'PEMASUKAN'}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-slate-100">{f.category}</td>
                          <td className="p-3.5 text-slate-300">{f.description}</td>
                          <td className={`p-3.5 font-black text-sm ${f.type === 'EXPENSE' ? 'text-red-400' : 'text-[#00E676]'}`}>
                            {f.type === 'EXPENSE' ? '-' : '+'}Rp {(f?.amount ?? 0)?.toLocaleString?.('id-ID')}
                          </td>
                          <td className="p-3.5 text-slate-400">{f.created_by}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Catat Transaksi Finance */}
              {showFinanceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <div className="bg-[#111b21] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h3 className="text-base font-black text-[#00E676] flex items-center gap-2">
                        <DollarSign className="w-5 h-5" /> Catat Transaksi Keuangan
                      </h3>
                      <button onClick={() => setShowFinanceModal(false)} className="text-slate-400 hover:text-slate-200">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveFinance} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Jenis Transaksi</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-[#202c33] rounded-xl border border-slate-700">
                          <button
                            type="button"
                            onClick={() => setFinType('INCOME')}
                            className={`py-2 text-center rounded-lg font-extrabold ${finType === 'INCOME' ? 'bg-[#00E676] text-[#111b21]' : 'text-slate-400'}`}
                          >
                            + Pemasukan
                          </button>
                          <button
                            type="button"
                            onClick={() => setFinType('EXPENSE')}
                            className={`py-2 text-center rounded-lg font-extrabold ${finType === 'EXPENSE' ? 'bg-red-500 text-white' : 'text-slate-400'}`}
                          >
                            - Pengeluaran
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Tanggal Transaksi</label>
                        <input
                          type="date"
                          required
                          value={finDate}
                          onChange={e => setFinDate(e.target.value)}
                          className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Kategori</label>
                        <input
                          type="text"
                          required
                          value={finCategory}
                          onChange={e => setFinCategory(e.target.value)}
                          placeholder="Contoh: Joko Mobile Legends / Gaji Worker / Operasional"
                          className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Nominal Jumlah (Rp)</label>
                        <input
                          type="number"
                          required
                          value={finAmount}
                          onChange={e => setFinAmount(e.target.value)}
                          placeholder="Contoh: 150000"
                          className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-bold text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Deskripsi / Keterangan</label>
                        <textarea
                          rows={2}
                          value={finDesc}
                          onChange={e => setFinDesc(e.target.value)}
                          placeholder="Keterangan transaksi..."
                          className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowFinanceModal(false)}
                          className="flex-1 py-3 bg-[#202c33] text-slate-300 font-bold rounded-xl"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 bg-[#00E676] text-[#111b21] font-black rounded-xl shadow-lg"
                        >
                          Simpan Record
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {activeMenu === 'settings' && isAdmin && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                <Settings className="w-6 h-6 text-[#00E676]" />
                Pengaturan Admin & Metode Pembayaran
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Kelola status keaktifan Admin (Online/Offline) dan rekening pembayaran QRIS / DANA yang akan tampil secara dinamis pada UI Customer.
              </p>
            </div>

            {/* 0. Admin Profile / Store Avatar Setting */}
            <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200 flex items-center justify-between">
                <span>Foto Profile Admin / Logo Bar Atas Customer</span>
                <span className="text-xs text-[#00E676] font-semibold">Tampil di Header HP & Customer</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0">
                  {storeAvatarUrl ? (
                    <img 
                      src={storeAvatarUrl} 
                      alt="Avatar Admin" 
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#00E676] shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#005C4B] border-2 border-[#00E676] flex items-center justify-center text-[#00E676] font-black text-xl shadow-lg">
                      ES
                    </div>
                  )}
                  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#111b21] ${!isStoreClosed ? 'bg-[#00E676] ' : 'bg-amber-400'}`} />
                </div>

                <div className="flex-1 w-full space-y-2">
                  <input
                    type="text"
                    value={localSettings.storeAvatarUrl}
                    onChange={e => setLocalSettings({ ...localSettings, storeAvatarUrl: e.target.value })}
                    placeholder="Masukkan URL Foto Profil Admin..."
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#00E676]"
                  />
                  <label className="block w-full text-center py-2 bg-[#202c33] hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs cursor-pointer border border-slate-600">
                    Upload Foto Profil Baru
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file, 400, 0.8);
                            setLocalSettings({ ...localSettings, storeAvatarUrl: compressed });
                          } catch (err) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setLocalSettings({ ...localSettings, storeAvatarUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 2. QRIS & DANA Payment Settings */}
            <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
              <h3 className="text-sm font-bold text-slate-200">Konfigurasi Metode Pembayaran Customer</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* QRIS Upload / URL */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300">1. Gambar Barcode QRIS All Payment</label>
                  <div className="bg-[#202c33] p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center space-y-3">
                    <img 
                      src={qrisImageUrl} 
                      alt="QRIS Preview" 
                      className="w-48 h-48 object-contain rounded-xl bg-white p-2 border border-slate-600 shadow-md"
                      onError={(e) => {
                        (e.target as HTMLElement).setAttribute('src', 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=600&q=80');
                      }}
                    />
                    <div className="w-full space-y-2">
                      <input
                        type="text"
                        value={localSettings.qrisImageUrl}
                        onChange={e => setLocalSettings({ ...localSettings, qrisImageUrl: e.target.value })}
                        placeholder="Masukkan URL Gambar QRIS..."
                        className="w-full p-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100"
                      />
                      <label className="block w-full text-center py-2 bg-[#202c33] hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs cursor-pointer border border-slate-600">
                        Upload Foto QRIS dari HP / PC
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setLocalSettings({ ...localSettings, qrisImageUrl: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* DANA Account Settings */}
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-300">2. Akun E-Wallet DANA</label>
                  <div className="bg-[#202c33] p-4 rounded-2xl border border-slate-700 space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Nomor DANA Admin</label>
                      <input
                        type="text"
                        value={localSettings.danaNumber}
                        onChange={e => setLocalSettings({ ...localSettings, danaNumber: e.target.value })}
                        placeholder="Contoh: 0812-3456-7890"
                        className="w-full p-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Nama Pemilik Akun DANA</label>
                      <input
                        type="text"
                        value={localSettings.danaName}
                        onChange={e => setLocalSettings({ ...localSettings, danaName: e.target.value })}
                        placeholder="Contoh: ENTONG CHAT OFFICIAL"
                        className="w-full p-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 font-bold"
                      />
                    </div>
                    
                    <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-[11px] text-blue-200">
                      Data ini akan tampil otomatis di checkout customer saat memilih metode pembayaran DANA.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2.5. WhatsApp Admin Khusus Gift In-Game & Fast Response */}
            <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[#00E676]">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">
                      Nomor WhatsApp Admin Khusus Gift In-Game
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Nomor tujuan saat customer menekan tombol "Request Pengiriman Sekarang" pada modal Gift.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#00E676] bg-[#00E676]/10 px-2.5 py-1 rounded-full border border-[#00E676]/30">
                  Sinkron Realtime
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nomor WhatsApp Admin (Format: 08xxx / 628xxx)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={localSettings.adminWhatsappNumber}
                      onChange={e => setLocalSettings({ ...localSettings, adminWhatsappNumber: e.target.value })}
                      placeholder="Contoh: 081234567890"
                      className="w-full p-3 pl-10 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 font-mono font-bold focus:outline-none focus:border-[#00E676]"
                    />
                    <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    Nomor aktif sekarang: <strong className="font-mono text-white">{adminWhatsappNumber || '081234567890'}</strong>. Tersambung langsung ke tombol customer di modal pesanan gift.
                  </span>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
                  <button
                    onClick={handleSavePaymentSettings}
                    className="px-6 py-3 bg-[#00E676] hover:bg-[#00C853] text-[#111b21] font-bold rounded-xl shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-transform hover:scale-105"
                  >
                    💾 Simpan Semua Pengaturan Pembayaran & WA
                  </button>
              </div>
            </div>

            {/* 3. Banner Pengumuman Toko */}
            {!bannerCfg ? (
              <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 flex items-center justify-center h-24">
                <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
              </div>
            ) : (
              <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📢</span>
                    <h3 className="text-sm font-bold text-slate-200">Pengaturan Banner Toko</h3>
                  </div>
                  <button
                    onClick={() => setBannerCfg({ ...bannerCfg, enabled: !bannerCfg.enabled })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      bannerCfg.enabled
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${bannerCfg.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    {bannerCfg.enabled ? 'Banner Aktif' : 'Banner Nonaktif'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Ikuti Jam Toko Otomatis</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Banner berubah sesuai buka/tutup toko</p>
                    </div>
                    <button
                      onClick={() => setBannerCfg({ ...bannerCfg, followStoreHours: !bannerCfg.followStoreHours })}
                      className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${bannerCfg.followStoreHours ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${bannerCfg.followStoreHours ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-slate-200">Teks Berjalan (Marquee)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Teks banner bergerak seperti running text</p>
                    </div>
                    <button
                      onClick={() => setBannerCfg({ ...bannerCfg, scrolling: !bannerCfg.scrolling })}
                      className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${bannerCfg.scrolling ? 'bg-blue-500' : 'bg-slate-700'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${bannerCfg.scrolling ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Teks Saat Toko BUKA</label>
                    <input value={bannerCfg.openText} onChange={e => setBannerCfg({ ...bannerCfg, openText: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500/50"
                      placeholder="Toko sedang BUKA! Admin siap melayani." />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-sky-400 uppercase tracking-widest">Teks Saat TAKE ORDER</label>
                    <input value={bannerCfg.takeOrderText} onChange={e => setBannerCfg({ ...bannerCfg, takeOrderText: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sky-500/50"
                      placeholder="Take Order sudah dibuka! Order via WhatsApp." />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Teks Saat Toko TUTUP</label>
                    <input value={bannerCfg.closedText} onChange={e => setBannerCfg({ ...bannerCfg, closedText: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500/50"
                      placeholder="Toko sedang TUTUP. Buka kembali besok." />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Emoji Ikon</label>
                    <input value={bannerCfg.emoji} onChange={e => setBannerCfg({ ...bannerCfg, emoji: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-slate-600"
                      maxLength={2} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Warna Buka</label>
                    <select value={bannerCfg.openColor} onChange={e => setBannerCfg({ ...bannerCfg, openColor: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none">
                      <option value="green">Hijau</option>
                      <option value="emerald">Emerald</option>
                      <option value="blue">Biru</option>
                      <option value="cyan">Cyan</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Warna Tutup</label>
                    <select value={bannerCfg.closedColor} onChange={e => setBannerCfg({ ...bannerCfg, closedColor: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none">
                      <option value="amber">Amber</option>
                      <option value="orange">Orange</option>
                      <option value="red">Merah</option>
                      <option value="rose">Rose</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button onClick={handleSaveBanner} disabled={bannerSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#00E676] hover:bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-500 text-[#111b21] font-bold rounded-xl transition-all text-sm">
                    {bannerSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : bannerSaved ? <CheckCircle2 className="w-4 h-4" /> : null}
                    {bannerSaved ? 'Tersimpan!' : 'Simpan Pengaturan Banner'}
                  </button>
                </div>
              </div>
            )}

            {/* 4. Global Auto-Update & Client Refresh Broadcast */}
            <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-200">
                    Pembaruan Sistem & Broadcast Auto-Reload Klien
                  </h3>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Realtime Watcher Active
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Gunakan fitur ini setelah melakukan deploy pembaruan atau saat ingin menyinkronkan seluruh browser customer dan staf secara instan. Semua browser yang sedang membuka web akan otomatis me-refresh dan memuat versi terbaru tanpa cache usang.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Kirim sinyal auto-reload ke SELURUH browser pengguna & staf yang sedang aktif?")) {
                      const success = await triggerForceSystemRefresh(currentUser?.email || currentUser?.username);
                      if (success) {
                        alert("✅ Sinyal broadcast pembaruan berhasil dikirim! Seluruh browser klien akan me-refresh secara otomatis.");
                      } else {
                        alert("❌ Gagal mengirim sinyal. Pastikan koneksi Firestore tersedia.");
                      }
                    }
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  Paksa Update & Refresh Seluruh Client
                </button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('app_version');
                    localStorage.removeItem('last_system_refresh');
                    if ('caches' in window) {
                      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
                    }
                    window.location.reload();
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Bersihkan Cache & Refresh Perangkat Ini
                </button>
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'cloud_monitor' && (
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <CloudMonitor />
          </div>
        )}

              </main>

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* Item Modal */}
      {showItemModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111b21] border border-slate-700 rounded-2xl p-6 text-slate-100">
            <h3 className="text-base font-bold mb-4">Tambah / Edit Paket Joko</h3>
            <form onSubmit={async e => {
              e.preventDefault();
              if (isItemLoading) return;
              setIsItemLoading(true);
              try {
                await saveItem(editingItem);
                setShowItemModal(false);
                alert('Item berhasil disimpan!');
              } catch (err) {
                 alert('Gagal menyimpan item.');
              } finally {
                setIsItemLoading(false);
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama Game</label>
                <input
                  type="text"
                  required
                  value={editingItem.game_name}
                  onChange={e => setEditingItem({ ...editingItem, game_name: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Nama Paket</label>
                <input
                  type="text"
                  required
                  value={editingItem.package_name}
                  onChange={e => setEditingItem({ ...editingItem, package_name: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  required
                  value={editingItem.price}
                  onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Estimasi Pengerjaan</label>
                <input
                  type="text"
                  required
                  value={editingItem.estimated_time}
                  onChange={e => setEditingItem({ ...editingItem, estimated_time: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Deskripsi Paket / Katalog</label>
                <textarea
                  value={editingItem.description || (editingItem as any).deskripsi || ''}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value, deskripsi: e.target.value } as any)}
                  rows={3}
                  placeholder="Masukkan deskripsi detail paket..."
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-[#00E676] resize-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Status Ketersediaan (Buka / Tutup Order)</label>
                <button
                  type="button"
                  onClick={() => setEditingItem({ ...editingItem, is_closed: !editingItem.is_closed })}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-between  ${!editingItem.is_closed ? 'bg-emerald-500/20 text-[#00E676] border-emerald-500/50' : 'bg-rose-500/20 text-rose-300 border-rose-500/50'}`}
                >
                  <span>{editingItem.is_closed ? '🔴 TUTUP (Produk tidak tersedia)' : '🟢 BUKA (Order tersedia)'}</span>
                  <span className="underline font-normal">Klik untuk Ubah</span>
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="item_is_closed"
                  checked={!!editingItem.is_closed}
                  onChange={e => setEditingItem({ ...editingItem, is_closed: e.target.checked })}
                  className="w-4 h-4 accent-[#00E676] rounded"
                />
                <label htmlFor="item_is_closed" className="text-slate-300 font-bold cursor-pointer">
                  Tutup Order (Produk Tidak Tersedia / Tulis: Produk tidak tersedia, tunggu admin open order lagi)
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowItemModal(false)} className="flex-1 py-2 bg-[#202c33] text-slate-300 rounded-xl">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-[#00E676] text-[#111b21] font-bold rounded-xl">Simpan Paket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Reply Modal */}
      {showQrModal && editingQr && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111b21] border border-slate-700 rounded-2xl p-6 text-slate-100">
            <h3 className="text-base font-bold mb-4">Tambah / Edit Quick Reply</h3>
            <form onSubmit={e => {
              e.preventDefault();
              saveQuickReply(editingQr);
              setShowQrModal(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Shortcut (misal: /salam)</label>
                <input
                  type="text"
                  required
                  value={editingQr.shortcut}
                  onChange={e => setEditingQr({ ...editingQr, shortcut: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Judul / Kategori</label>
                <input
                  type="text"
                  required
                  value={editingQr.title}
                  onChange={e => setEditingQr({ ...editingQr, title: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Pesan Balasan</label>
                <textarea
                  required
                  value={editingQr.message}
                  onChange={e => setEditingQr({ ...editingQr, message: e.target.value })}
                  rows={3}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowQrModal(false)} className="flex-1 py-2 bg-[#202c33] text-slate-300 rounded-xl">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-[#00E676] text-[#111b21] font-bold rounded-xl">Simpan Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustModal && editingCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111b21] border border-slate-700 rounded-2xl p-6 text-slate-100">
            <h3 className="text-base font-bold mb-4">Tambah / Edit Data Customer</h3>
            <form onSubmit={e => {
              e.preventDefault();
              saveUser(editingCust);
              setShowCustModal(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editingCust.name}
                  onChange={e => setEditingCust({ ...editingCust, name: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editingCust.username}
                  onChange={e => setEditingCust({ ...editingCust, username: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Password Baru (Opsional)</label>
                <input
                  type="text"
                  placeholder="Kosongkan jika tidak diubah"
                  value={editingCust.password || ''}
                  onChange={e => setEditingCust({ ...editingCust, password: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">No WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={editingCust.phone}
                  onChange={e => setEditingCust({ ...editingCust, phone: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editingCust.email}
                  onChange={e => setEditingCust({ ...editingCust, email: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Foto Profil / Avatar Customer</label>
                <div className="flex items-center gap-3">
                  {editingCust.avatar ? (
                    <img src={editingCust.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-[#00E676]/40 shadow shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#202c33] border border-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                      {getSafeInitial(editingCust.name, 'C')}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="https://... atau upload file"
                    value={editingCust.avatar || ''}
                    onChange={e => setEditingCust({ ...editingCust, avatar: e.target.value })}
                    className="flex-1 p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 text-xs"
                  />
                  <label className="px-3 py-2 bg-[#202c33] hover:bg-slate-700 text-[#00E676] font-bold rounded-xl text-xs cursor-pointer border border-slate-600 shrink-0">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file, 300, 0.8);
                            setEditingCust({ ...editingCust, avatar: compressed });
                          } catch (err) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setEditingCust({ ...editingCust, avatar: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCustModal(false)} className="flex-1 py-2 bg-[#202c33] text-slate-300 rounded-xl">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-[#00E676] text-[#111b21] font-bold rounded-xl">Simpan Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Paket Joki Modal (Kelola Customer) */}
      {showEditJokoModal && editingJokoOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#111b21] border border-[#00E676]/30 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-4 my-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-[#00E676]" /> Edit Paket Joko Customer
                </h3>
                <p className="text-xs text-slate-400">Customer: <span className="text-[#00E676] font-bold">{editingJokoOrder.customer_name}</span></p>
              </div>
              <button type="button" onClick={() => setShowEditJokoModal(false)} className="text-slate-400 hover:text-slate-100 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={async e => {
              e.preventDefault();
              if (isJokoLoading) return;
              setIsJokoLoading(true);
              try {
                const summary = calcCartSummaryHelper(jokoModalCart, editingJokoOrder.game_name, editingJokoOrder.package_name, editingJokoOrder.price);
                const updatedObj = {
                  ...editingJokoOrder,
                  game_name: summary.game_name,
                  package_name: summary.package_name,
                  price: summary.price
                };

                const exists = orders.some(o => o.id === updatedObj.id);
                if (exists) {
                  await updateOrder(updatedObj);
                } else {
                  await createOrder(updatedObj);
                }
                setShowEditJokoModal(false);
                alert(`✓ Paket joko untuk ${updatedObj.customer_name} (${summary.totalQty} item katalog) berhasil disimpan!`);
              } catch (err) {
                 alert('Gagal menyimpan pesanan.');
              } finally {
                setIsJokoLoading(false);
              }
            }} className="space-y-3.5 text-xs">
              
              {/* Multi-Catalog Cart Selector in Kelola Customer */}
              <div className="p-3 bg-[#202c33]/90 border border-[#00E676]/40 rounded-xl space-y-2">
                <div className="flex justify-between items-center font-extrabold text-[#00E676]">
                  <span className="flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Daftar Katalog Customer ({jokoModalCart.length} Item)
                  </span>
                  <span className="text-emerald-400 font-mono">
                    Total: Rp {jokoModalCart.reduce((s, c) => s + (c.price * c.qty), 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {jokoModalCart.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {jokoModalCart.map((item: any, idx: number) => (
                      <div key={item.id ? `${item.id}-${idx}` : `joko-cart-${idx}`} className="flex justify-between items-center bg-[#111b21] p-2 rounded-lg border border-slate-700 text-xs">
                        <div className="truncate pr-2">
                          <div className="font-bold text-slate-100">{item.game_name} - {item.package_name}</div>
                          <div className="text-[11px] text-[#00E676]">
                            Rp {item.price.toLocaleString('id-ID')} x {item.qty} = Rp {(item.price * item.qty).toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setJokoModalCart(prev => updateCartQtyHelper(prev, item.id, -1))}
                            className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-extrabold px-1 text-slate-100">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => setJokoModalCart(prev => updateCartQtyHelper(prev, item.id, 1))}
                            className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setJokoModalCart(prev => removeCartItemHelper(prev, item.id))}
                            className="w-5 h-5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded font-bold flex items-center justify-center ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#111b21] rounded-lg border border-dashed border-slate-700 text-center text-slate-400">
                    Belum ada katalog. Pilih katalog di bawah lalu klik <span className="text-[#00E676] font-bold">+ Tambah Katalog</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={selectedJokoCatalogId}
                    onChange={e => setSelectedJokoCatalogId(e.target.value)}
                    className="flex-1 p-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-100 font-semibold"
                  >
                    <option value="">-- Pilih Katalog Toko --</option>
                    {items.map((i, idx) => (
                      <option key={i.id ? `joko-opt-${i.id}-${idx}` : `joko-opt-${idx}`} value={i.id}>
                        {i.game_name} - {i.package_name} (Rp {i.price.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const selected = items.find(i => i.id === selectedJokoCatalogId) || items[0];
                      if (selected) {
                        setJokoModalCart(prev => addCatalogToCartHelper(prev, selected));
                        setSelectedJokoCatalogId('');
                      }
                    }}
                    className="px-3 py-2 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-bold rounded-lg flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Tambah Katalog
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nama Game (Gabungan)</label>
                  <input
                    type="text"
                    required
                    value={editingJokoOrder.game_name}
                    onChange={e => setEditingJokoOrder({ ...editingJokoOrder, game_name: e.target.value })}
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Status Pengerjaan</label>
                  <select
                    value={editingJokoOrder.status}
                    onChange={e => setEditingJokoOrder({ ...editingJokoOrder, status: e.target.value as OrderStatus })}
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-[#00E676] font-bold"
                  >
                    <option value="BOOKING">⏳ BOOKING</option>
                    <option value="ANTRIAN_LOGIN">🕒 ANTRIAN LOGIN</option>
                    <option value="PROSES_WORKER">⚡ PROSES WORKER</option>
                    <option value="BUTUH_LOGIN_ULANG">⚠️ BUTUH LOGIN ULANG</option>
                    <option value="SELESAI">✓ SELESAI</option>
                    <option value="BATAL">✕ BATAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Total Harga Paket (Rp)</label>
                <input
                  type="number"
                  required
                  value={editingJokoOrder.price}
                  onChange={e => setEditingJokoOrder({ ...editingJokoOrder, price: Number(e.target.value) })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-bold text-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Username / Email Akun Game</label>
                  <input
                    type="text"
                    value={editingJokoOrder.game_username || ''}
                    onChange={e => setEditingJokoOrder({ ...editingJokoOrder, game_username: e.target.value })}
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                    placeholder="Username game"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Password Akun Game</label>
                  <input
                    type="text"
                    value={editingJokoOrder.game_password || ''}
                    onChange={e => setEditingJokoOrder({ ...editingJokoOrder, game_password: e.target.value })}
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                    placeholder="Password game"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nomor Cloud Joko (Cloud #)</label>
                <input
                  type="text"
                  value={editingJokoOrder.cloud_number || ''}
                  onChange={e => setEditingJokoOrder({ ...editingJokoOrder, cloud_number: e.target.value })}
                  placeholder="Contoh: Cloud 01 / Cloud 05"
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Petugas / Worker Joko</label>
                <select
                  value={editingJokoOrder.worker_id || ''}
                  onChange={e => {
                    const w = users.find(usr => usr.id === e.target.value);
                    setEditingJokoOrder({
                      ...editingJokoOrder,
                      worker_id: e.target.value,
                      worker_name: w ? w.name : ''
                    });
                  }}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                >
                  <option value="">-- Belum Ditugaskan --</option>
                  {users.filter(u => u.role === 'WORKER' || u.role === 'ADMIN').map((w, idx) => (
                    <option key={w.id ? `${w.id}-${idx}` : `worker-${idx}`} value={w.id}>{w.name} ({w.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Catatan Pengerjaan Joko</label>
                <textarea
                  value={editingJokoOrder.note || ''}
                  onChange={e => setEditingJokoOrder({ ...editingJokoOrder, note: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  placeholder="Request hero, jam online, dll"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowEditJokoModal(false)} className="flex-1 py-2.5 bg-[#202c33] text-slate-300 rounded-xl font-bold">
                  Batal
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl shadow-lg">
                  Simpan Perubahan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {showStaffModal && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111b21] border border-slate-700 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-[#00E676]">
              <span>Manajemen Akun Staff & Admin Entong Store</span>
            </h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!editingStaff.name || !editingStaff.username) {
                alert("Mohon isi Nama dan Username staff!");
                return;
              }
              const cleanUsername = editingStaff.username.trim().toLowerCase();
              const staffUid = editingStaff.uid || editingStaff.id || `staff_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
              const staffPayload: UserProfile = {
                ...editingStaff,
                id: staffUid,
                uid: staffUid,
                name: editingStaff.name.trim(),
                username: cleanUsername,
                usernameLower: cleanUsername,
                email: editingStaff.email ? editingStaff.email.trim() : `${cleanUsername}@entong.store`,
                phone: editingStaff.phone ? editingStaff.phone.trim() : '-',
                role: (editingStaff.role || 'STAFF').toUpperCase() as any,
                isStaff: true,
                isBanned: false,
                created: editingStaff.created || new Date().toISOString()
              };
              await saveUser(staffPayload);
              alert(`✅ Akun Staff/Admin (${staffPayload.name}) berhasil ditambahkan/diperbarui di database!`);
              setShowStaffModal(false);
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Nama Staff / Admin</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Joko"
                  value={editingStaff.name}
                  onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-[#00E676]"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Username Login</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: budijoko"
                  value={editingStaff.username}
                  onChange={e => setEditingStaff({ ...editingStaff, username: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-[#00E676]"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Password (Opsional)</label>
                <input
                  type="text"
                  placeholder="Kosongkan jika tidak diubah"
                  value={editingStaff.password || ''}
                  onChange={e => setEditingStaff({ ...editingStaff, password: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-[#00E676]"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Role / Hak Akses</label>
                <select
                  value={editingStaff.role || 'STAFF'}
                  onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value as UserRole, isStaff: true })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-bold focus:outline-none focus:border-[#00E676]"
                >
                  <option value="STAFF">STAFF (Pengelola Toko Joko)</option>
                  <option value="WORKER">WORKER (Pekerja Joko)</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OWNER">OWNER</option>
                  <option value="OPERATOR">OPERATOR</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">No WhatsApp</label>
                <input
                  type="tel"
                  placeholder="0812xxxx"
                  value={editingStaff.phone || ''}
                  onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-[#00E676]"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Email (Opsional)</label>
                <input
                  type="email"
                  placeholder="staff@entong.store"
                  value={editingStaff.email || ''}
                  onChange={e => setEditingStaff({ ...editingStaff, email: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-[#00E676]"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setShowStaffModal(false)} className="flex-1 py-2.5 bg-[#202c33] text-slate-300 rounded-xl font-bold hover:bg-slate-700">
                  Batal
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-extrabold rounded-xl shadow-lg">
                  Simpan Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Modal (Edit) */}
      {showOrderModal && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#111b21] border border-slate-700 rounded-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#00E676]" /> Edit Data Orderan <span className="font-mono text-[#00E676]">#{editingOrder.id}</span>
              </h3>
              <button type="button" onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (editingOrder) {
                const summary = calcCartSummaryHelper(orderModalCart, editingOrder.game_name, editingOrder.package_name, editingOrder.price);
                const updatedObj = {
                  ...editingOrder,
                  game_name: summary.game_name,
                  package_name: summary.package_name,
                  price: summary.price
                };
                const exists = orders.some(o => o.id === updatedObj.id);
                if (exists) {
                  await updateOrder(updatedObj);
                } else {
                  await createOrder(updatedObj);
                }
                if (selectedOrderId) {
                  const isGift = (updatedObj as any).category === 'gift' || (updatedObj as any).service_type === 'gift' || (updatedObj.game_name || '').toLowerCase().includes('gift');
                  const isTopUpTc = (updatedObj as any).category === 'topup_tc' || (updatedObj as any).service_type === 'topup_tc' || (updatedObj.game_name || '').toLowerCase().includes('tongcoins') || (updatedObj.game_name || '').toLowerCase().includes('tc');

                  let headerText = '🛒 ORDER JOKO DICATAT DARI CHAT';
                  if (isTopUpTc) {
                    headerText = '🪙 TOP UP TONGCOINS DICATAT DARI CHAT';
                  } else if (isGift) {
                    headerText = '🎁 ORDER GIFT IN-GAME DICATAT DARI CHAT';
                  }

                  const robloxUserText = (updatedObj as any).roblox_username || (updatedObj as any).robloxUsername || (updatedObj as any).robloxUser || (updatedObj as any).username || '';
                  const robloxDisplay = robloxUserText ? `\nRoblox Username: @${robloxUserText.replace(/^@/, '')}` : '';

                  const notifyMsg = `${headerText}\n\nID Order: #${updatedObj.id}\nCustomer: ${updatedObj.customer_name}${robloxDisplay}\nGame: ${updatedObj.game_name} (${updatedObj.package_name})\nHarga Total: Rp ${(updatedObj.price || 0).toLocaleString('id-ID')}\nStatus: [ ${updatedObj.status || 'BOOKING'} ]\n\nOrderan telah tersinkronisasi otomatis ke Database Toko & Panel Kelola Customer.`;
                  sendMessage(selectedOrderId, notifyMsg, undefined, undefined, true);
                }
                setShowOrderModal(false);
              }
            }} className="space-y-3.5 text-xs">

              {/* Multi-Catalog Cart Selector */}
              <div className="p-3 bg-[#202c33]/90 border border-[#00E676]/40 rounded-xl space-y-2">
                <div className="flex justify-between items-center font-extrabold text-[#00E676]">
                  <span className="flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" /> Daftar Katalog Order ({orderModalCart.length} Item)
                  </span>
                  <span className="text-emerald-400 font-mono">
                    Total: Rp {orderModalCart.reduce((s, c) => s + (c.price * c.qty), 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {orderModalCart.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {orderModalCart.map((item: any, idx: number) => (
                      <div key={item.id ? `${item.id}-${idx}` : `order-cart-${idx}`} className="flex justify-between items-center bg-[#111b21] p-2 rounded-lg border border-slate-700 text-xs">
                        <div className="truncate pr-2">
                          <div className="font-bold text-slate-100">{item.game_name} - {item.package_name}</div>
                          <div className="text-[11px] text-[#00E676]">
                            Rp {item.price.toLocaleString('id-ID')} x {item.qty} = Rp {(item.price * item.qty).toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setOrderModalCart(prev => updateCartQtyHelper(prev, item.id, -1))}
                            className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-extrabold px-1 text-slate-100">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => setOrderModalCart(prev => updateCartQtyHelper(prev, item.id, 1))}
                            className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold flex items-center justify-center"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderModalCart(prev => removeCartItemHelper(prev, item.id))}
                            className="w-5 h-5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded font-bold flex items-center justify-center ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#111b21] rounded-lg border border-dashed border-slate-700 text-center text-slate-400">
                    Belum ada katalog. Pilih katalog di bawah lalu klik <span className="text-[#00E676] font-bold">+ Tambah Katalog</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={selectedModalCatalogId}
                    onChange={e => setSelectedModalCatalogId(e.target.value)}
                    className="flex-1 p-2 bg-[#111b21] border border-slate-700 rounded-lg text-slate-100 font-semibold"
                  >
                    <option value="">-- Tambah Katalog ke Order ini --</option>
                    {items.map((i, idx) => (
                      <option key={i.id ? `modal-opt-${i.id}-${idx}` : `modal-opt-${idx}`} value={i.id}>
                        {i.game_name} - {i.package_name} (Rp {i.price.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const selected = items.find(i => i.id === selectedModalCatalogId) || items[0];
                      if (selected) {
                        setOrderModalCart(prev => addCatalogToCartHelper(prev, selected));
                        setSelectedModalCatalogId('');
                      }
                    }}
                    className="px-3 py-2 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-bold rounded-lg flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Tambah Katalog
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Customer</label>
                <input
                  type="text"
                  required
                  value={editingOrder.customer_name}
                  onChange={e => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">No WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={editingOrder.customer_phone}
                  onChange={e => setEditingOrder({ ...editingOrder, customer_phone: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Nama Game (Gabungan)</label>
                  <input
                    type="text"
                    required
                    value={editingOrder.game_name || ''}
                    onChange={e => setEditingOrder({ ...editingOrder, game_name: e.target.value })}
                    placeholder="Mobile Legends"
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Status Order</label>
                  <select
                    value={editingOrder.status}
                    onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value as OrderStatus })}
                    className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-[#00E676] font-bold"
                  >
                    <option value="BOOKING">⏳ BOOKING</option>
                    <option value="ANTRIAN_LOGIN">🕒 ANTRIAN LOGIN</option>
                    <option value="PROSES_WORKER">⚡ PROSES WORKER</option>
                    <option value="BUTUH_LOGIN_ULANG">⚠️ BUTUH LOGIN ULANG</option>
                    <option value="SELESAI">✓ SELESAI</option>
                    <option value="BATAL">✕ BATAL</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Total Harga Order (Rp)</label>
                <input
                  type="number"
                  required
                  value={editingOrder.price}
                  onChange={e => setEditingOrder({ ...editingOrder, price: Number(e.target.value) })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-bold text-[#00E676]"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Username Game</label>
                <input
                  type="text"
                  required
                  value={editingOrder.game_username}
                  onChange={e => setEditingOrder({ ...editingOrder, game_username: e.target.value })}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nomor Cloud Joko (Cloud #)</label>
                <input
                  type="text"
                  value={editingOrder.cloud_number || ''}
                  onChange={e => setEditingOrder({ ...editingOrder, cloud_number: e.target.value })}
                  placeholder="Contoh: Cloud 01 / Cloud 05"
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-mono"
                />
              </div>

              {editingOrder.payment_proof && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-slate-400 mb-1">Foto Bukti Transfer Customer:</label>
                  <SafeImage src={editingOrder.payment_proof} alt="Bukti Transfer" className="h-28 max-w-xs mx-auto rounded-lg border border-slate-700 shadow" />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 py-2 bg-[#202c33] text-slate-300 rounded-xl">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-[#00E676] text-[#111b21] font-bold rounded-xl">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup Detail Akun Target Roblox */}
      {selectedOrderForAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-">
          <div className="relative bg-[#111b21] p-6 rounded-3xl border border-amber-500/40 max-w-md w-full shadow-2xl text-slate-100 flex flex-col gap-4">
            <button 
              onClick={() => setSelectedOrderForAccount(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-slate-100 uppercase tracking-wide">
                🔑 Data Akun Target
              </h3>
            </div>

            {/* Profile Details (Clean & Text-Only) */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
              <div className="min-w-0 flex-1 text-left">
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
                  🟢 Roblox Profile Verified
                </span>
                <h4 className="text-base font-black text-white truncate mt-2.5">
                  {selectedOrderForAccount.robloxDisplayName || 'User Roblox'}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">
                  @{selectedOrderForAccount.robloxUsername || selectedOrderForAccount.game_username || 'Tidak ada'}
                </p>
              </div>
            </div>

            {/* Credentials Info */}
            <div className="space-y-3.5">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Username / ID Target</span>
                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="font-mono text-xs text-white">
                    {selectedOrderForAccount.robloxUsername || selectedOrderForAccount.game_username || 'Tidak ada'}
                  </span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(selectedOrderForAccount.robloxUsername || selectedOrderForAccount.game_username || '');
                      alert('Username disalin ke clipboard!');
                    }}
                    className="p-1 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded"
                    title="Salin Username"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Password / Kode Backup</span>
                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <span className="font-mono text-xs text-white">
                    {showPasswordMap[selectedOrderForAccount.id] 
                      ? (selectedOrderForAccount.jokoPassword || selectedOrderForAccount.game_password || 'Tidak ada')
                      : '••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setShowPasswordMap(prev => ({ ...prev, [selectedOrderForAccount.id]: !prev[selectedOrderForAccount.id] }))}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                      title="Lihat / Sembunyikan Password"
                    >
                      {showPasswordMap[selectedOrderForAccount.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedOrderForAccount.jokoPassword || selectedOrderForAccount.game_password || '');
                        alert('Password disalin ke clipboard!');
                      }}
                      className="p-1 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded"
                      title="Salin Password"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Uang Game Sebelum Joko (Awal)</span>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-amber-400 font-mono font-bold">
                  {selectedOrderForAccount.initialGameMoney || (selectedOrderForAccount as any).initial_money || 'Tidak diisi / 0'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Catatan Worker / Note</span>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
                  {selectedOrderForAccount.workerNote || selectedOrderForAccount.note || 'Tidak ada catatan tambahan.'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rincian Paket</span>
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-xs text-slate-300">
                  <span className="font-extrabold text-[#00E676] block mb-0.5">{selectedOrderForAccount.game_name}</span>
                  <span className="text-slate-200">{selectedOrderForAccount.package_name}</span>
                </div>
              </div>
            </div>

            {/* Footer button */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setSelectedOrderForAccount(null)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-[#111b21] font-black rounded-xl text-xs shadow-md"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lightbox Bukti Pembayaran untuk Admin */}
      {viewingProofOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative bg-[#111b21] p-5 md:p-6 rounded-2xl border border-slate-700 max-w-md w-full max-h-[95vh] overflow-y-auto my-auto shadow-2xl text-slate-100 flex flex-col">
            <button 
              onClick={() => { setViewingProofOrder(null); setIsImageZoomed(false); }}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-[#00E676]" />
              <h3 className="text-base font-bold text-slate-100">Verifikasi Bukti Pembayaran</h3>
            </div>
            
            <div className="bg-[#202c33] p-3.5 rounded-xl border border-slate-700 text-xs space-y-2 mb-4">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">ID Order:</span> 
                <span className="font-mono text-[#00E676] font-bold">#{((viewingProofOrder as any).orderId || viewingProofOrder?.id || '')}</span>
              </div>
              
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Customer:</span> 
                <span className="font-extrabold text-white">{(viewingProofOrder as any).customerName || viewingProofOrder.customer_name || 'Customer'}</span>
              </div>

              {/* BARIS BARU 1: NOMOR WHATSAPP WITH COPY & DIRECT WA BUTTON */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Nomor WhatsApp:</span>
                <WhatsAppCopyBadge phone={(viewingProofOrder as any).whatsapp || viewingProofOrder.customer_phone || (viewingProofOrder as any).phone || ''} />
              </div>

              {/* BARIS BARU 2: USERNAME ROBLOX WITH COPY */}
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Username Roblox:</span>
                <RobloxUsernameBadge username={(viewingProofOrder as any).robloxUsername || (viewingProofOrder as any).targetUsername || viewingProofOrder.game_username || ''} />
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Game & Paket:</span> 
                <span className="text-slate-200">{viewingProofOrder?.game_name || ''} - {(viewingProofOrder as any).packageName || viewingProofOrder?.package_name || ''}</span>
              </div>
              
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Nominal:</span> 
                <span className="text-emerald-400 font-extrabold">Rp {(((viewingProofOrder as any).totalPrice || viewingProofOrder?.price) ?? 0)?.toLocaleString?.('id-ID')}</span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Metode:</span> 
                <span className="uppercase font-semibold text-slate-200">{(viewingProofOrder as any).paymentMethod || viewingProofOrder.payment_method || 'QRIS'}</span>
              </div>
            </div>

            {/* CONTAINER BUKTI TRANSFER YANG DIPERBAIKI */}
            {(() => {
              const paymentProofUrl = (viewingProofOrder as any)?.proofOfPayment || viewingProofOrder?.payment_proof || '';
              return (
                <div className="mt-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 mb-4">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <i className="fa-solid fa-receipt text-emerald-400"></i> Bukti Pembayaran
                    </span>
                    {paymentProofUrl && (
                      <a
                        href={paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square"></i> Buka Gambar Asli
                      </a>
                    )}
                  </div>

                  {paymentProofUrl ? (
                    <div 
                      onClick={() => setIsImageZoomed(true)} 
                      className="relative group cursor-zoom-in overflow-hidden rounded-xl bg-black flex items-center justify-center border border-slate-800 hover:border-emerald-500/50 min-h-[200px]"
                    >
                      <img
                        src={paymentProofUrl}
                        alt="Bukti Transfer"
                        className="w-full max-h-[420px] object-contain rounded-xl group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.classList.add('p-8');
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'text-center text-slate-400 space-y-2';
                          errorDiv.innerHTML = `
                            <i class="fa-solid fa-image-slash text-4xl text-slate-600 mb-2 block"></i>
                            <p class="font-bold text-sm">Gambar Gagal Dimuat</p>
                            <p class="text-xs">Link bukti transfer rusak atau kedaluwarsa.</p>
                          `;
                          e.currentTarget.parentElement?.appendChild(errorDiv);
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white font-bold text-xs backdrop-blur-[2px]">
                        <i className="fa-solid fa-magnifying-glass-plus text-lg"></i>
                        <span>Klik untuk Memperbesar</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 p-8 bg-slate-900/50 rounded-xl border border-slate-800/80">
                      <i className="fa-solid fa-file-invoice-dollar text-4xl mb-3 block opacity-50"></i>
                      <p className="font-bold text-sm">Belum Ada Bukti Pembayaran</p>
                      <p className="text-xs mt-1">Customer belum mengunggah struk transfer.</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Quick Approval Actions */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400">Ubah Status Pengerjaan Order:</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  onClick={async () => {
                    if (viewingProofOrder) {
                      const targetOrderId = viewingProofOrder.id || (viewingProofOrder as any).orderId || '';
                      await handleVerifyPayment(targetOrderId, viewingProofOrder);
                      setViewingProofOrder(null);
                      setIsImageZoomed(false);
                    }
                  }}
                  className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow"
                >
                  ✓ Terima & Proses
                </button>
                <button
                  onClick={async () => {
                    if (viewingProofOrder) {
                      const targetOrderId = viewingProofOrder.id || (viewingProofOrder as any).orderId || '';
                      await handleStatusChange(targetOrderId, 'SELESAI');
                      const targetRoom = viewingProofOrder?.customer_id ? (viewingProofOrder.customer_id.startsWith('guest_') || viewingProofOrder.customer_id.startsWith('room_') ? viewingProofOrder.customer_id : `room_${viewingProofOrder.customer_id}`) : (viewingProofOrder?.id?.startsWith('room_') ? viewingProofOrder.id : `room_${viewingProofOrder?.id}`);
                      sendMessage(
                        targetRoom.startsWith('room_') ? targetRoom : `room_${targetRoom}`,
                        `🎉 Orderan #${(viewingProofOrder?.id || '')} (${(viewingProofOrder?.game_name || '')} - ${(viewingProofOrder?.package_name || '')}) telah SELESAI dikerjakan!\n\nTerima kasih telah order di Entong Store!`
                      );
                      setViewingProofOrder(null);
                      setIsImageZoomed(false);
                    }
                  }}
                  className="py-2 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-bold rounded-xl shadow"
                >
                  ★ Selesai
                </button>
                <button
                  onClick={() => {
                    const orderId = viewingProofOrder?.id || (viewingProofOrder as any)?.orderId || '';
                    rejectPaymentVerification(orderId, 'Bukti tidak valid / mutasi belum masuk', viewingProofOrder);
                    setViewingProofOrder(null);
                    setIsImageZoomed(false);
                  }}
                  className="py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-bold rounded-xl border border-rose-800"
                >
                  ✕ Tolak / Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX / FULLSCREEN ZOOM BUKTI PEMBAYARAN */}
      {isImageZoomed && viewingProofOrder && ((viewingProofOrder as any)?.proofOfPayment || viewingProofOrder?.payment_proof) && (
        <div 
          className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-"
          onClick={() => setIsImageZoomed(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setIsImageZoomed(false)}
              className="absolute -top-12 right-0 text-white bg-slate-800/80 hover:bg-slate-700 w-10 h-10 rounded-full flex items-center justify-center border border-slate-700"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
            <SafeImage
              src={(viewingProofOrder as any)?.proofOfPayment || viewingProofOrder?.payment_proof}
              alt="Bukti Transfer Full"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-800"
            />
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL CHAT MEDIA (FOTO/VIDEO) */}
      {expandedMediaUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setExpandedMediaUrl(null)}>
          <div className="relative max-w-2xl w-full text-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setExpandedMediaUrl(null)}
              className="absolute -top-10 right-0 text-slate-300 hover:text-white p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <SafeImage 
              src={expandedMediaUrl} 
              alt="Preview Gambar Chat" 
              className="w-full max-h-[85vh] object-contain rounded-2xl border border-slate-700 shadow-2xl mx-auto" 
            />
          </div>
        </div>
      )}

      {/* MODAL INPUT ORDER WA */}
      <ManualWAOrderModal
        isOpen={isManualWAOrderModalOpen}
        onClose={() => setIsManualWAOrderModalOpen(false)}
        catalogs={items}
      />

      {/* MODAL PENGATURAN JAM OPERASIONAL TOKO TERPUSAT (WIB) */}
      <StoreScheduleSettingModal
        isOpen={isStoreScheduleModalOpen}
        onClose={() => setIsStoreScheduleModalOpen(false)}
      />

    </div>
  );
};
