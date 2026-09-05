import { LiveTransactionsCarousel } from "./LiveTransactionsCarousel";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, formatDate, formatChatTime } from '../../context/AppContext';
import { GameOrder, OrderStatus, GameItem, ChatMessage, resolveChatRoomId, CartEntry } from '../../types';
import { doc, collection, query, orderBy, onSnapshot, limit, where, getDocs, getCountFromServer, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, getSafeTimestamp, getPureCreationTime, applySmartSearch } from '../../lib/firebase';
import { WebPushNotificationBanner } from '../common/WebPushNotificationBanner';
import { InstallPWAButton } from '../common/InstallPWAButton';
import { StoreOperationalBanner } from '../banner/StoreOperationalBanner';
import { SafeImage } from '../common/SafeImage';
import { 
  LogOut, ShoppingBag, MessageSquare, Clock, CheckCircle2, AlertCircle, 
  Send, Plus, Gamepad2, ArrowRight, Copy, Check, ShoppingCart, Trash2,
  QrCode, CreditCard, Upload, Eye, X, RefreshCw, FileText, Paperclip, Video, Image, Bell, User,
  Star, ThumbsUp, ShieldCheck, Flame, Zap, Headphones, Sparkles, Home as HomeIcon, LogIn,
  UserPlus, Settings, ChevronDown, Coins, Mail, Camera, Trophy, Search, ChevronRight, Phone
} from 'lucide-react';
import { compressImage, compressVideo } from '../../lib/mediaUtils';
import { CustomerChat } from './CustomerChat';
import { Catalog } from './Catalog';
import { ReviewsSection } from './ReviewsSection';
import { LeaderboardSection } from './LeaderboardSection';
import { CustomerSettings } from './CustomerSettings';
import { CustomerOrders } from './CustomerOrders';
import { OrderDetail } from './OrderDetail';
import { optimizeGoogleAvatarUrl, handleUploadAvatar } from '../../utils/avatarUtils';
import { CheckoutModal } from '../checkout/CheckoutModal';
import { GiftOrderFormModal } from '../checkout/GiftOrderFormModal';
import { GiftDeliveryModal } from '../orders/GiftDeliveryModal';
import { AuthModal } from '../auth/AuthModal';
import { RulesAgreementModal } from '../common/RulesAgreementModal';
import { TongCoinsPage } from './TongCoinsPage';
import { isGiftClosedTime, isProductGift, GIFT_OPERATIONAL_HOURS, checkIsGamepassOpen, isProductGamepass } from '../../lib/operatingHours';
import { getGiftOperatingStatus } from '../../utils/giftTimeHelper';
import { safeGetJSON } from '../../utils/safeStorage';
import { getCachedCatalogs, setCachedCatalogs, getCachedPopularProducts, setCachedPopularProducts, extractPopularProductsFromCatalogs } from '../../utils/productCache';
import { isFictionalOrTemplateReview } from '../../utils/reviewUtils';
import { normalizePhone, normalizePhoneVariants, syncGuestOrdersToUser } from '../../utils/phoneUtils';
import { CustomerNotifications } from './CustomerNotifications';
import { validateOrderEligibility } from '../../services/orderService';
import { RobloxProfile } from '../../lib/roblox';


const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const CustomerPortal: React.FC<{ standaloneCategory?: string }> = ({ standaloneCategory }) => {
  const { 
    currentUser, setCurrentUser, logout, orders, items, createOrder, chats, activeMessages, selectedChatId, setSelectedChatId, sendMessage, markChatAsRead,
    customerMainRoomId,
    adminStatus, qrisImageUrl, danaNumber, danaName, storeAvatarUrl,
    isUserMuted, getMuteRemainingSeconds, muteUser,
    isStoreClosed, storeClosedNoticeText, storeOpenHour, storeCloseHour
 , adminWhatsappNumber } = useApp();
  
  
  
  const [gameUsername, setGameUsername] = useState('');
  const [gamePassword, setGamePassword] = useState('');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || currentUser?.whatsappNumber || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');
  const [initialGameMoney, setInitialGameMoney] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [copiedDana, setCopiedDana] = useState(false);
  const [viewingProofOrder, setViewingProofOrder] = useState<any>(null);
  const [showQrisExpand, setShowQrisExpand] = useState(false);
  const [expandedMediaUrl, setExpandedMediaUrl] = useState<string | null>(null);
  const [giftOrderForRequestModal, setGiftOrderForRequestModal] = useState<any>(null);

  // Sync phone from currentUser if updated
  useEffect(() => {
    if (currentUser?.phone || currentUser?.whatsappNumber) {
      setCustomerPhone(prev => prev || currentUser.phone || currentUser.whatsappNumber || '');
    }
  }, [currentUser?.phone, currentUser?.whatsappNumber]);

  // ðŸ¤– Chatbot Auto-Popup: Muncul otomatis 1x sehari per user/browser, tombol manual tetap aktif selalu
  useEffect(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const lastShownDate = localStorage.getItem('entong_daily_chat_popup_date');

      if (lastShownDate !== todayStr) {
        const timer = setTimeout(() => {
          setIsChatPopupOpen(true);
          localStorage.setItem('entong_daily_chat_popup_date', todayStr);
        }, 1200);

        return () => clearTimeout(timer);
      }
    } catch (_) {}
  }, []);

  const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'chat' | 'catalog' | 'tracking' | 'testimoni' | 'leaderboard' | 'settings' | 'tongcoins'>('home');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);
  const [prefilledChatMessage, setPrefilledChatMessage] = useState<string>('');
  const [targetOrderIdForChat, setTargetOrderIdForChat] = useState<string>('');
  const [activeOrderForChat, setActiveOrderForChat] = useState<any>(null);

  // ðŸ’¬ Handle auto-paste chat confirmation to admin
  const handleChatAdminConfirmation = async (order: any) => {
    if (!order) return;
    const docId = order.docUniqueId || order.firestoreId || order.id || order.orderId;
    const rawOrderId = order.orderId || (order.id?.startsWith('ORD-') ? order.id : `#${(order.id || 'ORDER').substring(0, 10).toUpperCase()}`);
    const cleanOrderId = rawOrderId.replace(/^#/, '');
    const productName = order.package_name || order.packageName || order.itemGift || order.game_name || order.gameName || 'Produk';
    const confirmationText = `Halo min, mau konfirmasi pesanan #${cleanOrderId} (${productName})`;
    
    // 1. Save to localStorage
    try {
      const confirmedOrders = JSON.parse(localStorage.getItem('confirmed_chat_orders') || '[]');
      const idsToAdd = [docId, order.id, order.orderId, cleanOrderId].filter(Boolean);
      let changed = false;
      idsToAdd.forEach(id => {
        if (id && !confirmedOrders.includes(id)) {
          confirmedOrders.push(id);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('confirmed_chat_orders', JSON.stringify(confirmedOrders));
      }
    } catch (_) {}

    // 2. Update Firestore document flag
    if (docId) {
      try {
        const orderRef = doc(db, 'orders', docId);
        await updateDoc(orderRef, {
          isChatConfirmed: true,
          chatConfirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Gagal update flag konfirmasi chat di Firestore:", err);
      }
    }

    // 3. Optimistic local state update
    setSelectedOrderDetail((prev: any) => {
      if (!prev) return prev;
      return { ...prev, isChatConfirmed: true };
    });

    setPrefilledChatMessage(confirmationText);
    setTargetOrderIdForChat(cleanOrderId);
    setActiveOrderForChat(order);
    setIsChatPopupOpen(true);
  };

  // ðŸ”„ REALTIME LISTENER FOR SELECTED ORDER DETAIL MODAL
  useEffect(() => {
    if (!selectedOrderDetail) return;
    const targetDocId = selectedOrderDetail.docUniqueId || selectedOrderDetail.firestoreId || selectedOrderDetail.id;
    if (!targetDocId) return;

    const unsub = onSnapshot(doc(db, 'orders', targetDocId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSelectedOrderDetail((prev: any) => {
          if (!prev) return null;
          return {
            ...prev,
            ...data,
            id: docSnap.id,
            docUniqueId: docSnap.id,
            status: data.status || data.orderStatus || prev.status,
            orderStatus: data.orderStatus || data.status || prev.orderStatus
          };
        });
      }
    }, (err) => {
      console.warn("Realtime order detail listener notice:", err);
    });

  
    return () => unsub();
  }, [selectedOrderDetail?.id, selectedOrderDetail?.docUniqueId]);
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // ðŸ“¦ TRACKING / CEK PESANAN STATES
  const [trackingLookupMode, setTrackingLookupMode] = useState<'USER_DATA' | 'INVOICE'>('USER_DATA');
  const [trackingSearchInput, setTrackingSearchInput] = useState('');
  const [isSearchingTracking, setIsSearchingTracking] = useState(false);
  const [trackingResults, setTrackingResults] = useState<any[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  const handleSearchTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError('');
    setTrackingResults(null);
    setHasSearched(true);

    const q = trackingSearchInput.trim();
    if (!q) {
      setTrackingError(
        trackingLookupMode === 'INVOICE'
          ? 'Silakan masukkan nomor invoice / ID pesanan.'
          : 'Silakan masukkan Username Roblox atau Nomor WhatsApp Anda.'
      );
      return;
    }

    setIsSearchingTracking(true);
    try {
      const ordersRef = collection(db, 'orders');

      // Ambil semua orders (limit 500 cukup untuk usage normal)
      const snap = await getDocs(query(ordersRef, limit(500)));
      const allOrders: any[] = snap.docs.map(d => {
        const data = d.data() || {};
        return { ...data, id: d.id, docUniqueId: d.id, firestoreId: d.id, orderId: (data as any).orderId || d.id };
      });

      let matches: any[] = [];

      if (trackingLookupMode === 'INVOICE') {
        const cleanTarget = q.toLowerCase().replace(/^#/, '').trim();
        matches = allOrders.filter(ord => {
          const ordId = (ord.orderId || ord.id || '').toLowerCase().replace(/^#/, '');
          const dispId = (ord.displayOrderId || '').toLowerCase().replace(/^#/, '');
          return ordId === cleanTarget || ordId.includes(cleanTarget) || dispId.includes(cleanTarget);
        });
      } else {
        // Username Roblox: case-insensitive exact match
        // Phone: digit-only match
        const cleanTarget = q.toLowerCase().replace(/^@/, '').trim();
        const inputPhone = q.replace(/\D/g, '');

        matches = allOrders.filter(ord => {
          // Cek semua field variant username Roblox
          const rUser = (
            ord.robloxUsername ||
            ord.roblox_username ||
            ord.game_username ||
            ord.targetUsername ||
            ord.assignedGameUsername ||
            ''
          ).toLowerCase().trim();

          // Username: exact match case-insensitive
          if (cleanTarget.length >= 3 && rUser && rUser === cleanTarget) return true;

          // Phone: digit match
          if (inputPhone.length >= 8) {
            const phone = (
              ord.whatsapp ||
              ord.phone ||
              ord.customer_phone ||
              ord.customerPhone ||
              ord.whatsappNumber ||
              ''
            ).replace(/\D/g, '');
            if (phone && (phone === inputPhone || phone.endsWith(inputPhone) || inputPhone.endsWith(phone))) return true;
          }

          return false;
        });
      }

      // Juga cek dari local myOrders (user login)
      let localMatches: any[] = [];
      if (trackingLookupMode === 'INVOICE') {
        const cleanTarget = q.toLowerCase().replace(/^#/, '').trim();
        localMatches = myOrders.filter(ord => {
          const ordId = (ord.orderId || ord.id || '').toLowerCase().replace(/^#/, '');
          return ordId === cleanTarget || ordId.includes(cleanTarget);
        });
      } else {
        const cleanTarget = q.toLowerCase().replace(/^@/, '').trim();
        const inputPhone = q.replace(/\D/g, '');
        localMatches = myOrders.filter(ord => {
          const rUser = (ord.robloxUsername || (ord as any).roblox_username || (ord as any).game_username || '').toLowerCase().trim();
          if (cleanTarget.length >= 3 && rUser && rUser === cleanTarget) return true;
          if (inputPhone.length >= 8) {
            const phone = ((ord as any).whatsapp || (ord as any).phone || (ord as any).customer_phone || '').replace(/\D/g, '');
            if (phone && (phone === inputPhone || phone.endsWith(inputPhone))) return true;
          }
          return false;
        });
      }

      // Gabung + deduplikasi
      const combinedMap = new Map<string, any>();
      [...localMatches, ...matches].forEach(item => {
        if (item && item.id) combinedMap.set(item.id, item);
      });
      const combined = Array.from(combinedMap.values());

      if (combined.length === 0) {
        setTrackingError('Pesanan tidak ditemukan. Pastikan data yang dimasukkan sudah benar.');
      } else {
        setTrackingResults(combined);
      }
    } catch (err: any) {
      console.error("Gagal melacak pesanan:", err);
      setTrackingError(err?.message || 'Gagal melacak pesanan. Silakan periksa koneksi internet Anda.');
    } finally {
      setIsSearchingTracking(false);
    }
  };

  // Sync Unread Notifications Count for Customer
  useEffect(() => {
    if (!currentUser?.id) {
      setUnreadNotifCount(0);
      return;
    }

    const notifCol = collection(db, 'notifications');
    const qUnread = query(
      notifCol,
      where('userId', '==', currentUser.id),
      where('isRead', '==', false),
      limit(20)
    );

    const unsub = onSnapshot(qUnread, (snap) => {
      setUnreadNotifCount(snap.docs.length);
    }, () => {
      // Fallback
      setUnreadNotifCount(0);
    });

  
    return () => unsub();
  }, [currentUser?.id]);

  // Auto-sync any guest/POS orders with matching WhatsApp phone to this customer account
  useEffect(() => {
    if (currentUser && !currentUser.isGuest && currentUser.role === 'CUSTOMER') {
      const userUid = currentUser.id || currentUser.uid;
      const userPhone = currentUser.phone || currentUser.whatsappNumber || (currentUser as any).whatsapp;
      if (userUid && userPhone) {
        syncGuestOrdersToUser(userUid, userPhone).catch(e => {
          console.warn('Background auto-sync guest orders notice:', e);
        });
      }
    }
  }, [currentUser?.id, currentUser?.uid, currentUser?.phone, currentUser?.whatsappNumber]);

  // ðŸŒ ROUTING URL SYNC (/ -> Home, /katalog -> Katalog, /settings -> Pengaturan, /pesanan -> Pesanan, /profil -> Profil)
  useEffect(() => {
    const handleRouteChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      if (path.includes('/katalog') || hash.includes('katalog') || hash.includes('produk')) {
        setActiveTab('catalog');
      } else if (path.includes('/chat') || hash.includes('chat')) {
        setIsChatPopupOpen(true);
      } else if (path.includes('/testimoni') || path.includes('/review') || hash.includes('testimoni') || hash.includes('review')) {
        setActiveTab('testimoni');
      } else if (path.includes('/pesanan') || hash.includes('pesanan') || hash.includes('tracking')) {
        setActiveTab('tracking');
      } else if (path.includes('/settings') || path.includes('/pengaturan') || hash.includes('settings') || hash.includes('pengaturan')) {
        setActiveTab('settings');
      } else if (path.includes('/profil') || hash.includes('profil') || hash.includes('profile')) {
        setActiveTab('profile');
      } else if (path.includes('/leaderboard') || hash.includes('leaderboard')) {
        setActiveTab('leaderboard');
      } else {
        setActiveTab('home');
      }
    };

    handleRouteChange();
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
  
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  // Update URL pathname/hash gracefully on tab change
  const navigateTab = (tab: 'home' | 'profile' | 'chat' | 'catalog' | 'tracking' | 'testimoni' | 'leaderboard' | 'settings') => {
    if (tab === 'chat') {
      setIsChatPopupOpen(true);
      return;
    }
    setActiveTab(tab);
    let targetPath = '/';
    if (tab === 'catalog') targetPath = '/katalog';
    else if (tab === 'testimoni') targetPath = '/review';
    else if (tab === 'tracking') targetPath = '/pesanan';
    else if (tab === 'profile') targetPath = '/profil';
    else if (tab === 'leaderboard') targetPath = '/leaderboard';
    else if (tab === 'settings') targetPath = '/settings';

    try {
      window.history.pushState({ tab }, '', targetPath);
    } catch {}
  };

  const handleCopyOrderId = (orderIdText: string) => {
    if (!orderIdText) return;
    try {
      navigator.clipboard.writeText(orderIdText);
      setCopiedOrderId(orderIdText);
      setTimeout(() => {
        setCopiedOrderId(null);
      }, 2000);
    } catch {
      setCopiedOrderId(orderIdText);
      setTimeout(() => {
        setCopiedOrderId(null);
      }, 2000);
    }
  };

  // Helper untuk membuka Chat Admin Popup (Floating di Desktop, Fullscreen di Mobile)
  const openChatAdmin = () => {
    // Langsung buka chat popup tanpa auth check
    // Guest form akan muncul di dalam CustomerChat component
    setIsChatPopupOpen(true);
  };

  const [homeCatalogs, setHomeCatalogs] = useState<any[]>(() => getCachedCatalogs());
  const [products, setProducts] = useState<any[]>(() => getCachedPopularProducts());
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(() => getCachedPopularProducts().length === 0);
  const [selectedCatalogIdForView, setSelectedCatalogIdForView] = useState<string | null>(null);
  const [homeCategoryFilter, setHomeCategoryFilter] = useState<'all' | 'gift' | 'joko'>('all');

  // Handle click outside for User Profile Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
  
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ðŸ›¡ï¸ AUTH GUARD SENTRAL: Mencegat user yang belum login saat mencoba Beli, Chat, Top Up, atau Pesanan
  const handleProtectedAction = (actionCallback: () => void) => {
    if (!currentUser) {
      alert("Silakan login atau daftar terlebih dahulu untuk melanjutkan.");
      setShowAuthModal(true);
      return;
    }
    actionCallback();
  };

  // Helper untuk memilih produk dari section Produk & Layanan Terpopuler dan membuka tab Katalog secara otomatis
  const handleSelectProductFromHome = (product: any) => {
    setSelectedCatalogIdForView(product.catalogId || product.id);
    window.location.href = '/gpdragdrivesim';
  };

  // ðŸš€ ISOLATED & FAST: Realtime Catalogs & Products query with SWR (Stale-While-Revalidate) & 300ms Timeout Guard
  useEffect(() => {
    // 300ms Safety Timeout fallback to prevent infinite skeleton hang (cache sudah dirender seketika)
    const safetyTimer = setTimeout(() => {
      setIsProductsLoading(false);
    }, 300);

    const unsubscribe = onSnapshot(query(collection(db, 'catalogs'), limit(60)), (snapshot) => {
      clearTimeout(safetyTimer);
      if (!snapshot.empty) {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        setHomeCatalogs(fetched);
        setCachedCatalogs(fetched);

        // Ekstraksi produk dari Firestore catalogs & pricelists
        const extractedList = extractPopularProductsFromCatalogs(fetched);
        if (extractedList.length > 0) {
          setProducts(extractedList);
          setCachedPopularProducts(extractedList); // persist to cache for instant next load
        }
      }
      setIsProductsLoading(false);
    }, (err) => {
      clearTimeout(safetyTimer);
      console.warn("Home catalogs background sync notice:", err);
      setIsProductsLoading(false);
    });


    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // Top Products Filtered & Sorted for Home Landing Section
  const filteredTopProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    const list = products.filter(item => {
      if (homeCategoryFilter === 'all') return true;
      if (homeCategoryFilter === 'gift') {
        const cat = (item.category || '').toLowerCase();
        const rawCat = (item.rawGame?.category || '').toLowerCase();
        return cat === 'gift' || cat === 'roblox' || rawCat.includes('roblox') || rawCat.includes('gift') || (!cat.includes('joki') && !cat.includes('joko') && !cat.includes('jasa'));
      }
      if (homeCategoryFilter === 'joko') {
        const cat = (item.category || '').toLowerCase();
        const rawCat = (item.rawGame?.category || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const game = (item.game || '').toLowerCase();
        return cat === 'joko' || cat === 'joki' || cat === 'jasa' || rawCat.includes('joko') || rawCat.includes('joki') || rawCat.includes('jasa') || title.includes('joko') || title.includes('joki') || game.includes('joko') || game.includes('joki');
      }
      return true;
    });

    // Urutkan berdasarkan total penjualan/terpopuler secara menurun (descending)
    const sorted = [...list].sort((a, b) => (b.sold || 0) - (a.sold || 0));
    // Show up to 10 products on home page
    return sorted.slice(0, 10);
  }, [products, homeCategoryFilter]);

  // 1. STATISTIK TOKO ASYNC LAZY STATE (NON-BLOCKING)
  const [totalOrders, setTotalOrders] = useState<number>(6427);
  const [totalReviews, setTotalReviews] = useState<number>(1141);
  const [rating, setRating] = useState<number>(5.0);

  // Realtime listener for total reviews - use count query to avoid downloading all docs
  useEffect(() => {
    const reviewsRef = collection(db, 'reviews');
    // Use getCountFromServer once on mount (fast, no document download)
    getCountFromServer(reviewsRef).then(snap => {
      setTotalReviews(Math.max(1141, snap.data().count));
    }).catch(() => {
      // Fallback: silent fail, keep default value
    });
    // No realtime listener needed for a counter — revalidate every 5 minutes
    const interval = setInterval(() => {
      getCountFromServer(reviewsRef).then(snap => {
        setTotalReviews(Math.max(1141, snap.data().count));
      }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. ASYNC LAZY "TRANSAKSI SUKSES TERBARU" (LIMIT 20, NON-BLOCKING)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let isMounted = true;

    // 1.2s safety to avoid blocking first paint on cold cache
    const slowTimer = setTimeout(() => {
      if (!isMounted) return;
      setRecentTransactions((prev) => prev);
    }, 1200);

    const ordersRef = collection(db, 'orders');
    const qRecent = query(ordersRef, orderBy('createdAt', 'desc'), limit(20));
    
    const unsubRecent = onSnapshot(qRecent, (snapshot) => {
      if (!isMounted) return;
      if (!snapshot.empty) {
        const rawDocs = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        const validOrders = rawDocs.filter((order: any) => {
          const pStatus = (order.paymentStatus || order.payment_status || '').toUpperCase();
          const oStatus = (order.status || order.orderStatus || '').toLowerCase();
  
          return (
            pStatus === 'LUNAS' ||
            pStatus === 'PAID' ||
            pStatus === 'SUCCESS' ||
            pStatus === 'SETTLEMENT' ||
            pStatus === 'VERIFIED' ||
            oStatus === 'booking' ||
            oStatus === 'proses' ||
            oStatus === 'ready' ||
            oStatus === 'selesai' ||
            oStatus === 'completed' ||
            oStatus === 'success'
          );
        });

        const uniqueOrders = Array.from(
          new Map(validOrders.map((item: any) => [item.id || item.orderId || item.docUniqueId, item])).values()
        );

        setRecentTransactions(uniqueOrders);
      } else {
        setRecentTransactions([]);
      }
    }, (err) => {
      console.warn("Async recent transactions fallback:", err);
      if (isMounted) {
        // Fallback if index missing
        const qSimple = query(ordersRef, limit(25));
        const unsubSimple = onSnapshot(qSimple, (simpleSnap) => {
          if (!isMounted) return;
          const rawDocs = simpleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const validOrders = rawDocs.filter((order: any) => {
            const pStatus = (order.paymentStatus || order.payment_status || '').toUpperCase();
            const oStatus = (order.status || order.orderStatus || '').toLowerCase();
  
            return (
              pStatus === 'LUNAS' ||
              pStatus === 'PAID' ||
              pStatus === 'SUCCESS' ||
              pStatus === 'SETTLEMENT' ||
              pStatus === 'VERIFIED' ||
              oStatus === 'booking' ||
              oStatus === 'proses' ||
              oStatus === 'ready' ||
              oStatus === 'selesai' ||
              oStatus === 'completed' ||
              oStatus === 'success'
            );
          });
          const uniqueOrders = Array.from(
            new Map(validOrders.map((item: any) => [item.id || item.orderId || item.docUniqueId, item])).values()
          );
          setRecentTransactions(uniqueOrders);
        });
        unsubs.push(unsubSimple);
      }
    });
    
    unsubs.push(unsubRecent);


    return () => {
      isMounted = false;
      clearTimeout(slowTimer);
      unsubs.forEach(u => u());
    };
  }, []);

  const maskCustomerName = (name: string): string => {
    if (!name || name.trim() === '') return 'Pelanggan';
    const clean = name.trim();
    if (clean.length <= 2) return `${clean.charAt(0)}***`;
    const first = clean.charAt(0);
    const last = clean.charAt(clean.length - 1);
    const middle = '*'.repeat(Math.min(clean.length - 2, 3));
    return `${first}${middle}${last}`;
  };
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [pendingBuyItem, setPendingBuyItem] = useState<any | null>(null);
  const [isCartCheckout, setIsCartCheckout] = useState(false);
  const [giftFormItem, setGiftFormItem] = useState<any | null>(null);

  const handleRequestCheckout = (fromCart: boolean = true) => {
    const hasJokiService = cart.some(c => {
      const item: any = c.item;
      const cat = (item.category || item.rawGame?.category || '').toLowerCase();
      const game = (item.game_name || item.game || item.title || '').toLowerCase();
      const pkg = (item.package_name || item.name || '').toLowerCase();
      return cat.includes('joko') || cat.includes('joki') || cat.includes('jasa') ||
             game.includes('joko') || game.includes('joki') ||
             pkg.includes('joko') || pkg.includes('joki') || item.isJoki;
    });

    const proceed = () => {
      const hasGamepass = cart.some(c => isProductGamepass(c.item));
      if (hasGamepass && !checkIsGamepassOpen()) {
        const proceedGp = window.confirm("Layanan Gamepass saat ini sedang tutup. Pesanan Gamepass Anda baru akan diproses oleh admin pada jam operasional (13.00 - 20.45 WIB). Apakah Anda ingin tetap melanjutkan pembayaran sekarang (Pre-order)?");
        if (!proceedGp) return;
      }

      setIsCartCheckout(fromCart);
      setPendingBuyItem(null);
      if (hasJokiService) {
        setShowRulesModal(true);
      } else {
        setShowCheckoutModal(true);
      }
    };

    if (hasJokiService) {
      handleProtectedAction(proceed);
    } else {
      proceed();
    }
  };

  const handleBuyNowItem = (item: any) => {
    const anyItem: any = item;
    const cat = (anyItem.category || anyItem.rawGame?.category || '').toLowerCase();
    const game = (anyItem.game_name || anyItem.game || anyItem.title || '').toLowerCase();
    const pkg = (anyItem.package_name || anyItem.name || '').toLowerCase();
    const isJokiItem = cat.includes('joko') || cat.includes('joki') || cat.includes('jasa') ||
                       game.includes('joko') || game.includes('joki') ||
                       pkg.includes('joko') || pkg.includes('joki') || anyItem.isJoki;

    if (!isJokiItem) {
      // Gift In Game -> tampilkan Form Roblox dulu (lengkap checker + avatar), setelah valid baru buka Checkout/Payment
      const isGamepass = isProductGamepass(anyItem);
      if (isGamepass && !checkIsGamepassOpen()) {
        const proceedGp = window.confirm("Layanan Gamepass saat ini sedang tutup. Pesanan Gamepass Anda baru akan diproses oleh admin pada jam operasional (13.00 - 20.45 WIB). Apakah Anda ingin tetap melanjutkan pembayaran sekarang (Pre-order)?");
        if (!proceedGp) return;
      }
      setPendingBuyItem(anyItem);
      setIsCartCheckout(false);
      setShowRulesModal(false);
      setGiftFormItem(anyItem);
      return;
    }

    const proceed = () => {
      setIsCartCheckout(false);
      setPendingBuyItem(anyItem);
      setShowRulesModal(true);
    };

    handleProtectedAction(proceed);
  };

  const handleGiftFormConfirm = (params: { robloxUsername: string; robloxProfile: RobloxProfile | null; customerPhone?: string }) => {
    const sourceItem = giftFormItem || pendingBuyItem;
    if (!sourceItem) return;
    const enrichedItem = {
      ...sourceItem,
      robloxUsername: params.robloxUsername,
      robloxProfile: params.robloxProfile,
    };
    setGiftFormItem(null);
    setPendingBuyItem(enrichedItem);
    addToCart(enrichedItem);
    if (params.customerPhone) {
      setCustomerPhone(params.customerPhone);
    }
    setShowCheckoutModal(true);
  };

  const handleAgreeRules = () => {
    setShowRulesModal(false);
    if (pendingBuyItem) {
      addToCart(pendingBuyItem);
      setPendingBuyItem(null);
    }
    setShowCheckoutModal(true);
  };
  const [msgInput, setMsgInput] = useState('');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrderDocId, setActiveOrderDocId] = useState<string>('');
  const [orderSuccessNotice, setOrderSuccessNotice] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [announcementText, setAnnouncementText] = useState<string>('');

  const [unverifiedCountState, setUnverifiedCountState] = useState<number>(0);
  const [profilePendingCount, setProfilePendingCount] = useState<number>(0);

  useEffect(() => {
    const activeUser = currentUser || safeGetJSON<any>('entong_active_user', {});
    const currentUid = activeUser?.id || activeUser?.uid || currentUser?.id || currentUser?.uid;
    const userEmail = activeUser?.email || currentUser?.email;
    const userPhone = activeUser?.phone || (activeUser as any)?.whatsapp || currentUser?.phone || (currentUser as any)?.whatsapp;

    if (!currentUid && !userEmail && !userPhone) {
      setProfilePendingCount(0);
      return;
    }

    // Hitung secara presisi hanya yang BELUM DIVERIFIKASI dari orders context
    const unverifiedTotal = (orders || []).filter((ord: any) => {
      const matchUid = currentUid && (
        ord.userId === currentUid || 
        ord.customerUid === currentUid || 
        ord.userUid === currentUid || 
        ord.customerId === currentUid || 
        ord.customer_id === currentUid || 
        ord.id === currentUid ||
        ord.uid === currentUid
      );
      const matchEmail = userEmail && (ord.email === userEmail || ord.customerEmail === userEmail || ord.customer_email === userEmail);
      const matchPhone = userPhone && (ord.customer_phone === userPhone || ord.customerPhone === userPhone || ord.whatsapp === userPhone || ord.phone === userPhone);
      
      const isMatched = matchUid || matchEmail || matchPhone;
      const isPending = ord.status === 'PENDING_VERIFICATION' || ord.paymentStatus === 'UNVERIFIED' || ord.paymentStatus === 'PENDING_VERIFICATION';
      return isMatched && isPending;
    }).length;

    setProfilePendingCount(unverifiedTotal);
  }, [orders, currentUser]);

  // ðŸ›¡ï¸ DEDUPLICATION HELPER BERDASARKAN ID DOKUMEN / ORDER ID
  const removeDuplicateOrders = (rawOrdersList: any[]) => {
    const uniqueOrdersMap = new Map<string, any>();
    const seenIds = new Set<string>();

    rawOrdersList.forEach((ord: any) => {
      if (!ord) return;
      const idKey = ord.docUniqueId || ord.firestoreId || ord.id || ord.orderId;
      if (idKey && seenIds.has(idKey)) {
        // Jika sudah ada dengan id sama, ambil yang memiliki bukti atau waktu lebih baru
        const existing = uniqueOrdersMap.get(idKey);
        if (existing) {
          const ordProof = ord.proofUrl || ord.payment_proof || ord.proofOfPayment;
          const existProof = existing.proofUrl || existing.payment_proof || existing.proofOfPayment;
          if (ordProof && !existProof) {
            uniqueOrdersMap.set(idKey, ord);
          }
        }
        return;
      }
      if (idKey) {
        seenIds.add(idKey);
        uniqueOrdersMap.set(idKey, ord);
      } else {
        uniqueOrdersMap.set(`ord_anon_${Math.random()}`, ord);
      }
    });

    return Array.from(uniqueOrdersMap.values());
  };

  const handleUploadPaymentProof = async (uploadedImageUrl: string, fallbackOrderDocId?: string) => {
    if (!uploadedImageUrl) return;

    try {
      const { doc, getDoc, updateDoc, addDoc, collection } = await import('firebase/firestore');
      
      const activeUser = currentUser || safeGetJSON<any>('entong_active_user', {});
      const activeCustomerId = activeUser?.id || activeUser?.uid || currentUser?.id;
      const currentRoomId = activeCustomerId ? `room_${activeCustomerId}` : '';

      let targetOrderDocId = fallbackOrderDocId || '';
      let displayOrderId = '';

      // 1. TARIK DATA RUANGAN SAAT INI UNTUK MENCARI JEJAK ID ORDER
      if (currentRoomId) {
        try {
          const roomRef = doc(db, 'rooms', currentRoomId);
          const roomSnap = await getDoc(roomRef);
          if (roomSnap.exists()) {
            const roomData = roomSnap.data();
            if (roomData?.activeOrderDocId) {
              targetOrderDocId = roomData.activeOrderDocId;
            }
            if (roomData?.activeDisplayOrderId) {
              displayOrderId = roomData.activeDisplayOrderId;
            }
          }
        } catch (e) {
          console.warn("Could not read roomDoc:", e);
        }

        // Cek juga ke collection 'chats' jika belum dapat
        if (!targetOrderDocId) {
          try {
            const chatSnap = await getDoc(doc(db, 'chats', currentRoomId));
            if (chatSnap.exists()) {
              const chatData = chatSnap.data();
              if (chatData?.activeOrderDocId) targetOrderDocId = chatData.activeOrderDocId;
              if (chatData?.activeDisplayOrderId) displayOrderId = chatData.activeDisplayOrderId;
            }
          } catch (_) {}
        }
      }

      if (!targetOrderDocId && activeOrderDocId) {
        targetOrderDocId = activeOrderDocId;
      }

      if (!targetOrderDocId) {
        alert("Sistem kehilangan jejak pesanan Anda. Silakan hubungi admin.");
        return;
      }

      // 2. ðŸš¨ FORCED UPDATE MUTLAK PADA DOKUMEN YANG SUDAH ADA (ANTI-DOBEL)
      const orderRef = doc(db, 'orders', targetOrderDocId);
      await updateDoc(orderRef, {
        proofUrl: uploadedImageUrl,
        payment_proof: uploadedImageUrl,
        proofOfPayment: uploadedImageUrl,
        hasProof: true,
        paymentStatus: 'PENDING_VERIFICATION',
        proofUploadedAt: Date.now()
        // ðŸ›‘ Dilarang menyisipkan `createdAt` atau `orderTimestamp` baru di sini!
      });

      // 3. Kirim notifikasi bukti ke chat
      if (currentRoomId) {
        const notifText = `[Memperbarui Pesanan #${displayOrderId || targetOrderDocId}] - Bukti pembayaran telah diunggah.`;
        try {
          await addDoc(collection(db, 'rooms', currentRoomId, 'messages'), {
            senderRole: 'customer',
            sender_role: 'customer',
            senderUid: currentUser?.id || activeCustomerId,
            sender_id: currentUser?.id || activeCustomerId,
            senderName: activeUser?.name || 'Customer',
            sender_name: activeUser?.name || 'Customer',
            text: notifText,
            message: notifText,
            imageUrl: uploadedImageUrl,
            media_url: uploadedImageUrl,
            media_type: 'IMAGE',
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
            created: new Date().toISOString()
          });
        } catch (_) {}

        try {
          await addDoc(collection(db, 'chats', currentRoomId, 'messages'), {
            senderRole: 'customer',
            sender_role: 'customer',
            senderUid: currentUser?.id || activeCustomerId,
            sender_id: currentUser?.id || activeCustomerId,
            senderName: activeUser?.name || 'Customer',
            sender_name: activeUser?.name || 'Customer',
            text: notifText,
            message: notifText,
            imageUrl: uploadedImageUrl,
            media_url: uploadedImageUrl,
            media_type: 'IMAGE',
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
            created: new Date().toISOString()
          });
        } catch (_) {}
      }

      alert("Bukti berhasil diunggah dan disatukan ke pesanan Anda!");
    } catch (error: any) {
      console.error("Gagal upload bukti:", error);
      alert(`Terjadi kesalahan: ${error?.message || error}`);
    }
  };

  // ðŸ“¢ Real-time Announcement Listener from Firestore
  useEffect(() => {
    const unsubAnn = onSnapshot(doc(db, 'settings', 'announcement'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Jika dokumen ada tetapi field text/announcement dikosongkan/tidak ada, set empty string agar banner otomatis tersembunyi
        setAnnouncementText(data.text || data.announcement || data.message || data.content || '');
      } else {
        setAnnouncementText('');
      }
    });
  
    return () => unsubAnn();
  }, []);

  // Auto-populate gameUsername with verified Roblox username from cart upon opening checkout
  useEffect(() => {
    if (showCheckoutModal && cart.length > 0) {
      const primaryItem = cart.find(c => c.item.robloxUsername);
      if (primaryItem) {
        setGameUsername(primaryItem.item.robloxUsername || '');
      } else {
        setGameUsername('');
      }
    }
  }, [showCheckoutModal, cart]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef<boolean>(false);

  // States for submitting a review
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<GameOrder | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewOrder || !currentUser) return;
    if (!reviewComment.trim()) {
      alert("Silakan masukkan komentar ulasan Anda!");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { collection, addDoc, doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

      // Sensor nama otomatis: Sandi -> S***i
      const censorName = (name: string): string => {
        if (!name) return 'Pelanggan';
        const trimmed = name.trim();
        if (trimmed.length <= 2) {
          return trimmed[0] + '*';
        }
        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];
        const starsCount = Math.max(3, trimmed.length - 2);
        const stars = '*'.repeat(starsCount);
        return first + stars + last;
      };

      const censored = censorName(currentUser.name);

      const newReview = {
        userId: currentUser.id,
        userName: censored,
        customerName: censored,
        rating: reviewRating,
        comment: reviewComment.trim(),
        productName: reviewOrder.package_name,
        gameTitle: reviewOrder.game_name,
        gameName: reviewOrder.game_name,
        catalogId: reviewOrder.catalogId || '',
        createdAt: new Date().toISOString(),
        helpfulCount: 0
      };

      await addDoc(collection(db, 'reviews'), newReview);

      if (reviewOrder.id) {
        try {
          await updateDoc(doc(db, 'orders', reviewOrder.id), { hasReviewed: true, reviewedAt: serverTimestamp() }).catch(() => {});
          await updateDoc(doc(db, 'chats', `room_${reviewOrder.id}`), { hasReviewed: true, reviewedAt: serverTimestamp() }).catch(() => {});
        } catch (err) {
          console.error("Error updating review flag in order/chat:", err);
        }
      }
      
      setShowReviewModal(false);
      setShowThankYouModal(true);
      setReviewOrder(null);
      setReviewComment('');
      setReviewRating(5);
    } catch (err: any) {
      console.error("Gagal mengirim ulasan:", err);
      alert(`Gagal mengirim ulasan: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  
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
    if (activeTab === 'chat') scrollToBottom();
  }, [activeTab, activeMessages]);

  useEffect(() => {
    if (customerMainRoomId) {
      setSelectedChatId(customerMainRoomId);
    } else {
      setSelectedChatId(null);
    }
  }, [customerMainRoomId, setSelectedChatId]);

  // ðŸ›¡ï¸ DEDICATED REALTIME ORDER LISTENER FOR CURRENT CUSTOMER (MULTI-IDENTIFIER)
  const [directCustomerOrders, setDirectCustomerOrders] = useState<any[]>([]);

  useEffect(() => {
    const activeUser = currentUser || safeGetJSON<any>('entong_active_user', null);
    if (!activeUser) {
      setDirectCustomerOrders([]);
      return;
    }

    const rawPhone = activeUser.whatsapp || activeUser.whatsappNumber || activeUser.phone || activeUser.customerPhone || '';
    const cleanPhone = normalizePhone(rawPhone);
    const userPhoneVariants = normalizePhoneVariants(rawPhone);
    const userUid = activeUser.id || activeUser.uid;
    const userEmail = (activeUser.email || '').trim().toLowerCase();
    const userUsername = (activeUser.username || activeUser.name || '').trim().toLowerCase();
    const userRoblox = (activeUser.robloxUsername || activeUser.roblox_username || '').trim().toLowerCase();

    const ordersRef = collection(db, "orders");
    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
      const allFetched = snapshot.docs.map(docSnap => {
        const data = docSnap.data() || {};
        const docId = docSnap.id;
        const pureTime = getPureCreationTime(data);
        const officialOrderId = data.orderId || (docId.startsWith('ORD-') ? docId : `#ORD-${docId.slice(-6).toUpperCase()}`);
        return {
          ...data,
          id: docId,
          docUniqueId: docId,
          firestoreId: docId,
          orderId: officialOrderId,
          pureTime,
          createdTimestamp: pureTime,
          orderTimestamp: data.orderTimestamp || pureTime
        };
      });

      // Multi-identifier client-side filter
      const customerOrders = allFetched.filter((order: any) => {
        const orderPhone1 = normalizePhone(order.whatsapp || order.whatsappNumber || order.customer_whatsapp || '');
        const orderPhone2 = normalizePhone(order.customer_phone || order.customerPhone || order.phone || order.userPhone || '');
        const orderUid = order.userId || order.customerUid || order.userUid || order.customerId || order.customer_id || order.id || order.uid;
        const orderEmail = (order.email || order.customerEmail || order.customer_email || order.userEmail || '').trim().toLowerCase();
        const orderName = (order.customer_name || order.customerName || order.username || order.userName || order.name || '').trim().toLowerCase();
        const orderRoblox = (order.robloxUsername || order.roblox_username || order.game_username || order.targetUsername || order.username_roblox || '').trim().toLowerCase();

        const isUidMatch = Boolean(userUid && orderUid && orderUid === userUid);
        const isPhoneMatch = Boolean(userPhoneVariants.length > 0 && (
          (orderPhone1 && userPhoneVariants.includes(orderPhone1)) || 
          (orderPhone2 && userPhoneVariants.includes(orderPhone2)) ||
          (cleanPhone && (orderPhone1 === cleanPhone || orderPhone2 === cleanPhone))
        ));
        const isEmailMatch = Boolean(userEmail && orderEmail && orderEmail === userEmail);
        const isUsernameMatch = Boolean(userUsername && orderName && orderName === userUsername);
        const isRobloxMatch = Boolean(userRoblox && orderRoblox && orderRoblox === userRoblox);

        return isUidMatch || isPhoneMatch || isEmailMatch || isUsernameMatch || isRobloxMatch;
      });

      setDirectCustomerOrders(customerOrders);
    }, (error) => {
      console.warn("Realtime direct customer orders notice:", error);
    });

  
    return () => unsubscribe();
  }, [currentUser]);

  const myOrders = useMemo(() => {
    const activeUser = currentUser || safeGetJSON<any>('entong_active_user', {});
    const currentUid = activeUser?.id || activeUser?.uid || currentUser?.id || currentUser?.uid;
    const userEmail = (activeUser?.email || currentUser?.email || '').trim().toLowerCase();
    const userPhone = (activeUser?.phone || (activeUser as any)?.whatsapp || (activeUser as any)?.whatsappNumber || currentUser?.phone || (currentUser as any)?.whatsapp || (currentUser as any)?.whatsappNumber || '').trim();
    const userPhoneNorm = normalizePhone(userPhone);
    const userPhoneVariants = normalizePhoneVariants(userPhone);
    const userUsername = (activeUser?.username || activeUser?.name || '').trim().toLowerCase();
    const userRoblox = (activeUser?.robloxUsername || activeUser?.roblox_username || '').trim().toLowerCase();

    if (!currentUid && !userEmail && !userPhoneNorm && !userUsername && !userRoblox) return [];

    // Combine direct orders listener + context orders
    const combined = [...directCustomerOrders];

    if (orders && orders.length > 0) {
      const fromContext = orders.filter((o: any) => {
        // 1. Match by UID
        const orderUid = o.userId || o.customerUid || o.userUid || o.customerId || o.customer_id || o.id || o.uid;
        const matchUid = Boolean(currentUid && orderUid && orderUid === currentUid);

        // 2. Match by Email
        const orderEmail = (o.email || o.customerEmail || o.customer_email || (o as any).userEmail || '').trim().toLowerCase();
        const matchEmail = Boolean(userEmail && orderEmail && orderEmail === userEmail);

        // 3. Match by Normalized Phone / WhatsApp Number Variants
        const orderPhoneNorm1 = normalizePhone(o.customer_phone || o.customerPhone || '');
        const orderPhoneNorm2 = normalizePhone(o.whatsapp || o.whatsappNumber || (o as any).customer_whatsapp || '');
        const orderPhoneNorm3 = normalizePhone(o.phone || '');
        const matchPhone = Boolean(userPhoneVariants.length > 0 && (
          (orderPhoneNorm1 && userPhoneVariants.includes(orderPhoneNorm1)) || 
          (orderPhoneNorm2 && userPhoneVariants.includes(orderPhoneNorm2)) || 
          (orderPhoneNorm3 && userPhoneVariants.includes(orderPhoneNorm3)) ||
          (userPhoneNorm && (orderPhoneNorm1 === userPhoneNorm || orderPhoneNorm2 === userPhoneNorm || orderPhoneNorm3 === userPhoneNorm))
        ));

        // 4. Match by Username / Roblox Username
        const orderName = (o.customer_name || o.customerName || o.username || (o as any).userName || o.name || '').trim().toLowerCase();
        const orderRoblox = (o.robloxUsername || o.roblox_username || o.game_username || o.targetUsername || (o as any).username_roblox || '').trim().toLowerCase();

        const matchName = Boolean(userUsername && orderName && orderName === userUsername);
        const matchRoblox = Boolean(userRoblox && orderRoblox && orderRoblox === userRoblox);

        return matchUid || matchEmail || matchPhone || matchName || matchRoblox;
      });

      combined.push(...fromContext);
    }

    const deduped = removeDuplicateOrders(combined).map((o: any) => ({
      ...o,
      pureTime: o.pureTime || getPureCreationTime(o)
    }));

    return [...deduped].sort((a: any, b: any) => {
      const timeA = a.pureTime || (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || a.created || 0).getTime());
      const timeB = b.pureTime || (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || b.created || 0).getTime());
  
      return (timeB || 0) - (timeA || 0);
    });
  }, [directCustomerOrders, orders, currentUser]);

  const activeCustomerOrders = useMemo(() => {
    return myOrders.filter((ord: any) => {
      const rawStatus = (ord.status || ord.orderStatus || '').toUpperCase();
      return rawStatus !== 'SELESAI' && 
             rawStatus !== 'COMPLETED' && 
             rawStatus !== 'BATAL' && 
             rawStatus !== 'CANCEL' && 
             rawStatus !== 'BATAL_TOLAK' && 
             rawStatus !== 'REJECTED';
    });
  }, [myOrders]);

  const unverifiedCount = useMemo(() => {
    return myOrders.filter((ord: any) => 
      ord.status === 'PENDING_VERIFICATION' || 
      ord.paymentStatus === 'UNVERIFIED' || 
      ord.paymentStatus === 'PENDING_VERIFICATION'
    ).length;
  }, [myOrders]);

  const effectivePendingCount = Math.max(profilePendingCount, unverifiedCount);
  
  const handleAddToCart = (item: GameItem) => {
    setCart(prev => {
      const exist = prev.find(c => c.item.id === item.id && c.item.robloxUsername === item.robloxUsername);
      if (exist) {
        if (item.robloxUsername) {
          alert(`âš ï¸ Username Roblox @${item.robloxUsername} sudah ada di keranjang untuk paket ini!`);
          return prev;
        }
        return prev.map(c => (c.item.id === item.id && c.item.robloxUsername === item.robloxUsername) ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  

  
  const [showNotifBanner, setShowNotifBanner] = useState(true);

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowNotifBanner(false);
        console.log('Notifikasi berhasil diaktifkan.');
      } else {
        console.warn('Notifikasi ditolak oleh pengguna.');
      }
    } catch (error) {
      console.warn('Error saat meminta izin notifikasi:', error);
    }
  };

  const customerKey = currentUser?.id || currentUser?.phone || 'customer-session';
  const isMutedCurrently = isUserMuted(customerKey);

  // Anti-spam state
  const [recentSentTimestamps, setRecentSentTimestamps] = useState<number[]>([]);
  const [showSpamWarning, setShowSpamWarning] = useState<boolean>(false);
  const [muteCountdown, setMuteCountdown] = useState<number>(0);

  // Live countdown timer when muted
  

  // Active chat messages for selected order with rigorous deduplication
  
  // PILAR 1: CENTRALIZED STATE - Use activeMessages from AppContext directly
  const currentOrderChats = useMemo(() => {
    return activeMessages || [];
  }, [activeMessages]);


  // Auto mark chats as read & auto scroll to bottom when in chat tab
  useEffect(() => {
    if (activeTab === 'chat' && customerMainRoomId) {
      markChatAsRead(customerMainRoomId, 'CUSTOMER');
      scrollToBottom();
    }
  }, [activeTab, customerMainRoomId, activeMessages.length]);

  const processMediaFile = async (file: File) => {
    if (!file || !customerMainRoomId) return;

    setIsUploadingMedia(true);
    try {
      if (file.type.startsWith('image/')) {
        const compressedUrl = await compressImage(file, 800, 0.7);
        await sendMessage(customerMainRoomId, '', compressedUrl, 'IMAGE');
      } else if (file.type.startsWith('video/')) {
        const compressedUrl = await compressVideo(file);
        await sendMessage(customerMainRoomId, '', compressedUrl, 'VIDEO');
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

  const handlePasteImage = (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processMediaFile(file);
          break;
        }
      }
    }
  };

  // Cart helper functions
  const addToCart = (item: GameItem) => {
    if (item.is_closed) {
      alert('Produk tidak tersedia, tunggu admin open order lagi');
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id && c.item.robloxUsername === item.robloxUsername);
      if (existing) {
        if (item.robloxUsername) {
          alert(`âš ï¸ Username Roblox @${item.robloxUsername} sudah ada di keranjang untuk paket ini!`);
          return prev;
        }
        return prev.map(c => (c.item.id === item.id && c.item.robloxUsername === item.robloxUsername) ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.item.id === itemId) {
        const newQty = c.qty + delta;
        return newQty > 0 ? { ...c, qty: newQty } : null;
      }
      return c;
    }).filter(Boolean) as CartEntry[]);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  const cartTotalItems = cart.reduce((acc, c) => acc + c.qty, 0);
  const cartTotalPrice = cart.reduce((acc, c) => acc + (c.item.price * c.qty), 0);

  useEffect(() => {
    if (customerMainRoomId) {
      markChatAsRead(customerMainRoomId, 'CUSTOMER');
    }
  }, [customerMainRoomId, chats.length]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isProcessingRef.current) return;

    const rawRobloxUser = gameUsername.trim();
    const cleanRobloxUsername = rawRobloxUser.toLowerCase();

    const hasJoko = cart.some(c => {
      const cat = (c.item.category || '').toLowerCase();
      const game = (c.item.game_name || '').toLowerCase();
      const pkg = (c.item.package_name || '').toLowerCase();
      return cat.includes('joko') || cat.includes('joki') || game.includes('joko') || game.includes('joki') || pkg.includes('joko') || pkg.includes('joki') || (c.item as any).isJoki;
    });
    const isGiftOrder = !hasJoko;

    if (hasJoko && !currentUser) {
      alert("Silakan Login atau Daftar Akun Resmi terlebih dahulu sebelum melakukan pesanan Jasa Joko!");
      return;
    }

    if (cart.length === 0) {
      alert('Keranjang belanja Anda masih kosong.');
      return;
    }

    if (paymentMethod === 'TC') {
      const curBal = Number(currentUser?.tc_balance || 0);
      if (curBal < cartTotalPrice) {
        alert(`Saldo TongCoins Anda (${curBal.toLocaleString('id-ID')} TC) tidak cukup untuk membayar tagihan sebesar Rp ${cartTotalPrice.toLocaleString('id-ID')}!\n\nSilakan Top Up TC terlebih dahulu.`);
        return;
      }
    } else if (!paymentProof || !paymentProof.trim()) {
      alert('Wajib mengunggah screenshot / foto bukti transfer pembayaran sebelum melanjutkan!');
      return;
    }

    // ðŸ”¥ EARLY STATE LOCK: Prevent double-click immediately
    setIsSubmitting(true);
    isProcessingRef.current = true;

    const activeUser = currentUser || safeGetJSON<any>('entong_active_user', {});
    const loginProvider = activeUser.provider || ((activeUser.email || '').includes('gmail.com') ? 'GOOGLE' : 'MANUAL');
    const guestPhone = customerPhone || '081234567890';
    const guestUid = `GUEST_${cleanRobloxUsername || 'BUYER'}_${Date.now()}`;
    const activeCustomerId = activeUser.id || activeUser.uid || currentUser?.id || guestUid;
    const activeCustomerName = activeUser.name || activeUser.username || activeUser.displayName || currentUser?.name || gameUsername.trim() || 'Pelanggan Gift';
    
    // Strict Guard Lock: Prevent Bot & Dummy Orders
    if (cartTotalPrice <= 0) {
      alert('Error: Total harga order tidak boleh Rp 0.');
      setIsSubmitting(false);
      isProcessingRef.current = false;
      return;
    }

    // =====================================================================
    // ðŸ›‘ KUNCI ANTI-DOBEL ORDER REALTIME (SISTEM VALIDASI MULTI-PRODUK KETAT)
    // =====================================================================
    const targetUser = (gameUsername || '').toString().trim().toLowerCase();

    if (targetUser && cart.length > 0) {
      for (const cartItem of cart) {
        const checkResult = await validateOrderEligibility({
          robloxUsername: targetUser,
          packageName: cartItem.item.package_name,
          itemGift: (cartItem.item as any).itemGift || cartItem.item.package_name,
          category: cartItem.item.category,
          catalogId: cartItem.item.id
        });

        if (!checkResult.allowed) {
          alert(checkResult.reason || `Username "${targetUser}" masih memiliki pesanan aktif untuk item ini.`);
          setIsSubmitting(false);
          isProcessingRef.current = false;
          return; // ðŸ›‘ EKSEKUSI DIBATALKAN & KUNCI DILEPAS!
        }
      }
    }
    // =====================================================================

    if (!isGiftOrder && (activeCustomerName === 'Customer' || activeCustomerName.trim() === '' || activeCustomerName === '-')) {
      alert('Error: Nama customer tidak valid (masih placeholder). Silakan lengkapi profil Anda.');
      setIsSubmitting(false);
      isProcessingRef.current = false;
      return;
    }

    const customerRoomId = `room_${activeCustomerId}`;

    try {
      // Logic below is already inside a try-catch, states are set true above
      
      // Group all items in cart into 1 single order
      let combinedGameName = cart[0].item.game_name;
      const allSameGame = cart.every(c => c.item.game_name === cart[0].item.game_name);
      if (!allSameGame) {
        combinedGameName = 'Grup Multi-Game';
      }

      const combinedPackageName = cart.length === 1
        ? `${cart[0].item.package_name} (x${cart[0].qty})`
        : `Grup Paket (${cart.length} Item: ${cart.map(c => `${c.item.package_name} x${c.qty}`).join(', ')})`;

      const itemBreakdown = cart.map(c => `- ${c.item.game_name} (${c.item.package_name}) x${c.qty} = Rp ${((c.item.price ?? 0) * c.qty)?.toLocaleString?.('id-ID')}`).join('\n');
      const combinedNote = cart.length === 1
        ? orderNote
        : `[Rincian ${cart.length} Item Dalam 1 Order Group]:\n${itemBreakdown}${orderNote ? `\n\nCatatan Tambahan: ${orderNote}` : ''}`;

      const orderCatalogId = cart[0]?.item?.id?.includes('__') ? cart[0].item.id.split('__')[0] : (cart[0]?.item?.id || '');

      const rUsername = gameUsername ? gameUsername.trim() : '';
      const rDisplayName = rUsername || 'User Roblox';
      const rAvatarUrl = 'https://tr.rbxcdn.com/30df8184051d367a8644f8d77a561111/150/150/AvatarHeadshot/Png';

      const robloxUsernames = [rUsername];
      const robloxProfiles = [] as any[];

      const hasJoko = cart.some(c => {
        const cat = (c.item.category || '').toLowerCase();
        const game = (c.item.game_name || '').toLowerCase();
        const pkg = (c.item.package_name || '').toLowerCase();
        return cat.includes('joko') || cat.includes('joki') || game.includes('joko') || game.includes('joki') || pkg.includes('joko') || pkg.includes('joki');
      });
      const giftStatus = getGiftOperatingStatus();
      const isGiftOrder = !hasJoko;
      const initialStatus = (!giftStatus.isOperatingHours && isGiftOrder) ? 'Booking' : 'PENDING_VERIFICATION';

      const jPassword = hasJoko ? gamePassword : '';
      const wNote = hasJoko ? orderNote : '';
      const customerPhone = currentUser?.phone || '081234567890';
      const exactOrderTime = Date.now();
      const exactIsoString = new Date(exactOrderTime).toISOString();

      // Single-Source UNIQUE ORDER CREATION Logic (Always create a distinct order document for repeat orders)
      const { setDoc, doc, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const chatRef = doc(db, 'chats', customerRoomId);

      // 1. ðŸš¨ BUAT PREDICTABLE ID: Gabungan UID + Tanggal (Tanpa Garis Miring)
      const orderDate = new Date(exactOrderTime).toLocaleDateString('id-ID').replace(/\//g, '');
      const predictableDocId = `ORD_${activeCustomerId || currentUser?.id || 'GUEST'}_${orderDate}`; 

      // Generate unique display order ID (e.g. ORD-17128391283-921)
      const uniqueDisplayId = `ORD-${exactOrderTime}-${Math.floor(100 + Math.random() * 900)}`;
      const finalOrderId = uniqueDisplayId;

      const orderPayload = {
        orderId: uniqueDisplayId,
        id: uniqueDisplayId,
        docUniqueId: predictableDocId,
        userUid: activeCustomerId || currentUser?.id || 'GUEST',
        customerId: activeCustomerId,
        customer_id: activeCustomerId,
        customerName: activeCustomerName,
        customer_name: activeCustomerName,
        isGuest: false,
        customer_phone: customerPhone,
        whatsapp: customerPhone,
        gameName: combinedGameName,
        game_name: combinedGameName,
        packageName: combinedPackageName,
        package_name: combinedPackageName,
        packageNameLower: combinedPackageName.toLowerCase(),
        imageUrl: (cart[0]?.item as any)?.imageUrl || (cart[0]?.item as any)?.image || (cart[0]?.item as any)?.productImage || (cart[0]?.item as any)?.thumbnail || null,
        productImage: (cart[0]?.item as any)?.imageUrl || (cart[0]?.item as any)?.image || (cart[0]?.item as any)?.productImage || (cart[0]?.item as any)?.thumbnail || null,
        itemImage: (cart[0]?.item as any)?.imageUrl || (cart[0]?.item as any)?.image || (cart[0]?.item as any)?.productImage || (cart[0]?.item as any)?.thumbnail || null,
        price: cartTotalPrice,
        totalPrice: cartTotalPrice,
        status: initialStatus,
        orderStatus: initialStatus,
        paymentStatus: paymentMethod === 'TC' ? 'PAID' : 'UNVERIFIED',
        category: isGiftOrder ? 'gift' : 'joko',
        type: isGiftOrder ? 'gift' : 'joko',
        orderType: isGiftOrder ? 'gift' : 'joko',
        service_type: isGiftOrder ? 'gift' : 'joko',
        isGift: isGiftOrder,
        isJoko: !isGiftOrder,
        items: cart.map(c => ({
          catalogId: c.item.id,
          gameName: c.item.game_name,
          name: c.item.package_name,
          packageName: c.item.package_name,
          title: c.item.package_name,
          category: c.item.category,
          price: Number(c.item.price) || 0,
          totalPrice: (Number(c.item.price) || 0) * c.qty,
          qty: c.qty,
          quantity: c.qty,
          imageUrl: (c.item as any)?.imageUrl || (c.item as any)?.image || (c.item as any)?.productImage || null
        })),
        isOffHours: !giftStatus.isOperatingHours && isGiftOrder,
        is_off_hours_order: !giftStatus.isOperatingHours && isGiftOrder,
        offHoursNote: (!giftStatus.isOperatingHours && isGiftOrder) ? 'Dipesan di luar jam operasional' : '',
        off_hours_note: (!giftStatus.isOperatingHours && isGiftOrder) ? 'Dipesan di luar jam operasional' : '',
        loginMethod: loginProvider,
        login_provider: loginProvider,
        email: activeUser.email || currentUser?.email || '',
        payment_method: paymentMethod,
        paymentMethod: paymentMethod,
        payment_proof: paymentMethod === 'TC' ? 'TONGCOINS_INSTANT_PAYMENT' : paymentProof,
        proofOfPayment: paymentMethod === 'TC' ? 'TONGCOINS_INSTANT_PAYMENT' : paymentProof,
        catalogId: orderCatalogId,
        game_username: rUsername,
        robloxUsername: rUsername,
        robloxUsernameLower: rUsername.toLowerCase(),
        robloxDisplayName: rDisplayName,
        robloxAvatarUrl: rAvatarUrl,
        game_password: jPassword,
        jokoPassword: jPassword,
        robloxPassword: jPassword,
        password: jPassword,
        formData: {
          username: rUsername,
          robloxUsername: rUsername,
          password: jPassword,
          robloxPassword: jPassword,
          uangAwal: hasJoko ? initialGameMoney : '-',
          initialCash: hasJoko ? initialGameMoney : '-',
          note: combinedNote
        },
        uangAwal: hasJoko ? initialGameMoney : '-',
        uang_awal: hasJoko ? initialGameMoney : '-',
        uangSebelumJoko: hasJoko ? initialGameMoney : '',
        initialGameMoney: hasJoko ? initialGameMoney : '',
        login_method: hasJoko ? 'Roblox Login' : 'Direct Gift',
        note: combinedNote,
        catatanWorker: combinedNote,
        workerNote: wNote,
        roblox_usernames: robloxUsernames,
        roblox_profiles: robloxProfiles,

        // ðŸ”’ PROPERTI TIMESTAMP KUNCI MATI
        orderTimestamp: exactOrderTime,
        timestamp: exactOrderTime,
        created: exactIsoString,
        createdAt: exactIsoString,
        updated: exactIsoString,
        updatedAt: exactIsoString,
        statusUpdatedAt: exactIsoString
      };

      // 2. ðŸš¨ ZERO-DUPLICATE ENGINE: GUNAKAN setDoc DENGAN merge: true, BUKAN addDoc
      const orderRef = doc(db, 'orders', predictableDocId);
      
      const { saveOrderWithRetry } = await import('../../services/orderService');
      await saveOrderWithRetry(orderRef, orderPayload, { merge: true });
      
      console.log('Order berhasil dibuat dengan Predictable Doc ID:', predictableDocId);
      setActiveOrderDocId(predictableDocId);

      // Potong saldo TongCoins (TC) secara realtime jika metode pembayaran adalah TC
      if (paymentMethod === 'TC' && activeCustomerId && activeCustomerId !== 'GUEST') {
        try {
          const userRef = doc(db, 'users', activeCustomerId);
          const uSnap = await (await import('firebase/firestore')).getDoc(userRef);
          if (uSnap.exists()) {
            const curBal = Number(uSnap.data().tc_balance || 0);
            const nextBal = Math.max(0, curBal - cartTotalPrice);
            await setDoc(userRef, {
              tc_balance: nextBal,
              updatedAt: exactIsoString
            }, { merge: true });

            // Catat di ledger coin_transactions
            const txRef = doc(collection(db, 'coin_transactions'));
            await setDoc(txRef, {
              id: txRef.id,
              userId: activeCustomerId,
              userEmail: activeUser.email || '',
              userName: activeCustomerName,
              userPhone: customerPhone,
              type: 'PAYMENT',
              amount: -cartTotalPrice,
              orderId: predictableDocId,
              description: `Pembayaran Order #${predictableDocId.slice(-6)}: ${combinedPackageName}`,
              status: 'SUCCESS',
              paymentMethod: 'TONGCOINS',
              createdAt: exactIsoString,
              updatedAt: exactIsoString
            });
          }
        } catch (tcErr) {
          console.error('Gagal potong saldo TC:', tcErr);
        }
      }

      // Incremental catalog total sold
      if (orderCatalogId) {
        try {
          const { updateDoc, increment } = await import('firebase/firestore');
          const catalogRef = doc(db, 'catalogs', orderCatalogId);
          await updateDoc(catalogRef, {
            totalSold: increment(1)
          });
        } catch (catErr) {
          console.error('Gagal increment totalSold:', catErr);
        }
      }

      // 2. ðŸŸ¢ INJEKSI AUTO CHAT SISTEM KE SUB-KOLEKSI MESSAGES ROOM
      const autoSystemText = `ðŸ“¦ **Form Gamepass / Order Gift**\n\nPaket: ${combinedPackageName}\nUsername Target: ${rUsername || '-'}\nTotal: Rp ${cartTotalPrice.toLocaleString('id-ID')}\nStatus: **${!giftStatus.isOperatingHours && isGiftOrder ? 'Booking (Diluar Jam Operasional 13.00-20.50 WIB - Diproses mulai pukul 13.00 WIB)' : 'Menunggu Verifikasi Pembayaran'}**`;
      
      try {
        const systemChatMessage = {
          text: autoSystemText,
          message: autoSystemText,
          senderName: 'SYSTEM ORDER',
          sender_name: 'SYSTEM ORDER',
          senderRole: 'system',
          sender_role: 'system',
          senderUid: 'SYSTEM',
          sender_id: 'system',
          roomId: customerRoomId,
          isSystemMessage: true,
          isSystem: true,
          is_system: true,
          orderId: finalOrderId,
          order_id: finalOrderId,
          orderDocId: predictableDocId,
          timestamp: exactOrderTime,
          orderTimestamp: exactOrderTime,
          createdAt: serverTimestamp(),
          created: exactIsoString
        };

        const msgRef = doc(collection(db, 'chats', customerRoomId, 'messages'));
        await setDoc(msgRef, {
          id: msgRef.id,
          ...systemChatMessage
        });

        // Mirror write ke collection rooms/ messages juga
        try {
          const roomMsgRef = doc(collection(db, 'rooms', customerRoomId, 'messages'));
          await setDoc(roomMsgRef, {
            id: roomMsgRef.id,
            ...systemChatMessage
          });
        } catch (_) {}

        const lastMsgText = `Form Order Joko #${finalOrderId} - Menunggu Pembayaran`;
        await setDoc(chatRef, {
          activeOrderDocId: predictableDocId,
          activeDisplayOrderId: finalOrderId,
          orderDocId: predictableDocId,
          orderId: finalOrderId,
          packageName: combinedPackageName,
          gameName: combinedGameName,
          totalPrice: cartTotalPrice,
          robloxUsername: rUsername,
          customerName: activeCustomerName,
          customerPhone: customerPhone,
          hasOrder: true,
          updatedAt: exactIsoString,
          updated: exactIsoString,
          lastMessage: lastMsgText,
          lastMessageTimestamp: exactOrderTime
        }, { merge: true });

        try {
          const roomRef = doc(db, 'rooms', customerRoomId);
          await setDoc(roomRef, {
            activeOrderDocId: predictableDocId,
            activeDisplayOrderId: finalOrderId,
            orderDocId: predictableDocId,
            orderId: finalOrderId,
            packageName: combinedPackageName,
            lastMessage: lastMsgText,
            lastMessageTimestamp: exactOrderTime,
            updatedAt: exactIsoString
          }, { merge: true });
        } catch (_) {}
      } catch (sysMsgErr) {
        console.error('Error sending automated checkout chat message:', sysMsgErr);
      }

      const createdOrderObj = {
        id: predictableDocId,
        docUniqueId: predictableDocId,
        firestoreId: predictableDocId,
        ...orderPayload
      };

      setCart([]);
      setShowCheckoutModal(false);
      setGameUsername('');
      setGamePassword('');
      setOrderNote('');
      setPaymentProof('');
      setOrderSuccessNotice(true);
      setSelectedOrderDetail(createdOrderObj);
      setActiveTab('tracking');

      // ðŸŽ Buka popup Request Pengiriman otomatis jika ini pesanan Gift
      if (isGiftOrder) {
        setGiftOrderForRequestModal(createdOrderObj);
      }

      try {
        window.history.pushState({ tab: 'tracking', orderId: finalOrderId }, '', `/pesanan/${finalOrderId}`);
      } catch (_) {}

      setTimeout(() => setOrderSuccessNotice(false), 5000);
    } catch (err: any) {
      console.error('Error creating order:', err);
      if (err?.message?.includes("Timeout koneksi")) {
        alert(err.message);
      } else {
        alert('Terjadi kendala saat memproses pesanan. Silakan coba beberapa saat lagi.');
      }
    } finally {
      setIsSubmitting(false);
      isProcessingRef.current = false;
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerMainRoomId || !msgInput.trim()) return;

    if (isMutedCurrently) {
      alert(`Akun Anda sedang di-mute selama 15 menit karena melakukan spam. Tersisa: ${formatCountdown(muteCountdown)}.`);
      return;
    }

    const now = Date.now();
    // Window time: 2 minutes (120,000 ms)
    const windowMs = 120000;
    const filtered = [...recentSentTimestamps, now].filter(t => now - t <= windowMs);
    setRecentSentTimestamps(filtered);

    // Anti-Spam threshold checks
    if (filtered.length >= 12) {
      // Sent >= 12 chats in 2 minutes (7 chats initial + 5 more chats during spam)
      muteUser(customerKey, 15);
      setShowSpamWarning(false);
      setRecentSentTimestamps([]);
      setMsgInput('');
      alert(`âš ï¸ SPAM TERDETEKSI! Anda mengirim ${filtered.length} pesan dalam kurun waktu kurang dari 2 menit.\n\nAkun Anda OTOMATIS DI-MUTE selama 15 menit.`);
      return;
    } else if (filtered.length >= 7) {
      // 7 chats threshold reached in 2 minutes
      setShowSpamWarning(true);
    }

    try {
      await sendMessage(customerMainRoomId, msgInput.trim());
      setMsgInput('');
    } catch (err: any) {
      alert("Gagal mengirim pesan: " + (err.message || 'Silakan coba lagi.'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDana(true);
    setTimeout(() => setCopiedDana(false), 2000);
  };

  const getStatusBadge = (status: OrderStatus | string) => {
    const sUpper = (status || '').toUpperCase();
    if (sUpper === 'PENDING_VERIFICATION' || sUpper === 'NEW' || sUpper === 'UNVERIFIED') {
  
      return (
        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-extrabold flex items-center gap-1.5 animate-pulse shadow-sm">
          â³ Menunggu Verifikasi Admin
        </span>
      );
    }
    switch (sUpper) {
      case 'BOOKING':
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Booking</span>;
      case 'DIORDER':
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Diorder</span>;
      case 'READY':
        return <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5 animate-pulse"><Zap className="w-3.5 h-3.5 text-cyan-400" /> Ready</span>;
      case 'PROSES':
      case 'PROSES_WORKER':
      case 'ANTRIAN_LOGIN':
        return <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5 animate-pulse"><Gamepad2 className="w-3.5 h-3.5" /> Proses</span>;
      case 'LOGUL':
      case 'BUTUH_LOGIN_ULANG':
        return <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Butuh Login Ulang (OTP)</span>;
      case 'SELESAI':
      case 'COMPLETED':
        return <span className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Selesai</span>;
      case 'BATAL':
      case 'BATAL_TOLAK':
      case 'CANCEL':
      case 'REJECTED':
      case 'CANCELED':
      case 'DIBATALKAN':
        return <span className="px-2.5 py-1 bg-red-600/20 text-red-400 border border-red-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Cancel (Refund TC)</span>;
      case 'HANGUS':
      case 'EXPIRED':
        return <span className="px-2.5 py-1 bg-rose-900/30 text-rose-300 border border-rose-600/40 rounded-full text-xs font-semibold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Hangus</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full text-xs">{status}</span>;
    }
  };

  // Orders Filtering & Statistics (Derived State: displayedOrders)
  const displayedOrders = useMemo(() => {
    return myOrders.filter((order: any) => {
      if (orderSearchQuery.trim()) {
        const searchLower = orderSearchQuery.toLowerCase();
        const idMatch = (order.id || order.orderId || '').toLowerCase().includes(searchLower);
        const usernameMatch = (
          order.gameUsername || 
          order.game_username || 
          order.robloxUsername || 
          order.username || 
          order.customerName || 
          order.customer_name || 
          ''
        ).toLowerCase().includes(searchLower);
        const gameMatch = (order.game_name || order.gameName || '').toLowerCase().includes(searchLower);
        const packageMatch = (order.package_name || order.packageName || '').toLowerCase().includes(searchLower);

        if (!idMatch && !usernameMatch && !gameMatch && !packageMatch) return false;
      }

      if (orderStatusFilter !== 'ALL') {
        const s = (order.status || '').toUpperCase();
        if (orderStatusFilter === 'PENDING' && !['PENDING', 'MENUNGGU_PEMBAYARAN', 'UNPAID', 'PENDING_VERIFICATION', 'BOOKING'].includes(s)) return false;
        if (orderStatusFilter === 'ANTRIAN_LOGIN' && !['ANTRIAN_LOGIN', 'QUEUE', 'MENUNGGU_VERIFIKASI'].includes(s)) return false;
        if (orderStatusFilter === 'PROSES_WORKER' && !['PROSES_WORKER', 'PROCESSING', 'BUTUH_LOGIN_ULANG', 'PROSES'].includes(s)) return false;
        if (orderStatusFilter === 'SELESAI' && !['SELESAI', 'COMPLETED', 'SUCCESS'].includes(s)) return false;
        if (orderStatusFilter === 'BATAL' && !['BATAL', 'BATAL_TOLAK', 'CANCEL', 'REJECTED', 'CANCELED'].includes(s)) return false;
      }

      if (orderDateFilter) {
        const orderTime = order.pureTime || getPureCreationTime(order);
        if (orderTime > 0) {
          const orderDateStr = new Date(orderTime).toISOString().slice(0, 10);
          if (orderDateStr !== orderDateFilter) return false;
        } else if (order.created) {
          const orderDateStr = new Date(order.created).toISOString().slice(0, 10);
          if (orderDateStr !== orderDateFilter) return false;
        }
      }

      return true;
    });
  }, [myOrders, orderSearchQuery, orderStatusFilter, orderDateFilter]);

  const filteredOrders = displayedOrders;

  const completedOrdersCount = useMemo(() => {
    return myOrders.filter((o: any) => (o.status || '').toUpperCase() === 'SELESAI').length;
  }, [myOrders]);

  const totalSpent = useMemo(() => {
    return myOrders
      .filter((o: any) => (o.status || '').toUpperCase() === 'SELESAI')
      .reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
  }, [myOrders]);

  const lastOrderDateText = useMemo(() => {
    if (!myOrders || myOrders.length === 0) return 'Belum Ada';
    const latest = myOrders[0];
    const time = latest.pureTime || getPureCreationTime(latest) || (latest.created ? new Date(latest.created).getTime() : 0);
    if (time > 0) {
      return new Date(time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return 'Baru saja';
  }, [myOrders]);

  const currentTab = activeTab as string;
  if (currentTab === 'chat') {
  
    return (
      <CustomerChat 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        cartTotalItems={cartTotalItems} 
        prefilledMessage={prefilledChatMessage}
        targetOrderId={targetOrderIdForChat}
        activeOrder={activeOrderForChat}
      />
    );
  }

  

  if (standaloneCategory) {
    return (
      <div className="w-full min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between select-none pb-24 md:pb-8">
        <header className="w-full sticky top-0 z-40 bg-[#070b14]">
          <div className="bg-[#0b1120]/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-800/80">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = "/"}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <img 
                  src={storeAvatarUrl || "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=120&h=120&fit=crop&q=80"} 
                  alt="Entong Store" 
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h1 className="text-sm font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wide uppercase">
                ENTONG STORE
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {currentUser ? (
                <button 
                  onClick={() => handleRequestCheckout(true)}
                  className="relative p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <ShoppingCart className="w-4 h-4 text-slate-300" />
                  {cartTotalItems > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md shadow-rose-950/50">
                      {cartTotalItems}
                    </span>
                  )}
                </button>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md">Masuk</button>
              )}
            </div>
          </div>
          <StoreOperationalBanner/>
        </header>

        <main className="w-full max-w-7xl mx-auto flex-1">
          <Catalog 
            onAddToCart={addToCart} 
            cart={cart} 
            onViewCart={() => handleRequestCheckout(true)}
            onBuyNow={handleBuyNowItem}
            standaloneCategory={standaloneCategory}
          />
        </main>
        
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0b1120]/95 backdrop-blur-xl border-t border-slate-800/80 px-2 sm:px-4 py-2 pb-safe md:hidden">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button onClick={() => window.location.href = "/"} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors">
              <HomeIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold">Home</span>
            </button>
            <button onClick={() => handleRequestCheckout(true)} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-[10px] font-bold">Keranjang</span>
              {cartTotalItems > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {cartTotalItems}
                </span>
              )}
            </button>
            <button onClick={() => { if (!currentUser) setShowAuthModal(true); else window.location.href = "/pesanan"; }} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors">
              <FileText className="w-5 h-5" />
              <span className="text-[10px] font-bold">Pesanan</span>
            </button>
            <button onClick={() => { if (!currentUser) setShowAuthModal(true); else window.location.href = "/profil"; }} className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors">
              <User className="w-5 h-5" />
              <span className="text-[10px] font-bold">Profil</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-[#070b14] text-slate-100 font-sans overflow-x-hidden pb-32">
      
      {/* Web Notification Banner when logged in */}
      {showNotifBanner && currentUser && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
        <>
          {/* Desktop Notification Banner */}
          <div className="hidden md:flex bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-blue-500/30 px-5 py-3 items-center justify-between gap-4 text-xs z-40 shadow-xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-lg shrink-0">
                ðŸ””
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-slate-100 text-sm block">Aktifkan Notifikasi Web Real-Time</span>
                <span className="text-xs text-slate-400 block truncate">Dapatkan pemberitahuan instan saat status pesanan joko berubah atau admin membalas pesan Anda di browser ini.</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                Aktifkan Sekarang
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNotifBanner(false);
                  try {
                    sessionStorage.setItem('entong_notif_dismissed_session', 'true');
                  } catch {}
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs border border-slate-700 transition-all cursor-pointer"
              >
                Nanti
              </button>
            </div>
          </div>

          {/* Mobile Notification Banner */}
          <div className="flex md:hidden bg-slate-900 border-b border-blue-500/30 px-3 py-2 items-center justify-between gap-2 text-xs z-45 shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">ðŸ””</span>
              <span className="font-bold text-slate-200 text-xs truncate">Aktifkan Notifikasi Status Order</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-2.5 py-1 bg-blue-600 text-white font-black rounded-lg text-[11px]"
              >
                Aktifkan
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNotifBanner(false);
                  try {
                    sessionStorage.setItem('entong_notif_dismissed_session', 'true');
                  } catch {}
                }}
                className="px-2 py-1 bg-slate-800 text-slate-300 font-bold rounded-lg text-[11px] border border-slate-700"
              >
                Nanti
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* ðŸš€ ENTONG STORE NAVBAR */}
      <header className="sticky top-0 z-[100] bg-[#060d1a]/95 backdrop-blur-xl border-b border-blue-900/20 px-4 md:px-8 py-3 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer select-none shrink-0" onClick={() => setActiveTab('home')}>
          <div className="w-8 h-8 rounded-xl overflow-hidden border border-blue-800/40 shrink-0">
            <img
              src={storeAvatarUrl || "/logo-entong.png"}
              alt="Entong Store Logo"
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black tracking-tight text-white">ENTONG</span>
            <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-600 text-white rounded tracking-widest uppercase leading-none">STORE</span>
          </div>
        </div>

        {/* Center Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-0.5">
          {[
            { tab: 'home',      label: 'Beranda',  icon: <HomeIcon className="w-3.5 h-3.5" /> },
            { tab: 'catalog',   label: 'Produk',   icon: <ShoppingBag className="w-3.5 h-3.5" /> },
            { tab: 'tracking',  label: 'Pesanan',  icon: <Clock className="w-3.5 h-3.5" /> },
            { tab: 'testimoni', label: 'Ulasan',   icon: <Star className="w-3.5 h-3.5" /> },
            { tab: 'chat',      label: 'Chat',     icon: <MessageSquare className="w-3.5 h-3.5" /> },
          ].map(item => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === item.tab
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          {cartTotalItems > 0 && (
            <button
              onClick={() => handleRequestCheckout(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600/10 border border-blue-600/20 text-blue-400 hover:bg-blue-600/20 transition-all cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                {cartTotalItems}
              </span>
            </button>
          )}

          {/* Notification Bell */}
          <button
            onClick={() => { handleEnableNotifications(); setShowNotificationModal(prev => !prev); }}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/8 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>

          {/* User Menu / Login */}
          {currentUser ? (
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(v => !v)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg overflow-hidden bg-blue-600/20 border border-blue-600/30 shrink-0">
                  {currentUser.photoURL ? (
                    <img src={optimizeGoogleAvatarUrl(currentUser.photoURL)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-300 max-w-[80px] truncate hidden sm:block">
                  {currentUser.displayName?.split(' ')[0] || 'Akun'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#0d1829] border border-blue-900/40 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden py-1.5">
                  <div className="px-3.5 py-2.5 border-b border-blue-900/30">
                    <p className="text-xs font-bold text-white truncate">{currentUser.displayName || 'Pengguna'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                  </div>
                  {[
                    { icon: <User className="w-3.5 h-3.5" />, label: 'Profil & Settings', action: () => { setActiveTab('settings'); setShowProfileDropdown(false); } },
                    { icon: <ShoppingBag className="w-3.5 h-3.5" />, label: 'Pesanan Saya', action: () => { navigateTab('tracking'); setShowProfileDropdown(false); } },
                    { icon: <Coins className="w-3.5 h-3.5" />, label: 'TongCoins', action: () => { setActiveTab('tongcoins'); setShowProfileDropdown(false); } },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-blue-600/10 transition-all cursor-pointer"
                    >
                      <span className="text-slate-500">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t border-blue-900/30 mt-1 pt-1">
                    <button
                      onClick={() => { logout(); setShowProfileDropdown(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Banner Operasional Toko ── */}
      <StoreOperationalBanner />


      {/* BAR NOTIFIKASI INFORMASI REAL-TIME DARI FIRESTORE */}

      {/* ðŸ“¢ BAR NOTIFIKASI INFORMASI REAL-TIME DARI FIRESTORE */}
      {announcementText && announcementText.trim().length > 0 && (
        <div className="w-full bg-[#0F172A] border-b border-slate-800 px-4 py-2 text-xs text-slate-300">
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate text-xs font-medium text-slate-300">
              {announcementText.trim()}
            </span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className={`flex-1 w-full relative ${activeTab === 'home' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-0 pb-28 md:pb-12'}`}>
        
        {/* Success Toast Notice */}
        {orderSuccessNotice && (
          <div className="mb-6 p-4 bg-blue-900/80 border border-blue-500 rounded-2xl text-white text-xs font-semibold flex items-center justify-between shadow-xl animate-bounce">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
              <span>Pesanan Anda berhasil dibuat! Tim Admin Entong Store siap memproses secepat kilat.</span>
            </div>
            <button onClick={() => setOrderSuccessNotice(false)} className="text-white font-bold p-1">âœ•</button>
          </div>
        )}

        {/* ============================================================== */}
        {/* ðŸ”¥ 0. LANDING PAGE UTAMA (BERANDA / HOME - RIERBUX DARK BLUE) */}
        {/* ============================================================== */}
        {activeTab === 'home' && (
          <div className="animate-fade-in w-full bg-[#060d1a]">

            {/* â•â• HERO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <section className="relative overflow-hidden bg-gradient-to-b from-[#091424] to-[#060d1a] pt-10 pb-12 sm:pt-16 sm:pb-20">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.12)_0%,transparent_70%)] pointer-events-none" />
              <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-8 flex flex-col items-center text-center gap-5">
                {/* Badge */}
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-300 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Toko Roblox Terpercaya #1 Indonesia
                </span>

                {/* Headline */}
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05]">
                  Entong{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500">Store</span>
                </h1>
                <p className="text-sm sm:text-base text-slate-400 max-w-md">
                  Top Up Roblox{' · '}Gift In-Game{' · '}Joki Service
                  <br className="hidden sm:block" />
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>Proses Cepat</span>
                    <span className="hidden sm:inline text-slate-700">·</span>
                    <span>Admin Ramah</span>
                    <span className="hidden sm:inline text-slate-700">·</span>
                    <span>Harga Terbaik</span>
                  </div>
                </p>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:justify-center">
                  <button
                    onClick={() => setActiveTab('catalog')}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-600/25 border border-blue-400/20 transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Order Sekarang
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigateTab('tracking')}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-slate-200 font-semibold text-sm rounded-2xl border border-white/10 transition-all cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-blue-400" />
                    Cek Pesanan
                  </button>
                </div>

                {/* Trust pills */}
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {[
                    { icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />, text: 'Terpercaya' },
                    { icon: <Zap className="w-3.5 h-3.5 text-yellow-400" />, text: 'Proses Cepat' },
                    { icon: <Headphones className="w-3.5 h-3.5 text-emerald-400" />, text: 'Admin 24 Jam' },
                    { icon: <CreditCard className="w-3.5 h-3.5 text-purple-400" />, text: 'Banyak Metode Bayar' },
                  ].map(t => (
                    <span key={t.text} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1829]/80 border border-blue-900/40 rounded-xl text-slate-400 text-[11px] font-medium">
                      {t.icon}{t.text}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* STATS BAR */}
            <div className="w-full bg-[#080f1e]">
              <div className="max-w-5xl mx-auto px-4 sm:px-8 grid grid-cols-3">
                <div className="py-6 text-center">
                  <div className="text-xl sm:text-2xl font-black text-white">{(6427 + totalOrders).toLocaleString('id-ID')}+</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Pesanan Sukses</div>
                </div>
                <div className="py-6 text-center border-x border-blue-900/20">
                  <div className="text-xl sm:text-2xl font-black text-white">{totalReviews.toLocaleString('id-ID')}+</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Ulasan Pembeli</div>
                </div>
                <div className="py-6 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">{[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}</div>
                  <div className="text-xl sm:text-2xl font-black text-white">{rating ? Number(rating).toFixed(1) : '4.9'} / 5</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Rating Toko</div>
                </div>
              </div>
            </div>

            {/* â•â• MAIN CONTENT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-14">

              {/* Live Transactions */}
              <div>
                <LiveTransactionsCarousel catalogList={homeCatalogs} />
              </div>

              {/* Products */}
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <h2 className="text-base sm:text-xl font-black text-white">Produk Terpopuler</h2>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">Item dan joki paling banyak dipesan</p>
                  </div>
                  {/* Category tabs */}
                  <div className="flex items-center gap-1 p-1 bg-[#0d1829] border border-blue-900/20 rounded-xl self-start shrink-0">
                    {[{ k: 'all', l: 'Semua' }, { k: 'gift', l: 'Gift & GP' }, { k: 'joko', l: 'Joki' }].map(f => (
                      <button key={f.k} onClick={() => setHomeCategoryFilter(f.k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          homeCategoryFilter === f.k ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'}`}>
                        {f.l}
                      </button>
                    ))}
                  </div>
                </div>

                {isProductsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 animate-pulse">
                    {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="bg-[#0d1829] rounded-2xl h-64 border border-blue-900/15" />)}
                  </div>
                ) : filteredTopProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-[#0d1829] rounded-2xl border border-blue-900/15 gap-3">
                    <Gamepad2 className="w-10 h-10 text-slate-700" />
                    <p className="text-sm text-slate-600">Belum ada produk tersedia.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {filteredTopProducts.map((item, itIdx) => {
                      const isGiftProduct = isProductGift(item.rawGame || item) || item.category === 'gift';
                      const isGiftCurrentlyClosed = isGiftProduct && isGiftClosedTime();
                      return (
                        <div key={item.id ? `tp-${item.id}-${itIdx}` : `tp-${itIdx}`}
                          onClick={() => handleSelectProductFromHome(item)}
                          className="group relative bg-[#0d1829] border border-blue-900/20 hover:border-blue-500/40 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-blue-900/30 transition-all duration-200 flex flex-col cursor-pointer">
                          {/* Thumbnail */}
                          <div className="relative h-32 sm:h-40 overflow-hidden bg-[#060d1a] shrink-0">
                            <img src={item.img} alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1829] via-transparent to-transparent opacity-80" />
                            <span className="absolute top-2 left-2 px-2 py-0.5 bg-blue-600/90 backdrop-blur-sm text-white text-[9px] font-black rounded-md uppercase tracking-wide z-10">
                              {item.tag}
                            </span>
                            {isGiftCurrentlyClosed && (
                              <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-amber-950/90 border border-amber-700/30 text-amber-300 text-[9px] font-bold rounded-md z-10">
                                Di Luar Jam
                              </span>
                            )}
                          </div>
                          {/* Info */}
                          <div className="p-3 flex flex-col flex-1 gap-2.5">
                            <div className="flex-1">
                              <span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">{item.game}</span>
                              <h3 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-white line-clamp-2 leading-snug mt-0.5 transition-colors">
                                {item.title}
                              </h3>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-end justify-between gap-1">
                                <div>
                                  {item.originalPrice && item.originalPrice > item.price && (
                                    <span className="text-[9px] text-slate-600 line-through font-mono block">
                                      Rp {item.originalPrice.toLocaleString('id-ID')}
                                    </span>
                                  )}
                                  <span className="text-sm font-black text-blue-400 font-mono">
                                    Rp {item.price.toLocaleString('id-ID')}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-600 shrink-0">{item.sold}+ sold</span>
                              </div>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handleSelectProductFromHome(item); }}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
                                Beli <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-center pt-2">
                  <button onClick={() => setActiveTab('catalog')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0d1829] hover:bg-[#112040] border border-blue-900/20 hover:border-blue-700/30 text-blue-400 font-bold text-sm rounded-xl transition-all cursor-pointer">
                    Lihat Semua Produk <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </section>

              {/* Why Us */}
              <section className="space-y-5">
                <div className="text-center">
                  <h2 className="text-base sm:text-lg font-black text-white">Kenapa Pilih Entong Store?</h2>
                  <p className="text-xs text-slate-600 mt-1">Komitmen kami untuk pengalaman Roblox terbaik</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { icon: <Zap className="w-5 h-5 text-blue-400" />, bg: 'bg-blue-500/10 border-blue-500/15', title: 'Proses Kilat', desc: 'Order diproses dalam 5â€“15 menit, tanpa antre panjang.' },
                    { icon: <MessageSquare className="w-5 h-5 text-emerald-400" />, bg: 'bg-emerald-500/10 border-emerald-500/15', title: 'Live Chat Aktif', desc: 'Admin siap membantu kapan saja via chat interaktif.' },
                    { icon: <CreditCard className="w-5 h-5 text-purple-400" />, bg: 'bg-purple-500/10 border-purple-500/15', title: 'Banyak Metode Bayar', desc: 'QRIS, DANA, OVO, GoPay, ShopeePay, Transfer Bank, TC.' },
                  ].map(s => (
                    <div key={s.title} className="bg-[#0d1829] border border-blue-900/20 hover:border-blue-800/40 rounded-2xl p-5 space-y-3 transition-colors">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.bg}`}>{s.icon}</div>
                      <div>
                        <h4 className="text-sm font-extrabold text-white">{s.title}</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Review CTA */}
              <section>
                <div className="relative overflow-hidden bg-gradient-to-r from-[#0d1f3c] to-[#0a1628] border border-blue-800/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,rgba(59,130,246,0.06)_0%,transparent_70%)] pointer-events-none" />
                  <div className="relative text-center sm:text-left space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-0.5">
                      {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                      <span className="text-xs font-bold text-white ml-2">{rating ? Number(rating).toFixed(1) : '4.9'} / 5.0</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Dipercaya {(6427 + totalOrders).toLocaleString('id-ID')}+ Gamers Indonesia
                    </h3>
                    <p className="text-xs text-slate-500">Lihat testimoni dan ulasan asli dari pembeli kami.</p>
                  </div>
                  <button onClick={() => setActiveTab('testimoni')}
                    className="relative shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2 cursor-pointer">
                    Lihat Ulasan <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </section>

              {/* Web Push */}
              <WebPushNotificationBanner />


            {/* ══ FOOTER ══ */}
            <footer className="w-full bg-[#040a14] border-t border-blue-900/20 mt-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
                {/* Top grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
                  {/* Brand — full width on mobile */}
                  <div className="col-span-2 lg:col-span-2 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl overflow-hidden border border-blue-800/40 shrink-0">
                        <img src={storeAvatarUrl || "/logo-entong.png"} alt="Entong Store" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white tracking-tight">ENTONG</span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-600 text-white rounded tracking-widest uppercase">STORE</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                      Toko Roblox terpercaya untuk Top Up, Gift In-Game, dan Joki Service. Proses cepat, admin ramah, harga terbaik.
                    </p>
                    <div className="flex items-center gap-2.5">
                      {[
                        { href: 'https://www.tiktok.com/@sientong.id', label: '@sientong.id' },
                        { href: 'https://www.tiktok.com/@entongsupply', label: '@entongsupply' },
                        { href: 'https://www.tiktok.com/@entongjoki', label: '@entongjoki' },
                      ].map(tt => (
                        <a key={tt.href} href={tt.href} target="_blank" rel="noopener noreferrer"
                          title={tt.label}
                          className="w-8 h-8 rounded-xl bg-[#0d1829] border border-blue-900/30 hover:border-blue-600/50 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.5a8.16 8.16 0 0 0 4.78 1.52V6.55a4.85 4.85 0 0 1-1.01.14z"/></svg>
                        </a>
                      ))}
                      <a href="https://wa.me/6281958308349" target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-xl bg-[#0d1829] border border-blue-900/30 hover:border-emerald-600/50 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-all">
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Layanan */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Layanan</h4>
                    <ul className="space-y-2">
                      {[
                        { label: 'Top Up Roblox', tab: 'catalog' },
                        { label: 'Gift In-Game', tab: 'catalog' },
                        { label: 'Joki Service', tab: 'catalog' },
                        { label: 'Cek Pesanan', tab: 'tracking' },
                        { label: 'Ulasan', tab: 'testimoni' },
                      ].map(item => (
                        <li key={item.label}>
                          <button onClick={() => setActiveTab(item.tab)}
                            className="text-xs text-slate-500 hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Kontak */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Kontak</h4>
                    <div className="space-y-3">
                      <a href="https://wa.me/6281958308349" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <Phone className="w-3 h-3 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600">WhatsApp</p>
                          <p className="text-xs font-semibold text-slate-300">+62 819-5830-8349</p>
                        </div>
                      </a>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <Clock className="w-3 h-3 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-600">Jam Operasional</p>
                          <p className="text-xs font-semibold text-slate-300">Setiap Hari, 13.00 - 23.00 WIB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-8 pt-5 border-t border-blue-900/20 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <p className="text-xs text-slate-600 text-center sm:text-left">
                    &copy; {new Date().getFullYear()} Entong Store. Semua hak dilindungi.
                  </p>
                  <div className="flex items-center gap-4">
                    {[
                      { label: "Syarat & Ketentuan", tab: "catalog" },
                      { label: "Kebijakan Privasi", tab: "catalog" },
                    ].map(item => (
                      <button key={item.label} onClick={() => setActiveTab(item.tab)}
                        className="text-xs text-slate-600 hover:text-slate-400 transition-colors cursor-pointer">
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </footer>
            </div>
          </div>
        )}
        {activeTab === 'tracking' && (
          selectedOrderDetail ? (
            <OrderDetail 
              order={selectedOrderDetail}
              onBack={() => {
                setSelectedOrderDetail(null);
                try {
                  window.history.pushState({ tab: 'tracking' }, '', '/pesanan');
                } catch (_) {}
              }}
              onOpenChatWithConfirmation={handleChatAdminConfirmation}
              onViewProof={(ord) => setViewingProofOrder(ord)}
              onOpenReview={(ord) => {
                setReviewOrder(ord);
                setReviewRating(5);
                setReviewComment('');
                setShowReviewModal(true);
              }}
            />
          ) : (
            <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-fade-in px-4">
              {/* Header Cek Pesanan */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
                      <Search className="w-6 h-6 text-blue-400" />
                      <span>Cek Pesanan Kamu</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Lacak progres pemrosesan pesanan Anda secara instan dan real-time.
                    </p>
                  </div>

                  {/* Pill Toggle */}
                  <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingLookupMode('USER_DATA');
                        setTrackingError('');
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        trackingLookupMode === 'USER_DATA'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Pakai Username / WA
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingLookupMode('INVOICE');
                        setTrackingError('');
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        trackingLookupMode === 'INVOICE'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Pakai Invoice ID
                    </button>
                  </div>
                </div>

                {/* Input Pencarian */}
                <form onSubmit={handleSearchTracking} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={trackingSearchInput}
                      onChange={(e) => setTrackingSearchInput(e.target.value)}
                      placeholder={
                        trackingLookupMode === 'INVOICE'
                          ? 'Masukkan Nomor Invoice (Contoh: ORD-123456 atau #ORD-123456)...'
                          : 'Masukkan Username Roblox atau Nomor WhatsApp Anda...'
                      }
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-11 pr-4 py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner"
                    />
                    <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>

                  <button
                    type="submit"
                    disabled={isSearchingTracking}
                    className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-blue-600/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isSearchingTracking ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Melacak...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Lacak Pesanan</span>
                      </>
                    )}
                  </button>

                  {hasSearched && (
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingResults(null);
                        setTrackingSearchInput('');
                        setTrackingError('');
                        setHasSearched(false);
                      }}
                      className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </form>

                {/* Alert Box */}
                <div className="p-3.5 bg-blue-900/20 border border-blue-500/30 rounded-2xl flex items-start gap-3 text-blue-300 text-xs leading-relaxed shadow-sm">
                  <span className="text-base shrink-0">ðŸ’¡</span>
                  <div>
                    <strong className="text-blue-200 font-bold">Informasi Khusus:</strong> Kalau kamu beli <strong>Robux Via Login</strong>, pesanan hanya bisa dicari melalui <strong>Invoice ID</strong> demi keamanan data akun Anda.
                  </div>
                </div>

                {trackingError && (
                  <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-2xl flex items-center gap-2 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{trackingError}</span>
                  </div>
                )}
              </div>

              {/* Daftar Pesanan - Hanya Tampil Jika hasSearched === true */}
              {hasSearched && (() => {
                const displayedOrders = trackingResults !== null ? trackingResults : myOrders;
                return (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span>
                          {trackingResults !== null
                            ? `Hasil Pencarian (${displayedOrders.length} Pesanan)`
                            : `Daftar Pesanan Anda (${displayedOrders.length})`}
                        </span>
                      </h3>
                    </div>

                    {displayedOrders.length === 0 ? (
                      <div className="text-center py-12 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                        <p className="text-slate-300 font-bold text-sm">Tidak ada pesanan yang ditemukan</p>
                        <p className="text-slate-500 text-xs max-w-sm mx-auto">
                          {trackingResults !== null
                            ? 'Coba periksa kembali nomor invoice atau username yang dimasukkan.'
                            : 'Anda belum memiliki riwayat pesanan. Yuk cari item favoritmu di katalog!'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/80 text-slate-400 uppercase font-black tracking-wider border-b border-slate-800 text-[11px]">
                              <tr>
                                <th className="py-3.5 px-4">Invoice</th>
                                <th className="py-3.5 px-4">Tanggal</th>
                                <th className="py-3.5 px-4">Total Pembayaran</th>
                                <th className="py-3.5 px-4">Status Pesanan</th>
                                <th className="py-3.5 px-4 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                              {displayedOrders.map((ord: any) => {
                                const inv = ord.orderId || ord.id || '-';
                                const dateStr = ord.createdAt || ord.created || ord.orderDate || ord.timestamp;
                                const total = ord.totalPrice || ord.finalPrice || ord.price || ord.total || 0;
                                const st = (ord.status || ord.orderStatus || 'PENDING').toUpperCase();
                                const productName = ord.packageName || ord.itemGift || ord.package_name || ord.game_name || ord.productName || 'Produk Game';

                                return (
                                  <tr key={ord.id || ord.docUniqueId} className="hover:bg-slate-850/50 transition-colors">
                                    <td className="py-4 px-4">
                                      <div className="font-bold text-white flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                        <span>{inv}</span>
                                      </div>
                                      <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                        {productName}
                                      </div>
                                    </td>
                                    <td className="py-4 px-4 text-slate-300">
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                                        <span>{dateStr ? formatDate(dateStr) : '-'}</span>
                                      </div>
                                    </td>
                                    <td className="py-4 px-4">
                                      <div className="font-black text-white text-xs">
                                        Rp {Number(total).toLocaleString('id-ID')}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {ord.paymentMethod || 'QRIS / E-Wallet'}
                                      </div>
                                    </td>
                                    <td className="py-4 px-4">
                                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold border ${
                                        st === 'SELESAI'
                                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                          : st === 'PROSES'
                                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                          : st === 'BATAL' || st === 'GAGAL' || st === 'HANGUS'
                                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                      }`}>
                                        {st === 'SELESAI' && <CheckCircle2 className="w-3 h-3" />}
                                        {st === 'PROSES' && <RefreshCw className="w-3 h-3 animate-spin" />}
                                        {st === 'PENDING' && <Clock className="w-3 h-3" />}
                                        <span>{st}</span>
                                      </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedOrderDetail(ord);
                                          try {
                                            const ordId = ord.orderId || ord.id;
                                            window.history.pushState({ tab: 'tracking', orderId: ordId }, '', `/pesanan/${ordId}`);
                                          } catch (_) {}
                                        }}
                                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Lihat Detail</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {displayedOrders.map((ord: any) => {
                            const inv = ord.orderId || ord.id || '-';
                            const dateStr = ord.createdAt || ord.created || ord.orderDate || ord.timestamp;
                            const total = ord.totalPrice || ord.finalPrice || ord.price || ord.total || 0;
                            const st = (ord.status || ord.orderStatus || 'PENDING').toUpperCase();
                            const productName = ord.packageName || ord.itemGift || ord.package_name || ord.game_name || ord.productName || 'Produk Game';

                            return (
                              <div
                                key={ord.id || ord.docUniqueId}
                                className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-bold text-white text-xs flex items-center gap-1.5 truncate">
                                    <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                    <span className="truncate">{inv}</span>
                                  </div>
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${
                                    st === 'SELESAI'
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                      : st === 'PROSES'
                                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                      : st === 'BATAL' || st === 'GAGAL' || st === 'HANGUS'
                                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  }`}>
                                    {st}
                                  </span>
                                </div>

                                <div className="text-xs text-slate-300 font-semibold line-clamp-1">
                                  {productName}
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                                  <div className="text-slate-400 text-[11px]">
                                    {dateStr ? formatDate(dateStr) : '-'}
                                  </div>
                                  <div className="font-black text-white">
                                    Rp {Number(total).toLocaleString('id-ID')}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderDetail(ord);
                                    try {
                                      const ordId = ord.orderId || ord.id;
                                      window.history.pushState({ tab: 'tracking', orderId: ordId }, '', `/pesanan/${ordId}`);
                                    } catch (_) {}
                                  }}
                                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-blue-600/20 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Lihat Detail Pesanan</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )
        )}

        {/* 2. CATALOG TAB */}
        {activeTab === 'catalog' && (
          <div className="space-y-4 pb-32 md:pb-24 px-4 py-2">
            <Catalog
              onAddToCart={addToCart}
              cart={cart}
              onViewCart={() => handleRequestCheckout(true)}
              onBuyNow={handleBuyNowItem}
              selectedGameId={selectedCatalogIdForView}
              onClearSelectedGame={() => setSelectedCatalogIdForView(null)}
            />
          </div>
        )}

        {/* TESTIMONI TAB */}
        {activeTab === 'testimoni' && (
          <div className="space-y-4 pb-16 overflow-y-auto px-4 py-2">
            <ReviewsSection />
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4 pb-16 overflow-y-auto px-4 py-2">
            <LeaderboardSection />
          </div>
        )}

        {/* TONGCOINS (TC) TAB */}
        {activeTab === 'tongcoins' && (
          <div className="space-y-4 pb-16 overflow-y-auto px-4 py-2">
            <TongCoinsPage 
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenAuthModal={() => setShowAuthModal(true)}
            />
          </div>
        )}

        {/* PROFIL TAB (PROFILE DASHBOARD) */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in px-4">
            {!currentUser ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-blue-400">
                  <User className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white">Akun Pelanggan Entong Store</h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                  Silakan masuk dengan akun Google atau email Anda untuk melihat profil, memantau riwayat pesanan, dan mengumpulkan peringkat belanja.
                </p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm shadow-xl shadow-blue-600/30 transition active:scale-95 cursor-pointer"
                >
                  Masuk / Daftar Akun
                </button>
              </div>
            ) : (
              <>
                {/* 1. KARTU PROFIL UTAMA (bg-slate-900, Tanpa badge sultan) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left min-w-0">
                      {/* Avatar Dynamic */}
                      <div className="relative group shrink-0">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-950 border-2 border-slate-700/80 overflow-hidden flex items-center justify-center text-emerald-400 font-black text-3xl shadow-xl">
                          <span>{(currentUser?.name || currentUser?.username || 'U').charAt(0).toUpperCase()}</span>
                        </div>

                      </div>

                      {/* Detail Nama & Tanggal Gabung */}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                          {currentUser?.name || currentUser?.username || 'Pelanggan Entong Store'}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1 truncate">
                          {currentUser?.email ? currentUser.email : `@${currentUser?.username || 'user'}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1.5 font-medium">
                          Gabung sejak {currentUser?.created || (currentUser as any)?.createdAt ? new Date(currentUser.created || (currentUser as any).createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Baru saja'}
                        </p>
                      </div>
                    </div>

                    {/* Tombol Pengaturan */}
                    <button
                      onClick={() => navigateTab('settings')}
                      className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm shrink-0 active:scale-95 cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Pengaturan Akun</span>
                    </button>
                  </div>

                  {/* ðŸŒŸ KARTU / WIDGET SALDO TONGCOINS (TC) - POSISI PALING ATAS */}
                  <div className="mt-6 bg-gradient-to-r from-emerald-950/70 via-slate-950 to-teal-950/50 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <Coins className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">SALDO TONGCOINS</span>
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded border border-emerald-500/30">1 TC = Rp 1</span>
                        </div>
                        <div className="flex items-baseline gap-2 pt-1">
                          <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                            {(Number(currentUser?.tc_balance) || 0).toLocaleString('id-ID')}
                          </span>
                          <span className="text-base font-black text-emerald-400">TC</span>
                          <span className="text-xs text-slate-400 font-mono">
                            (Rp {(Number(currentUser?.tc_balance) || 0).toLocaleString('id-ID')})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center">
                        <button
                          onClick={() => setActiveTab('tongcoins')}
                          className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#0a101b] font-black rounded-xl text-xs transition shadow-md shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5 text-[#0a101b]" />
                          <span>Top Up TC</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('tongcoins')}
                          className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300 text-xs font-bold rounded-xl transition active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>Riwayat & Dompet</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. BARIS STATISTIK (3 KOLOM) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-8">
                    {/* Kolom 1: Total Pesanan Selesai */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pesanan Selesai</span>
                        <span className="text-xl font-black text-white mt-1 block">{completedOrdersCount} Pesanan</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Kolom 2: Total Transaksi */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Transaksi</span>
                        <span className="text-xl font-black text-blue-400 mt-1 block">Rp {totalSpent.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                        <Coins className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Kolom 3: Pesanan Terakhir */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pesanan Terakhir</span>
                        <span className="text-base sm:text-lg font-bold text-slate-200 mt-1 block truncate">{lastOrderDateText}</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. BANNER LEADERBOARD (Tombol Lebar Biru Terang) */}
                <button
                  onClick={() => navigateTab('leaderboard')}
                  className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-blue-600/25 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] group"
                >
                  <Trophy className="w-5 h-5 text-amber-300 group-hover:scale-110 transition-transform" />
                  <span>ðŸ† Lihat Leaderboard & Peringkat Belanja</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                {/* Kartu Bantuan & Sesi Akun */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Headphones className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Butuh Bantuan Kendala Akun?</div>
                      <div className="text-xs text-slate-400">Tim Customer Care Entong Store siap membantu 24/7.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <a
                      href="https://www.sientong.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md"
                    >
                      <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WA" className="w-4 h-4" />
                      <span>Chat CS Sientong</span>
                    </a>
                    <button
                      onClick={logout}
                      className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto pb-16 animate-fade-in px-4">
            <CustomerSettings onBack={() => navigateTab('profile')} />
          </div>
        )}
      </main>

      {/* SHOPPING CART & DYNAMIC CHECKOUT MODAL */}
      {showCheckoutModal && (
        <CheckoutModal
          onClose={() => setShowCheckoutModal(false)}
          cart={cart}
          cartTotalPrice={cartTotalPrice}
          updateCartQty={updateCartQty}
          removeFromCart={removeFromCart}
          gameUsername={gameUsername}
          setGameUsername={setGameUsername}
          gamePassword={gamePassword}
          setGamePassword={setGamePassword}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerEmail={customerEmail}
          setCustomerEmail={setCustomerEmail}
          initialGameMoney={initialGameMoney}
          setInitialGameMoney={setInitialGameMoney}
          orderNote={orderNote}
          setOrderNote={setOrderNote}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          qrisImageUrl={qrisImageUrl}
          danaNumber={danaNumber}
          danaName={danaName}
          paymentProof={paymentProof}
          setPaymentProof={setPaymentProof}
          onSubmit={handleCheckoutSubmit}
          isSubmitting={isSubmitting}
          setShowQrisExpand={setShowQrisExpand}
          currentUser={currentUser}
          onOpenTongCoins={() => setActiveTab('tongcoins')}
        />
      )}

      {/* GIFT ORDER FORM (STEP 1: collect Roblox username with live checker + avatar) */}
      {giftFormItem && !showCheckoutModal && (
        <GiftOrderFormModal
          item={giftFormItem}
          initialPhone={customerPhone}
          onClose={() => {
            setGiftFormItem(null);
          }}
          onConfirm={handleGiftFormConfirm}
        />
      )}

      {/* GIFT ORDER DELIVERY REQUEST MODAL (POST-PAYMENT) */}
      {giftOrderForRequestModal && (
        <GiftDeliveryModal
          order={giftOrderForRequestModal}
          onClose={() => setGiftOrderForRequestModal(null)}
          onViewDetail={() => {
            setSelectedOrderDetail(giftOrderForRequestModal);
            setActiveTab('tracking');
          }}
        />
      )}

      {/* RULES AGREEMENT INTERCEPTOR MODAL */}
      <RulesAgreementModal
        isOpen={showRulesModal}
        onClose={() => {
          setShowRulesModal(false);
          setPendingBuyItem(null);
        }}
        onAgree={handleAgreeRules}
      />

      {/* LIGHTBOX MODAL BUKTI TRANSFER CUSTOMER */}
      {viewingProofOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="relative bg-[#111b21] p-5 rounded-2xl border border-slate-700 text-center max-w-md w-full shadow-2xl">
            <button 
              onClick={() => setViewingProofOrder(null)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-slate-100 mb-1">Bukti Transfer Order #{viewingProofOrder.id}</h3>
            <p className="text-xs text-slate-400 mb-4">{viewingProofOrder.game_name} - {viewingProofOrder.package_name}</p>
            
            {viewingProofOrder.payment_proof ? (
              <div className="space-y-3">
                <SafeImage 
                  src={viewingProofOrder.payment_proof} 
                  alt="Bukti Transfer Customer" 
                  className="w-full max-h-96 object-contain bg-slate-900 rounded-xl border border-slate-700 shadow-md p-1 mx-auto" 
                />
                <label className="block w-full text-center py-2 px-3 bg-[#202c33] hover:bg-slate-700 text-[#00E676] font-bold rounded-xl text-xs cursor-pointer border border-dashed border-[#00E676]/50 transition-all">
                  <Upload className="w-3.5 h-3.5 inline mr-1" /> Ganti / Upload Ulang Bukti
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result as string;
                          await handleUploadPaymentProof(base64, viewingProofOrder.docUniqueId || viewingProofOrder.id);
                          setViewingProofOrder((prev: any) => prev ? { ...prev, payment_proof: base64, proofOfPayment: base64 } : null);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-8 bg-slate-900 rounded-xl text-slate-500 text-xs italic">
                  Belum ada foto bukti transfer yang diunggah untuk orderan ini.
                </div>
                <label className="block w-full text-center py-3 px-4 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl text-xs cursor-pointer shadow-lg transition-all">
                  <Upload className="w-4 h-4 inline mr-1" /> Upload Bukti Pembayaran Sekarang
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result as string;
                          await handleUploadPaymentProof(base64, viewingProofOrder.docUniqueId || viewingProofOrder.id);
                          setViewingProofOrder((prev: any) => prev ? { ...prev, payment_proof: base64, proofOfPayment: base64 } : null);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            )}
            
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800">
              <span>Metode: <strong className="text-slate-200">{viewingProofOrder.payment_method || 'QRIS'}</strong></span>
              <span>Total: <strong className="text-emerald-400">Rp {(viewingProofOrder?.price ?? 0)?.toLocaleString?.('id-ID')}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* FULL EXPANDED QRIS MODAL */}
      {showQrisExpand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setShowQrisExpand(false)}>
          <div className="relative bg-[#111b21] p-4 sm:p-6 rounded-2xl border border-slate-700 text-center max-w-lg w-full max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowQrisExpand(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 bg-[#202c33] rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-slate-100 mb-3">Barcode QRIS Resmi Entong Store</h3>
            <SafeImage 
              src={qrisImageUrl} 
              alt="QRIS Expanded" 
              className="w-full max-h-[75vh] object-contain mx-auto bg-white p-3 rounded-xl shadow-2xl" 
            />
            <p className="text-xs text-slate-400 mt-3">Scan menggunakan GoPay, OVO, DANA, ShopeePay, BCA Mobile, Mandiri, dll.</p>
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

      {/* MODAL BERI ULASAN REALTIME */}
      {showReviewModal && reviewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#111b21] border border-slate-700 p-6 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Background design */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E676]/5 rounded-bl-full pointer-events-none" />
            
            <button 
              type="button"
              onClick={() => {
                setShowReviewModal(false);
                setReviewOrder(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 bg-slate-800/60 rounded-xl hover:bg-slate-700/80 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black rounded-lg uppercase tracking-wider inline-block mb-2">
                âœï¸ Berikan Review
              </span>
              <h3 className="text-base font-black text-slate-100">Ulasan Pengerjaan Joko</h3>
              <p className="text-xs text-slate-400 mt-1">
                Berikan ulasan Anda untuk pesanan <strong className="text-white">{reviewOrder.package_name}</strong> pada game <strong className="text-blue-400">{reviewOrder.game_name}</strong>.
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star rating picker */}
              <div className="bg-[#1e293b]/30 p-4 rounded-xl border border-slate-800/60 text-center space-y-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Rating Bintang ({reviewRating} / 5)
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-125 transition-all focus:outline-none cursor-pointer"
                    >
                      <Star 
                        className={`w-8 h-8 ${
                          star <= reviewRating 
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' 
                            : 'text-slate-600'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">
                  {reviewRating === 5 ? 'ðŸ”¥ Sangat Puas / Satset Gacor!' :
                   reviewRating === 4 ? 'âœ¨ Puas / Fast Respon!' :
                   reviewRating === 3 ? 'ðŸ‘ Cukup / Standar' :
                   reviewRating === 2 ? 'âš ï¸ Kurang Puas' : 'âŒ Kecewa'}
                </p>
              </div>

              {/* Comment text input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Komentar / Catatan Ulasan
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Contoh: fast respon mantap, satset langsung masuk!..."
                  rows={3}
                  required
                  maxLength={200}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
                <div className="text-right text-[10px] text-slate-500">
                  {reviewComment.length} / 200 karakter
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewOrder(null);
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-700/50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReview ? 'Mengirim...' : 'Kirim Ulasan Realtime'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL TERIMA KASIH */}
      {showThankYouModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-blue-500/40 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/10 rounded-bl-full pointer-events-none" />
            <div className="text-4xl mb-3">ðŸŽ‰</div>
            <h3 className="text-blue-400 font-extrabold text-sm uppercase tracking-wide mb-2">
              TERIMA KASIH ATAS ULASAN ANDA!
            </h3>
            <p className="text-slate-300 text-xs mb-5 leading-relaxed">
              Ulasan Anda telah berhasil terkirim dan sangat berharga bagi peningkatan kualitas pelayanan <strong>Entong Store</strong>.
            </p>
            <button
              onClick={() => setShowThankYouModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              [ âœ… Tutup ]
            </button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (5 ITEMS: BERANDA, PRODUK, PESANAN, TESTIMONI, PROFIL) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full z-[100] bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-1 py-1.5 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => navigateTab('home')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'home' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <HomeIcon className="w-5 h-5" />
          <span>Beranda</span>
        </button>

        <button
          onClick={() => window.location.href = '/gpdragdrivesim'}
          className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl text-[10px] font-bold transition-all relative ${activeTab === 'catalog' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartTotalItems > 0 && (
              <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                {cartTotalItems}
              </span>
            )}
          </div>
          <span>Produk</span>
        </button>

        <button
          onClick={() => navigateTab('tracking')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl text-[10px] font-bold transition-all relative ${activeTab === 'tracking' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <div className="relative">
            <Clock className="w-5 h-5" />
            {myOrders.length > 0 && (
              <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[9px] font-bold flex items-center justify-center">
                {myOrders.length}
              </span>
            )}
          </div>
          <span>Pesanan</span>
        </button>

        <button
          onClick={() => navigateTab('testimoni')}
          className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'testimoni' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Star className="w-5 h-5" />
          <span>Testimoni</span>
        </button>

        <button
          onClick={() => handleProtectedAction(() => navigateTab('profile'))}
          className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl text-[10px] font-bold transition-all ${activeTab === 'profile' || activeTab === 'settings' ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <User className="w-5 h-5" />
          <span>Profil</span>
        </button>
      </nav>

      {/* MODAL ADD FRIEND OFFICIAL */}
      {showAddFriendModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#151B2B] border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-left shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-black text-sm uppercase tracking-wide">
                  Add Friend Game Official
                </h3>
              </div>
              <button
                onClick={() => setShowAddFriendModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 my-3 leading-relaxed">
              Silakan add friend akun resmi kami untuk mempercepat proses joko atau gift item in-game:
            </p>

            <div className="space-y-2.5">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Roblox Username</span>
                  <span className="text-xs font-mono font-bold text-blue-400">EntongStoreOfficial</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('EntongStoreOfficial');
                    alert('Roblox username berhasil disalin!');
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                >
                  Salin
                </button>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Mobile Legends ID</span>
                  <span className="text-xs font-mono font-bold text-blue-400">889123019 (2102)</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('889123019');
                    alert('Mobile Legends ID berhasil disalin!');
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                >
                  Salin
                </button>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Valorant Riot ID</span>
                  <span className="text-xs font-mono font-bold text-blue-400">EntongStore#ID1</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('EntongStore#ID1');
                    alert('Riot ID berhasil disalin!');
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                >
                  Salin
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowAddFriendModal(false)}
              className="w-full mt-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition shadow-lg cursor-pointer"
            >
              Selesai / Tutup
            </button>
          </div>
        </div>
      )}

      {/* FLOATING CHAT BUTTON (BOTTOM RIGHT) */}
      {!isChatPopupOpen && !showCheckoutModal && (
        <button
          onClick={openChatAdmin}
          className="fixed z-[999] right-4 bottom-24 md:bottom-8 md:right-8 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl p-3.5 md:px-5 md:py-3.5 flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 border border-blue-400/40 cursor-pointer group"
          title="Buka Chat Admin"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-blue-600 animate-pulse" />
          </div>
          <span className="hidden md:inline font-bold text-xs tracking-wide">
            Chat Admin
          </span>
        </button>
      )}

      {/* CHAT ADMIN POPUP WIDGET (MOBILE FULLSCREEN, DESKTOP FLOATING MODAL) */}
      {isChatPopupOpen && (
        <CustomerChat
          isFloating={true}
          onClose={() => {
            setIsChatPopupOpen(false);
            setPrefilledChatMessage('');
            setTargetOrderIdForChat('');
            setActiveOrderForChat(null);
          }}
          cartTotalItems={cartTotalItems}
          prefilledMessage={prefilledChatMessage}
          targetOrderId={targetOrderIdForChat}
          activeOrder={activeOrderForChat}
        />
      )}

      {/* AUTH MODAL DIALOG */}
      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)} 
        />
      )}

      {/* CUSTOMER NOTIFICATIONS POPUP & MOBILE DRAWER */}
      <CustomerNotifications
        currentUser={currentUser}
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onNavigateTab={(tab) => {
          navigateTab(tab as any);
        }}
        onOpenChat={openChatAdmin}
        onSelectOrder={(ordId) => {
          navigateTab('tracking');
          setOrderSearchQuery(ordId);
        }}
        orders={myOrders}
      />

      {/* ðŸš€ Floating Install PWA prompt (mobile bottom bar) */}
      <InstallPWAButton variant="floating" />

    </div>
  );
};

