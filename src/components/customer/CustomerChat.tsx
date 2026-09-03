import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, formatChatTime } from '../../context/AppContext';
import { ChatMessage, UserRole } from '../../types';
import { SafeImage } from '../common/SafeImage';
import { ChatMessageRenderer } from '../common/ChatMessageRenderer';
import { 
  MessageSquare, User, ShoppingBag, Send, Paperclip, 
  RefreshCw, AlertCircle, Clock, Image, Video, X, Star,
  ChevronRight, Gamepad2, Check, Home, Maximize2, Minimize2,
  Loader2, CheckCircle2
} from 'lucide-react';
import { compressImage, compressVideo } from '../../lib/mediaUtils';
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, serverTimestamp, collectionGroup } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { normalizePhone } from '../../utils/phoneUtils';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, signInWithPopup, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getDeviceHwid, formatTimerHHMMSS } from '../../utils/deviceFingerprint';
import { safeGetJSON } from '../../utils/safeStorage';
import { ShieldCheck, Eye, EyeOff, Lock, Phone, AlertTriangle, Zap } from 'lucide-react';
import { checkStoreOperatingStatus } from '../../utils/storeHours';
import { JokiCredentialFormMessage } from '../chat/JokiCredentialFormMessage';
import TwoFactorActionBubble from '../chat/TwoFactorActionBubble';
import { InteractiveBotBubble } from '../chat/InteractiveBotBubble';
import BotWelcomeOptions from '../chat/BotWelcomeOptions';
import AuthModal from '../auth/AuthModal';
import { StoreOperationalBanner } from '../banner/StoreOperationalBanner';
import { detectInteractiveType, ensureInitialWelcomeGreeting } from '../../services/botChatService';
import { fetchRobloxProfile, RobloxProfile } from '../../lib/roblox';
import GuestChatForm from '../chat/GuestChatForm';

export { checkStoreOperatingStatus };

interface CustomerChatProps {
  activeTab?: 'home' | 'profile' | 'settings' | 'chat' | 'catalog' | 'tracking' | 'testimoni' | 'leaderboard' | 'tongcoins';
  setActiveTab?: (tab: 'home' | 'profile' | 'settings' | 'chat' | 'catalog' | 'tracking' | 'testimoni' | 'leaderboard' | 'tongcoins') => void;
  cartTotalItems?: number;
  isFloating?: boolean;
  onClose?: () => void;
  prefilledMessage?: string;
  targetOrderId?: string;
  activeOrder?: any;
}

const renderMessageText = (text: string) => {
  if (!text) return null;

  // 1. Detect Roblox Private Server links or Roblox links
  const robloxLinkRegex = /https?:\/\/(www\.)?roblox\.com\/[^\s]+/gi;
  const links = text.match(robloxLinkRegex);

  // Helper to parse bold formatting: *text* or **text**
  const formatBold = (txt: string): React.ReactNode[] => {
    const parts = txt.split(/(\*\*|\*)/g);
    let isBold = false;
    let currentMarker = '';

    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '**' || part === '*') {
        if (isBold && part === currentMarker) {
          isBold = false;
          currentMarker = '';
        } else if (!isBold) {
          isBold = true;
          currentMarker = part;
        }
      } else {
        if (isBold) {
          nodes.push(<strong key={i} className="font-extrabold text-white">{part}</strong>);
        } else {
          // Standard URL rendering fallback for other links
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urlTokens = part.split(urlRegex);
          urlTokens.forEach((tok, sIdx) => {
            if (tok.match(urlRegex)) {
              nodes.push(
                <a
                  key={`url-${i}-${sIdx}`}
                  href={tok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300 break-all font-medium inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {tok}
                </a>
              );
            } else {
              nodes.push(tok);
            }
          });
        }
      }
    }
    return nodes;
  };

  // Strip Roblox links from the text so we can display them as a card
  let textWithoutRobloxLinks = text;
  if (links && links.length > 0) {
    links.forEach(link => {
      textWithoutRobloxLinks = textWithoutRobloxLinks.replace(link, '');
    });
  }

  return (
    <div className="space-y-1.5 text-left">
      {textWithoutRobloxLinks.trim() && (
        <div className="whitespace-pre-wrap break-words leading-relaxed space-y-1 font-sans text-xs md:text-sm">
          {textWithoutRobloxLinks.split('\n').map((line, idx) => (
            <div key={idx} className="min-h-[1.2em]">
              {line.trim() ? formatBold(line) : '\u00A0'}
            </div>
          ))}
        </div>
      )}
      
      {links && links.map((link, idx) => {
        return (
          <a
            key={idx}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block mt-2 p-3 bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/30 rounded-xl transition-all shadow-md group active:scale-[0.98] text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 shrink-0">
                <Gamepad2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-white flex items-center gap-1">
                  <span>Roblox Private Server</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                </h4>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{link}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </a>
        );
      })}
    </div>
  );
};

const ReviewPromptCard = ({ currentUser, roomId }: { currentUser: any; roomId?: string }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWidget, setShowWidget] = useState(true);
  const [showThankYouModal, setShowThankYouModal] = useState(false);

  const activeCustomerId = currentUser ? currentUser.id : 'anonymous';
  const activeCustomerName = currentUser ? (currentUser.name || currentUser.username || currentUser.email || 'Customer') : 'Customer';

  const maskCustomerName = (name: string): string => {
    if (!name || name.trim() === '') return 'Anonim';
    const clean = name.trim();
    if (clean.length <= 2) return `${clean.charAt(0)}***`;
    const first = clean.charAt(0);
    const last = clean.charAt(clean.length - 1);
    const middle = '*'.repeat(Math.min(clean.length - 2, 3));
    return `${first}${middle}${last}`;
  };

  const handleSubmit = async () => {
    if (!comment.trim()) {
      alert('Mohon isi ulasan Anda.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { db } = await import('../../lib/firebase');
      
      const maskedNameStr = maskCustomerName(activeCustomerName);
      const displayNameToUse = isAnonymous ? maskedNameStr : activeCustomerName;

      await addDoc(collection(db, 'reviews'), {
        customerName: displayNameToUse,
        userName: displayNameToUse,
        realName: activeCustomerName,
        userId: activeCustomerId,
        isAnonymous: isAnonymous,
        maskedName: maskedNameStr,
        rating,
        comment: comment.trim(),
        gameName: 'Layanan Joko / Gamepass',
        gameTitle: 'Layanan Joko / Gamepass',
        productName: 'Layanan Joko / Gamepass',
        createdAt: serverTimestamp(),
        isApproved: true
      });

      // Update order and chat docs in Firestore instantly
      if (roomId) {
        try {
          const cleanId = roomId.replace(/^room_/, '');
          await updateDoc(doc(db, 'chats', roomId), { hasReviewed: true, reviewedAt: serverTimestamp() }).catch(() => {});
          await updateDoc(doc(db, 'orders', cleanId), { hasReviewed: true, reviewedAt: serverTimestamp() }).catch(() => {});
        } catch (e) {
          console.error("Error updating review flag:", e);
        }
      }

      // Hide widget immediately and show thank you modal
      setShowWidget(false);
      setShowThankYouModal(true);
    } catch (err: any) {
      alert('Gagal mengirim ulasan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showWidget && !showThankYouModal) {
    return null;
  }

  return (
    <>
      {showWidget && (
        <div className="flex justify-center my-3 px-2 w-full">
          <div className="bg-[#111b21] border border-amber-500/30 rounded-xl p-4 w-full max-w-sm shadow-lg text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <h4 className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-400" /> 
              Tinggalkan Ulasan
              <Star className="w-3.5 h-3.5 fill-amber-400" />
            </h4>
            <p className="text-slate-300 text-[11px] mb-3">Bagaimana pengalaman Anda dengan pelayanan kami?</p>
            
            <div className="flex justify-center gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star className={`w-6 h-6 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-slate-600'}`} />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tulis ulasan Anda di sini..."
              className="w-full bg-[#0b141a] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none min-h-[60px] mb-2"
            />

            {/* TOGGLE SENSOR USERNAME CHECKBOX */}
            <label className="flex items-center justify-center gap-2 cursor-pointer my-2.5 text-xs text-slate-300 select-none bg-[#0b141a]/60 p-2 rounded-lg border border-slate-800 hover:border-amber-500/30 transition-all">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0b141a] border-slate-700 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
              />
              <span className="text-[11px]">
                Sensor Username Saya (Tampilkan sebagai <strong className="text-amber-400">{maskCustomerName(activeCustomerName)}</strong> / Anonim)
              </span>
            </label>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-[#111b21] font-black rounded-lg text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isSubmitting ? 'Mengirim...' : 'Kirim Ulasan'}
            </button>
          </div>
        </div>
      )}

      {/* POPUP MODAL TERIMA KASIH */}
      {showThankYouModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-amber-500/40 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full pointer-events-none" />
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-amber-400 font-extrabold text-sm uppercase tracking-wide mb-2">
              TERIMA KASIH ATAS ULASAN ANDA!
            </h3>
            <p className="text-slate-300 text-xs mb-5 leading-relaxed">
              Ulasan Anda telah berhasil terkirim dan sangat berharga bagi peningkatan kualitas pelayanan <strong>Entong Store</strong>.
            </p>
            <button
              onClick={() => setShowThankYouModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Tutup</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const CustomerChat: React.FC<CustomerChatProps> = ({ 
  activeTab, 
  setActiveTab, 
  cartTotalItems,
  isFloating,
  onClose,
  prefilledMessage,
  targetOrderId,
  activeOrder
}) => {
  const { 
    currentUser, sendMessage, markChatAsRead,
    isUserMuted, getMuteRemainingSeconds, muteUser,
    adminStatus, storeAvatarUrl, storeClosedNoticeText, isStoreClosed,
    orders
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const hasEverLoadedMessagesRef = useRef<boolean>(false);
  const hasTriedFallbackRef = useRef<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [msgInput, setMsgInput] = useState(prefilledMessage || '');
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [expandedMediaUrl, setExpandedMediaUrl] = useState<string | null>(null);
  const [announcementText, setAnnouncementText] = useState<string>('');
  const [incomingToastMsg, setIncomingToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const isInitialSnapshotRef = useRef<boolean>(true);
  const chatMountTimeRef = useRef<number>(Date.now());
  const lastSoundPlayedAtRef = useRef<number>(0);

  // 📝 Auto-fill & auto-focus prefilled message
  useEffect(() => {
    if (prefilledMessage) {
      setMsgInput(prefilledMessage);
      if (chatInputRef.current) {
        chatInputRef.current.value = prefilledMessage;
      }
      const timer = setTimeout(() => {
        if (chatInputRef.current) {
          chatInputRef.current.focus();
          const len = chatInputRef.current.value.length;
          chatInputRef.current.setSelectionRange(len, len);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [prefilledMessage]);

  // Soft sound alert with debounce and document.hidden check
  const playSoftNotificationSound = () => {
    // Only play audio if user is NOT actively looking at the chat (background / minimized)
    if (!document.hidden) return;

    const now = Date.now();
    if (now - lastSoundPlayedAtRef.current < 3500) {
      // Cooldown active to prevent audio spam / overlap
      return;
    }
    lastSoundPlayedAtRef.current = now;

    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.25; // Gentle volume
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const [storeOperatingStatus, setStoreOperatingStatus] = useState(() => checkStoreOperatingStatus());

  // Interval Pengecekan Otomatis Setiap 1 Menit untuk Jam Operasional (11.00 - 23.00 WIB)
  useEffect(() => {
    setStoreOperatingStatus(checkStoreOperatingStatus());
    const interval = setInterval(() => {
      setStoreOperatingStatus(checkStoreOperatingStatus());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // --- Auth Modal States ---
  const { captchaQuestion, refreshCaptcha, setCurrentUser } = useApp();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterTab, setIsRegisterTab] = useState(false);
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaInput, setCaptchaInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [remainingCooldownSeconds, setRemainingCooldownSeconds] = useState(0);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  const [profilePendingCount, setProfilePendingCount] = useState<number>(0);

  // Guest Chat States
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestData, setGuestData] = useState<any>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('entong_guest_last_activity') || '0', 10);
    return saved > 0 ? saved : Date.now();
  });
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Auto-reset guest session setelah 30 menit tidak ada aktivitas
  useEffect(() => {
    if (!isGuestMode || !guestData) return;

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 menit dalam milidetik

    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTime;

      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        // Reset guest session
        console.log('Guest session expired due to inactivity. Resetting...');

        // Hapus chat lama dari database
        if (activeRoomId) {
          const messagesRef = collection(db, 'chats', activeRoomId, 'messages');
          getDocs(messagesRef).then(snapshot => {
            snapshot.forEach(docSnap => {
              deleteDoc(doc(db, 'chats', activeRoomId, 'messages', docSnap.id)).catch(() => {});
            });
          }).catch(() => {});

          // Hapus room document
          deleteDoc(doc(db, 'chats', activeRoomId)).catch(() => {});
        }

        // Clear local storage
        localStorage.removeItem('entong_guest_data');
        localStorage.removeItem('entong_guest_room_id');
        localStorage.removeItem('entong_guest_last_activity');

        // Reset state
        setGuestData(null);
        setIsGuestMode(false);
        setActiveRoomId(null);
        setMessages([]);
      }
    };

    // Cek segera saat guest mode aktif, lalu tiap 1 menit
    checkInactivity();
    const interval = setInterval(checkInactivity, 60000);

    return () => clearInterval(interval);
  }, [isGuestMode, guestData, lastActivityTime, activeRoomId]);

  // Auto-delete chat lama untuk menghemat database (maksimal 50 pesan terakhir)
  useEffect(() => {
    if (!activeRoomId || !isGuestMode) return;

    const MAX_MESSAGES = 50; // Maksimal 50 pesan untuk guest chat
    
    const cleanupOldMessages = async () => {
      try {
        const messagesRef = collection(db, 'chats', activeRoomId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(messagesQuery);
        
        if (snapshot.size > MAX_MESSAGES) {
          // Hapus pesan yang lebih lama dari 50 pesan terakhir
          const messagesToDelete = snapshot.docs.slice(MAX_MESSAGES);
          console.log(`Deleting ${messagesToDelete.length} old messages to save database costs`);
          
          for (const msgDoc of messagesToDelete) {
            await deleteDoc(doc(db, 'chats', activeRoomId, 'messages', msgDoc.id));
          }
        }
      } catch (error) {
        console.error('Error cleaning up old messages:', error);
      }
    };

    // Jalankan cleanup setiap kali ada pesan baru (dengan debounce)
    if (messages.length > 0) {
      const timer = setTimeout(cleanupOldMessages, 5000); // Delay 5 detik
      return () => clearTimeout(timer);
    }
  }, [activeRoomId, isGuestMode, messages.length]);

  // Update last activity time ketika ada aktivitas
  useEffect(() => {
    if (isGuestMode && (messages.length > 0 || msgInput.trim())) {
      const now = Date.now();
      setLastActivityTime(now);
      localStorage.setItem('entong_guest_last_activity', String(now));
    }
  }, [messages.length, msgInput, isGuestMode]);

  useEffect(() => {
    const activeUser = currentUser || safeGetJSON<any>('entong_active_user', {});
    const currentUid = activeUser?.id || activeUser?.uid;

    if (!currentUid) {
      setProfilePendingCount(0);
      return;
    }

    // LISTENER REALTIME PESANAN KHUSUS USER
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('userUid', '==', currentUid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const myOrders = snapshot.docs.map(doc => doc.data());

      // Hitung secara presisi hanya yang BELUM DIVERIFIKASI
      const unverifiedTotal = myOrders.filter((ord: any) => 
        ord.status === 'PENDING_VERIFICATION' || ord.paymentStatus === 'UNVERIFIED' || ord.paymentStatus === 'PENDING_VERIFICATION'
      ).length;

      setProfilePendingCount(unverifiedTotal);
    }, (err) => console.error("Error syncing profile badge count:", err));

    return () => unsubscribe();
  }, [currentUser]);

  // 🎯 1. REALTIME LIVE BAN & MUTE LISTENER ON CUSTOMER SIDE
  const [userStatus, setUserStatus] = useState<{ isBanned: boolean; mutedUntil: string | null }>({
    isBanned: false,
    mutedUntil: null
  });

  useEffect(() => {
    const activeUser = currentUser || safeGetJSON<any>('entong_active_user', {});
    const uid = activeUser?.id || activeUser?.uid;

    if (!uid) return;

    // LISTENER REALTIME MEMANTAU DOKUMEN USER SENSITIF
    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();

        // Update state status lokal
        setUserStatus({
          isBanned: !!userData?.isBanned,
          mutedUntil: userData?.mutedUntil || null
        });

        // 🚨 1. REALTIME LIVE KICK JIKA USER DI-BAN ADMIN
        if (userData?.isBanned === true) {
          console.warn("AKUN INI DIBAN OLEH ADMIN! MEMPROSES AUTO-KICK & LOGOUT INSTAN...");

          try {
            await signOut(auth);
          } catch (e) {
            console.error("Signout error:", e);
          }

          // Bersihkan cache lokal
          localStorage.removeItem('entong_active_user');
          localStorage.removeItem('entong_local_user');
          if (typeof setCurrentUser === 'function') setCurrentUser(null);

          // Buka modal login dengan pesan penolakan rapi
          setShowAuthModal(true);
          setAuthError("🚫 Akun kamu telah ditangguhkan dari sistem Entong Store karena terdeteksi melakukan pelanggaran. Silakan hubungi admin jika ini adalah kekeliruan.");

          alert("🚫 Akun Anda telah ditangguhkan oleh Admin Entong Store. Sesi Anda dihentikan.");
        }
      }
    }, (err) => {
      console.error("Realtime User Status Listener Error:", err);
    });

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.uid]);

  useEffect(() => {
    let timer: any = null;
    if (isLimitModalOpen && remainingCooldownSeconds > 0) {
      timer = setInterval(() => {
        setRemainingCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLimitModalOpen, remainingCooldownSeconds]);

  useEffect(() => {
    // 1. Cek Hasil Redirect (termasuk jika dites di AI Studio Preview)
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          let userData: any;
          if (userSnap.exists()) {
            userData = { id: user.uid, ...userSnap.data() };
          } else {
            const cleanUsername = user.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : `user_${user.uid.slice(0, 5)}`;
            userData = {
              id: user.uid,
              name: user.displayName || 'Pelanggan Entong Store',
              username: cleanUsername,
              usernameLower: cleanUsername,
              email: user.email || '',
              role: 'CUSTOMER',
              created: new Date().toISOString()
            };
            await setDoc(userRef, userData);
          }

          if (typeof setCurrentUser === 'function') setCurrentUser(userData);
          localStorage.setItem('entong_active_user', JSON.stringify(userData));
          if (typeof setShowAuthModal === 'function') setShowAuthModal(false);
        }
      } catch (err: any) {
        console.error("Redirect Auth Result Error:", err);
      }
    };
    checkRedirectResult();

    // 2. Auth State Listener
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const uDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (uDoc.exists()) {
            const userData = { id: firebaseUser.uid, ...uDoc.data() };
            setCurrentUser(userData as any);
            // Sync session
            localStorage.setItem('entong_active_user', JSON.stringify(userData));
          }
        } catch (e) {
          console.error("Auto recovery auth error:", e);
        }
      }
    });
    return () => unsubscribe();
  }, [setCurrentUser]);

  const verifyAndProceedLogin = async (userUid: string): Promise<boolean> => {
    try {
      const userRef = doc(db, 'users', userUid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData?.isBanned === true) {
          await signOut(auth);
          localStorage.removeItem('entong_active_user');
          localStorage.removeItem('entong_local_user');
          if (typeof setCurrentUser === 'function') setCurrentUser(null);

          setAuthError("🚫 Akun kamu telah ditangguhkan dari sistem Entong Store karena terdeteksi melakukan pelanggaran. Silakan hubungi admin jika ini adalah kekeliruan.");
          setAuthLoading(false);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error("Error checking ban status during login:", err);
      return true;
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      // Cek apakah dijalankan di lingkungan Preview AI Studio / Iframe
      const isAiStudioEnv = typeof window !== 'undefined' && (
        window.location.hostname.includes('aistudio') || 
        window.location.href.includes('applet-auth-bridge') ||
        window.location.href.includes('aistudio.google.com') ||
        window.self !== window.top
      );

      if (isAiStudioEnv) {
        // Gunakan REDIRECT khusus untuk AI Studio agar lolos dari blokir Popup 403
        await signInWithRedirect(auth, provider);
        return;
      }

      // Gunakan POPUP biasa jika dibuka di browser luar / Vercel
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user) {
        throw new Error("Gagal mengambil informasi akun dari Google.");
      }

      const canProceed = await verifyAndProceedLogin(user.uid);
      if (!canProceed) return;

      // 1. Ambil atau Buat Record User di Firestore dengan avatar resolusi tinggi
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const rawPhoto = user.photoURL || '';
      const optimizedAvatar = rawPhoto.includes('googleusercontent.com')
        ? rawPhoto.replace(/=s\d+(-c)?$/, '=s400-c').replace(/\?[^?]*$/, '')
        : rawPhoto;

      let userData: any;
      if (userSnap.exists()) {
        const existingData = userSnap.data();
        userData = { id: user.uid, ...existingData };
        if (optimizedAvatar && (!existingData.photoURL || !existingData.avatar)) {
          userData.photoURL = optimizedAvatar;
          userData.avatar = optimizedAvatar;
          await setDoc(userRef, { photoURL: optimizedAvatar, avatar: optimizedAvatar }, { merge: true });
        }
      } else {
        const cleanUsername = user.email 
          ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') 
          : `user_${user.uid.slice(0, 5)}`;
          
        userData = {
          id: user.uid,
          name: user.displayName || 'Pelanggan Entong Store',
          username: cleanUsername,
          usernameLower: cleanUsername,
          email: user.email || '',
          photoURL: optimizedAvatar,
          avatar: optimizedAvatar,
          showPublicName: true,
          role: 'CUSTOMER',
          created: new Date().toISOString()
        };
        await setDoc(userRef, userData, { merge: true });
      }

      // 2. SIMPAN KE LOCALSTORAGE SEBAGAI FALLBACK SESI
      localStorage.setItem('entong_active_user', JSON.stringify(userData));

      // 3. SINKRONKAN STATE USER DAN TUTUP MODAL SECARA INSTAN
      if (typeof setCurrentUser === 'function') {
        setCurrentUser(userData);
      }
      
      // Tutup modal auth
      if (typeof setShowAuthModal === 'function') {
        setShowAuthModal(false);
      }

    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Login dibatalkan. Silakan klik tombol lagi untuk masuk.');
      } else {
        setAuthError(err.message || 'Gagal login dengan Google.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (parseInt(captchaInput) !== captchaQuestion.answer) {
      setAuthError('Jawaban Captcha Matematika salah! Silakan coba lagi.');
      refreshCaptcha();
      setCaptchaInput('');
      return;
    }

    setAuthLoading(true);
    try {
      const cleanUsername = identity.trim().toLowerCase();
      let targetEmail = `${cleanUsername.replace(/[^a-z0-9]/g, '')}@entongstore.com`;

      if (identity.includes('@')) {
        targetEmail = identity.trim();
      } else {
        const usersRef = collection(db, 'users');
        const qUsername = query(usersRef, where('usernameLower', '==', cleanUsername));
        const qSnap = await getDocs(qUsername);
        
        if (!qSnap.empty) {
          targetEmail = qSnap.docs[0].data().email;
        } else {
          const qPhone = query(usersRef, where('phone', '==', identity.trim()));
          const pSnap = await getDocs(qPhone);
          if (!pSnap.empty) {
            targetEmail = pSnap.docs[0].data().email;
          }
        }
      }

      const userCred = await signInWithEmailAndPassword(auth, targetEmail, password);
      if (userCred.user) {
        const canProceed = await verifyAndProceedLogin(userCred.user.uid);
        if (!canProceed) return;

        const uDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        if (uDoc.exists()) {
          const ud = uDoc.data();
          setCurrentUser({ id: userCred.user.uid, ...ud } as any);
        } else {
          setCurrentUser({ id: userCred.user.uid, username: cleanUsername, email: targetEmail, role: 'CUSTOMER', name: cleanUsername, phone: '', created: new Date().toISOString() } as any);
        }
        setShowAuthModal(false);
      }
    } catch (err: any) {
      setAuthError(err?.code === 'auth/invalid-credential' ? 'Username/Email atau Password salah.' : 'Terjadi kesalahan saat login.');
      refreshCaptcha();
      setCaptchaInput('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (parseInt(captchaInput) !== captchaQuestion.answer) {
      setAuthError('Jawaban Captcha Matematika salah! Silakan coba lagi.');
      refreshCaptcha();
      setCaptchaInput('');
      return;
    }

    const phoneDigits = regPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setAuthError('Nomor WhatsApp wajib diisi minimal 10 angka!');
      return;
    }

    setAuthLoading(true);
    try {
      const hwid = getDeviceHwid();
      const deviceRef = doc(db, 'device_registrations', hwid);
      const deviceSnap = await getDoc(deviceRef);

      const now = Date.now();
      if (deviceSnap.exists()) {
        const data = deviceSnap.data();
        const cooldownUntil = data.cooldownUntil?.toMillis ? data.cooldownUntil.toMillis() : (data.cooldownUntil || 0);

        if (now < cooldownUntil) {
          setRemainingCooldownSeconds(Math.ceil((cooldownUntil - now) / 1000));
          setIsLimitModalOpen(true);
          refreshCaptcha();
          setCaptchaInput('');
          setAuthLoading(false);
          return;
        }
      }

      const cleanUsername = regUsername.trim();
      const lowerUsername = cleanUsername.toLowerCase();
      const targetEmail = `${lowerUsername.replace(/[^a-z0-9]/g, '')}@entongstore.com`;

      const userCred = await createUserWithEmailAndPassword(auth, targetEmail, regPassword);
      const uid = userCred.user.uid;

      const newUser = {
        id: uid,
        name: regName.trim(),
        username: cleanUsername,
        usernameLower: lowerUsername,
        email: targetEmail,
        phone: regPhone.trim(),
        role: 'CUSTOMER',
        created: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), newUser);

      // HWID Cooldown Logic: 1st (none), 2nd (1h), 3rd+ (12h) within 24h
      let currentAccountCount = deviceSnap.exists() ? (deviceSnap.data().accountCount || 0) : 0;
      let lastReg = deviceSnap.exists() ? (deviceSnap.data().lastRegisteredAt?.toMillis?.() || 0) : 0;
      
      // Reset count if last registration was more than 24h ago
      if (now - lastReg > 24 * 60 * 60 * 1000) {
        currentAccountCount = 0;
      }

      let cooldownDurationMs = 0;
      if (currentAccountCount === 1) {
        cooldownDurationMs = 1 * 60 * 60 * 1000; // 1 Hour
      } else if (currentAccountCount >= 2) {
        cooldownDurationMs = 12 * 60 * 60 * 1000; // 12 Hours
      }

      await setDoc(deviceRef, {
        deviceHwid: hwid,
        accountCount: currentAccountCount + 1,
        cooldownUntil: now + cooldownDurationMs,
        lastRegisteredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      setCurrentUser(newUser as any);
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Gagal mendaftar.');
      refreshCaptcha();
      setCaptchaInput('');
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * 🎯 FITUR ANTI-SPAM DETEKSI DUPLICATE ORDER (CHECKOUT GUARD - BLACKLIST LOGIC)
   * Menggunakan logika "Finished Keywords" (Blacklist) agar kebal terhadap variasi nama status aktif.
   */
  const checkIsDuplicateOrderActive = (robloxUsername: string, packageName: string): boolean => {
    try {
      const cleanUser = robloxUsername.trim().toLowerCase();
      const cleanPkg = packageName.trim().toLowerCase();

      if (!cleanUser || cleanUser === '-') return false;

      // Kata kunci yang menandakan orderan sudah BERAKHIR
      const finishedKeywords = ['selesai', 'batal', 'refund', 'done', 'cancel'];

      // Cek di Memory Browser (Substring Match) menggunakan state 'orders' yang realtime
      const isDuplicate = (orders || []).some(order => {
        const u = (order.robloxUsernameLower || order.robloxUsername || '').toString().trim().toLowerCase();
        const p = (order.packageNameLower || order.packageName || '').toString().trim().toLowerCase();
        const currentStatus = (order.status || (order as any).orderStatus || '').toString().trim().toLowerCase();

        const isSameUser = (u === cleanUser);
        const isSamePackage = (p === cleanPkg);
        
        // JIKA TIDAK MENGANDUNG kata kunci selesai/batal, berarti MASIH AKTIF
        const isFinished = finishedKeywords.some(kw => currentStatus.includes(kw));
        const isActive = !isFinished;

        return isSameUser && isSamePackage && isActive;
      });

      return isDuplicate;
    } catch (err) {
      console.error("Gagal melakukan verifikasi duplikat:", err);
      return false;
    }
  };

  useEffect(() => {
    const unsubAnn = onSnapshot(doc(db, 'settings', 'announcement'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const activeText = data.text || data.announcement || data.message || data.content || '';
        setAnnouncementText(activeText);
      } else {
        setAnnouncementText('');
      }
    });

    
    return () => {
      unsubAnn();
      
    };
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handler untuk Guest Form Submission
  const handleGuestFormSubmit = async (guestFormData: {
    name: string;
    robloxUsername: string;
    robloxUserId: string;
    whatsapp: string;
  }) => {
    try {
      const guestRoomId = `guest_${guestFormData.whatsapp}`;
      
      // Create guest user object
      const guestUserData = {
        id: guestRoomId,
        name: `Guest - ${guestFormData.name}`,
        displayName: `Guest - ${guestFormData.name}`,
        robloxUsername: guestFormData.robloxUsername,
        robloxUserId: guestFormData.robloxUserId,
        phone: guestFormData.whatsapp,
        whatsapp: guestFormData.whatsapp,
        role: 'CUSTOMER' as UserRole,
        isGuest: true,
        createdAt: new Date().toISOString()
      };

      // Create chat room document for guest
      const roomRef = doc(db, 'chats', guestRoomId);
      await setDoc(roomRef, {
        id: guestRoomId,
        customerId: guestRoomId,
        customer_id: guestRoomId,
        customerName: `Guest - ${guestFormData.name}`,
        customer_name: `Guest - ${guestFormData.name}`,
        robloxUsername: guestFormData.robloxUsername,
        robloxUserId: guestFormData.robloxUserId,
        whatsapp: guestFormData.whatsapp,
        phone: guestFormData.whatsapp,
        isGuest: true,
        isCustomerRegistered: false,
        isRegistered: false,
        lastMessage: '',
        last_message: '',
        lastSender: 'customer',
        last_sender: 'customer',
        is_read_admin: false,
        isReadByAdmin: false,
        unreadByAdmin: true,
        unread_by_admin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Set guest data and mode
      setGuestData(guestUserData);
      setIsGuestMode(true);
      setShowGuestForm(false);
      const now = Date.now();
      setLastActivityTime(now);
      localStorage.setItem('entong_guest_last_activity', String(now));

      // Send welcome message from bot
      setTimeout(() => {
        if (ensureInitialWelcomeGreeting) {
          ensureInitialWelcomeGreeting(guestRoomId, guestUserData);
        }
      }, 500);
    } catch (error) {
      console.error('Failed to create guest chat:', error);
      alert('Gagal membuat sesi chat. Silakan coba lagi.');
    }
  };

  // Ambil/Buat ID Room Customer Persisten (Pillar 1)
  useEffect(() => {
    if (!currentUser?.id) {
      setActiveRoomId(null);
      return;
    }
    
    const resolveChatRoom = async () => {
      try {
        const cleanPhone = normalizePhone(currentUser?.phone || (currentUser as any)?.whatsapp || (currentUser as any)?.whatsappNumber);
        
        let foundId = null;
        
        // 1. Dokumen chats/chat_${cleanPhone} (Room dari WA)
        if (cleanPhone) {
          const docWA = await getDoc(doc(db, 'chats', `chat_${cleanPhone}`));
          if (docWA.exists()) foundId = `chat_${cleanPhone}`;
        }
        
        // 2. Dokumen chats/room_${currentUser.id} (Legacy)
        if (!foundId) {
          const docLegacy = await getDoc(doc(db, 'chats', `room_${currentUser.id}`));
          if (docLegacy.exists()) foundId = `room_${currentUser.id}`;
        }
        
        // 3. Dokumen chats/chat_${currentUser.id} (UID based)
        if (!foundId) {
          const docUid = await getDoc(doc(db, 'chats', `chat_${currentUser.id}`));
          if (docUid.exists()) foundId = `chat_${currentUser.id}`;
        }
        
        // 4. Query based
        if (!foundId) {
          const chatsRef = collection(db, 'chats');
          if (cleanPhone) {
             const qPhone = query(chatsRef, where('whatsapp', '==', cleanPhone));
             const sPhone = await getDocs(qPhone);
             if (!sPhone.empty) foundId = sPhone.docs[0].id;
          }
          if (!foundId) {
             const qUid = query(chatsRef, where('userId', '==', currentUser.id));
             const sUid = await getDocs(qUid);
             if (!sUid.empty) foundId = sUid.docs[0].id;
          }
        }
        
        // Fallback create new
        if (!foundId) {
          foundId = cleanPhone ? `chat_${cleanPhone}` : `room_${currentUser.id}`;
        } else {
          // Update metadata jika room sudah ada
          try {
            const chatSnap = await getDoc(doc(db, 'chats', foundId));
            if (chatSnap.exists()) {
               const chatData = chatSnap.data();
               const updatePayload: any = {
                  userId: currentUser.id,
                  userUid: currentUser.id,
                  customerName: currentUser.displayName || currentUser.name || currentUser.username,
                  isCustomerRegistered: true,
                  isRegistered: true
               };
               if (chatData.status === 'BOOKING' || chatData.orderStatus === 'BOOKING') {
                  updatePayload.status = chatData.status || 'BOOKING';
                  updatePayload.orderStatus = chatData.orderStatus || 'BOOKING';
               }
               await updateDoc(doc(db, 'chats', foundId), updatePayload);
            }
          } catch (e) {}
        }
        
        setActiveRoomId(foundId);
      } catch (err) {
        console.error("Error resolving chat room:", err);
        setActiveRoomId(`room_${currentUser?.id}`);
      }
    };
    resolveChatRoom();
  }, [currentUser?.id, currentUser?.phone, (currentUser as any)?.whatsapp, (currentUser as any)?.whatsappNumber]);

  // Guest Mode: Set activeRoomId untuk guest user
  useEffect(() => {
    if (isGuestMode && guestData && !currentUser) {
      const guestRoomId = `guest_${guestData.whatsapp}`;
      setActiveRoomId(guestRoomId);
      
      // Save guest data to localStorage for persistence
      localStorage.setItem('entong_guest_data', JSON.stringify(guestData));
      localStorage.setItem('entong_guest_room_id', guestRoomId);
    }
  }, [isGuestMode, guestData, currentUser]);

  // Check if there's existing guest session on mount
  useEffect(() => {
    if (!currentUser) {
      const savedGuestData = localStorage.getItem('entong_guest_data');
      if (savedGuestData) {
        try {
          const parsed = JSON.parse(savedGuestData);
          setGuestData(parsed);
          setIsGuestMode(true);
          setLastActivityTime(Date.now());
          localStorage.setItem('entong_guest_last_activity', String(Date.now()));
        } catch (e) {
          console.error('Failed to parse guest data:', e);
        }
      }
    }
  }, [currentUser]);

  // --- SW Registration & Notification Audio ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        // SW registered
      }).catch(err => console.error('SW Error', err));
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);




  // Realtime Listener Sub-Koleksi Messages (Pillar 1)
  useEffect(() => {
    if (!activeRoomId) return;

    setIsLoadingChat(true);
    hasEverLoadedMessagesRef.current = false;
    hasTriedFallbackRef.current = false;

    // Auto-create direct room document agar Direct Path tidak bernilai kosong
    import('../chat/roomManager').then(({ ensureDirectRoomExists }) => {
      ensureDirectRoomExists(activeRoomId, currentUser);
    }).catch(() => {});

    const messagesQuery = collection(db, 'chats', activeRoomId, 'messages');

    let unsubGroup: any = null;

    const unsubscribe = onSnapshot(messagesQuery, { includeMetadataChanges: true }, (snapshot) => {
      try {
        const isFirstSnapshot = isInitialSnapshotRef.current;
        if (isFirstSnapshot) {
          isInitialSnapshotRef.current = false;
        }

        // Only process incoming notifications for real-time changes AFTER the initial snapshot
        if (!isFirstSnapshot) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && !snapshot.metadata.hasPendingWrites) {
              const data: any = change.doc.data() || {};
              const sender = data.sender || (data.senderRole === 'ADMIN' || data.sender_role === 'ADMIN' ? 'admin' : 'customer');
              const isSystem = data.isSystem || data.type === 'system';

              // Validasi timestamp: pesan harus lebih baru dari saat jendela chat dimount
              const msgTime = data.createdAtMillis || 
                (data.createdAt?.toMillis ? data.createdAt.toMillis() : 
                (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 
                (data.timestamp || 0)));

              if (msgTime > 0 && msgTime < chatMountTimeRef.current - 1500) {
                // Pesan lama dari database yang terbawa listener snapshot, abaikan
                return;
              }

              if (sender === 'admin' || isSystem) {
                const msgText = data.text || data.message || 'Pesan baru dari admin';

                if (Notification.permission === 'granted' && document.hidden) {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then((registration) => {
                      if (registration && registration.showNotification) {
                        registration.showNotification('💬 Pesan Baru dari Admin Entong Store', {
                          body: msgText,
                          icon: '/logo-entong.png',
                          badge: '/logo-entong.png',
                          vibrate: [200, 100, 200],
                          tag: `chat-${activeRoomId}`,
                          renotify: true,
                          data: {
                            url: `/pesanan?id=${activeRoomId}`
                          }
                        } as any);
                      }
                    }).catch(() => {});
                  } else {
                    try {
                      new Notification('Pesan Baru dari Admin Entong Store', {
                        body: msgText,
                        icon: '/logo-entong.png',
                        tag: `chat-${activeRoomId}`
                      });
                    } catch (e) {}
                  }
                }

                // Play gentle sound alert ONLY when chat is in background / minimized
                playSoftNotificationSound();

                // Show toast popup and auto clear after 4s
                if (toastTimerRef.current) {
                  clearTimeout(toastTimerRef.current);
                }
                setIncomingToastMsg(msgText);
                toastTimerRef.current = setTimeout(() => setIncomingToastMsg(null), 4000);
              }
            }
          });
        }

        if (!snapshot.empty) {
          hasEverLoadedMessagesRef.current = true;
          const parsedMessages = snapshot.docs.map((docSnap) => {
            const data: any = docSnap.data({ serverTimestamps: 'estimate' }) || {};
            
            let timeMs = 0;
            // 1. Ekstrak milidetik angka eksplisit presisi tinggi jika tersedia
            if (typeof data.createdAtMillis === 'number' && !isNaN(data.createdAtMillis) && data.createdAtMillis > 0) {
              timeMs = data.createdAtMillis;
            } else if (typeof data.localTimestamp === 'number' && !isNaN(data.localTimestamp) && data.localTimestamp > 0) {
              timeMs = data.localTimestamp;
            } else if (typeof data.timestamp === 'number' && !isNaN(data.timestamp) && data.timestamp > 0) {
              timeMs = data.timestamp;
            } else {
              // 2. Ekstrak dari objek Timestamp Firestore / Date / String
              const rawTime = data.createdAt || data.timestamp || data.time || data.created;
              if (rawTime?.toMillis) {
                timeMs = rawTime.toMillis();
              } else if (rawTime?.toDate) {
                timeMs = (rawTime?.toDate ? (rawTime?.toDate ? rawTime.toDate().getTime() : new Date(rawTime?.seconds ? rawTime.seconds * 1000 : rawTime || 0).getTime()) : new Date(rawTime || 0).getTime());
              } else if (rawTime?.seconds) {
                timeMs = rawTime.seconds * 1000;
              } else if (rawTime instanceof Date) {
                timeMs = rawTime.getTime();
              } else if (typeof rawTime === 'number') {
                timeMs = rawTime;
              } else if (typeof rawTime === 'string') {
                const parsed = new Date(rawTime).getTime();
                timeMs = isNaN(parsed) ? Date.now() : parsed;
              } else {
                timeMs = Date.now();
              }
            }

            if (isNaN(timeMs) || timeMs <= 0) {
              timeMs = Date.now();
            }

            let resolvedCreatedAt: string;
            if (data.created && typeof data.created === 'string') {
              resolvedCreatedAt = data.created;
            } else if (data.createdAt?.toDate) {
              resolvedCreatedAt = (data.createdAt?.toDate ? data.createdAt.toDate() : new Date()).toISOString();
            } else if (data.createdAt?.seconds) {
              resolvedCreatedAt = new Date(data.createdAt.seconds * 1000).toISOString();
            } else {
              resolvedCreatedAt = new Date(timeMs).toISOString();
            }

            return {
              id: docSnap.id,
              ...data,
              text: data.text || data.message || '',
              sender: data.sender || (data.senderRole === 'ADMIN' || data.sender_role === 'ADMIN' ? 'admin' : 'customer'),
              timeMs: timeMs,
              createdAt: data.createdAt ? data.createdAt : { seconds: Math.floor(timeMs / 1000) },
              created: resolvedCreatedAt
            } as ChatMessage;
          });

          parsedMessages.sort((a: any, b: any) => (a.timeMs || 0) - (b.timeMs || 0));
          setMessages(parsedMessages);
          setIsLoadingChat(false);
        } else {
          // 🛡️ PERBAIKAN WAJIB BUG #1: Cegah snapshot kosong transisi/cache mengosongkan chat
          const isFromCache = snapshot.metadata?.fromCache === true;
          const hasPendingWrites = snapshot.metadata?.hasPendingWrites === true;
          const alreadyHasMessages = messagesRef.current.length > 0 || hasEverLoadedMessagesRef.current;

          if (isFromCache || hasPendingWrites || alreadyHasMessages) {
            // JANGAN TIMPA DENGAN ARRAY KOSONG! Pertahankan pesan yang sudah tampil di layar
            setIsLoadingChat(false);
            return;
          }

          // Fallback Guard: Cek recovery legacy messages HANYA jika pertama kali buka dan belum pernah coba
          const targetCustId = currentUser?.id || currentUser?.phone || activeRoomId;
          const cleanCustId = targetCustId ? String(targetCustId).replace(/^direct-/, '').replace(/^room_/, '') : '';

          if (cleanCustId && cleanCustId !== targetCustId && !hasTriedFallbackRef.current) {
            hasTriedFallbackRef.current = true;
            const groupRef = query(
              collectionGroup(db, 'messages'),
              where('customerId', '==', targetCustId)
            );

            unsubGroup = onSnapshot(groupRef, (groupSnapshot) => {
              if (groupSnapshot.empty) {
                if (!hasEverLoadedMessagesRef.current && messagesRef.current.length === 0) {
                  setMessages([]);
                }
                setIsLoadingChat(false);
                return;
              }

              hasEverLoadedMessagesRef.current = true;
              const loadedGroup: ChatMessage[] = [];
              groupSnapshot.forEach((docSnap) => {
                const data: any = docSnap.data({ serverTimestamps: 'estimate' }) || {};
                const rawCreatedAt = data.createdAt || data.created;
                let resolvedCreatedAt: string;
                
                if (!rawCreatedAt) {
                  resolvedCreatedAt = new Date().toISOString();
                } else if (rawCreatedAt.toDate) {
                  resolvedCreatedAt = (rawCreatedAt?.toDate ? rawCreatedAt.toDate() : new Date()).toISOString();
                } else if (rawCreatedAt.seconds) {
                  resolvedCreatedAt = new Date(rawCreatedAt.seconds * 1000).toISOString();
                } else {
                  resolvedCreatedAt = String(rawCreatedAt);
                }

                loadedGroup.push({
                  id: docSnap.id,
                  ...data,
                  createdAt: data.createdAt ? data.createdAt : { seconds: Date.now() / 1000 },
                  created: resolvedCreatedAt
                } as ChatMessage);
              });

              loadedGroup.sort((a, b) => {
                const getSafeTime = (ts: any) => {
                  if (!ts) return Date.now();
                  if (typeof ts === 'object' && ts.seconds) return ts.seconds * 1000;
                  const d = new Date(ts);
                  return isNaN(d.getTime()) ? Date.now() : d.getTime();
                };
                return getSafeTime(a.createdAt) - getSafeTime(b.createdAt);
              });
              
              setMessages(loadedGroup);
              setIsLoadingChat(false);
            }, (_err: any) => {
              setIsLoadingChat(false);
            });
          } else {
            if (!hasEverLoadedMessagesRef.current && messagesRef.current.length === 0) {
              setMessages([]);
            }
            setIsLoadingChat(false);
          }
        }
      } catch (err) {
        console.error("Gagal parse pesan customer:", err);
      }
    }, (error) => {
      console.error('Error fetching chat history:', error);
      setIsLoadingChat(false);
    });

    return () => {
      unsubscribe();
      if (unsubGroup) unsubGroup();
    };
  }, [activeRoomId]);

  const customerKey = currentUser?.id || currentUser?.phone || activeRoomId || 'customer-session';
  const isMutedFromLocal = isUserMuted(customerKey);
  const isMutedFromFirestore = Boolean(userStatus.mutedUntil && new Date(userStatus.mutedUntil).getTime() > Date.now());
  const isMutedCurrently = isMutedFromLocal || isMutedFromFirestore;

  // Anti-spam state
  const [recentSentTimestamps, setRecentSentTimestamps] = useState<number[]>([]);
  const [showSpamWarning, setShowSpamWarning] = useState<boolean>(false);
  const [muteCountdown, setMuteCountdown] = useState<number>(0);

  const currentOrderChats = useMemo(() => {
    return messages;
  }, [messages]);

  // Auto-Greeting Bot Trigger if conversation is empty
  useEffect(() => {
    if (activeRoomId && !isLoadingChat) {
      ensureInitialWelcomeGreeting(activeRoomId, currentUser, messages);
    }
  }, [activeRoomId, isLoadingChat, messages.length]);

  const [showNotifBanner, setShowNotifBanner] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotifBanner(true);
    }
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  const requestNotifPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setShowNotifBanner(false);
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(console.error);
          }
        }
      });
    }
  };

  const prevChatsLengthRef = useRef(0);
  useEffect(() => {
    if (currentOrderChats.length > prevChatsLengthRef.current && prevChatsLengthRef.current !== 0) {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      
      const lastMessage = currentOrderChats[currentOrderChats.length - 1];
      if (lastMessage && (lastMessage.sender_id === 'admin' || lastMessage.sender_role === 'ADMIN' || lastMessage.sender_role === 'OWNER')) {
        if (document.hidden) {
          playSoftNotificationSound();

          if ('Notification' in window && Notification.permission === 'granted') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('Pesan Baru dari Admin Entong Store', {
                  body: lastMessage.message || 'Pesan gambar/video/file',
                  icon: '/icon-192x192.png',
                  badge: '/icon-192x192.png',
                });
              });
            } else {
              new Notification('Pesan Baru dari Admin Entong Store', {
                body: lastMessage.message || 'Pesan gambar/video/file',
                icon: '/icon-192x192.png',
              });
            }
          }
        }
      }
    }
    prevChatsLengthRef.current = currentOrderChats.length;
  }, [currentOrderChats]);
  // ---------------------------------------------
  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentOrderChats]);

  useEffect(() => {
    if (activeRoomId) {
      markChatAsRead(activeRoomId, 'CUSTOMER');
    }
  }, [activeRoomId, currentOrderChats.length]);

  // Live countdown timer when muted
  useEffect(() => {
    if (!isMutedCurrently) return;
    const updateCountdown = () => {
      let seconds = 0;
      if (userStatus.mutedUntil && new Date(userStatus.mutedUntil).getTime() > Date.now()) {
        seconds = Math.ceil((new Date(userStatus.mutedUntil).getTime() - Date.now()) / 1000);
      } else {
        seconds = getMuteRemainingSeconds(customerKey);
      }
      setMuteCountdown(seconds > 0 ? seconds : 0);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isMutedCurrently, userStatus.mutedUntil, customerKey, getMuteRemainingSeconds]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Jika user belum login dan bukan guest mode, tampilkan guest form
    if (!currentUser && !isGuestMode) {
      setShowGuestForm(true);
      return;
    }

    const rawVal = chatInputRef.current ? chatInputRef.current.value : msgInput;
    const directText = (rawVal || '').trim();
    if (!activeRoomId || !directText) return;

    // Reset input immediately on DOM & React state
    if (chatInputRef.current) chatInputRef.current.value = '';
    setMsgInput('');

    // 🚫 CEK BAN GUARD (skip for guest)
    if (!isGuestMode && (userStatus.isBanned || currentUser?.isBanned)) {
      alert("Akun Anda telah ditangguhkan. Tidak dapat mengirim pesan.");
      return;
    }

    // 🚫 CEK MUTE GUARD (skip for guest)
    if (!isGuestMode) {
      const isMuted = isMutedCurrently || (userStatus.mutedUntil && new Date(userStatus.mutedUntil).getTime() > Date.now());
      if (isMuted) {
        const remainingMinutes = Math.max(1, Math.ceil((muteCountdown > 0 ? muteCountdown : 60) / 60));
        alert(`Akses chat Anda sedang dibungkam (Muted) oleh admin. Sisa waktu: ${remainingMinutes} menit.`);
        return;
      }
    }

    const now = Date.now();
    const windowMs = 60000; // 60 Detik Sliding Window
    const filtered = [...recentSentTimestamps, now].filter(t => now - t <= windowMs);
    setRecentSentTimestamps(filtered);

    // Anti-Spam threshold checks (>10 pesan dalam 60 detik -> Mute 15 Menit)
    if (filtered.length > 10) {
      muteUser(customerKey, 15);
      setShowSpamWarning(false);
      setRecentSentTimestamps([]);
      
      // Catat di dokumen chat
      if (activeRoomId) {
        updateDoc(doc(db, "chats", activeRoomId), {
          isMutedUntil: now + 15 * 60 * 1000,
          updatedAt: serverTimestamp()
        }).catch(() => {});
        addDoc(collection(db, "chats", activeRoomId, "messages"), {
          text: "⛔ *SISTEM ANTI-SPAM*: Kamu mengirim lebih dari 10 pesan dalam 1 menit. Fitur chat dibatasi (mute) selama 15 menit.",
          sender: "admin",
          senderRole: "RESMI",
          isSystemNotice: true,
          createdAt: serverTimestamp()
        }).catch(() => {});
      }

      alert(`⚠️ SPAM TERDETEKSI! Anda mengirim lebih dari 10 pesan dalam 1 menit.\n\nAkun Anda OTOMATIS DI-MUTE selama 15 menit.`);
      return;
    } else if (filtered.length >= 7) {
      setShowSpamWarning(true);
    }

    // If sending order confirmation, link activeOrderId to the room metadata
    if (activeRoomId) {
      const match = directText.match(/pesanan\s*#?([A-Za-z0-9\-_]+)/i);
      const cleanOrdId = targetOrderId || (match ? match[1] : '');
      if (cleanOrdId) {
        try {
          const roomRef = doc(db, 'rooms', activeRoomId);
          setDoc(roomRef, {
            activeOrderId: cleanOrdId,
            activeDisplayOrderId: cleanOrdId,
            orderId: cleanOrdId,
            hasOrder: true,
            lastMessage: directText,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
          const chatRef = doc(db, 'chats', activeRoomId);
          setDoc(chatRef, {
            activeOrderId: cleanOrdId,
            activeDisplayOrderId: cleanOrdId,
            orderId: cleanOrdId,
            hasOrder: true,
            lastMessage: directText,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        } catch (_) {}
      }
    }

    // Instant Optimistic Message in local state to ensure it never flickers or disappears
    const tempMsgId = 'temp-cust-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    
    // Fix untuk guest mode: gunakan guestData jika guest
    const senderId = isGuestMode && guestData ? guestData.id : (currentUser?.id || 'customer');
    const senderName = isGuestMode && guestData ? guestData.name : (currentUser?.name || 'Customer');
    
    const optimisticCustMsg: ChatMessage = {
      id: tempMsgId,
      order_id: activeRoomId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: 'CUSTOMER',
      sender: 'customer',
      message: directText,
      text: directText,
      timeMs: Date.now(),
      createdAt: { seconds: Date.now() / 1000 } as any,
      created: new Date().toISOString(),
      timestamp: new Date()
    } as ChatMessage;

    hasEverLoadedMessagesRef.current = true;
    setMessages((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return [...list, optimisticCustMsg];
    });

    // Execute message send in background without blocking UI
    sendMessage(activeRoomId, directText).catch((err: any) => {
      console.error("Gagal mengirim pesan:", err);
    });
  };

  const processMediaFile = async (file: File) => {
    if (!file || !activeRoomId) return;

    if (userStatus.isBanned || currentUser?.isBanned) {
      alert("Akun Anda telah ditangguhkan. Tidak dapat mengirim media.");
      return;
    }

    if (isMutedCurrently) {
      const remainingMinutes = Math.max(1, Math.ceil((muteCountdown > 0 ? muteCountdown : 60) / 60));
      alert(`Akses chat Anda sedang dibungkam (Muted) oleh admin. Sisa waktu: ${remainingMinutes} menit.`);
      return;
    }

    setIsUploadingMedia(true);
    try {
      if (file.type.startsWith('image/')) {
        const compressedUrl = await compressImage(file, 800, 0.7);
        await sendMessage(activeRoomId, '', compressedUrl, 'IMAGE');

        // 🔗 Sinkronkan secara otomatis ke orderan aktif di ruangan jika ada
        try {
          const roomRef = doc(db, 'rooms', activeRoomId);
          const roomSnap = await getDoc(roomRef);
          let targetOrderDocId = '';
          if (roomSnap.exists()) {
            const rData = roomSnap.data();
            if (rData?.activeOrderDocId) targetOrderDocId = rData.activeOrderDocId;
          }
          if (!targetOrderDocId) {
            const chatSnap = await getDoc(doc(db, 'chats', activeRoomId));
            if (chatSnap.exists()) {
              const cData = chatSnap.data();
              if (cData?.activeOrderDocId) targetOrderDocId = cData.activeOrderDocId;
            }
          }
          if (targetOrderDocId) {
            const orderRef = doc(db, 'orders', targetOrderDocId);
            await updateDoc(orderRef, {
              proofUrl: compressedUrl,
              payment_proof: compressedUrl,
              proofOfPayment: compressedUrl,
              hasProof: true,
              proofUploadedAt: Date.now()
            });
          }
        } catch (_) {}
      } else if (file.type.startsWith('video/')) {
        const compressedUrl = await compressVideo(file);
        await sendMessage(activeRoomId, '', compressedUrl, 'VIDEO');
      } else {
        alert('Format file tidak didukung. Harap pilih foto atau video.');
      }
    } catch (err: any) {
      alert(err?.message || 'Gagal memproses file media.');
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processMediaFile(file);
  };

  const handlePasteImage = async (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const file = e.clipboardData.items[0]?.getAsFile();
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      await processMediaFile(file);
    }
  };

  return (
    <div className={
      isFullscreen
        ? "fixed inset-0 z-[99999] w-full h-full bg-[#0B0F19] rounded-none border-none flex flex-col overflow-hidden transition-all duration-300"
        : "fixed inset-x-0 bottom-0 sm:bottom-6 sm:right-6 sm:inset-x-auto z-[99999] w-full sm:w-[400px] h-[90dvh] sm:h-[580px] sm:max-h-[88vh] bg-[#0F172A] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
    }>
      {incomingToastMsg && (
        <div className="absolute top-3 left-3 right-3 z-[999999] bg-blue-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg">💬</span>
            <div className="text-xs truncate font-bold">
              Admin: {incomingToastMsg}
            </div>
          </div>
          <button
            onClick={() => setIncomingToastMsg(null)}
            className="text-white/80 hover:text-white font-bold text-sm px-2 py-0.5 rounded-lg bg-black/20"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* ELEMEN 1: HEADER CHAT (ENTONG STORE EXCLUSIVE DARK BLUE REDESIGN) */}
      <div className="shrink-0 bg-[#0F172A] px-4 py-3.5 border-b border-slate-800 flex justify-between items-center z-10">
        {/* CS Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img 
              src={storeAvatarUrl || "/logo-entong.png"} 
              alt="CS Entong Store" 
              className="w-10 h-10 rounded-full object-cover object-top border border-blue-500/40 shadow-sm" 
              referrerPolicy="no-referrer"
            />
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${storeOperatingStatus.isOpen ? 'bg-emerald-500' : 'bg-rose-500'} border-2 border-[#0F172A]`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white truncate">CS Entong Store</span>
            </div>
            <p className={`text-[11px] ${storeOperatingStatus.isOpen ? 'text-emerald-400' : 'text-rose-400'} font-medium flex items-center gap-1.5 mt-0.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${storeOperatingStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span>• {storeOperatingStatus.isOpen ? 'Online' : 'Offline'}</span>
            </p>
          </div>
        </div>
        
        {/* Right Action Buttons: Login (if guest), Toggle Fullscreen, Close ("X") */}
        <div className="flex items-center gap-2 shrink-0">
          {(!currentUser || currentUser.id?.startsWith('guest_') || currentUser.id?.startsWith('local-')) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAuthModal(true);
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-all shadow cursor-pointer mr-1"
            >
              Login
            </button>
          )}

          {/* Fullscreen / Minimize Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(!isFullscreen);
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all border border-slate-700/50 hover:border-slate-600 cursor-pointer shadow-sm flex items-center justify-center"
            title={isFullscreen ? "Kecilkan / Minimize" : "Layar Penuh / Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(false);
              if (onClose) {
                onClose();
              }
            }}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-xl transition-all border border-slate-700/50 hover:border-rose-500/40 cursor-pointer shadow-sm flex items-center justify-center"
            title="Tutup Chat"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* 📢 BANNER JAM OPERASIONAL TOKO TERPUSAT & PENGUMUMAN REALTIME */}
      <StoreOperationalBanner />

      {/* ELEMEN 2: AREA PESAN (Tengah / Isi Chat ATAU Inline Guest Form) */}
      {!currentUser && !isGuestMode ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 bg-[#0B0F19] flex flex-col">
          {/* Header Welcome */}
          <div className="text-center mb-6 mt-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-4">
              <svg className="w-10 h-10 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white mb-2">👋 Selamat datang!</h2>
            <p className="text-sm text-slate-400">Isi dulu ya sebelum mulai chat ~</p>
          </div>

          {/* Form Content - Full Width dalam Chat Area */}
          <div className="w-full max-w-md mx-auto">
            <GuestChatForm 
              onSubmit={handleGuestFormSubmit}
              onClose={() => {}}
              isInline={true}
            />
          </div>
        </div>
      ) : (
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 bg-[#0B0F19] space-y-2.5">
        {showNotifBanner && (
          <div className="mb-2 bg-blue-950/90 border border-blue-500/50 rounded-xl p-3 flex items-center justify-between shadow-lg">
            <div className="flex-1 mr-3">
              <h4 className="text-blue-400 font-bold text-xs">Aktifkan Notifikasi</h4>
              <p className="text-[10px] text-blue-200/80">Agar tidak ketinggalan balasan chat dari admin saat aplikasi ditutup.</p>
            </div>
            <button onClick={requestNotifPermission} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shrink-0 shadow-lg cursor-pointer">
              Izinkan
            </button>
          </div>
        )}

        <div className="text-center my-2">
          <span className="px-3 py-1 bg-[#151B2B] text-slate-400 text-[10px] rounded-xl border border-slate-800 shadow-sm inline-block font-medium">
            🔒 Pesan terenkripsi langsung ke Customer Service Entong Store
          </span>
        </div>

        {currentOrderChats.map((chat, idx) => {
          if (!chat) return null;
          const messageText = chat.message || (chat as any).text || '';
          const isSystemMsg = !!(messageText && (messageText.includes('STATUS UPDATE') || messageText.includes('UPDATE STATUS') || messageText.includes('STATUS ORDER') || messageText.includes('[STATUS') || messageText.includes('[PESANAN BARU]')));
          const timeStr = formatChatTime(chat.created || new Date());
          const chatKey = (chat as any).docUniqueId || chat.id ? `${chat.id || (chat as any).docUniqueId}-${idx}` : `chat-item-${idx}`;

          if (isSystemMsg) {
            const cleanMsg = messageText.replace(/^📋\s*STATUS\s*(UPDATE|ORDER)\s*#[^\n]*\n?/gi, '').trim() || messageText;
            return (
              <div key={chatKey} className="flex justify-center my-1.5 px-2 w-full">
                <div className="bg-[#151B2B] border border-blue-500/30 rounded-2xl px-4 py-2 max-w-xs sm:max-w-sm text-center shadow-md">
                  <div className="flex items-center justify-center gap-1.5 text-blue-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span>INFO PESANAN</span>
                  </div>
                  <div className="text-slate-200 text-[11px] font-medium leading-snug whitespace-pre-wrap">
                    {renderMessageText(cleanMsg)}
                  </div>
                  <div className="text-[9px] text-blue-400/60 mt-1">
                    {timeStr}
                  </div>
                </div>
              </div>
            );
          }

          if (chat.type === 'review_prompt') {
            return <ReviewPromptCard key={chatKey} currentUser={currentUser} roomId={activeRoomId} />;
          }

          if (chat.type === 'JOKI_CREDENTIAL_FORM' || (chat as any).type === 'joki_credential_form') {
            return (
              <JokiCredentialFormMessage
                key={chatKey}
                message={chat as any}
                chatId={activeRoomId}
                isCustomer={true}
                currentUser={currentUser}
              />
            );
          }

          if ((chat as any).is2FAPrompt || (chat as any).type === '2FA_PROMPT' || (chat as any).type === 'TWO_FACTOR_ACTION') {
            return (
              <div key={chatKey} className="flex justify-start my-2">
                <TwoFactorActionBubble
                  chatId={activeRoomId}
                  orderId={(chat as any).orderId || targetOrderId}
                  isResolved={(chat as any).isResolved || false}
                />
              </div>
            );
          }

          const isAdmin = chat.sender_role === 'ADMIN' || chat.sender_role === 'OWNER' || chat.sender_role === 'WORKER' || chat.sender_name === 'Ceo Entong' || (chat as any).senderName === 'Bot Entong Store' || chat.isOfficialBot;
          
          // Fix untuk guest chat: pastikan pesan dari admin tidak masuk ke bubble user
          let isMe = false;
          
          // Jika pesan dari admin, pasti bukan pesan dari user
          if (isAdmin) {
            isMe = false;
          } else {
            // Dapatkan ID pengirim yang sebenarnya
            const currentSenderId = isGuestMode && guestData ? guestData.id : (currentUser?.id || currentUser?.uid);
            
            if (currentSenderId && chat.sender_id) {
              // Cek apakah sender_id sama dengan ID user/guest saat ini
              isMe = chat.sender_id === currentSenderId;
            } else {
              // Fallback: jika tidak ada sender_id, cek berdasarkan sender_role dan sender
              isMe = chat.sender_role === 'CUSTOMER' || chat.sender === 'customer';
            }
          }
          
          const bubbleClass = chat.is_quick_reply
            ? 'bg-gradient-to-r from-blue-950 to-slate-900 border border-blue-500/50 text-blue-100 shadow-md'
            : (isMe ? 'bg-blue-600 text-white rounded-2xl rounded-br-none shadow-md shadow-blue-600/10' : 'bg-slate-800 text-slate-100 rounded-2xl rounded-bl-none border border-slate-700/60 shadow-md');

          // Inline Interactive Bot Flow Detection
          const interactiveType = !isMe ? detectInteractiveType(chat) : 'NONE';
          const isAnswered = interactiveType !== 'NONE' && currentOrderChats.slice(idx + 1).some((nextMsg: any) => {
            const t = nextMsg.text || nextMsg.message || '';
            const nextIsCust = nextMsg.sender === 'customer' || nextMsg.sender_role === 'CUSTOMER' || nextMsg.sender_id === currentUser?.id;
            if (!nextIsCust) return false;
            
            if (interactiveType === 'WELCOME') {
              return t.includes('jajan di Entong Store');
            }
            if (interactiveType === 'NOT_YET_SERVICES') {
              return t.includes('Gift Ingame') || t.includes('Joki Game');
            }
            if (interactiveType === 'CHOOSE_CATEGORY') {
              return t.includes('Gift In Game') || t.includes('Joki');
            }
            if (interactiveType === 'FILL_GIFT_FORM' || interactiveType === 'FILL_JOKI_FORM') {
              return t.includes('[FORM GIFT') || t.includes('[FORM JOKI]');
            }
            if (interactiveType === 'WAITING_FEEDBACK') {
              return t.includes('sabar nunggu') || t.includes('lama banget min');
            }
            return false;
          });

          return (
            <div key={chatKey} className="space-y-2">
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-md text-xs relative ${bubbleClass}`}>
                  {!isMe && (() => {
                    const isOfficialBot = chat.isOfficialBot || (chat as any).senderName === 'Bot Entong Store' || (chat as any).senderName === 'Entong Bot' || (chat as any).is_official_bot;
                    if (isOfficialBot) {
                      return (
                        <div className="text-[10px] font-bold mb-1 flex items-center gap-1.5 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>🤖 Entong Bot</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">RESMI</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <ChatMessageRenderer text={(chat as any).text || chat.message || ''} />

                  {chat.is_quick_reply && (
                    <div className="text-[9px] font-bold text-blue-400 mt-1 uppercase tracking-wider flex items-center gap-1 border-t border-blue-500/30 pt-1">
                      <span>⚡ Sistem • Pesan Otomatis</span>
                    </div>
                  )}
                  
                  {chat.media_url && (
                    <div className="my-1.5 max-w-xs cursor-pointer" onClick={() => setExpandedMediaUrl(chat.media_url!)}>
                      {chat.media_type === 'IMAGE' ? (
                        <SafeImage
                          src={chat.media_url}
                          alt="Foto Chat"
                          className="w-full max-h-56 rounded-xl border border-slate-700/80 shadow hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <video
                          src={chat.media_url}
                          controls
                          className="w-full max-h-56 rounded-xl border border-slate-700/80 bg-black shadow"
                        />
                      )}
                    </div>
                  )}

                  <div className="text-[9px] text-slate-500 mt-1 font-mono text-right">
                    {timeStr.endsWith('WIB') ? timeStr : `${timeStr} WIB`}
                  </div>
                </div>
              </div>

              {/* RENDER UI DIRECT KATALOG (CARD INTERAKTIF DI BAWAH BUBBLE PESAN) */}
              {(chat as any).actionCard && (chat as any).actionCard.type === 'OPEN_CATALOG_MODAL' && (
                <div className="w-full max-w-xs pl-2">
                  <div className="bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-3.5 space-y-2.5 shadow-xl shadow-cyan-950/20">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
                      <span>{(chat as any).actionCard.targetCategory === 'GIFT' ? '🎁' : '⚡'}</span>
                      <span>{(chat as any).actionCard.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      {(chat as any).actionCard.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (setActiveTab) {
                          setActiveTab('catalog');
                        } else {
                          window.location.href = (chat as any).actionCard.routePath || '/';
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{(chat as any).actionCard.buttonLabel}</span>
                      <span>➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* OUTSIDE-BUBBLE INTERACTIVE BOT PILLS & FORMS (MAYOBLOX STYLE) */}
              {interactiveType !== 'NONE' && activeRoomId && (
                <div className="flex justify-start">
                  <InteractiveBotBubble
                    type={interactiveType}
                    roomId={activeRoomId}
                    currentUser={currentUser}
                    messageId={chat.id}
                    isAnswered={isAnswered}
                    onOpenCatalog={(category) => {
                      if (setActiveTab) {
                        setActiveTab('catalog');
                      }
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* OPSI BOT TERKONTROL (HANYA MUNCUL DI AWAL / SETELAH ORDER SELESAI/HANGUS) */}
        {activeRoomId && (
          <BotWelcomeOptions
            chatId={activeRoomId}
            customerName={currentUser?.name || currentUser?.username || "Kak"}
            customerUid={currentUser?.id || currentUser?.phone}
            currentUser={currentUser}
            orderStatus={activeOrder?.status || (orders && orders[0]?.status) || "NONE"}
            hasActiveOrder={Boolean(activeOrder ? !["SELESAI", "HANGUS"].includes(activeOrder.status) : (orders && orders.some(o => !["SELESAI", "HANGUS"].includes(o.status))))}
            messages={messages}
          />
        )}

        <div ref={chatEndRef} />
      </div>
      )}

      {/* ELEMEN 3: AREA INPUT TEXT (Paling Bawah - Hanya tampil jika user aktif atau guest mode) */}
      {(currentUser || isGuestMode) && (
        <div className="shrink-0 bg-[#151B2B] p-3 border-t border-slate-800">
          {showSpamWarning && !isMutedCurrently && (
            <div className="bg-amber-950/90 border border-amber-500/30 px-3 py-2 rounded-xl flex items-center justify-between text-xs text-amber-200 mb-2 shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <p className="text-[11px] leading-tight">
                  <strong className="text-amber-300">Peringatan Spam:</strong> Mohon tidak spam! Jika lanjut mengirim pesan terlalu cepat, akun Anda akan di-mute selama 15 menit.
                </p>
              </div>
              <button type="button" onClick={() => setShowSpamWarning(false)} className="text-amber-400 font-bold px-2 py-0.5 hover:bg-amber-900/50 rounded transition-colors shrink-0 cursor-pointer">✕</button>
            </div>
          )}

          {isMutedCurrently ? (
            <div className="bg-rose-950/95 border border-rose-600/40 p-3 rounded-xl flex flex-col items-center justify-center text-center space-y-1.5 shadow-2xl">
              <div className="text-rose-300 font-black flex items-center gap-1.5 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 animate-pulse" />
                AKUN ANDA SEDANG DI-MUTE KARENA SPAM!
              </div>
              <p className="text-slate-300 text-[10px] max-w-md leading-tight">
                Anda telah mengirim terlalu banyak pesan dalam waktu singkat. Anda tidak dapat mengirim pesan selama masa cooldown.
              </p>
              <div className="mt-1 px-4 py-1 bg-rose-500/20 border border-rose-400/50 rounded-full text-rose-200 font-mono font-extrabold text-[11px] animate-pulse">
                Mute tersisa: {formatCountdown(muteCountdown)}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleMediaUpload}
                accept="image/*,video/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingMedia}
                className="h-10 w-10 flex items-center justify-center bg-[#0B0F19] hover:bg-slate-800 text-slate-300 hover:text-blue-400 rounded-xl border border-slate-700 transition-all shrink-0 active:scale-95 cursor-pointer"
                title="Kirim Foto / Video"
              >
                {isUploadingMedia ? <RefreshCw className="w-4 h-4 animate-spin text-blue-400" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <div className="flex-1 bg-[#0B0F19] border border-slate-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 rounded-xl px-3 py-1.5 flex items-center transition-colors min-h-[42px]">
                <textarea
                  ref={chatInputRef}
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => {
                    // Tekan Enter untuk mengirim, Shift + Enter untuk baris baru
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat(e);
                    }
                  }}
                  onPaste={handlePasteImage}
                  rows={1}
                  placeholder="Ketik pesan atau paste foto..."
                  className="flex-1 bg-transparent text-slate-100 text-xs sm:text-sm focus:outline-none resize-none overflow-y-auto max-h-32 leading-relaxed whitespace-pre-wrap py-1 px-0.5"
                />
              </div>
              <button
                type="submit"
                className="h-10 w-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Kirim Pesan"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}

      {/* ELEMEN 3b: AREA INPUT UNTUK GUEST - REMOVED karena form sudah inline di area chat */}

      {/* MODAL AUTH PORTAL ENTONG STORE (HANYA DITAMPILKAN JIKA USER KLIK TOMBOL LOGIN SECARA EKSPLISIT) */}
      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      )}



      {/* Modal Limit Registrasi HWID */}
      {isLimitModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto text-xl">
              <AlertTriangle className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="font-bold text-base text-white">Batas Registrasi Tercapai</h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              Kamu buat akun terlalu banyak, coba lagi setelah:
            </p>
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xl font-extrabold text-amber-400 tracking-wider">
              {formatTimerHHMMSS(remainingCooldownSeconds)}
            </div>
            <button
              onClick={() => setIsLimitModalOpen(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl transition text-xs"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Expanded Media Modal */}
      {expandedMediaUrl && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4" onClick={() => setExpandedMediaUrl(null)}>
          <button 
            onClick={() => setExpandedMediaUrl(null)}
            className="absolute top-4 right-4 p-2 bg-slate-900/80 border border-slate-800 hover:bg-slate-850 rounded-full text-slate-300 hover:text-white transition-all shadow-md"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl w-full max-h-[85vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <SafeImage 
              src={expandedMediaUrl} 
              alt="Preview Media" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-800" 
            />
          </div>
        </div>
      )}

      {/* Guest Chat Form Modal - REMOVED, form sudah inline di area chat */}
    </div>
  );
};
