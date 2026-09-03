import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { UserProfile, GameOrder, ChatMessage, GameItem, QuickReplyTemplate, StaffAttendanceRecord, FinanceRecord, OrderStatus, UserRole, CloudInstance, CoinTransaction } from '../types';
import { DEFAULT_QUICK_REPLIES } from '../utils/quickRepliesData';
import { getDeviceHwid } from '../utils/deviceFingerprint';
import { collection, onSnapshot, query, limit, setDoc, doc, updateDoc, deleteDoc, serverTimestamp, increment, orderBy, writeBatch, getDoc, getDocFromServer, where, addDoc, getDocs, collectionGroup, arrayUnion, startAfter } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, messaging, getSafeTimestamp, getPureCreationTime, extractTimeMs, syncUserToFirestore } from '../lib/firebase';
import { updateOrderStatusGlobal } from '../utils/orderUtils';
import { isJunkBotOrder, isTopUpTcOrder } from '../lib/orderRefund';
import { safeGetJSON, safeSetJSON, safeRemoveItem } from '../utils/safeStorage';
import { getCachedCatalogs, setCachedCatalogs } from '../utils/productCache';
import { normalizePhone, syncGuestOrdersToUser } from '../utils/phoneUtils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

interface AppContextType {
  currentUser: UserProfile | null;
  setCurrentUser: (u: UserProfile | null) => void;
  authLoading: boolean;
  users: UserProfile[];
  orders: GameOrder[];
  chats: any[];
  setChats: React.Dispatch<React.SetStateAction<any[]>>;
  unreadChats: any[];
  loadMoreChats: () => Promise<void>;
  hasMoreChats: boolean;
  isLoadingMoreChats: boolean;
  activeMessages: ChatMessage[];
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;
  customerMainRoomId: string | null;
  items: GameItem[];
  quickReplies: QuickReplyTemplate[];
  attendance: StaffAttendanceRecord[];
  finance: FinanceRecord[];
  isOnlinePB: boolean;
  mutedUsers: Record<string, number>;
  isUserMuted: (idOrPhone: string) => boolean;
  getMuteRemainingSeconds: (idOrPhone: string) => number;
  muteUser: (idOrPhone: string, minutes: number) => void;
  unmuteUser: (idOrPhone: string) => void;
  banUser: (userId: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
  isUserBanned: (userId: string) => boolean;
  adminStatus: 'ONLINE' | 'OFFLINE';
  qrisImageUrl: string;
  danaNumber: string;
  danaName: string;
  storeAvatarUrl: string;
  adminWhatsappNumber: string;
  updatePaymentSettings: (fields: { qrisImageUrl?: string, danaNumber?: string, danaName?: string, storeAvatarUrl?: string, adminStatus?: 'ONLINE' | 'OFFLINE', adminWhatsappNumber?: string, adminWhatsapp?: string }) => Promise<void>;
  storeOpenHour: number;
  storeCloseHour: number;
  storeAutoHours: boolean;
  storeForceStatus: 'AUTO' | 'OPEN' | 'CLOSED';
  storeClosedNoticeText: string;
  isStoreClosed: boolean;
  updateStoreSettings: (fields: { storeOpenHour?: number, storeCloseHour?: number, storeAutoHours?: boolean, storeForceStatus?: 'AUTO' | 'OPEN' | 'CLOSED', storeClosedNoticeText?: string }) => Promise<void>;
  login: (i: string, p: string) => Promise<{success: boolean; error?: string}>;
  register: (n: string, u: string, p: string, pass: string, providedHwid?: string) => Promise<{success: boolean; error?: string; remainingSeconds?: number}>;
  logout: () => void;
  createOrder: (o: Omit<GameOrder, 'id' | 'created' | 'updated'>) => Promise<string>;
  updateOrderStatus: (id: string, s: OrderStatus, wid?: string, wname?: string) => Promise<void>;
  sendMessage: (id: string, t: string, mUrl?: string, mType?: 'IMAGE'|'VIDEO', qr?: boolean, msgType?: string) => Promise<void>;
  clearOrderChats: (id: string) => Promise<void>;
  purgeEmptyChats: () => Promise<number>;
  markChatAsRead: (id: string, role?: UserRole) => Promise<void>;
  saveItem: (i: GameItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  saveQuickReply: (q: QuickReplyTemplate) => Promise<void>;
  deleteQuickReply: (id: string) => Promise<void>;
  custCounter: number;
  getNextCustCode: () => string;
  saveUser: (u: UserProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateOrder: (o: GameOrder) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  checkInStaff: (id: string, name: string) => Promise<void>;
  checkOutStaff: (id: string) => Promise<void>;
  addFinanceRecord: (r: Omit<FinanceRecord, 'id'>) => Promise<void>;
  submitCount: number;
  lastSubmitTime: number;
  isRateLimited: boolean;
  captchaQuestion: { num1: number; num2: number; op: string; answer: number };
  refreshCaptcha: () => void;
  optimizeDatabase: () => void;
  resetQuotaExceeded: () => void;
  chatNotes: Record<string, string>;
  saveChatNote: (id: string, n: string) => void;
  totalUnreadCount: number;
  clouds: CloudInstance[];
  saveCloud: (cloudData: Partial<CloudInstance>) => Promise<string>;
  deleteCloud: (cloudId: string) => Promise<void>;
  assignOrderToCloud: (cloudId: string, orderId: string) => Promise<void>;
  releaseOrderFromCloud: (cloudId: string) => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

const cleanFirestorePayload = (obj: any) => {
  const clean = { ...obj };
  Object.keys(clean).forEach(key => {
    if (clean[key] === undefined) {
      delete clean[key];
    }
  });
  return clean;
};


export const formatDate = (timestamp: any): string => {
  if (!timestamp) return '';
  try {
    let date: Date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('id-ID');
  } catch (err) {
    return '';
  }
};


export const formatChatTime = (timestamp: any): string => {
  if (!timestamp) return 'Baru saja';
  
  let date: Date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return 'Baru saja';

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

export const formatTime = (timestamp: any): string => {
  if (!timestamp) return '';
  try {
    let date: Date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} WIB`;
  } catch (err) {
    return '';
  }
};

const extractGameItemsFromCatalogs = (catalogs: any[]): GameItem[] => {
  const allItems: GameItem[] = [];
  (catalogs || []).forEach(cat => {
    if (cat.pricelists && Array.isArray(cat.pricelists)) {
      cat.pricelists.forEach((pkg: any) => {
        allItems.push({
          id: pkg.id,
          game_name: cat.title,
          package_name: pkg.name,
          category: cat.category,
          price: pkg.price,
          description: pkg.description || '',
          estimated_time: pkg.estimatedTime || '',
          is_closed: pkg.is_closed,
        });
      });
    }
  });
  return allItems;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const savedUser = safeGetJSON<UserProfile | null>('entong_user_session', null) ||
                      safeGetJSON<UserProfile | null>('entong_active_user', null) ||
                      safeGetJSON<UserProfile | null>('entong_local_user', null);
    return savedUser && typeof savedUser === 'object' ? savedUser : null;
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);

  // 🚀 ANTI-LAG PROCESSOR: Memetakan rawOrders menjadi array orderan yang dinormalisasi & terurut kronologis (Khusus Joko & Gift, Non Top-Up TC)
  const orders = useMemo(() => {
    const list = rawOrders.map((doc: any) => {
      if (!doc || isJunkBotOrder(doc) || isTopUpTcOrder(doc)) return null;
      const pureTime = extractTimeMs(doc) || getPureCreationTime(doc);
      const customer_name = doc.customer_name || doc.customer_username || doc.name || doc.userName || doc.customerName || 'Customer';
      const roblox_username = doc.roblox_username || doc.game_user_id || doc.username_roblox || doc.username || doc.robloxUsername || doc.game_username || doc.targetUsername || '-';
      const package_name = doc.package_name || doc.item_name || doc.game_name || doc.product_name || doc.packageName || doc.gameName || 'Item Joko/Gift';
      const game_name = doc.game_name || doc.gameName || doc.product_name || doc.category || 'Gamepass / Joko';
      const price = Number(doc.price || doc.total_price || doc.amount || doc.totalPrice || 0);
      const status = doc.status || doc.orderStatus || 'Booking';
      const payment_proof = doc.payment_proof || doc.proof_url || doc.image_proof || doc.proofUrl || doc.proofOfPayment || '';
      const payment_status = doc.payment_status || doc.status_pembayaran || doc.paymentStatus || (doc.is_paid ? 'Lunas' : 'Menunggu Verifikasi');
      const customer_phone = doc.customer_phone || doc.customerPhone || doc.whatsapp || doc.phone || '';

      return {
        ...doc,
        id: doc.id || doc.docUniqueId,
        docUniqueId: doc.docUniqueId || doc.id,
        firestoreId: doc.firestoreId || doc.id,
        orderId: doc.orderId || (doc.id?.startsWith('ORD-') ? doc.id : `#ORD-${(doc.id || '0000').slice(-6).toUpperCase()}`),
        customer_name,
        customerName: customer_name,
        roblox_username,
        robloxUsername: roblox_username,
        game_username: roblox_username,
        targetUsername: roblox_username,
        package_name,
        packageName: package_name,
        game_name,
        gameName: game_name,
        price,
        totalPrice: price,
        status,
        orderStatus: status,
        payment_proof,
        proofUrl: payment_proof,
        proofOfPayment: payment_proof,
        payment_status,
        paymentStatus: payment_status,
        customer_phone,
        customerPhone: customer_phone,
        whatsapp: customer_phone,
        pureTime,
        initialCreationTime: pureTime,
        createdTimestamp: pureTime,
        sortTime: pureTime
      };
    }).filter(Boolean);

    list.sort((a: any, b: any) => {
      const timeA = extractTimeMs(a) || a.pureTime || 0;
      const timeB = extractTimeMs(b) || b.pureTime || 0;
      return timeB - timeA;
    });

    return list as GameOrder[];
  }, [rawOrders]);

  const [chats, setChats] = useState<any[]>([]);
  const [unreadChats, setUnreadChats] = useState<any[]>([]);
  const [hasMoreChats, setHasMoreChats] = useState<boolean>(true);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState<boolean>(false);
  const lastVisibleChatDocRef = useRef<any>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [customerMainRoomId, setCustomerMainRoomId] = useState<string | null>(null);
  const [items, setItems] = useState<GameItem[]>(() => extractGameItemsFromCatalogs(getCachedCatalogs()));
  const [clouds, setClouds] = useState<CloudInstance[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendanceRecord[]>([]);
  const [finance, setFinance] = useState<FinanceRecord[]>([]);
  const [isOnlinePB, setIsOnlinePB] = useState(true);
  const [mutedUsers, setMutedUsers] = useState<Record<string, number>>({});
  
  const [adminStatus, setAdminStatus] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const lastAdminHeartbeatRef = useRef<number>(0);

  const [qrisImageUrl, setQrisImageUrl] = useState('');
  const [danaNumber, setDanaNumber] = useState('');
  const [danaName, setDanaName] = useState('');
  const [storeAvatarUrl, setStoreAvatarUrl] = useState('');
  const [adminWhatsappNumber, setAdminWhatsappNumber] = useState<string>('081234567890');

  useEffect(() => {
    const avatarToUse = storeAvatarUrl || "/logo-entong.png";
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = avatarToUse;
  }, [storeAvatarUrl]);

  const [storeOpenHour, setStoreOpenHour] = useState<number>(9);
  const [storeCloseHour, setStoreCloseHour] = useState<number>(23);
  const [storeAutoHours, setStoreAutoHours] = useState<boolean>(true);
  const [storeForceStatus, setStoreForceStatus] = useState<'AUTO' | 'OPEN' | 'CLOSED'>('AUTO');
  const [storeClosedNoticeText, setStoreClosedNoticeText] = useState<string>('Mohon maaf, toko sedang tutup. Jam operasional pukul 09:00 - 23:00 WIB. Silakan tinggalkan pesan, kami akan balas segera saat buka!');
  
  const [chatNotes, setChatNotes] = useState<Record<string, string>>({});
  const [submitCount, setSubmitCount] = useState<number>(0);
  const [lastSubmitTime, setLastSubmitTime] = useState<number>(0);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 3, num2: 4, op: '+', answer: 7 });

  const isStoreClosed = (() => {
    if (storeForceStatus === 'OPEN' || (storeForceStatus as string) === 'FORCE_OPEN') return false;
    if (storeForceStatus === 'CLOSED' || (storeForceStatus as string) === 'FORCE_CLOSE') return true;
    const currentHour = new Date().getHours();
    const open = storeOpenHour ?? 9;
    const close = storeCloseHour ?? 23;
    if (open < close) {
      return currentHour < open || currentHour >= close;
    } else {
      return !(currentHour >= open || currentHour < close);
    }
  })();

  const getNextCustCode = () => { return "CUST-00" + Math.floor(Math.random()*1000); };
  
  const updatePaymentSettings = async (fields: { qrisImageUrl?: string, danaNumber?: string, danaName?: string, storeAvatarUrl?: string, adminStatus?: 'ONLINE' | 'OFFLINE', adminWhatsappNumber?: string, adminWhatsapp?: string }) => {
    try {
      if (fields.adminStatus !== undefined) {
         const isOnlineBool = fields.adminStatus === 'ONLINE';
         await setDoc(doc(db, 'settings', 'store'), {
           isOnline: isOnlineBool,
           activeMode: isOnlineBool ? 'ONLINE_MANUAL' : 'OFFLINE_MANUAL',
           updatedAt: new Date().toISOString()
         }, { merge: true });
         await setDoc(doc(db, 'settings', 'admin_status'), {
           isOnline: isOnlineBool,
           status: fields.adminStatus,
           last_heartbeat: isOnlineBool ? Date.now() : 0,
           updated: new Date().toISOString()
         }, { merge: true });
         await setDoc(doc(db, 'settings', 'status'), {
           isOnline: isOnlineBool,
           status: fields.adminStatus,
           updated: new Date().toISOString()
         }, { merge: true });
         setAdminStatus(fields.adminStatus);
      }
      
      const whatsappVal = fields.adminWhatsappNumber || fields.adminWhatsapp;
      if (whatsappVal !== undefined) {
        // NEW: Save to settings/whatsapp as requested
        await setDoc(doc(db, 'settings', 'whatsapp'), {
          giftAdminNumber: whatsappVal,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setAdminWhatsappNumber(whatsappVal);
        await setDoc(doc(db, 'settings', 'store'), {
          adminWhatsapp: whatsappVal,
          adminWhatsappNumber: whatsappVal,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      const cleanFields = cleanFirestorePayload({
        ...(fields.qrisImageUrl !== undefined && { qrisImageUrl: fields.qrisImageUrl }),
        ...(fields.danaNumber !== undefined && { danaNumber: fields.danaNumber }),
        ...(fields.danaName !== undefined && { danaName: fields.danaName }),
        ...(fields.storeAvatarUrl !== undefined && { storeAvatarUrl: fields.storeAvatarUrl }),
        ...(whatsappVal !== undefined && { adminWhatsapp: whatsappVal, adminWhatsappNumber: whatsappVal }),
        updated: new Date().toISOString()
      });
      
      if (Object.keys(cleanFields).length > 1) {
         await setDoc(doc(db, 'settings', 'payment'), cleanFields, { merge: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateStoreSettings = async (fields: { storeOpenHour?: number, storeCloseHour?: number, storeAutoHours?: boolean, storeForceStatus?: 'AUTO' | 'OPEN' | 'CLOSED', storeClosedNoticeText?: string }) => {
    try {
      const cleanFields = cleanFirestorePayload({
        ...(fields.storeOpenHour !== undefined && { storeOpenHour: Number(fields.storeOpenHour) }),
        ...(fields.storeCloseHour !== undefined && { storeCloseHour: Number(fields.storeCloseHour) }),
        ...(fields.storeAutoHours !== undefined && { storeAutoHours: Boolean(fields.storeAutoHours) }),
        ...(fields.storeForceStatus !== undefined && { storeForceStatus: fields.storeForceStatus }),
        ...(fields.storeClosedNoticeText !== undefined && { storeClosedNoticeText: fields.storeClosedNoticeText }),
        updated: new Date().toISOString()
      });
      await setDoc(doc(db, 'settings', 'store'), {
        ...(fields.storeOpenHour !== undefined && { openHour: Number(fields.storeOpenHour), storeOpenHour: Number(fields.storeOpenHour) }),
        ...(fields.storeCloseHour !== undefined && { closeHour: Number(fields.storeCloseHour), storeCloseHour: Number(fields.storeCloseHour) }),
        ...(fields.storeForceStatus !== undefined && { storeMode: fields.storeForceStatus, storeForceStatus: fields.storeForceStatus }),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await setDoc(doc(db, 'settings', 'store_hours'), cleanFields, { merge: true });
      if (fields.storeClosedNoticeText !== undefined) {
        await setDoc(doc(db, 'settings', 'announcement'), {
          text: fields.storeClosedNoticeText,
          announcement: fields.storeClosedNoticeText,
          message: fields.storeClosedNoticeText,
          updated: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isUserMuted = (idOrPhone: string) => {
    const u = usersRef.current.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone) || users.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone);
    if (u?.mutedUntil) {
      const mutedUntilMs = new Date(u.mutedUntil).getTime();
      if (Date.now() < mutedUntilMs) return true;
    }
    if (!mutedUsers[idOrPhone]) return false;
    return Date.now() < mutedUsers[idOrPhone];
  };

  const getMuteRemainingSeconds = (idOrPhone: string) => {
    const u = usersRef.current.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone) || users.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone);
    if (u?.mutedUntil) {
      const mutedUntilMs = new Date(u.mutedUntil).getTime();
      const diff = mutedUntilMs - Date.now();
      if (diff > 0) return Math.floor(diff / 1000);
    }
    if (!mutedUsers[idOrPhone]) return 0;
    const diff = mutedUsers[idOrPhone] - Date.now();
    return diff > 0 ? Math.floor(diff / 1000) : 0;
  };

  const muteUser = async (idOrPhone: string, minutes: number) => {
    setMutedUsers(prev => ({ ...prev, [idOrPhone]: Date.now() + minutes * 60000 }));
    try {
      const u = usersRef.current.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone) || users.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone);
      const targetId = u?.id || idOrPhone;
      const mutedUntilTime = new Date(Date.now() + minutes * 60000).toISOString();
      await updateDoc(doc(db, 'users', targetId), { mutedUntil: mutedUntilTime });
    } catch (e) {
      console.error('Failed to sync mute status to Firestore:', e);
    }
  };

  const unmuteUser = async (idOrPhone: string) => {
    setMutedUsers(prev => {
      const copy = { ...prev };
      delete copy[idOrPhone];
      return copy;
    });
    try {
      const u = usersRef.current.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone) || users.find(usr => usr.id === idOrPhone || usr.phone === idOrPhone);
      const targetId = u?.id || idOrPhone;
      await updateDoc(doc(db, 'users', targetId), { mutedUntil: null });
    } catch (e) {
      console.error('Failed to sync unmute status to Firestore:', e);
    }
  };

  const banUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBanned: true,
        bannedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to ban user:', e);
    }
  };

  const unbanUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBanned: false,
        bannedAt: null
      });
    } catch (e) {
      console.error('Failed to unban user:', e);
    }
  };

  const isUserBanned = (userId: string) => {
    const u = usersRef.current.find(u => u.id === userId) || users.find(u => u.id === userId);
    return !!u?.isBanned;
  };

  const usersRef = useRef<UserProfile[]>([]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'settings', 'payment'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or internet connection.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkRedirect = async () => {
      try {
        const { getRedirectResult } = await import('firebase/auth');
        const result = await getRedirectResult(auth);
        if (!isMounted) return;
        if (result?.user) {
          const user = result.user;
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = { id: user.uid, ...userDoc.data() } as UserProfile;
            setCurrentUser(userData);
            localStorage.setItem('entong_active_user', JSON.stringify(userData));
          } else {
            // Handle new user from redirect if needed
            const rawEmailPrefix = user.email ? user.email.split('@')[0] : `user_${user.uid.slice(0, 5)}`;
            const cleanUsername = rawEmailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');
            const newUser: UserProfile = {
              id: user.uid,
              name: user.displayName || 'Pelanggan Entong Store',
              username: cleanUsername,
              email: user.email || '',
              phone: user.phoneNumber || '-',
              role: 'CUSTOMER',
              created: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', user.uid), newUser);
            if (isMounted) {
              setCurrentUser(newUser);
            }
            localStorage.setItem('entong_active_user', JSON.stringify(newUser));
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err || '');
        // Suppress expected iframe/IndexedDB lifecycle errors (e.g. database closing, database is hidden, tab switching)
        if (
          !errMsg.includes('Database is closing') && 
          !errMsg.includes('Database is hidden') && 
          !errMsg.includes('closing/hidden') && 
          !errMsg.includes('connection is closing')
        ) {
          console.warn("Redirect recovery notice:", errMsg);
        }
      }
    };
    checkRedirect();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // 1. Pulihkan sesi lokal seketika saat browser refresh (Crash-proof)
    const savedUser = safeGetJSON<UserProfile | null>('entong_user_session', null) ||
                      safeGetJSON<UserProfile | null>('entong_active_user', null) ||
                      safeGetJSON<UserProfile | null>('entong_local_user', null);
    if (savedUser && typeof savedUser === 'object') {
      setCurrentUser(savedUser);
    }

    let userDocUnsub: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (user) {
        try {
          userDocUnsub = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
            let userData: UserProfile | null = null;
            if (userDoc.exists()) {
              const data = userDoc.data();
              const rawBal = Number(data.tongCoins ?? data.tc_balance ?? data.tongcoins ?? data.balance ?? 0);
              userData = {
                id: userDoc.id,
                uid: userDoc.id,
                ...data,
                tc_balance: rawBal,
                tongCoins: rawBal,
                tongcoins: rawBal,
                balance: rawBal
              } as unknown as UserProfile;
            } else {
              if (user.email === 'admin@entong.com' || user.email === 'owner@entong.com' || user.email === 'entong@entong.com') {
                const isOwner = user.email === 'owner@entong.com';
                userData = {
                  id: user.uid,
                  uid: user.uid,
                  name: isOwner ? 'Ceo Entong' : 'Admin Entong',
                  username: isOwner ? 'own' : 'entong',
                  email: user.email,
                  phone: isOwner ? '08123456789' : '08123456788',
                  role: isOwner ? 'OWNER' : 'ADMIN',
                  isStaff: true,
                  created: new Date().toISOString()
                } as UserProfile;
                await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
              }
            }

            if (userData) {
              // Cross-check: jika users/{uid} tidak punya role staff, periksa koleksi `staff`
              // untuk mencegah staff ter-reset menjadi CUSTOMER ketika users/{uid} kosong/stale.
              const roleUpper = (userData.role || '').toString().toUpperCase();
              const looksLikeStaff = userData.isStaff === true ||
                ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes(roleUpper);
              if (!looksLikeStaff) {
                try {
                  const staffSnap = await getDoc(doc(db, 'staff', user.uid));
                  if (staffSnap.exists()) {
                    const sd = staffSnap.data() as any;
                    const sdRole = (sd.role || '').toString().toUpperCase();
                    if (sd.isStaff === true || ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes(sdRole)) {
                      userData = { ...userData, ...sd, id: user.uid, uid: user.uid, isStaff: true, role: sdRole };
                      setDoc(doc(db, 'users', user.uid), userData, { merge: true }).catch(() => {});
                    }
                  }
                } catch {}
              }

              if (userData.isBanned === true) {
                await signOut(auth);
                safeRemoveItem('entong_user_session');
                safeRemoveItem('entong_active_user');
                safeRemoveItem('entong_local_user');
                setCurrentUser(null);
                setAuthLoading(false);
                return;
              }
              setCurrentUser(userData);
              safeSetJSON('entong_user_session', userData);
              safeSetJSON('entong_active_user', userData);
            }
            setAuthLoading(false);
          }, (err) => {
            console.error("User doc snapshot error:", err);
            setAuthLoading(false);
          });
        } catch (err) {
          console.error("Auth fetch user error", err);
          setAuthLoading(false);
        }
      } else {
        const local = safeGetJSON<UserProfile | null>('entong_user_session', null) ||
                      safeGetJSON<UserProfile | null>('entong_active_user', null) ||
                      safeGetJSON<UserProfile | null>('entong_local_user', null);
        if (local && typeof local === 'object') {
          setCurrentUser(local);
        } else {
          setCurrentUser(null);
        }
        setAuthLoading(false);
      }
    });

    return () => {
      if (userDocUnsub) userDocUnsub();
      unsub();
    };
  }, []);

  // Register FCM and start foreground notification listener
  useEffect(() => {
    if (!currentUser || typeof window === 'undefined') return;

    let active = true;

    const setupFCM = async () => {
      try {
        if (!('serviceWorker' in navigator) || !messaging) {
          console.log('FCM or Service Workers not supported/available in this browser.');
          return;
        }

        // Register Service Worker if not registered
        let registration: ServiceWorkerRegistration;
        try {
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
          });
          console.log('Firebase Messaging Service Worker registered:', registration);
        } catch (swErr) {
          console.warn('Failed to register service worker:', swErr);
          return;
        }

        // Request Notification permission
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }

        if (Notification.permission === 'granted' && active) {
          const { getToken } = await import('firebase/messaging');
          // Retrieve FCM token
          const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: 'BMk_Xj5wz4b7G46ZfH0nFvE3S1oY6Gg8tG_rQzS4-vR1G3-m_E_Z7Yh0f0l_eA_vO0t9_c_S7Z-F-w'
          }).catch(async (tokenErr) => {
            console.warn('FCM getToken with VAPID key failed, trying without VAPID key:', tokenErr);
            return await getToken(messaging, { serviceWorkerRegistration: registration });
          });

          if (token && active) {
            console.log('🔥 FCM Device Token retrieved:', token);
            await setDoc(doc(db, 'users', currentUser.id), {
              fcmToken: token,
              fcmTokens: [token]
            }, { merge: true });
          }
        }
      } catch (err) {
        console.warn('FCM registration or setup failed:', err);
      }
    };

    setupFCM();

    // Foreground messages handler
    let unsubscribeForeground: (() => void) | undefined;
    if (messaging) {
      import('firebase/messaging').then(({ onMessage }) => {
        if (!active) return;
        unsubscribeForeground = onMessage(messaging, (payload) => {
          console.log('Foreground notification received:', payload);
          if (Notification.permission === 'granted') {
            const title = payload.notification?.title || payload.data?.title || 'Entong Store';
            const body = payload.notification?.body || payload.data?.body || 'Ada notifikasi baru!';
            new Notification(title, {
              body,
              icon: '/favicon.ico',
              badge: '/favicon.ico'
            });
          }
        });
      }).catch(err => console.warn('Failed to bind onMessage handler:', err));
    }

    return () => {
      active = false;
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, [currentUser]);

  
  // Anti-spam throttling map
  const lastPushSentMap = new Map<string, { time: number, count: number }>();

  const triggerPushNotification = async (fcmToken: string | string[], title: string, body: string, data?: any) => {
    if (!fcmToken) return;
    const tokens = Array.isArray(fcmToken) ? fcmToken : [fcmToken];
    if (tokens.length === 0) return;

    // Throttling logic (anti-spam) per user/chat
    const throttleKey = tokens[0]; 
    const now = Date.now();
    const lastSent = lastPushSentMap.get(throttleKey);
    
    if (lastSent) {
      if (now - lastSent.time < 3000) {
        lastSent.count++;
        if (lastSent.count >= 3) {
           console.log('Push skipped to prevent spam.');
           return; // Skip if >= 3 messages within 3 seconds
        }
      } else {
        lastPushSentMap.set(throttleKey, { time: now, count: 1 });
      }
    } else {
      lastPushSentMap.set(throttleKey, { time: now, count: 1 });
    }

    try {
      // Use the local API route
      const payload = {
        tokens: tokens,
        title,
        body,
        data: data || {}
      };

      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log('Push notification response:', await response.json());
    } catch (err) {
      console.error('Failed to send push notification via API:', err);
    }
  };// PILAR 1 & 2: RESOLUSI ROOM CUSTOMER (KUSTOMER TERDAFTAR & GUEST)
  useEffect(() => {
    const getCustomerRoomId = () => {
      if (currentUser?.id) {
        return `room_${currentUser.id}`;
      }
      return null;
    };

    const mainRoomId = getCustomerRoomId();
    setCustomerMainRoomId(mainRoomId);
  }, [currentUser]);

  // Helper mapper for room document to unified state (Single Source of Truth)
  const mapDocToRoom = (docSnap: any) => {
    const data = docSnap.data({ serverTimestamps: 'estimate' }) || {};
    const roomId = docSnap.id;
    
    let customerId = data.customerId || data.customer_id;
    if (!customerId) {
      if (roomId.startsWith('direct-')) {
        customerId = roomId.replace('direct-', '');
      } else if (roomId.startsWith('room_')) {
        customerId = roomId.replace('room_', '');
      } else {
        customerId = roomId;
      }
    }
    
    let displayName = data.customerName || data.customer_name;
    if (customerId) {
      const matchedUser = usersRef.current.find(u => u.id === customerId);
      if (matchedUser && matchedUser.name) {
        displayName = matchedUser.name;
      }
    }
    
    if (!displayName || displayName.startsWith('CUST-') || displayName.startsWith('Cust-') || displayName === 'Customer') {
      displayName = data.customerName || data.customer_name || 'Customer';
    }

    // Unread count normalization (Single Source of Truth)
    const rawAdminUnread = typeof data.unreadAdminCount === 'number' 
      ? data.unreadAdminCount 
      : (typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    const rawCustomerUnread = typeof data.unreadCustomerCount === 'number' 
      ? data.unreadCustomerCount 
      : (typeof data.customerUnread === 'number' ? data.customerUnread : 0);
    const isUnreadByAdminFlag = data.unreadByAdmin === true || data.unread_by_admin === true;
    const isAdminRead = (data.is_read_admin === true || data.isReadByAdmin === true) && !isUnreadByAdminFlag && rawAdminUnread === 0;
    const isCustRead = (data.is_read_customer === true || data.isReadByCustomer === true) && rawCustomerUnread === 0;

    let computedUnreadAdmin = 0;
    if (isAdminRead) {
      computedUnreadAdmin = 0;
    } else if (rawAdminUnread > 0) {
      computedUnreadAdmin = rawAdminUnread;
    } else if (isUnreadByAdminFlag) {
      computedUnreadAdmin = 1;
    } else if (data.last_sender_role === 'CUSTOMER' || data.last_sender_role === 'customer' || data.lastSender === 'customer' || data.last_sender === 'customer') {
      computedUnreadAdmin = 1;
    }

    // Extract last message text with comprehensive fallbacks
    let lastMsg = '';
    if (typeof data.lastMessage === 'string' && data.lastMessage.trim()) {
      lastMsg = data.lastMessage.trim();
    } else if (typeof data.last_message === 'string' && data.last_message.trim()) {
      lastMsg = data.last_message.trim();
    } else if (data.lastMessage?.message) {
      lastMsg = String(data.lastMessage.message).trim();
    } else if (data.lastMessage?.text) {
      lastMsg = String(data.lastMessage.text).trim();
    } else if (typeof data.lastMessageText === 'string' && data.lastMessageText.trim()) {
      lastMsg = data.lastMessageText.trim();
    } else if (data.latestMessage?.text) {
      lastMsg = String(data.latestMessage.text).trim();
    } else if (data.latestMessage?.message) {
      lastMsg = String(data.latestMessage.message).trim();
    } else if (typeof data.text === 'string' && data.text.trim()) {
      lastMsg = data.text.trim();
    } else if (typeof data.message === 'string' && data.message.trim()) {
      lastMsg = data.message.trim();
    }

    // Extract last message time & sender
    const lastMsgTime = data.lastMessageTime || data.updatedAt || data.createdAt || null;
    const lastSender = data.lastSender || data.last_sender || (data.last_sender_role === 'CUSTOMER' || data.last_sender_role === 'customer' ? 'customer' : 'admin');

    return {
      id: roomId,
      roomId: roomId,
      ...data,
      name: displayName,
      customerName: displayName,
      customer_name: displayName,
      customerId: customerId,
      customer_id: customerId,
      status: data.status || data.orderStatus || 'ACTIVE',
      lastMessage: lastMsg,
      last_message: lastMsg,
      lastMessageText: lastMsg,
      lastMessageTime: lastMsgTime,
      lastSender: lastSender,
      last_sender: lastSender,
      last_sender_id: data.last_sender_id || data.lastSenderId || '',
      last_sender_role: data.last_sender_role || data.lastSenderRole || (lastSender === 'customer' ? 'CUSTOMER' : 'ADMIN'),
      unreadAdminCount: computedUnreadAdmin,
      unreadCustomerCount: isCustRead ? 0 : Math.max(0, rawCustomerUnread),
      unreadCount: computedUnreadAdmin,
      unreadByAdmin: Boolean(data.unreadByAdmin ?? (computedUnreadAdmin > 0)),
      is_read_admin: Boolean(data.is_read_admin ?? (computedUnreadAdmin === 0)),
      is_read_customer: isCustRead,
      updatedAt: data.updatedAt || data.lastMessageTime || data.createdAt || null
    };
  };

  // PERBAIKAN #1: PAGINATION DENGAN CURSOR FIRESTORE (getDocs on-demand untuk chat ke-81 dst)
  const loadMoreChats = async () => {
    if (isLoadingMoreChats || !hasMoreChats || !lastVisibleChatDocRef.current) return;
    setIsLoadingMoreChats(true);
    try {
      const nextQuery = query(
        collection(db, 'chats'),
        orderBy('updatedAt', 'desc'),
        startAfter(lastVisibleChatDocRef.current),
        limit(80)
      );
      const snap = await getDocs(nextQuery);
      if (snap.empty) {
        setHasMoreChats(false);
      } else {
        if (snap.docs.length < 80) {
          setHasMoreChats(false);
        }
        lastVisibleChatDocRef.current = snap.docs[snap.docs.length - 1];
        const moreRooms = snap.docs.map(mapDocToRoom);
        setChats(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newBatch = moreRooms.filter(c => !existingIds.has(c.id));
          return [...prev, ...newBatch];
        });
      }
    } catch (err) {
      console.error('Failed to load more chats:', err);
    } finally {
      setIsLoadingMoreChats(false);
    }
  };

  // PILAR 1: REALTIME LISTENER ROOMS (CHATS) & UNREAD SEPARATE QUERY
  useEffect(() => {
    // Hanya staff yang butuh daftar semua chat rooms (admin inbox); customer hanya butuh room sendiri.
    if (authLoading) return;
    const roleUpper = (currentUser?.role || '').toString().toUpperCase();
    const isStaffUser = Boolean(
      currentUser?.isStaff === true ||
      ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes(roleUpper)
    );
    if (!isStaffUser) return;

    // 1. Optimized Realtime Query for latest 150 chat rooms
    const qChats = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'), limit(150));

    const unsubChats = onSnapshot(qChats, { includeMetadataChanges: true }, (snap) => {
      if (!snap.empty) {
        if (!lastVisibleChatDocRef.current || snap.docs.length >= 150) {
          lastVisibleChatDocRef.current = snap.docs[snap.docs.length - 1];
          setHasMoreChats(snap.docs.length >= 150);
        }
        const topBatch = snap.docs.map(mapDocToRoom);
        setChats(prev => {
          const topIds = new Set(topBatch.map(c => c.id));
          const olderLoaded = prev.filter(c => !topIds.has(c.id));
          return [...topBatch, ...olderLoaded];
        });
      } else {
        setChats([]);
        setHasMoreChats(false);
      }
    }, (error) => {
      // Fallback: If orderBy fails on edge cases, subscribe to collection with limit 150 & sort client-side
      const unsubFallback = onSnapshot(query(collection(db, 'chats'), limit(150)), (snap) => {
        const parsedChats = snap.docs.map(mapDocToRoom);
        parsedChats.sort((a, b) => {
          const getT = (x: any) => {
            if (!x) return 0;
            if (x.toMillis) return x.toMillis();
            if (x.seconds) return x.seconds * 1000;
            const t = new Date(x).getTime();
            return isNaN(t) ? 0 : t;
          };
          return getT(b.updatedAt || b.lastMessageTime) - getT(a.updatedAt || a.lastMessageTime);
        });
        if (snap.docs.length > 0) {
          lastVisibleChatDocRef.current = snap.docs[snap.docs.length - 1];
        }
        setChats(parsedChats);
      }, (err2) => {
        handleFirestoreError(err2, OperationType.LIST, 'chats');
      });
      return () => unsubFallback();
    });

    // 2. Query Realtime Khusus "Belum Dibaca" (TIDAK terikat pagination)
    const qUnread = query(
      collection(db, 'chats'),
      where('unreadByAdmin', '==', true),
      orderBy('updatedAt', 'desc')
    );

    let unsubFallbackUnread: (() => void) | null = null;
    const unsubUnread = onSnapshot(qUnread, (snap) => {
      const unreadRooms = snap.docs.map(mapDocToRoom);
      setUnreadChats(unreadRooms);
    }, (err) => {
      console.warn('qUnread with orderBy notice (falling back to simple where query):', err);
      const fallbackQ = query(
        collection(db, 'chats'),
        where('unreadByAdmin', '==', true)
      );
      unsubFallbackUnread = onSnapshot(fallbackQ, (snap) => {
        const unreadRooms = snap.docs.map(mapDocToRoom);
        unreadRooms.sort((a, b) => {
          const getT = (x: any) => {
            if (!x) return 0;
            if (x.toMillis) return x.toMillis();
            if (x.seconds) return x.seconds * 1000;
            const t = new Date(x).getTime();
            return isNaN(t) ? 0 : t;
          };
          return getT(b.updatedAt || b.lastMessageTime) - getT(a.updatedAt || a.lastMessageTime);
        });
        setUnreadChats(unreadRooms);
      }, (err2) => {
        console.error('Fallback unread listener failed:', err2);
      });
    });

    return () => {
      unsubChats();
      unsubUnread();
      if (unsubFallbackUnread) unsubFallbackUnread();
    };
  }, [authLoading, currentUser?.role, currentUser?.isStaff]);

  // PILAR 1: REALTIME LISTENER MESSAGES (ACTIVE ROOM WITH DYNAMIC PATH RESOLVER)
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const activeMessagesRef = useRef<ChatMessage[]>(activeMessages);
  useEffect(() => {
    activeMessagesRef.current = activeMessages;
  }, [activeMessages]);

  const hasEverLoadedActiveMsgsRef = useRef<boolean>(false);
  const hasTriedFallbackActiveMsgsRef = useRef<boolean>(false);

  useEffect(() => {
    hasEverLoadedActiveMsgsRef.current = false;
    hasTriedFallbackActiveMsgsRef.current = false;

    if (!selectedChatId) {
      setActiveMessages([]);
      return;
    }

    // Dynamic Room Path Resolver: Cari ID room presisi dari list chats jika selectedChatId berupa alias/ID customer/order
    let activeChatId = selectedChatId;
    const currentChatsList = chatsRef.current;
    if (currentChatsList && currentChatsList.length > 0) {
      const matchedChat = currentChatsList.find(c => 
        c.id === selectedChatId || 
        c.order_id === selectedChatId || 
        c.customer_id === selectedChatId || 
        c.customerId === selectedChatId ||
        c.id === `room_${selectedChatId}` ||
        c.id === selectedChatId.replace(/^room_/, '') ||
        c.id === selectedChatId.replace(/^direct-/, '') ||
        (c.order_id && (c.order_id === selectedChatId || c.order_id === `room_${selectedChatId}`))
      );
      if (matchedChat && matchedChat.id) {
        activeChatId = matchedChat.id;
      }
    }

    const directDocId = selectedChatId || activeChatId;
    const targetCustId = activeChatId;

    // Auto-create direct room document agar Direct Path tidak bernilai kosong
    import('../components/chat/roomManager').then(({ ensureDirectRoomExists }) => {
      ensureDirectRoomExists(directDocId, { id: targetCustId });
    }).catch(() => {});

    // Path 1: Direct Subcollection Listener (OrderBy createdAt desc with limit 80 for guaranteed latest messages)
    const messagesRef = query(
      collection(db, 'chats', directDocId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(80)
    );
    
    let unsubGroup: any = null;
    let unsubFallback: any = null;

    const mapDocToMessage = (d: any): ChatMessage => {
      const data: any = d.data({ serverTimestamps: 'estimate' }) || {};
      
      let timeMs = 0;
      if (typeof data.createdAtMillis === 'number' && !isNaN(data.createdAtMillis) && data.createdAtMillis > 0) {
        timeMs = data.createdAtMillis;
      } else if (typeof data.localTimestamp === 'number' && !isNaN(data.localTimestamp) && data.localTimestamp > 0) {
        timeMs = data.localTimestamp;
      } else if (typeof data.timestamp === 'number' && !isNaN(data.timestamp) && data.timestamp > 0) {
        timeMs = data.timestamp;
      } else {
        const rawTime = data.createdAt || data.timestamp || data.time || data.created;
        if (rawTime?.toMillis) {
          timeMs = rawTime.toMillis();
        } else if (rawTime?.toDate) {
          timeMs = rawTime.toDate().getTime();
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
        resolvedCreatedAt = data.createdAt.toDate().toISOString();
      } else if (data.createdAt?.seconds) {
        resolvedCreatedAt = new Date(data.createdAt.seconds * 1000).toISOString();
      } else {
        resolvedCreatedAt = new Date(timeMs).toISOString();
      }
      
      return {
        id: d.id,
        ...data,
        timeMs: timeMs,
        createdAt: data.createdAt ? data.createdAt : { seconds: Math.floor(timeMs / 1000) },
        created: resolvedCreatedAt
      } as ChatMessage;
    };

    const processMessageDocs = (docs: any[]): ChatMessage[] => {
      const msgs = docs.map(mapDocToMessage);
      const uniqueMsgs = Array.from(new Map(msgs.map(m => [m.id, m])).values());
      return [...uniqueMsgs].sort((a: any, b: any) => (a.timeMs || 0) - (b.timeMs || 0));
    };

    const unsubMsgs = onSnapshot(messagesRef, { includeMetadataChanges: true }, (snap) => {
      if (!snap.empty) {
        hasEverLoadedActiveMsgsRef.current = true;
        const sorted = processMessageDocs(snap.docs);
        setActiveMessages(sorted);
      } else {
        // 🛡️ PERBAIKAN WAJIB BUG #1: Cegah snapshot kosong transisi/cache mengosongkan chat
        const isFromCache = snap.metadata?.fromCache === true;
        const hasPendingWrites = snap.metadata?.hasPendingWrites === true;
        const alreadyHasMessages = activeMessagesRef.current.length > 0 || hasEverLoadedActiveMsgsRef.current;

        if (isFromCache || hasPendingWrites || alreadyHasMessages) {
          return;
        }

        // Fallback: If empty and never loaded, try query without orderBy in case legacy messages lack createdAt field
        if (!unsubFallback && !hasTriedFallbackActiveMsgsRef.current) {
          hasTriedFallbackActiveMsgsRef.current = true;
          const fallbackRef = query(collection(db, 'chats', directDocId, 'messages'), limit(80));
          unsubFallback = onSnapshot(fallbackRef, { includeMetadataChanges: true }, (fallbackSnap) => {
            if (!fallbackSnap.empty) {
              hasEverLoadedActiveMsgsRef.current = true;
              const sorted = processMessageDocs(fallbackSnap.docs);
              setActiveMessages(sorted);
            } else {
              // Legacy group recovery
              const cleanCustId = targetCustId.replace(/^direct-/, '').replace(/^room_/, '');
              if (cleanCustId && cleanCustId !== targetCustId) {
                const groupRef = query(
                  collectionGroup(db, 'messages'),
                  where('customerId', '==', targetCustId)
                );
                unsubGroup = onSnapshot(groupRef, (groupSnapshot) => {
                  if (groupSnapshot.empty) {
                    if (!hasEverLoadedActiveMsgsRef.current && activeMessagesRef.current.length === 0) {
                      setActiveMessages([]);
                    }
                    return;
                  }
                  hasEverLoadedActiveMsgsRef.current = true;
                  const loadedGroup = processMessageDocs(groupSnapshot.docs);
                  setActiveMessages(loadedGroup);
                }, () => {});
              } else {
                if (!hasEverLoadedActiveMsgsRef.current && activeMessagesRef.current.length === 0) {
                  setActiveMessages([]);
                }
              }
            }
          }, () => {});
        }
      }
    }, (error) => {
      // Fallback: If orderBy fails (e.g. indexing or field missing), fallback to simple limit(80)
      if (!unsubFallback && !hasTriedFallbackActiveMsgsRef.current) {
        hasTriedFallbackActiveMsgsRef.current = true;
        const fallbackRef = query(collection(db, 'chats', directDocId, 'messages'), limit(80));
        unsubFallback = onSnapshot(fallbackRef, { includeMetadataChanges: true }, (fallbackSnap) => {
          if (!fallbackSnap.empty) {
            hasEverLoadedActiveMsgsRef.current = true;
            const sorted = processMessageDocs(fallbackSnap.docs);
            setActiveMessages(sorted);
          } else {
            if (!hasEverLoadedActiveMsgsRef.current && activeMessagesRef.current.length === 0) {
              setActiveMessages([]);
            }
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, `chats/${directDocId}/messages`);
        });
      }
    });

    return () => {
      unsubMsgs();
      if (unsubFallback) unsubFallback();
      if (unsubGroup) unsubGroup();
    };
  }, [selectedChatId]);

  // Helper fetch functions untuk data sekunder (Fetch once + on-demand refresh)
  const fetchUsers = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), limit(500)));
      const allUsers = snap.docs.map(d => {
        const data = d.data();
        const rawBal = Number(data.tongCoins ?? data.tc_balance ?? data.tongcoins ?? data.balance ?? 0);
        return { 
          id: d.id, 
          ...data,
          tc_balance: rawBal,
          tongCoins: rawBal,
          tongcoins: rawBal,
          balance: rawBal
        } as unknown as UserProfile;
      });

      usersRef.current = allUsers;

      const filteredStaff = allUsers.filter((u: any) => {
        const roleUpper = (u.role || '').toString().toUpperCase();
        return (
          roleUpper === 'STAFF' ||
          roleUpper === 'ADMIN' ||
          roleUpper === 'OWNER' ||
          roleUpper === 'WORKER' ||
          roleUpper === 'OPERATOR' ||
          u.isStaff === true
        );
      });

      if (filteredStaff.length === 0) {
        const DEFAULT_STAFF_ACCOUNTS = [
          {
            id: 'staff_owner_envrix',
            uid: 'staff_owner_envrix',
            name: 'Envrix',
            username: 'envrix',
            email: 'envrix@entongstore.com',
            password: 'kenari88',
            role: 'OWNER',
            isStaff: true,
            isBanned: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff_owner_entong',
            uid: 'staff_owner_entong',
            name: 'Ceo Entong',
            username: 'ceo_entong',
            email: 'ceo@entong.store',
            password: 'admin123',
            role: 'OWNER',
            isStaff: true,
            isBanned: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff_admin_entong',
            uid: 'staff_admin_entong',
            name: 'Admin Entong',
            username: 'admin_entong',
            email: 'admin@entong.store',
            password: 'admin123',
            role: 'ADMIN',
            isStaff: true,
            isBanned: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff_kamil',
            uid: 'staff_kamil',
            name: 'kamil',
            username: 'kamil',
            email: 'kamil@entong.store',
            password: 'mafiatanah',
            role: 'STAFF',
            isStaff: true,
            isBanned: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'staff_owner_enprik',
            uid: 'staff_owner_enprik',
            name: 'Enprik',
            username: 'enprik',
            email: 'enprik@entong.store',
            password: 'kenari88',
            role: 'OWNER',
            isStaff: true,
            isBanned: false,
            createdAt: new Date().toISOString()
          }
        ];

        for (const account of DEFAULT_STAFF_ACCOUNTS) {
          try {
            await setDoc(doc(db, 'users', account.id), account, { merge: true });
          } catch (e) {}
        }
      }

      setUsers(allUsers);
    } catch (err) {
      console.error("Gagal fetch users:", err);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'orders'), limit(500)));
      const fetchedOrders = snap.docs.map(d => {
        const data = d.data();
        const pureTime = getPureCreationTime(data);
        const officialOrderId = data.orderId || (d.id.startsWith('ORD-') ? d.id : `#ORD-${d.id.slice(-6).toUpperCase()}`);
        const officialStatus = data.status || data.orderStatus || 'NEW';
        return {
          ...data,
          id: d.id,
          docUniqueId: d.id,
          firestoreId: d.id,
          orderId: officialOrderId,
          status: officialStatus,
          orderStatus: officialStatus,
          pureTime: pureTime,
          createdTimestamp: pureTime,
          orderTimestamp: data.orderTimestamp || pureTime,
          sortTime: pureTime
        };
      });
      setRawOrders(fetchedOrders);
    } catch (err) {
      console.error("Gagal fetch orders:", err);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'catalogs'), limit(60)));
      const allItems: GameItem[] = [];
      const rawCatalogs: any[] = [];
      snap.docs.forEach(d => {
        const cat = { id: d.id, ...d.data() as any };
        rawCatalogs.push(cat);
        if (cat.pricelists && Array.isArray(cat.pricelists)) {
          cat.pricelists.forEach((pkg: any) => {
            allItems.push({
              id: pkg.id,
              game_name: cat.title,
              package_name: pkg.name,
              category: cat.category,
              price: pkg.price,
              description: pkg.description || '',
              estimated_time: pkg.estimatedTime || '',
              is_closed: pkg.is_closed,
            });
          });
        }
      });
      if (allItems.length > 0) {
        setItems(allItems);
      }
      if (rawCatalogs.length > 0) {
        setCachedCatalogs(rawCatalogs);
      }
    } catch (err) {
      console.error("Gagal fetch items:", err);
    }
  }, []);

  const fetchQuickReplies = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'quickReplies'), limit(50)));
      if (snap.empty) {
        setQuickReplies(DEFAULT_QUICK_REPLIES);
      } else {
        const list = snap.docs.map(d => {
          const data = d.data();
          const cleanMsg = (data.message || '').replace(/`+(https?:\/\/[^\s`'"]+)`+/g, '$1');
          return { id: d.id, ...data, message: cleanMsg } as QuickReplyTemplate;
        });
        setQuickReplies(list.length > 0 ? list : DEFAULT_QUICK_REPLIES);
      }
    } catch (err) {
      console.error("Gagal fetch quick replies:", err);
    }
  }, []);

  const fetchFinance = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'finance'), limit(50)));
      setFinance(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceRecord)));
    } catch (err) {}
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'attendance'), limit(50)));
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffAttendanceRecord)));
    } catch (err) {}
  }, []);

  const fetchClouds = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'clouds'), limit(50)));
      if (!snap.empty) {
        const parsedClouds: CloudInstance[] = snap.docs.map(d => {
          const data = d.data();
          return {
            ...(data as CloudInstance),
            id: d.id,
            name: data.name || `Cloud ${d.id.slice(-2)}`,
            provider: data.provider || 'VPS Server',
            status: data.status || 'AVAILABLE'
          } as CloudInstance;
        });
        parsedClouds.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
        setClouds(parsedClouds);
      } else {
        const defaultInitClouds: CloudInstance[] = [
          { id: 'cloud_01', name: 'Cloud 01', provider: 'Contabo Singapore', status: 'AVAILABLE', durationDays: 30, rentStartDate: new Date().toISOString().split('T')[0] },
          { id: 'cloud_02', name: 'Cloud 02', provider: 'Contabo Singapore', status: 'AVAILABLE', durationDays: 30, rentStartDate: new Date().toISOString().split('T')[0] },
          { id: 'cloud_03', name: 'Cloud 03', provider: 'DigitalOcean SG', status: 'AVAILABLE', durationDays: 30, rentStartDate: new Date().toISOString().split('T')[0] },
          { id: 'cloud_04', name: 'Cloud 04', provider: 'AWS Tokyo', status: 'AVAILABLE', durationDays: 30, rentStartDate: new Date().toISOString().split('T')[0] },
          { id: 'cloud_05', name: 'Cloud 05', provider: 'VPS Jakarta', status: 'AVAILABLE', durationDays: 30, rentStartDate: new Date().toISOString().split('T')[0] }
        ];
        defaultInitClouds.forEach(async (c) => {
          await setDoc(doc(db, 'clouds', c.id), c, { merge: true }).catch(() => {});
        });
        setClouds(defaultInitClouds);
      }
    } catch (err) {}
  }, []);

  // Inisialisasi Data Sekunder Setelah Auth Diketahui (Cegah Fetch Berat Untuk Customer)
  useEffect(() => {
    if (authLoading) return;
    setIsOnlinePB(true);

    const roleUpper = (currentUser?.role || '').toString().toUpperCase();
    const isStaffUser = Boolean(
      currentUser?.isStaff === true ||
      ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes(roleUpper)
    );

    // Data yang dibutuhkan semua pengguna (katalog untuk browsing, order milik sendiri)
    fetchItems();
    fetchOrders();

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isStaffUser) {
      // Data berat (500 users, finance, attendance, clouds) khusus staff
      fetchUsers();
      timer = setTimeout(() => {
        fetchQuickReplies();
        fetchFinance();
        fetchAttendance();
        fetchClouds();
      }, 200);
    }

    // Dokumen Pengaturan Ringan (Real-time single doc)
    
    // Explicit WA listener as requested
    const unsubWhatsapp = onSnapshot(doc(db, 'settings', 'whatsapp'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().giftAdminNumber) {
        setAdminWhatsappNumber(docSnap.data().giftAdminNumber);
      }
    });

    const unsubPayment = onSnapshot(doc(db, 'settings', 'payment'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.qrisImageUrl) setQrisImageUrl(data.qrisImageUrl);
        if (data.danaNumber) setDanaNumber(data.danaNumber);
        if (data.danaName) setDanaName(data.danaName);
        if (data.storeAvatarUrl) setStoreAvatarUrl(data.storeAvatarUrl);
        if (data.adminWhatsappNumber || data.adminWhatsapp || data.adminPhone) {
          setAdminWhatsappNumber(data.adminWhatsappNumber || data.adminWhatsapp || data.adminPhone);
        }
      }
    });

    const unsubDedicatedStore = onSnapshot(doc(db, 'settings', 'store'), (docSnap) => {
      if (!docSnap.exists()) {
        const DEFAULT_STORE_SETTINGS = {
          isOnline: true,
          activeMode: 'ONLINE_MANUAL',
          storeMode: 'AUTO',
          openHour: 9,
          closeHour: 23,
          adminWhatsapp: '081234567890',
          adminWhatsappNumber: '081234567890',
          updatedAt: new Date().toISOString()
        };
        setDoc(doc(db, 'settings', 'store'), DEFAULT_STORE_SETTINGS, { merge: true }).catch(console.error);
        setAdminStatus('ONLINE');
        setStoreOpenHour(9);
        setStoreCloseHour(23);
        setStoreForceStatus('AUTO');
        setStoreAutoHours(true);
        setAdminWhatsappNumber('081234567890');
      } else {
        const data = docSnap.data();
        if (data.isOnline !== undefined) {
          setAdminStatus(data.isOnline ? 'ONLINE' : 'OFFLINE');
        }
        if (data.adminWhatsapp || data.adminWhatsappNumber || data.adminPhone) {
          setAdminWhatsappNumber(data.adminWhatsapp || data.adminWhatsappNumber || data.adminPhone);
        }
        if (data.openHour !== undefined) {
          setStoreOpenHour(Number(data.openHour));
        } else if (data.storeOpenHour !== undefined) {
          setStoreOpenHour(Number(data.storeOpenHour));
        }
        if (data.closeHour !== undefined) {
          setStoreCloseHour(Number(data.closeHour));
        } else if (data.storeCloseHour !== undefined) {
          setStoreCloseHour(Number(data.storeCloseHour));
        }
        if (data.storeMode !== undefined) {
          setStoreForceStatus(data.storeMode as 'AUTO' | 'OPEN' | 'CLOSED');
          if (data.storeMode === 'AUTO') {
            setStoreAutoHours(true);
          }
        } else if (data.storeForceStatus !== undefined) {
          setStoreForceStatus(data.storeForceStatus as 'AUTO' | 'OPEN' | 'CLOSED');
        }
      }
    });

    return () => { 
      if (timer) clearTimeout(timer);
      unsubWhatsapp();
      unsubPayment();
      unsubDedicatedStore();
    };
  }, [authLoading, currentUser?.role, currentUser?.isStaff, fetchUsers, fetchOrders, fetchItems, fetchQuickReplies, fetchFinance, fetchAttendance, fetchClouds]);

  const totalUnreadCount = useMemo(() => {
    if (!currentUser) return 0;
    const isUserAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'OWNER';
    if (isUserAdmin) {
      return chats.reduce((acc, chat) => {
        if (chat.is_read_admin === false) {
          const c = typeof chat.unreadCount === 'number' && chat.unreadCount > 0 ? chat.unreadCount : (chat.last_sender_role === 'CUSTOMER' || chat.last_sender_role === 'customer' ? 1 : 0);
          return acc + c;
        }
        return acc;
      }, 0);
    } else {
      return chats.reduce((acc, chat) => {
        if (chat.customer_id === currentUser.id && chat.is_read_customer === false) {
          const c = typeof chat.unreadCount === 'number' && chat.unreadCount > 0 ? chat.unreadCount : (chat.last_sender_role === 'ADMIN' || chat.last_sender_role === 'admin' ? 1 : 0);
          return acc + c;
        }
        return acc;
      }, 0);
    }
  }, [chats, currentUser]);

  const login = async (identity: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedIdent = identity.trim();
      const lowerIdent = trimmedIdent.toLowerCase();
      const trimmedPass = pass.trim();

      if (!trimmedIdent || !trimmedPass) {
        return { success: false, error: '🚫 Username/Email dan Password wajib diisi.' };
      }

      let matchedUserDoc: any = null;
      let targetEmail = trimmedIdent;

      // 1. 🔍 CARI DOKUMEN USER DI KOLEKSI `users` BERDASARKAN USERNAME, USERNAMELOWER, PHONE, ATAU EMAIL
      try {
        const usersRef = collection(db, 'users');

        // A. Cek usernameLower / username
        const qLower = query(usersRef, where('usernameLower', '==', lowerIdent));
        const snapLower = await getDocs(qLower);
        if (!snapLower.empty) {
          matchedUserDoc = { id: snapLower.docs[0].id, ...snapLower.docs[0].data() };
        } else {
          const qUser = query(usersRef, where('username', '==', lowerIdent));
          const snapUser = await getDocs(qUser);
          if (!snapUser.empty) {
            matchedUserDoc = { id: snapUser.docs[0].id, ...snapUser.docs[0].data() };
          } else {
            // B. Cek email
            const qEmail = query(usersRef, where('email', '==', lowerIdent));
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
              matchedUserDoc = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
            } else {
              // C. Cek phone / WhatsApp
              const cleanPhoneIdent = normalizePhone(trimmedIdent);
              let qPhone = query(usersRef, where('phone', '==', cleanPhoneIdent || trimmedIdent));
              let snapPhone = await getDocs(qPhone);
              if (snapPhone.empty && cleanPhoneIdent) {
                const qWhatsapp = query(usersRef, where('whatsapp', '==', cleanPhoneIdent));
                snapPhone = await getDocs(qWhatsapp);
              }
              if (snapPhone.empty && cleanPhoneIdent) {
                const qWhatsappNum = query(usersRef, where('whatsappNumber', '==', cleanPhoneIdent));
                snapPhone = await getDocs(qWhatsappNum);
              }
              if (snapPhone.empty && cleanPhoneIdent) {
                const qPhoneRaw = query(usersRef, where('phone', '==', trimmedIdent));
                snapPhone = await getDocs(qPhoneRaw);
              }
              if (!snapPhone.empty) {
                matchedUserDoc = { id: snapPhone.docs[0].id, ...snapPhone.docs[0].data() };
              }
            }
          }
        }

        // D. Cek koleksi staff jika belum ketemu di users
        if (!matchedUserDoc) {
          const staffRef = collection(db, 'staff');
          const qStaffUser = query(staffRef, where('username', '==', lowerIdent));
          let snapStaff = await getDocs(qStaffUser);
          if (snapStaff.empty) {
            const qStaffEmail = query(staffRef, where('email', '==', lowerIdent));
            snapStaff = await getDocs(qStaffEmail);
          }
          if (!snapStaff.empty) {
            matchedUserDoc = { id: snapStaff.docs[0].id, isStaff: true, ...snapStaff.docs[0].data() };
          }
        }
      } catch (errSearch) {
        console.warn("Error searching users in Firestore:", errSearch);
      }

      // Fallback 1B: Cek array `users` dari React Context
      if (!matchedUserDoc) {
        const cleanPhoneIdent = normalizePhone(trimmedIdent);
        const foundInState = users.find(u => 
          u.username?.toLowerCase() === lowerIdent || 
          u.usernameLower === lowerIdent || 
          u.email?.toLowerCase() === lowerIdent || 
          (cleanPhoneIdent && normalizePhone(u.phone) === cleanPhoneIdent) ||
          (cleanPhoneIdent && normalizePhone(u.whatsappNumber) === cleanPhoneIdent) ||
          (cleanPhoneIdent && normalizePhone((u as any).whatsapp) === cleanPhoneIdent) ||
          u.phone === trimmedIdent
        );
        if (foundInState) {
          matchedUserDoc = foundInState;
        }
      }

      // Fallback 1C: Default staff shortcuts
      if (!matchedUserDoc) {
        if (lowerIdent === 'ceo_entong' || lowerIdent === 'own' || lowerIdent === 'ceo') {
          matchedUserDoc = {
            id: 'staff_owner_entong',
            uid: 'staff_owner_entong',
            name: 'Ceo Entong',
            username: 'ceo_entong',
            email: 'ceo@entong.store',
            password: 'admin123',
            role: 'OWNER',
            isStaff: true,
            isBanned: false
          };
        } else if (lowerIdent === 'admin_entong' || lowerIdent === 'entong' || lowerIdent === 'admin') {
          matchedUserDoc = {
            id: 'staff_admin_entong',
            uid: 'staff_admin_entong',
            name: 'Admin Entong',
            username: 'admin_entong',
            email: 'admin@entong.store',
            password: 'admin123',
            role: 'ADMIN',
            isStaff: true,
            isBanned: false
          };
        } else if (lowerIdent === 'kamil') {
          matchedUserDoc = {
            id: 'staff_kamil',
            uid: 'staff_kamil',
            name: 'kamil',
            username: 'kamil',
            email: 'kamil@entong.store',
            password: 'mafiatanah',
            role: 'STAFF',
            isStaff: true,
            isBanned: false
          };
        } else if (lowerIdent === 'enprik') {
          matchedUserDoc = {
            id: 'staff_owner_enprik',
            uid: 'staff_owner_enprik',
            name: 'Enprik',
            username: 'enprik',
            email: 'enprik@entong.store',
            password: 'kenari88',
            role: 'OWNER',
            isStaff: true,
            isBanned: false
          };
        }
      }

      // 2. 🛡️ VERIFIKASI AKUN STAF / AKUN YANG PUNYA FIRESTORE PASSWORD
      if (matchedUserDoc) {
        targetEmail = matchedUserDoc.email || (lowerIdent.includes('@') ? lowerIdent : `${lowerIdent.replace(/[^a-z0-9]/g, '')}@entong.store`);

        if (matchedUserDoc.isBanned === true) {
          return {
            success: false,
            error: "🚫 Akun kamu telah ditangguhkan dari sistem Entong Store karena terdeteksi melakukan pelanggaran. Silakan hubungi admin jika ini adalah kekeliruan."
          };
        }

        const isStaffAccount = matchedUserDoc.isStaff === true || 
          ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes((matchedUserDoc.role || '').toString().toUpperCase());

        // Jika ini staf atau akun dengan password yang tersimpan
        const storedPass = String(matchedUserDoc.password ?? matchedUserDoc.pin ?? matchedUserDoc.pass ?? matchedUserDoc.staffPin ?? '').trim();
        if (isStaffAccount || storedPass) {
          if ((isStaffAccount && !storedPass) || (storedPass && storedPass === trimmedPass)) {
            const hasRealPassword = Boolean(storedPass);
            let signInUid: string | null = null;
            if (hasRealPassword) {
              try {
                const userCred = await signInWithEmailAndPassword(auth, targetEmail, trimmedPass);
                signInUid = userCred?.user?.uid || null;
              } catch (firebaseErr: any) {
                console.log("Firebase Auth login attempt for staff:", firebaseErr?.code);
                if (
                  firebaseErr.code === 'auth/user-not-found' ||
                  firebaseErr.code === 'auth/invalid-credential' ||
                  firebaseErr.code === 'auth/invalid-email'
                ) {
                  try {
                    const newUserCred = await createUserWithEmailAndPassword(auth, targetEmail, trimmedPass);

                    const newUid = newUserCred.user.uid;
                    signInUid = newUid;
                    await setDoc(doc(db, 'users', newUid), {
                      ...matchedUserDoc,
                      id: newUid,
                      uid: newUid
                    }, { merge: true });

                    await setDoc(doc(db, 'staff', newUid), {
                      ...matchedUserDoc,
                      id: newUid,
                      uid: newUid
                    }, { merge: true });

                    matchedUserDoc.uid = newUid;
                    matchedUserDoc.id = newUid;
                    console.log("Auto-registered staff in Firebase Auth:", targetEmail);
                  } catch (regErr: any) {
                    console.warn("Auto-register staff error (proceeding with Firestore session):", regErr);
                  }
                } else if (firebaseErr.code === 'auth/wrong-password') {
                  return { success: false, error: "Password akun staf salah." };
                }
              }
            }

            const staffRole = (matchedUserDoc.role || 'STAFF').toString().toUpperCase();
            const staffIsStaff = matchedUserDoc.isStaff === true ||
              ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes(staffRole);

            const finalUid = signInUid || matchedUserDoc.uid || matchedUserDoc.id;
            if (finalUid && (!matchedUserDoc.uid || matchedUserDoc.uid !== finalUid)) {
              matchedUserDoc.uid = finalUid;
            }
            if (finalUid && (!matchedUserDoc.id || matchedUserDoc.id !== finalUid)) {
              matchedUserDoc.id = finalUid;
            }

            const activeStaffSession: UserProfile = {
              ...matchedUserDoc,
              id: finalUid,
              uid: finalUid,
              name: matchedUserDoc.name || matchedUserDoc.username || trimmedIdent,
              username: matchedUserDoc.username || lowerIdent,
              email: targetEmail,
              phone: matchedUserDoc.phone || '-',
              role: staffRole,
              isStaff: staffIsStaff,
              isBanned: false,
              created: matchedUserDoc.createdAt || matchedUserDoc.created || new Date().toISOString()
            };

            if (staffIsStaff && finalUid) {
              const canonicalPayload = cleanFirestorePayload(activeStaffSession);
              setDoc(doc(db, 'users', finalUid), canonicalPayload, { merge: true }).catch(() => {});
              setDoc(doc(db, 'staff', finalUid), canonicalPayload, { merge: true }).catch(() => {});
            }

            localStorage.setItem('entong_active_user', JSON.stringify(activeStaffSession));
            localStorage.setItem('entong_local_user', JSON.stringify(activeStaffSession));
            setCurrentUser(activeStaffSession);
            return { success: true };
          } else if (storedPass && storedPass !== trimmedPass) {
            return { success: false, error: '🚫 Password / PIN salah.' };
          } else if (!isStaffAccount && !storedPass) {
            return { success: false, error: '🚫 Password tidak dikenali.' };
          }
        }
      } else {
        if (!lowerIdent.includes('@')) {
          targetEmail = `${lowerIdent.replace(/[^a-z0-9]/g, '')}@entong.store`;
        }
      }

      // 3. 🔐 FALLBACK PROSES FIREBASE AUTHENTICATION STANDAR (UNTUK CUSTOMER & FIREBASE AUTH USERS)
      try {
        const userCred = await signInWithEmailAndPassword(auth, targetEmail, trimmedPass);
        if (userCred.user) {
          const userData = await syncUserToFirestore(userCred.user, trimmedIdent);
          if (userData?.isBanned === true) {
            await signOut(auth);
            localStorage.removeItem('entong_active_user');
            localStorage.removeItem('entong_local_user');
            setCurrentUser(null);
            return {
              success: false,
              error: "🚫 Akun kamu telah ditangguhkan dari sistem Entong Store."
            };
          }

          const userRoleUpper = (userData?.role || '').toString().toUpperCase();
          const userIsStaff = userData?.isStaff === true ||
            ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes(userRoleUpper);

          const activeUserData: UserProfile = {
            ...userData,
            id: userCred.user.uid,
            uid: userCred.user.uid,
            name: userData?.name || userCred.user.displayName || trimmedIdent,
            username: userData?.username || trimmedIdent,
            email: userCred.user.email || '',
            phone: userData?.phone || userData?.whatsappNumber || '-',
            whatsappNumber: userData?.whatsappNumber || userData?.phone || '-',
            role: userIsStaff ? userRoleUpper || 'CUSTOMER' : 'CUSTOMER',
            isStaff: userIsStaff,
            created: userData?.createdAt || userData?.created || new Date().toISOString()
          };

          // Auto claim guest orders by WhatsApp
          const phoneToSync = userData?.phone || userData?.whatsappNumber || (userData as any)?.whatsapp;
          if (phoneToSync) {
            syncGuestOrdersToUser(userCred.user.uid, phoneToSync).catch(e => console.warn('Auto sync guest orders notice:', e));
          }

          localStorage.setItem('entong_active_user', JSON.stringify(activeUserData));
          setCurrentUser(activeUserData);
          return { success: true };
        }
      } catch (authErr: any) {
        if (matchedUserDoc) {
          const matchedPass = String(matchedUserDoc.password ?? matchedUserDoc.pin ?? matchedUserDoc.pass ?? matchedUserDoc.staffPin ?? '').trim();
          if (matchedPass && matchedPass !== trimmedPass) {
            return { success: false, error: '🚫 Password / PIN salah.' };
          }
        }
        if (authErr?.code === 'auth/wrong-password' || authErr?.code === 'auth/invalid-credential') {
          return { success: false, error: '🚫 Password / PIN salah.' };
        } else if (authErr?.code === 'auth/user-not-found') {
          if (!matchedUserDoc) {
            return { success: false, error: '🚫 Username tidak ditemukan di sistem.' };
          }
          return { success: false, error: '🚫 Akun tidak terdaftar di sistem. Silakan buat akun baru terlebih dahulu.' };
        } else {
          return { success: false, error: matchedUserDoc ? '🚫 Password / PIN salah.' : '🚫 Username tidak ditemukan di sistem.' };
        }
      }

      return { success: false, error: matchedUserDoc ? '🚫 Password / PIN salah.' : '🚫 Username tidak ditemukan di sistem.' };
    } catch (err: any) {
      return { success: false, error: '🚫 Password atau akun yang Anda masukkan salah.' };
    }
  };

  const register = async (name: string, username: string, phone: string, pass: string, providedHwid?: string): Promise<{ success: boolean; error?: string; remainingSeconds?: number }> => {
    try {
      const deviceHwid = providedHwid || getDeviceHwid();
      const deviceRef = doc(db, 'device_registrations', deviceHwid);
      const deviceSnap = await getDoc(deviceRef);

      if (deviceSnap.exists()) {
        const data = deviceSnap.data();
        const now = Date.now();
        const cooldownUntil = data.cooldownUntil?.toMillis ? data.cooldownUntil.toMillis() : (data.cooldownUntil || 0);

        // JIKA MASIH DALAM MASA COOLDOWN:
        if (now < cooldownUntil) {
          const remainingSeconds = Math.ceil((cooldownUntil - now) / 1000);
          return {
            success: false,
            error: 'COOLDOWN_LIMIT',
            remainingSeconds: remainingSeconds
          };
        }
      }

      const cleanPhone = normalizePhone(phone) || phone.trim();
      const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@entongstore.com`;
      const userData = {
        name: name.trim(),
        username: username.trim(),
        usernameLower: username.trim().toLowerCase(),
        email: email,
        phone: cleanPhone,
        whatsapp: cleanPhone,
        whatsappNumber: cleanPhone,
        role: 'CUSTOMER',
        isStaff: false,
        isBanned: false,
        isGuest: false
      };
      const cleanData = cleanFirestorePayload(userData);
      
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const uid = userCredential.user.uid;
        
        const payloadUtuh = {
          ...cleanData,
          id: uid,
          uid: uid,
          email,
          phone: cleanPhone,
          whatsapp: cleanPhone,
          whatsappNumber: cleanPhone,
          role: cleanData.role || 'CUSTOMER',
          created: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', uid), payloadUtuh, { merge: true });
        
        // Auto-claim guest orders for this user by phone
        if (cleanPhone) {
          syncGuestOrdersToUser(uid, cleanPhone).catch(e => console.warn('Auto-claim guest orders notice:', e));
        }

        localStorage.setItem('entong_active_user', JSON.stringify(payloadUtuh));
        setCurrentUser(payloadUtuh as any);

        // Update HWID registration tracking
        let currentAccountCount = 0;
        if (deviceSnap.exists()) {
          currentAccountCount = deviceSnap.data().accountCount || 0;
        }

        // Aturan Cooldown: 1 Jam setelah akun ke-1, 12 Jam setelah akun ke-2
        let delayMs = 1 * 60 * 60 * 1000; // Delay 1 Jam
        if (currentAccountCount >= 1) {
          delayMs = 12 * 60 * 60 * 1000; // Delay 12 Jam
        }

        const newCooldownUntil = Date.now() + delayMs;
        const newAccountCount = currentAccountCount + 1;

        await setDoc(deviceRef, {
          deviceHwid: deviceHwid,
          accountCount: newAccountCount,
          cooldownUntil: newCooldownUntil,
          lastRegisteredAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        return { success: true };
      } catch (authErr: any) {
        if (authErr?.code === 'auth/operation-not-allowed') {
           const localId = 'local-' + Date.now();
           const newUser = {
             ...cleanData,
             id: localId,
             created: new Date().toISOString()
           };
           await setDoc(doc(db, 'users', newUser.id), newUser);
           setCurrentUser(newUser as any);
           localStorage.setItem('entong_local_user', JSON.stringify(newUser));

           // Record HWID cooldown
           let currentAccountCount = 0;
           if (deviceSnap.exists()) {
             currentAccountCount = deviceSnap.data().accountCount || 0;
           }
           let delayMs = 1 * 60 * 60 * 1000;
           if (currentAccountCount >= 1) {
             delayMs = 12 * 60 * 60 * 1000;
           }
           const newCooldownUntil = Date.now() + delayMs;
           const newAccountCount = currentAccountCount + 1;

           await setDoc(deviceRef, {
             deviceHwid: deviceHwid,
             accountCount: newAccountCount,
             cooldownUntil: newCooldownUntil,
             lastRegisteredAt: serverTimestamp(),
             updatedAt: serverTimestamp()
           }, { merge: true });

           return { success: true };
        }
        throw authErr;
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mendaftar.' };
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('entong_local_user');
      await signOut(auth);
      setCurrentUser(null);
    } catch (e) {
      setCurrentUser(null);
    }
  };

  const createOrder = async (orderData: Omit<GameOrder, 'id' | 'created' | 'updated'>): Promise<string> => {
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const exactOrderTime = Date.now();
    const nowIso = new Date(exactOrderTime).toISOString();
    let custId = orderData.customer_id;
    if (!custId && currentUser && currentUser.role === 'CUSTOMER') custId = currentUser.id;
    if (!custId) custId = 'cust-' + exactOrderTime;
    
    const cleanCustPhone = normalizePhone(orderData.customer_phone || (orderData as any).whatsapp || (orderData as any).phone || '');

    const newOrder = {
      ...orderData, id: orderId, customer_id: custId,
      customer_name: orderData.customer_name || 'Customer',
      customer_phone: cleanCustPhone || orderData.customer_phone || '',
      whatsapp: cleanCustPhone || (orderData as any).whatsapp || '',
      whatsappNumber: cleanCustPhone || (orderData as any).whatsappNumber || '',
      status: orderData.status || 'BOOKING',
      orderTimestamp: (orderData as any).orderTimestamp || exactOrderTime,
      timestamp: (orderData as any).timestamp || exactOrderTime,
      created: nowIso,
      createdAt: (orderData as any).createdAt || nowIso,
      updated: nowIso,
      updatedAt: nowIso,
      statusUpdatedAt: nowIso,
      catalogId: orderData.catalogId || '',
      orderId: orderId
    } as GameOrder;
    
    try { 
      await setDoc(doc(db, 'orders', orderId), cleanFirestorePayload(newOrder));

      // PILAR 2: AUTOMATIC REALTIME TOTAL SOLD SYNC
      if (newOrder.catalogId) {
        try {
          const catalogRef = doc(db, 'catalogs', newOrder.catalogId);
          await updateDoc(catalogRef, {
            totalSold: increment(1)
          });
        } catch (catErr) {
          console.error('Gagal increment totalSold:', catErr);
        }
      }
      
      // Refresh orders in background
      fetchOrders();
    } catch (err) { 
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    }
    return orderId;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus, workerId?: string, workerName?: string) => {
    try {
      let finalOrderId = orderId;
      if (finalOrderId.startsWith('#ORD-') || finalOrderId.startsWith('ORD-') || finalOrderId.startsWith('room_') || finalOrderId.startsWith('direct-')) {
        const cleanId = finalOrderId.replace(/^#/, '').replace(/^room_/, '').replace(/^direct-/, '');
        const snap = await getDocs(query(collection(db, 'orders'), where('orderId', 'in', [finalOrderId, cleanId, `#${cleanId}`])));
        if (!snap.empty) {
          finalOrderId = snap.docs[0].id;
        } else {
          const snap2 = await getDocs(query(collection(db, 'orders'), where('id', 'in', [finalOrderId, cleanId, `#${cleanId}`])));
          if (!snap2.empty) finalOrderId = snap2.docs[0].id;
        }
      }

      await updateOrderStatusGlobal(finalOrderId, status);
      
      if (workerId !== undefined || workerName !== undefined) {
        try {
          await updateDoc(doc(db, 'orders', finalOrderId), {
            ...(workerId !== undefined && { worker_id: workerId }),
            ...(workerName !== undefined && { worker_name: workerName }),
            updated: new Date().toISOString()
          });
        } catch (e) {
          // Ignore if doc doesn't exist
        }
      }

      // Auto-release Cloud instance jika order SELESAI atau BATAL
      if (['SELESAI', 'BATAL', 'BATAL_TOLAK', 'CANCEL'].includes(status)) {
        try {
          const cloudQuery = query(collection(db, 'clouds'), where('assignedOrderId', 'in', [orderId, finalOrderId]));
          const cloudSnaps = await getDocs(cloudQuery);
          cloudSnaps.forEach(async (cDoc) => {
            await setDoc(doc(db, 'clouds', cDoc.id), {
              status: 'AVAILABLE',
              statusLabel: 'KOSONG',
              assignedOrderId: null,
              currentOrderId: null,
              orderData: null,
              monitoringData: null,
              initialMoney: null,
              currentMoney: null,
              totalProfit: null,
              totalCycle: null,
              scriptVersion: null,
              monitoringStatus: null,
              assignedCustomerName: null,
              assignedGameName: null,
              assignedPackageName: null,
              assignedGameUsername: null,
              assignedOrderStatus: null,
              assignedAt: null,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          });

          // Also check currentOrderId
          const cloudQuery2 = query(collection(db, 'clouds'), where('currentOrderId', '==', orderId));
          const cloudSnaps2 = await getDocs(cloudQuery2);
          cloudSnaps2.forEach(async (cDoc) => {
            await setDoc(doc(db, 'clouds', cDoc.id), {
              status: 'AVAILABLE',
              statusLabel: 'KOSONG',
              assignedOrderId: null,
              currentOrderId: null,
              orderData: null,
              monitoringData: null,
              initialMoney: null,
              currentMoney: null,
              totalProfit: null,
              totalCycle: null,
              scriptVersion: null,
              monitoringStatus: null,
              assignedCustomerName: null,
              assignedGameName: null,
              assignedPackageName: null,
              assignedGameUsername: null,
              assignedOrderStatus: null,
              assignedAt: null,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          });

          await setDoc(doc(db, 'orders', orderId), {
            assignedCloudId: null,
            assignedCloudName: null,
            cloudId: null,
            assignedCloud: null,
            cloud_number: null,
            currentMoney: null,
            initialMoney: null,
            monitoringProfit: null,
            monitoringData: null
          }, { merge: true });
        } catch (cloudRelErr) {
          console.warn('Auto release cloud on status finish warning:', cloudRelErr);
        }
      }
      
      // Auto-send system message for status update
      try {
        const nowIso = new Date().toISOString();
        const sysMsg = {
          text: `📋 [STATUS UPDATE] Status pesanan #${orderId} telah diperbarui menjadi: *${status}*`,
          message: `📋 [STATUS UPDATE] Status pesanan #${orderId} telah diperbarui menjadi: *${status}*`,
          senderRole: 'system',
          sender_role: 'system',
          senderName: 'System',
          sender_name: 'System',
          sender_id: 'system',
          createdAt: serverTimestamp(),
          created: nowIso,
          isSystem: true,
          is_quick_reply: true,
          order_id: orderId
        };
        // Find customer ID to route message correctly
        let targetCustId = '';
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (orderSnap.exists()) {
           targetCustId = orderSnap.data().customer_id;
        }
        if (!targetCustId && orderId.startsWith('direct-')) targetCustId = orderId.replace('direct-', '');
        if (!targetCustId && orderId.startsWith('room_')) targetCustId = orderId.replace('room_', '');
        const targetRoomId = targetCustId ? `room_${targetCustId}` : orderId;

        // 🪙 AUTO-REFUND KE TONGCOINS (TC) JIKA ORDER DIBATALKAN / CANCEL (1 RP = 1 TC)
        if (['BATAL', 'CANCEL', 'BATAL_TOLAK'].includes(status) && orderSnap.exists()) {
          try {
            const ordData = orderSnap.data();
            const orderPrice = Number(ordData.price || ordData.totalPrice || ordData.total_price || 0);
            const custId = ordData.customer_id || targetCustId;
            const alreadyRefunded = ordData.isRefunded === true;

            if (orderPrice > 0 && custId && !alreadyRefunded) {
              const userRef = doc(db, 'users', custId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const curBal = Number(userSnap.data().tc_balance || 0);
                const newBal = curBal + orderPrice;

                // Update saldo TC customer di Firestore
                await setDoc(userRef, {
                  tc_balance: newBal,
                  updatedAt: nowIso
                }, { merge: true });

                // Tandai order sudah direfund
                await setDoc(doc(db, 'orders', orderId), {
                  isRefunded: true,
                  refundAmount: orderPrice,
                  refundedAt: nowIso
                }, { merge: true });

                // Catat di ledger mutasi koin coin_transactions
                const txRef = doc(collection(db, 'coin_transactions'));
                await setDoc(txRef, {
                  id: txRef.id,
                  userId: custId,
                  userEmail: userSnap.data().email || ordData.customer_email || '',
                  userName: userSnap.data().name || ordData.customer_name || 'Customer',
                  userPhone: userSnap.data().phone || ordData.customer_phone || '',
                  type: 'REFUND',
                  amount: orderPrice,
                  orderId: ordData.orderId || orderId,
                  description: `Refund Pembatalan Order #${ordData.orderId || orderId}`,
                  status: 'SUCCESS',
                  createdAt: nowIso,
                  updatedAt: nowIso
                });

                // Kirim notifikasi chat khusus refund otomatis
                const refundMsgRef = doc(collection(db, 'chats', targetRoomId, 'messages'));
                const refundSysMsg = cleanFirestorePayload({
                  id: refundMsgRef.id,
                  text: `💰 [REFUND OTOMATIS] Pesanan #${ordData.orderId || orderId} dibatalkan. Dana sebesar Rp ${orderPrice.toLocaleString('id-ID')} telah otomatis dikembalikan menjadi ${orderPrice.toLocaleString('id-ID')} TC ke Dompet TongCoins Anda (1 Rp = 1 TC).`,
                  message: `💰 [REFUND OTOMATIS] Pesanan #${ordData.orderId || orderId} dibatalkan. Dana sebesar Rp ${orderPrice.toLocaleString('id-ID')} telah otomatis dikembalikan menjadi ${orderPrice.toLocaleString('id-ID')} TC ke Dompet TongCoins Anda (1 Rp = 1 TC).`,
                  senderRole: 'system',
                  sender_role: 'system',
                  senderName: 'System TongCoins',
                  sender_name: 'System TongCoins',
                  sender_id: 'system',
                  createdAt: serverTimestamp(),
                  created: nowIso,
                  isSystem: true,
                  order_id: orderId
                });
                await setDoc(refundMsgRef, refundSysMsg);
              }
            }
          } catch (refundErr) {
            console.warn('Auto refund on cancel error:', refundErr);
          }
        }
        
        const msgRef = doc(collection(db, 'chats', targetRoomId, 'messages'));
        const finalSysMsg = cleanFirestorePayload({ ...sysMsg, id: msgRef.id });
        await setDoc(msgRef, finalSysMsg);
        await setDoc(doc(db, 'chats', targetRoomId), {
           status,
           orderStatus: status,
           updatedAt: serverTimestamp(),
           lastMessage: { message: sysMsg.message, created: nowIso }
        }, { merge: true });

        // Trigger push notification to customer for order status update
        setTimeout(async () => {
          try {
            if (targetCustId) {
              const customerSnap = await getDoc(doc(db, 'users', targetCustId));
              if (customerSnap.exists()) {
                const customerData = customerSnap.data();
                if (customerData && customerData.fcmToken) {
                  await triggerPushNotification(
                    customerData.fcmToken,
                    'Pembaruan Status Order! 📋',
                    `Status order #${orderId} telah diperbarui menjadi: ${status}`
                  );
                }
              }
            }
          } catch (notifErr) {
            console.warn('Failed to send status update push notification:', notifErr);
          }
        }, 100);
      } catch (sysErr) {
        console.error('Gagal kirim system message status update:', sysErr);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const sendMessage = async (orderId: string, messageText: string, mediaUrl?: string, mediaType?: 'IMAGE' | 'VIDEO', isQuickReply?: boolean, msgType?: string) => {
    if (!orderId) {
      console.error('Room ID tidak ditemukan!');
      return;
    }

    // Check for guest data from localStorage
    let activeUser = currentUser;
    if (!activeUser) {
      const guestDataStr = localStorage.getItem('entong_guest_data');
      const guestId = localStorage.getItem('entong_guest_room_id') || `guest_${Date.now()}`;
      
      if (guestDataStr) {
        try {
          const guestData = JSON.parse(guestDataStr);
          activeUser = guestData;
        } catch (e) {
          activeUser = {
            id: guestId,
            name: `Guest_${guestId.slice(-6)}`,
            role: 'CUSTOMER' as UserRole,
            username: `guest_${guestId.slice(-6)}`,
            email: ''
          };
        }
      } else {
        activeUser = {
          id: guestId,
          name: `Guest_${guestId.slice(-6)}`,
          role: 'CUSTOMER' as UserRole,
          username: `guest_${guestId.slice(-6)}`,
          email: ''
        };
      }
    }

    const isOwner = activeUser.role === 'OWNER' || activeUser.username === 'own';
    const senderName = isOwner ? 'Ceo Entong' : activeUser.name;
    const senderRole = isOwner ? 'OWNER' : activeUser.role;
    const isCustomer = senderRole === 'CUSTOMER';
    
    // Dynamic Room Path Resolver for sendMessage: cari ID room presisi dari chats
    let targetRoomId = orderId;
    if (chats && chats.length > 0) {
      const existingChat = chats.find(c => 
        c.id === orderId || 
        c.order_id === orderId || 
        c.customer_id === orderId || 
        c.customerId === orderId ||
        c.id === `room_${orderId}` ||
        c.id === orderId.replace(/^room_/, '') ||
        c.id === orderId.replace(/^direct-/, '') ||
        (c.order_id && (c.order_id === orderId || c.order_id === `room_${orderId}`))
      );
      if (existingChat && existingChat.id) {
        targetRoomId = existingChat.id;
      }
    }

    // Fallback: Jika orderId merujuk ke order dengan customer_id, arahkan ke room_${customer_id}
    if (!targetRoomId.startsWith('room_')) {
      const matchedOrder = orders.find(o => o.id === orderId || o.id === targetRoomId);
      if (matchedOrder && matchedOrder.customer_id) {
        targetRoomId = `room_${matchedOrder.customer_id}`;
      }
    }

    const messagesCollRef = collection(db, 'chats', targetRoomId, 'messages');
    const msgRef = doc(messagesCollRef);
    const msgId = msgRef.id;

    let roomCustomerId = '';
    let roomCustomerName = '';
    
    if (isCustomer) {
      roomCustomerId = activeUser.id;
      roomCustomerName = activeUser.name || activeUser.email?.split('@')[0] || `Customer #${targetRoomId.slice(-4)}`;
    } else {
      if (targetRoomId.startsWith('direct-') || targetRoomId.startsWith('room_')) {
        roomCustomerId = targetRoomId.replace('direct-', '').replace('room_', '');
        const matchedUser = usersRef.current.find(u => u.id === roomCustomerId);
        roomCustomerName = matchedUser?.name || matchedUser?.email?.split('@')[0] || `Customer #${targetRoomId.slice(-4)}`;
      } else {
        const matchedOrder = orders.find(o => o.id === targetRoomId);
        if (matchedOrder) {
          roomCustomerId = matchedOrder.customer_id;
          roomCustomerName = matchedOrder.customer_name && matchedOrder.customer_name !== 'Customer' ? matchedOrder.customer_name : `Cust-${matchedOrder.id}`;
        } else {
          roomCustomerId = '';
          roomCustomerName = `Customer #${targetRoomId.slice(-4)}`;
        }
      }
    }

    // 1. Optimistic Update: Instant display in activeMessages without delay
    const tempMsgId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const optimisticMessage: ChatMessage = {
      id: tempMsgId,
      order_id: targetRoomId,
      sender_id: activeUser.id,
      sender_name: senderName,
      sender_role: senderRole,
      message: messageText || '',
      text: messageText || '',
      media_url: mediaUrl || '',
      media_type: mediaType || null,
      is_quick_reply: !!isQuickReply,
      type: msgType || null,
      is_read: false,
      createdAt: { seconds: Date.now() / 1000 } as any,
      created: new Date().toISOString(),
      timestamp: new Date()
    } as ChatMessage;

    setActiveMessages((prevMessages: ChatMessage[]) => {
      const currentList = Array.isArray(prevMessages) ? prevMessages : [];
      return [...currentList, optimisticMessage];
    });

    try {
      const messagePayload = cleanFirestorePayload({
        id: msgId,
        order_id: targetRoomId,
        senderId: activeUser.id,
        sender_id: activeUser.id,
        senderRole: isCustomer ? 'customer' : 'admin',
        sender_role: isCustomer ? 'customer' : 'admin',
        senderRoleFull: senderRole,
        senderName: senderName,
        sender_name: senderName,
        text: messageText || '',
        message: messageText || '',
        mediaUrl: mediaUrl || '',
        media_url: mediaUrl || '',
        media_type: mediaType || null,
        is_quick_reply: !!isQuickReply,
        type: msgType || null,
        is_read: false,
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        localTimestamp: Date.now(),
        createdAtMillis: Date.now()
      });
      
      // EKSEKUSI INSTAN: Tulis dokumen pesan ke subkoleksi langsung tanpa blocking
      await setDoc(msgRef, messagePayload);

      // ASYNCHRONOUS BACKGROUND TASK: Update ringkasan dokumen induk chat secara terpisah
      const roomRef = doc(db, 'chats', targetRoomId);
      let roomPayload: any = {};
      
      if (isCustomer) {
        roomPayload = cleanFirestorePayload({
          id: targetRoomId,
          order_id: targetRoomId,
          customerId: roomCustomerId,
          customer_id: roomCustomerId,
          customerName: roomCustomerName,
          customer_name: roomCustomerName,
          lastMessage: messageText || (mediaUrl ? '[Media]' : ''),
          last_message: messageText || (mediaUrl ? '[Media]' : ''),
          lastMessageTime: serverTimestamp(),
          lastSender: 'customer',
          last_sender: 'customer',
          last_sender_id: activeUser.id,
          last_sender_name: senderName,
          last_sender_role: 'customer',
          is_read_customer: true,
          isReadByCustomer: true,
          is_read_admin: false,
          isReadByAdmin: false,
          unreadByAdmin: true,
          unread_by_admin: true,
          unreadAdminCount: increment(1),
          unreadCount: increment(1),
          updatedAt: serverTimestamp(),
          ...(messageText?.trim() ? { chatHistoryText: arrayUnion(messageText.trim().toLowerCase()) } : {})
        });
      } else {
        // ADMIN REPLY: HANYA update metadata pesan terakhir, JANGAN timpa customerName/robloxUsername
        roomPayload = cleanFirestorePayload({
          id: targetRoomId,
          order_id: targetRoomId,
          customerId: roomCustomerId || undefined,
          customer_id: roomCustomerId || undefined,
          lastMessage: messageText || (mediaUrl ? '[Media]' : ''),
          last_message: messageText || (mediaUrl ? '[Media]' : ''),
          lastMessageTime: serverTimestamp(),
          lastSender: 'admin',
          last_sender: 'admin',
          last_sender_id: activeUser.id,
          last_sender_name: senderName,
          last_sender_role: 'admin',
          is_read_customer: false,
          isReadByCustomer: false,
          is_read_admin: true,
          isReadByAdmin: true,
          unreadByAdmin: false,
          unread_by_admin: false,
          unreadCustomerCount: increment(1),
          unreadAdminCount: 0,
          unreadCount: 0,
          updatedAt: serverTimestamp(),
          ...(messageText?.trim() ? { chatHistoryText: arrayUnion(messageText.trim().toLowerCase()) } : {})
        });
      }
      
      setDoc(roomRef, roomPayload, { merge: true }).catch(err => {
        console.warn('Background room document update warning:', err);
      });

      // === SMART OFF-HOURS AUTO-REPLY BOT ===
      if (isCustomer) {
        try {
          const now = new Date();
          const currentHour = now.getHours();
          
          // Cek apakah di luar jam operasional (23:00 - 10:59)
          const isOffHours = currentHour >= 23 || currentHour < 11;
          
          if (isOffHours) {
             const dateString = now.toLocaleDateString('en-CA'); // format YYYY-MM-DD
             const sessionKey = currentHour >= 23 ? `night_${dateString}` : `morning_${dateString}`;
             
             const existingChatObj = chats?.find(c => c.id === targetRoomId);
             const lastAutoReplySession = existingChatObj?.lastOffHoursAutoReplySession || '';
             
             if (lastAutoReplySession !== sessionKey) {
                const botMessage = "Halo! Terima kasih sudah menghubungi Entong Store. 🙏\n\nSaat ini toko kami sedang TUTUP (Di Luar Jam Operasional 11.00 - 23.00 WIB). Pesan kamu sudah masuk dan admin akan segera membalasnya saat operasional buka kembali. Terima kasih atas pengertiannya! ✨";
                
                const botMsgRef = doc(collection(db, 'chats', targetRoomId, 'messages'));
                const botPayload = cleanFirestorePayload({
                   id: botMsgRef.id,
                   order_id: targetRoomId,
                   senderId: 'system_bot',
                   sender_id: 'system_bot',
                   senderRole: 'admin',
                   sender_role: 'admin',
                   senderName: 'Entong Store (Bot)',
                   sender_name: 'Entong Store (Bot)',
                   text: botMessage,
                   message: botMessage,
                   is_read: false,
                   createdAt: serverTimestamp(),
                   timestamp: serverTimestamp(),
                   localTimestamp: Date.now() + 500,
                   createdAtMillis: Date.now() + 500
                });
                
                await setDoc(botMsgRef, botPayload);
                
                await setDoc(doc(db, 'chats', targetRoomId), cleanFirestorePayload({
                   lastMessage: botMessage,
                   last_message: botMessage,
                   lastMessageTime: serverTimestamp(),
                   lastSender: 'admin',
                   last_sender: 'admin',
                   is_read_customer: false,
                   is_read_admin: true,
                   lastOffHoursAutoReplySession: sessionKey,
                   updatedAt: serverTimestamp()
                }), { merge: true });
             }
          }
        } catch (botErr) {
           console.warn('Gagal menjalankan bot auto-reply:', botErr);
        }
      }

      // Trigger push notification to recipient
      setTimeout(async () => {
        try {
          if (isCustomer) {
            // Customer sent message -> Notify Admin
            const adminQuery = query(collection(db, 'users'), where('role', 'in', ['ADMIN', 'OWNER']));
            const adminSnaps = await getDocs(adminQuery);
            adminSnaps.forEach(async (adminDoc) => {
              const adminData = adminDoc.data();
              if (adminData && adminData.fcmToken) {
                await triggerPushNotification(
                  adminData.fcmToken,
                  `Pesan Baru dari ${senderName} 💬`,
                  messageText || (mediaUrl ? '[Gambar/Video]' : 'Ada pesan baru untuk Anda.')
                );
              }
            });
          } else {
            // Admin/Owner sent message -> Notify Customer
            if (roomCustomerId) {
              // 1. Check if customer is currently active in room
              const roomSnap = await getDoc(doc(db, 'chats', targetRoomId));
              let isCustomerActive = false;
              if (roomSnap.exists()) {
                const rData = roomSnap.data();
                if (rData.activeInRoom === roomCustomerId || rData.isCustomerOnline === true) {
                   isCustomerActive = true;
                }
              }

              if (!isCustomerActive) {
                const customerSnap = await getDoc(doc(db, 'users', roomCustomerId));
                if (customerSnap.exists()) {
                  const customerData = customerSnap.data();
                  const tokens = customerData.fcmTokens || (customerData.fcmToken ? [customerData.fcmToken] : []);
                  if (tokens && tokens.length > 0) {
                    await triggerPushNotification(
                      tokens,
                      `Entong Store - Pesan Baru dari Admin`,
                      messageText || (mediaUrl ? '[Gambar/Video]' : 'Ada pesan baru untuk Anda.'),
                      { chatId: targetRoomId, url: `/chat` }
                    );
                  }
                }
              }
            }
          }
        } catch (notifErr) {
          console.warn('Failed to send chat message push notification:', notifErr);
        }
      }, 100);
      
    } catch (error: any) {
      console.error("GAGAL KIRIM PESAN:", error);
      throw error;
    }
  };

  const clearOrderChats = async (orderId: string) => {
    if (!orderId) return;
    let targetRoomId = orderId;
    if (chats && chats.length > 0) {
      const existingChat = chats.find(c => 
        c.id === orderId || 
        c.order_id === orderId || 
        c.customer_id === orderId || 
        c.customerId === orderId ||
        c.id === `room_${orderId}` ||
        c.id === orderId.replace(/^room_/, '') ||
        c.id === orderId.replace(/^direct-/, '')
      );
      if (existingChat && existingChat.id) {
        targetRoomId = existingChat.id;
      }
    }
    try { 
      const msgsSnap = await getDocs(collection(db, 'chats', targetRoomId, 'messages'));
      for (const mDoc of msgsSnap.docs) {
        await deleteDoc(doc(db, 'chats', targetRoomId, 'messages', mDoc.id));
      }
      await deleteDoc(doc(db, 'chats', targetRoomId)); 
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${targetRoomId}`);
    }
  };

  const purgeEmptyChats = async (): Promise<number> => {
    try {
      const snap = await getDocs(collection(db, 'chats'));
      let deletedCount = 0;
      const dummyKeywords = ['', 'chat dimulai', 'percakapan dimulai', 'null', 'undefined'];

      for (const docSnap of snap.docs) {
        const data = docSnap.data() || {};
        const roomId = docSnap.id;

        // Check if there's an associated order in orders state or Firestore
        const hasAssociatedOrder = orders.some(o => 
          o.id === roomId || 
          o.customer_id === data.customer_id || 
          o.customer_id === data.customerId
        );

        const lastMsgText = (data.last_message || data.lastMessage?.message || data.lastMessage || '').toString().trim().toLowerCase();
        const isDummyMsg = dummyKeywords.includes(lastMsgText);

        // Check subcollection messages
        const msgsSnap = await getDocs(query(collection(db, 'chats', roomId, 'messages'), limit(10)));
        const realMsgs = msgsSnap.docs.filter(m => {
          const mData = m.data() || {};
          const txt = (mData.message || mData.text || '').toString().trim().toLowerCase();
          return !mData.isSystem && txt !== '' && txt !== 'chat dimulai' && txt !== 'percakapan dimulai';
        });

        if (!hasAssociatedOrder && (isDummyMsg || realMsgs.length === 0)) {
          // Delete messages in subcollection first
          for (const mDoc of msgsSnap.docs) {
            await deleteDoc(doc(db, 'chats', roomId, 'messages', mDoc.id));
          }
          await deleteDoc(doc(db, 'chats', roomId));
          deletedCount++;
        }
      }
      return deletedCount;
    } catch (err) {
      console.error('Error purging empty chats:', err);
      return 0;
    }
  };

  const markChatAsRead = async (orderId: string, readerRole?: UserRole) => {
    if (!orderId) return;
    let targetRoomId = orderId;
    if (chats && chats.length > 0) {
      const existingChat = chats.find(c => 
        c.id === orderId || 
        c.order_id === orderId || 
        c.customer_id === orderId || 
        c.customerId === orderId ||
        c.id === `room_${orderId}` ||
        c.id === orderId.replace(/^room_/, '') ||
        c.id === orderId.replace(/^direct-/, '')
      );
      if (existingChat && existingChat.id) {
        targetRoomId = existingChat.id;
      }
    }

    // ⚡ Optimistic update local chats state
    setChats(prev => prev.map(c => {
      if (c.id === targetRoomId || c.order_id === targetRoomId || c.customer_id === targetRoomId || `room_${c.customer_id}` === targetRoomId) {
        if (readerRole === 'CUSTOMER') {
          return { ...c, is_read_customer: true, isReadByCustomer: true, unreadCustomerCount: 0 };
        } else {
          return { 
            ...c, 
            is_read_admin: true, 
            isReadByAdmin: true, 
            unreadByAdmin: false, 
            unread_by_admin: false, 
            unreadAdminCount: 0, 
            unreadCount: 0 
          };
        }
      }
      return c;
    }));

    try {
      const chatRef = doc(db, 'chats', targetRoomId);
      const roomRef = doc(db, 'rooms', targetRoomId);

      if (readerRole === 'CUSTOMER') {
        await setDoc(chatRef, { is_read_customer: true, isReadByCustomer: true, unreadCustomerCount: 0, customerUnread: 0 }, { merge: true }).catch(() => {});
        await setDoc(roomRef, { is_read_customer: true, isReadByCustomer: true, unreadCustomerCount: 0, customerUnread: 0 }, { merge: true }).catch(() => {});
      } else {
        const adminResetData = { 
          is_read_admin: true, 
          isReadByAdmin: true,
          unreadByAdmin: false,
          unread_by_admin: false,
          unreadAdminCount: 0, 
          unreadCount: 0, 
          unread_count: 0, 
          unreadCountByAdmin: 0,
          adminUnread: 0 
        };
        await setDoc(chatRef, adminResetData, { merge: true }).catch(() => {});
        await setDoc(roomRef, adminResetData, { merge: true }).catch(() => {});
      }
      
      if ((selectedChatId === orderId || selectedChatId === targetRoomId) && activeMessages.length > 0) {
        const batch = writeBatch(db);
        let updatedCount = 0;
        activeMessages.forEach(msg => {
          if (!msg.is_read) {
            const isMsgFromCustomer = msg.sender_role === 'CUSTOMER' || (msg as any).senderRole === 'customer';
            if (readerRole === 'CUSTOMER' && !isMsgFromCustomer) {
              batch.update(doc(db, 'chats', targetRoomId, 'messages', msg.id), { is_read: true });
              updatedCount++;
            } else if (readerRole !== 'CUSTOMER' && isMsgFromCustomer) {
              batch.update(doc(db, 'chats', targetRoomId, 'messages', msg.id), { is_read: true });
              updatedCount++;
            }
          }
        });
        if (updatedCount > 0) await batch.commit().catch(() => {});
      }
    } catch (err) {
      console.warn("markChatAsRead error:", err);
    }
  };

  const saveItem = async (item: GameItem) => {
    try { 
      await setDoc(doc(db, 'items', item.id), cleanFirestorePayload(item), { merge: true }); 
      fetchItems();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `items/${item.id}`);
    }
  };
  const deleteItem = async (id: string) => {
    try { 
      await deleteDoc(doc(db, 'items', id)); 
      fetchItems();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `items/${id}`);
    }
  };

  const saveQuickReply = async (qr: QuickReplyTemplate) => {
    try { 
      await setDoc(doc(db, 'quickReplies', qr.id), cleanFirestorePayload(qr), { merge: true }); 
      fetchQuickReplies();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `quickReplies/${qr.id}`);
    }
  };
  const deleteQuickReply = async (id: string) => {
    try { 
      await deleteDoc(doc(db, 'quickReplies', id)); 
      fetchQuickReplies();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `quickReplies/${id}`);
    }
  };

  const saveUser = async (user: UserProfile) => {
    try { 
      const roleUpper = (user.role || '').toString().toUpperCase();
      const isStaffRole = ['STAFF', 'ADMIN', 'OWNER', 'OPERATOR', 'WORKER'].includes(roleUpper) || user.isStaff === true;
      const targetId = user.id || user.uid || `user_${Date.now()}`;
      const payload = {
        ...user,
        id: targetId,
        uid: user.uid || targetId,
        usernameLower: user.username ? user.username.toLowerCase() : '',
        isStaff: isStaffRole,
        createdAt: user.createdAt || user.created || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', targetId), cleanFirestorePayload(payload), { merge: true }); 
      if (isStaffRole) {
        await setDoc(doc(db, 'staff', targetId), cleanFirestorePayload(payload), { merge: true });
      }
      fetchUsers();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
    }
  };
  const deleteUser = async (id: string) => {
    try { 
      await deleteDoc(doc(db, 'users', id)); 
      fetchUsers();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    }
  };

  const updateOrder = async (order: GameOrder) => {
    try { 
      await setDoc(doc(db, 'orders', order.id), cleanFirestorePayload({ ...order, updated: new Date().toISOString() }), { merge: true }); 
      fetchOrders();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${order.id}`);
    }
  };
  const deleteOrder = async (id: string) => {
    try { 
      await deleteDoc(doc(db, 'orders', id)); 
      fetchOrders();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${id}`);
    }
  };

  const checkInStaff = async (staffId: string, staffName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const docId = `att_${staffId}_${today}`;
    const newAtt = {
      id: docId,
      staff_id: staffId,
      staff_name: staffName,
      date: today,
      check_in: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      status: 'HADIR' as const
    };
    try { 
      await setDoc(doc(db, 'attendance', docId), cleanFirestorePayload(newAtt), { merge: true }); 
      fetchAttendance();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const checkOutStaff = async (staffId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const docId = `att_${staffId}_${today}`;
    try { 
      await setDoc(doc(db, 'attendance', docId), {
        check_out: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
      }, { merge: true }); 
      fetchAttendance();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const addFinanceRecord = async (record: Omit<FinanceRecord, 'id'>) => {
    try { 
      await setDoc(doc(db, 'finance', 'fin-' + Date.now()), cleanFirestorePayload(record)); 
      fetchFinance();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'finance');
    }
  };

  const optimizeDatabase = () => { console.log('⚡ Optimasi database berhasil dilakukan!'); };
  const resetQuotaExceeded = () => { window.location.reload(); };
  
  const refreshCaptcha = () => { 
    const n1 = Math.floor(Math.random() * 8) + 2;
    const n2 = Math.floor(Math.random() * 8) + 1;
    setCaptchaQuestion({ num1: n1, num2: n2, op: '+', answer: n1 + n2 }); 
  };
  
  const saveChatNote = (chatId: string, note: string) => { setChatNotes(prev => ({...prev, [chatId]: note})); };

  const saveCloud = async (cloudData: Partial<CloudInstance>): Promise<string> => {
    const cloudId = cloudData.id || `cloud_${Date.now()}`;
    const payload = cleanFirestorePayload({
      ...cloudData,
      id: cloudId,
      updatedAt: new Date().toISOString(),
      ...(cloudData.createdAt ? {} : { createdAt: new Date().toISOString() })
    });
    await setDoc(doc(db, 'clouds', cloudId), payload, { merge: true });
    fetchClouds();
    return cloudId;
  };

  const deleteCloud = async (cloudId: string): Promise<void> => {
    const targetCloud = clouds.find(c => c.id === cloudId);
    if (targetCloud && targetCloud.assignedOrderId) {
      await setDoc(doc(db, 'orders', targetCloud.assignedOrderId), {
        assignedCloudId: null,
        assignedCloudName: null,
        cloud_number: null,
        updated: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    }
    await deleteDoc(doc(db, 'clouds', cloudId));
    fetchClouds();
    fetchOrders();
  };

  const assignOrderToCloud = async (cloudId: string, orderId: string): Promise<void> => {
    const matchedOrder = orders.find(o => o.id === orderId);
    const matchedCloud = clouds.find(c => c.id === cloudId);
    if (!matchedOrder || !matchedCloud) {
      throw new Error("Order atau Cloud tidak ditemukan.");
    }
    
    const now = new Date();
    const nowIso = now.toISOString();

    // Format loginAt: DD/MM/YYYY - HH:mm WIB
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const loginAtFormatted = `${day}/${month}/${year} - ${hours}:${minutes} WIB`;

    // Ambil Uang Awal dari order jika ada (uangSebelumJoko, initialGameMoney, initial_money, initialMoney)
    const initialMoneyFromOrder = 
      (matchedOrder as any).uangSebelumJoko || 
      matchedOrder.initialGameMoney || 
      (matchedOrder as any).initial_money || 
      matchedOrder.initialMoney || 
      '';

    // 1 Cloud = Tepat 1 Orderan Aktif
    // If this order was previously assigned to another cloud, release the previous cloud
    const oldCloud = clouds.find(c => (c.assignedOrderId === orderId || c.currentOrderId === orderId) && c.id !== cloudId);
    if (oldCloud) {
      await setDoc(doc(db, 'clouds', oldCloud.id), {
        status: 'AVAILABLE',
        statusLabel: 'KOSONG',
        assignedOrderId: null,
        currentOrderId: null,
        orderData: null,
        monitoringData: null,
        initialMoney: null,
        currentMoney: null,
        totalProfit: null,
        totalCycle: null,
        scriptVersion: null,
        monitoringStatus: null,
        assignedCustomerName: null,
        assignedGameName: null,
        assignedPackageName: null,
        assignedGameUsername: null,
        assignedOrderStatus: null,
        assignedAt: null,
        loginAt: null,
        updatedAt: nowIso
      }, { merge: true });
    }

    // Update Cloud Status & Data
    const cloudUpdatePromise = setDoc(doc(db, 'clouds', cloudId), {
      status: 'IN_USE',
      statusLabel: 'TERPAKAI',
      assignedOrderId: matchedOrder.id,
      currentOrderId: matchedOrder.id,
      orderData: {
        id: matchedOrder.id,
        customer_name: matchedOrder.customer_name || (matchedOrder as any).customerName || 'Customer',
        game_name: matchedOrder.game_name || 'Layanan Game',
        package_name: matchedOrder.package_name || (matchedOrder as any).packageName || '',
        game_username: matchedOrder.game_username || (matchedOrder as any).robloxUsername || '',
        status: matchedOrder.status || 'PROSES'
      },
      assignedCustomerName: matchedOrder.customer_name || (matchedOrder as any).customerName || 'Customer',
      assignedGameName: matchedOrder.game_name || 'Layanan Game',
      assignedPackageName: matchedOrder.package_name || (matchedOrder as any).packageName || '',
      assignedGameUsername: matchedOrder.game_username || (matchedOrder as any).robloxUsername || '',
      assignedOrderStatus: matchedOrder.status || (matchedOrder as any).orderStatus || 'PROSES',
      assignedAt: nowIso,
      loginAt: loginAtFormatted,
      initialMoney: initialMoneyFromOrder || null,
      updatedAt: nowIso
    }, { merge: true });

    // Update Order with assigned cloud info & login timestamp
    const orderUpdatePromise = setDoc(doc(db, 'orders', orderId), {
      assignedCloudId: cloudId,
      assignedCloudName: matchedCloud.name,
      cloudId: cloudId,
      assignedCloud: matchedCloud.name,
      cloud_number: matchedCloud.name,
      loginAt: loginAtFormatted,
      updated: nowIso
    }, { merge: true });

    await Promise.all([cloudUpdatePromise, orderUpdatePromise]);
    fetchClouds();
    fetchOrders();
  };

  const releaseOrderFromCloud = async (cloudId: string): Promise<void> => {
    const targetCloud = clouds.find(c => c.id === cloudId);
    const nowIso = new Date().toISOString();

    const targetOrderId = targetCloud?.assignedOrderId || targetCloud?.currentOrderId;

    const cloudResetPromise = setDoc(doc(db, 'clouds', cloudId), {
      status: 'AVAILABLE',
      statusLabel: 'KOSONG',
      assignedOrderId: null,
      currentOrderId: null,
      orderData: null,
      monitoringData: null,
      initialMoney: null,
      currentMoney: null,
      totalProfit: null,
      totalCycle: null,
      scriptVersion: null,
      monitoringStatus: null,
      assignedCustomerName: null,
      assignedGameName: null,
      assignedPackageName: null,
      assignedGameUsername: null,
      assignedOrderStatus: null,
      assignedAt: null,
      loginAt: null,
      updatedAt: nowIso
    }, { merge: true });

    let orderResetPromise = Promise.resolve();
    if (targetOrderId) {
      orderResetPromise = setDoc(doc(db, 'orders', targetOrderId), {
        assignedCloudId: null,
        assignedCloudName: null,
        cloudId: null,
        assignedCloud: null,
        cloud_number: null,
        currentMoney: null,
        initialMoney: null,
        monitoringProfit: null,
        monitoringData: null,
        updated: nowIso
      }, { merge: true }).catch(() => {});
    }

    await Promise.all([cloudResetPromise, orderResetPromise]);
    fetchClouds();
    fetchOrders();
  };

  return (
    <AppContext.Provider
      value={{
        currentUser, setCurrentUser, authLoading, users, orders,
        chats, setChats, unreadChats, loadMoreChats, hasMoreChats, isLoadingMoreChats,
        activeMessages, selectedChatId, setSelectedChatId, customerMainRoomId,
        items, quickReplies, attendance, finance, isOnlinePB,
        mutedUsers, isUserMuted, getMuteRemainingSeconds, muteUser, unmuteUser,
        banUser, unbanUser, isUserBanned,
        adminStatus, qrisImageUrl, danaNumber, danaName, storeAvatarUrl, adminWhatsappNumber, updatePaymentSettings,
        storeOpenHour, storeCloseHour, storeAutoHours, storeForceStatus, storeClosedNoticeText, isStoreClosed, updateStoreSettings,
        login, register, logout, createOrder, updateOrderStatus,
        sendMessage, clearOrderChats, purgeEmptyChats, markChatAsRead,
        saveItem, deleteItem, saveQuickReply, deleteQuickReply,
        custCounter: 100, getNextCustCode, saveUser, deleteUser,
        updateOrder, deleteOrder, checkInStaff, checkOutStaff, addFinanceRecord,
        submitCount, lastSubmitTime, isRateLimited, captchaQuestion, refreshCaptcha,
        optimizeDatabase, resetQuotaExceeded, chatNotes, saveChatNote,
        totalUnreadCount,
        clouds, saveCloud, deleteCloud, assignOrderToCloud, releaseOrderFromCloud
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
