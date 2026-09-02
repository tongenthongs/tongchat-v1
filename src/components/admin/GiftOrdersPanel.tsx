import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gift, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Copy, 
  Filter, 
  X, 
  AlertCircle,
  Phone,
  User,
  Gamepad2,
  DollarSign,
  CreditCard,
  FileText,
  Calendar,
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { updateOrderStatusGlobal, normalizeOrderStatus } from '../../utils/orderUtils';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  where,
  getDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { GameCatalog } from '../../types';
import { executeCancelOrderWithAutoRefund, isJunkBotOrder, purgeAllBotAndDummyOrders } from '../../lib/orderRefund';
import { matchOrderSearchAndCategory } from '../../utils/orderSearchHelper';

export interface GiftOrder {
  id: string;
  firestore_id?: string;
  order_id: string;
  id_order?: string;
  customer_name: string;
  customer_phone: string;
  game_user_id: string;
  item_name: string;
  itemGift?: string;
  items?: Array<{
    catalogId?: string;
    gameName?: string;
    name?: string;
    packageName?: string;
    title?: string;
    category?: string;
    price?: number;
    totalPrice?: number;
    qty?: number;
    quantity?: number;
    imageUrl?: string | null;
  }>;
  price: number;
  payment_method: string;
  status: 'Booking' | 'Diorder' | 'Proses' | 'Selesai' | string;
  service_type?: string;
  category?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// 🚀 Helper parsing dan format tanggal fleksibel & aman (mencegah Invalid Date)
export const parseSafeDate = (rawDate: any): Date | null => {
  if (!rawDate) return null;
  try {
    if (typeof rawDate?.toDate === 'function') return rawDate.toDate();
    if (typeof rawDate?.toMillis === 'function') return new Date(rawDate.toMillis());
    if (rawDate?.seconds) return new Date(rawDate.seconds * 1000);
    if (typeof rawDate === 'number') return new Date(rawDate);
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {
    return null;
  }
  return null;
};

export const formatOrderDate = (timestamp: any) => {
  if (!timestamp) return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  try {
    const date = parseSafeDate(timestamp);
    if (!date || isNaN(date.getTime())) {
      return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + 
           date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
};

// ⏰ Evaluasi apakah waktu order masuk dalam rentang jam operasional Gift (13.00 - 20.45 WIB)
export const getGiftOperatingHoursInfo = (dateVal: any): { isWithinHours: boolean; label: string; timeStr: string } => {
  const d = parseSafeDate(dateVal);
  if (!d) return { isWithinHours: true, label: '13.00 - 20.45 WIB', timeStr: '-' };

  // Hitung dalam WIB (UTC+7)
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wibDate = new Date(utc + (3600000 * 7));
  const hour = wibDate.getHours();
  const minute = wibDate.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  const timeStr = `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')} WIB`;

  // 13.00 WIB = 780 menit, 20.45 WIB = 1245 menit
  const isWithinHours = timeInMinutes >= (13 * 60) && timeInMinutes <= (20 * 60 + 45);

  return {
    isWithinHours,
    label: isWithinHours ? 'Jam Kirim (13.00 - 20.45 WIB)' : 'Di Luar Jam Operasional (Antrian 13.00)',
    timeStr
  };
};

// Cek status operasional Gift saat ini
export const getLiveGiftStatus = (): { isLiveOpen: boolean; liveTimeStr: string } => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wibDate = new Date(utc + (3600000 * 7));
  const hour = wibDate.getHours();
  const minute = wibDate.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  const isLiveOpen = timeInMinutes >= (13 * 60) && timeInMinutes <= (20 * 60 + 45);
  const liveTimeStr = `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')} WIB`;
  return { isLiveOpen, liveTimeStr };
};

const getLocalDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface GiftOrdersPanelProps {
  onOpenDirectChat?: (order: GiftOrder | any) => void;
}

export const GiftOrdersPanel: React.FC<GiftOrdersPanelProps> = ({ onOpenDirectChat }) => {
  const [orders, setOrders] = useState<GiftOrder[]>([]);
  const [catalogs, setCatalogs] = useState<GameCatalog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('Semua'); // 'Semua', 'Booking', 'Diorder', 'Proses', 'Selesai'
  const [searchQuery, setSearchQuery] = useState<string>('');



  const handleOpenDirectChat = (order: GiftOrder | any) => {
    // Ambil identifier unik percakapan
    const targetId = order.customer_phone || (order as any).whatsapp || order.room_id || order.chat_id || order.id || order.order_id || order.roblox_username || order.game_user_id || order.customer_name || order.customer_id;
    if (targetId) {
      sessionStorage.setItem('active_chat_target', String(targetId));
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('room', String(targetId));
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    }

    if (onOpenDirectChat) {
      onOpenDirectChat(order);
    }
    // Custom event fallback to trigger chat tab in AdminPortal
    window.dispatchEvent(new CustomEvent('open-admin-chat-order', { detail: order }));
  };

  // Date Filter State
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState<string>('');

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [registeredUidsSet, setRegisteredUidsSet] = useState<Set<string>>(new Set());
  const [registeredPhonesSet, setRegisteredPhonesSet] = useState<Set<string>>(new Set());

  const normalizePhoneForCheck = (p: string) => {
    if (!p) return '';
    let clean = p.toString().replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    else if (clean.startsWith('8')) clean = '62' + clean;
    return clean;
  };

  const checkIsRegisteredCustomer = (ordAny: any) => {
    if (ordAny.isRegistered === true || ordAny.isCustomerRegistered === true || ordAny.isClaimed === true) return true;
    const validId = ordAny.userId || ordAny.userUid || ordAny.customerUid || ordAny.customerId || ordAny.customer_id;
    const hasValidUid = Boolean(validId && (registeredUidsSet.has(validId) || (!validId.startsWith('guest_') && !validId.startsWith('wa_') && !validId.startsWith('anon_'))));
    
    const cleanPhone = normalizePhoneForCheck(ordAny.whatsapp || ordAny.phone || ordAny.customer_phone || ordAny.customerPhone || ordAny.whatsappNumber || ordAny.userPhone || '');
    const hasMatchingPhone = Boolean(cleanPhone && cleanPhone.length >= 6 && registeredPhonesSet.has(cleanPhone));
    
    return hasValidUid || hasMatchingPhone;
  };

  // Realtime listener specifically for users registration status
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), limit(150)), (snapshot) => {
      const uids = new Set<string>();
      const phones = new Set<string>();
      
      snapshot.forEach(doc => {
        uids.add(doc.id);
        const d = doc.data();
        if (d.uid) uids.add(d.uid);
        
        const wa = (d.whatsapp || d.phone || d.no_wa || '').toString().trim();
        if (wa) {
          phones.add(normalizePhoneForCheck(wa));
        }
      });
      
      setRegisteredUidsSet(uids);
      setRegisteredPhonesSet(phones);
    });
    
    return () => unsubscribeUsers();
  }, []);

  // Fetch registered customers and Google accounts on mount for instant dropdown availability
  useEffect(() => {
    const loadAllUsersAndGoogleAccounts = async () => {
      try {
        const map = new Map();

        const parseAndAdd = (docSnap: any) => {
          const d = docSnap.data();
          if (!d) return;

          const email = (d.email || d.user_email || '').trim();
          const wa = (d.whatsapp || d.phone || d.no_wa || d.customer_phone || '').toString().trim();
          const roblox = (d.roblox_username || d.username_roblox || d.username || d.game_user_id || '').toString().trim();
          const name = (d.displayName || d.name || d.customer_name || email.split('@')[0] || roblox || 'User').trim();
          
          if (email || wa || roblox) {
            const uniqueKey = docSnap.id || email || wa || roblox;
            if (!map.has(uniqueKey)) {
              map.set(uniqueKey, {
                id: docSnap.id,
                name: name,
                email: email,
                whatsapp: wa,
                roblox: roblox,
                roblox_username: roblox,
                phone: wa
              });
            }
          }
        };

        // 1. Scan koleksi 'users'
        try {
          const snapUsers = await getDocs(collection(db, 'users'));
          snapUsers.forEach(doc => parseAndAdd(doc));
        } catch (e) {}

        // 2. Scan koleksi 'customers'
        try {
          const snapCust = await getDocs(collection(db, 'customers'));
          snapCust.forEach(doc => parseAndAdd(doc));
        } catch (e) {}

        // 3. Scan koleksi 'orders' (riwayat transaksi)
        try {
          const snapOrders = await getDocs(query(collection(db, 'orders'), limit(300)));
          snapOrders.forEach(doc => parseAndAdd(doc));
        } catch (e) {}

        const result = Array.from(map.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
        setCustomerList(result);
      } catch (err) {
        console.error("Gagal load all accounts:", err);
      }
    };

    loadAllUsersAndGoogleAccounts();
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    customer_phone: '',
    game_user_id: '',
    item_name: '',
    price: '',
    payment_method: 'QRIS',
    status: 'Booking' as 'Booking' | 'Diorder' | 'Proses' | 'Selesai' | string,
    notes: ''
  });

  // 1. LISTENER REALTIME FIRESTORE (FILTER KHUSUS GIFT IN-GAME MURNI DENGAN LIMIT)
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({
        firestore_id: doc.id,
        id: doc.id,
        ...doc.data()
      }));

      // FILTER KHUSUS GIFT IN-GAME MURNI (ISOLASI MUTLAK - STRICT CATEGORY ROUTING)
      const pureGiftOrders = allOrders.filter((order: any) => {
        // Abaikan pesanan bot / junk
        if (isJunkBotOrder({ ...order, id: order.firestore_id || order.id })) {
          return false;
        }

        const rawPkgName = (order.packageName || order.package_name || order.item_name || order.product_name || order.name || '').toString().toLowerCase();
        const rawCat = (order.category || order.service_type || '').toString().toLowerCase();
        const rawType = (order.type || order.orderType || '').toString().toLowerCase();
        const rawGame = (order.gameName || order.game_name || '').toString().toLowerCase();

        // 1. TOLAK MUTLAK SEMUA DOKUMEN DENGAN TANDA JOKI / JOKO (TIDAK BOLEH MUNCUL DI PANEL GIFT)
        const isJoki = order.isJoko === true ||
                       rawCat === 'joko' ||
                       rawCat === 'joki' ||
                       rawType === 'joko' ||
                       rawType === 'joki' ||
                       rawPkgName.includes('joko') ||
                       rawPkgName.includes('joki') ||
                       rawPkgName.includes('leveling') ||
                       rawPkgName.includes('push rank') ||
                       rawPkgName.includes('joki rank') ||
                       rawPkgName.includes('joko cash') ||
                       rawGame.includes('joko') ||
                       rawGame.includes('joki');

        if (isJoki) {
          return false; // Tolak pesanan Joki dari Panel Gift
        }

        // 2. TERIMA PESANAN YANG MERUPAKAN GIFT
        const isGift = order.isGift === true || 
                       rawCat === 'gift' || 
                       rawType === 'gift' || 
                       Boolean(order.itemGift) ||
                       Boolean(order.giftItemName) ||
                       (Array.isArray(order.items) && order.items.length > 0) ||
                       rawPkgName.includes('item') ||
                       rawPkgName.includes('gift') ||
                       rawPkgName.includes('cash') ||
                       rawPkgName.includes('pass') ||
                       rawPkgName.includes('radio') ||
                       rawPkgName.includes('suspension') ||
                       rawPkgName.includes('spec') ||
                       rawPkgName.includes('paint') ||
                       rawPkgName.includes('luxury') ||
                       rawPkgName.includes('car');

        const isNotDeleted = order.isDeleted !== true && order.deleted !== true;
        
        return isGift && isNotDeleted;
      });

      // Urutkan dari yang terbaru
      pureGiftOrders.sort((a: any, b: any) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (val.seconds) return val.seconds * 1000;
          return new Date(val).getTime() || 0;
        };
        return getTime(b.created_at || b.createdAt || b.created) - getTime(a.created_at || a.createdAt || a.created);
      });

      // Normalisasi struktur data GiftOrder
      const normalizedList: GiftOrder[] = pureGiftOrders.map((data: any) => ({
        ...data,
        firestore_id: data.firestore_id || data.id,
        id: data.firestore_id || data.id,
        id_order: data.id_order || data.order_id || data.id,
        order_id: data.order_id || data.id_order || data.id,
        customer_name: data.customer_name || data.game_username || data.roblox_username || data.username_roblox || 'Customer',
        customer_phone: data.customer_phone || data.whatsapp || data.phone || data.customerPhone || data.customerWhatsapp || data.whatsappNumber || data.userPhone || '',
        game_user_id: data.game_username || data.game_user_id || data.robloxUsername || data.roblox_username || data.username_roblox || '-',
        item_name: data.itemGift || data.giftItemName || data.package_name || data.item_name || data.product_name || data.name || 'Gift In-Game',
        items: Array.isArray(data.items) && data.items.length > 0 ? data.items : (Array.isArray(data.order_items) ? data.order_items : (Array.isArray(data.orderItems) ? data.orderItems : [])),
        price: Number(data.price || data.total_price || data.totalPrice) || 0,
        payment_method: data.payment_method || data.paymentMethod || 'QRIS',
        status: data.status || 'Booking',
        notes: data.note || data.notes || '',
        created_by: data.created_by || 'admin_manual',
        created_at: data.created_at || data.createdAt || data.created || new Date().toISOString(),
        updated_at: data.updated_at || data.updatedAt || data.updated || new Date().toISOString(),
        service_type: data.service_type || data.category || 'gift',
        category: data.category || data.game_name || 'gift'
      }));

      setOrders(normalizedList);
      setIsLoading(false);
    }, (err) => {
      console.error("Sync Gift Orders Error:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Ambil Data Katalog
  useEffect(() => {
    const q = query(collection(db, 'catalogs'), limit(60));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameCatalog));
      setCatalogs(fetched);
    });
    return () => unsubscribe();
  }, []);

  // 2. FILTER TAB ORDERAN & COUNTER (CASE-INSENSITIVE) MENGGUNAKAN DATA GIFT MURNI
  const countStatus = (statusName: string) => {
    if (statusName === 'Semua') return orders.length;
    const targetTab = statusName.toLowerCase();
    return orders.filter(o => {
      const st = (o.status || '').toLowerCase();
      if (targetTab === 'diorder') {
        return st === 'diorder' || st === 'proses';
      }
      return st === targetTab;
    }).length;
  };

  // Filtered orders based on status, date filter & search query
  const filteredOrders = useMemo(() => {
    const todayStr = getLocalDateStr(new Date());

    return orders.filter(ord => {
      // 1. Status Tab
      if (activeTab !== 'Semua') {
        const st = (ord.status || '').toLowerCase();
        const tab = activeTab.toLowerCase();
        if (tab === 'diorder') {
          if (st !== 'diorder' && st !== 'proses') return false;
        } else {
          if (st !== tab) return false;
        }
      }

      // 2. Date Filter
      if (dateFilterMode !== 'ALL') {
        const d = parseSafeDate(ord.created_at || (ord as any).createdAt || (ord as any).created);
        if (!d) return false;
        const ordDateStr = getLocalDateStr(d);

        if (dateFilterMode === 'TODAY') {
          if (ordDateStr !== todayStr) return false;
        } else if (dateFilterMode === 'CUSTOM' && customDate) {
          if (ordDateStr !== customDate) return false;
        }
      }

      // 3. Search Query (Multi-Key Search Support)
      if (searchQuery.trim()) {
        const isMatched = matchOrderSearchAndCategory(ord, searchQuery, "GIFT");
        if (!isMatched) return false;
      }
      return true;
    });
  }, [orders, activeTab, dateFilterMode, customDate, searchQuery]);

  // 3. FUNGSI SIMPAN ORDER MANUAL KE FIRESTORE (Koleksi orders)
  const handleSaveGiftOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Mencegah klik ganda

    if (!formData.customer_phone.trim() || !formData.game_user_id.trim() || !formData.item_name.trim() || !formData.price) {
      alert('Harap isi semua kolom yang wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
      const newId = `GIFT-${Date.now()}`;
      const payload = {
        id: newId,
        order_id: newId,
        customer_id: 'manual-admin',
        customer_name: formData.game_user_id.trim(), // Menggunakan username Roblox sbg nama customer
        customer_phone: formData.customer_phone.trim(),
        game_username: formData.game_user_id.trim(),
        game_name: 'Gift / Gamepass In-Game', 
        service_type: 'gift', // Filter utama service_type == 'gift'
        category: 'gift', // Penanda orderan gift
        package_name: formData.item_name.trim(),
        price: Number(formData.price) || 0,
        totalPrice: Number(formData.price) || 0,
        payment_method: formData.payment_method || 'QRIS',
        status: formData.status || 'Booking',
        note: formData.notes.trim() || '',
        created_by: 'admin_manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      await setDoc(doc(db, 'orders', newId), payload);
      setShowModal(false);
      setFormData({
        customer_phone: '',
        game_user_id: '',
        item_name: '',
        price: '',
        payment_method: 'QRIS',
        status: 'Booking',
        notes: ''
      });
      alert('Orderan Gift In-Game berhasil ditambahkan!');
    } catch (error: any) {
      console.error("Gagal menambah order gift:", error);
      alert(`Gagal menyimpan order: ${error?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Update with Auto-Refund on Cancel
  const handleUpdateStatus = async (order: any, newStatus: string) => {
    try {
      const nowIso = new Date().toISOString();
      const price = Number(order.price || order.totalPrice || order.total_price || 0);
      const isCancel = newStatus.toLowerCase() === 'cancel' || newStatus.toLowerCase() === 'batal';
      const isHangus = newStatus.toLowerCase() === 'hangus' || newStatus.toLowerCase() === 'expired';

      if (isHangus) {
        const orderDisplayId = order.order_id || order.id_order || order.id;
        const confirmMsg = `Yakin ingin mengubah status pesanan #${orderDisplayId} menjadi HANGUS?\n\n⚠️ PENTING: Pesanan akan ditutup permanen TANPA REFUND (Zero Refund) saldo TongCoins sesuai kebijakan toko.`;
        if (!window.confirm(confirmMsg)) {
          return;
        }

        const docId = order.firestore_id || order.id;
        await updateOrderStatusGlobal(docId, 'Hangus', order.customer_phone || order.whatsapp || '', order.userId || order.userUid || '');
        alert(`Status pesanan #${orderDisplayId} berhasil diubah menjadi HANGUS (Tanpa Refund).`);
        return;
      }

      if (isCancel) {
        const confirmMsg = `Batalkan pesanan #${order.order_id || order.id_order || order.id} dan kembalikan dana sebesar Rp ${price.toLocaleString('id-ID')} ke saldo TongCoins customer?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }

        const res = await executeCancelOrderWithAutoRefund(order);
        alert(res.message);
        return;
      }

      const docId = order.firestore_id || order.id;
      const orderRef = doc(db, 'orders', docId);

      
      await updateOrderStatusGlobal(docId, newStatus, order.customer_phone || order.whatsapp || '', order.userId || order.userUid || '');

    } catch (err: any) {
      console.warn("Direct update error, mencoba query fallback...", err);
      try {
        const targetId = order.id_order || order.order_id || order.id;
        const q = query(collection(db, 'orders'), where('id_order', '==', targetId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await setDoc(doc(db, 'orders', snap.docs[0].id), {
            status: newStatus,
            orderStatus: newStatus,
            updated_at: new Date().toISOString(),
            updated: new Date().toISOString()
          }, { merge: true });
        } else {
          const q2 = query(collection(db, 'orders'), where('order_id', '==', targetId));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            await setDoc(doc(db, 'orders', snap2.docs[0].id), {
              status: newStatus,
              orderStatus: newStatus,
              updated_at: new Date().toISOString(),
              updated: new Date().toISOString()
            }, { merge: true });
          } else {
            throw new Error("Dokumen order tidak ditemukan");
          }
        }
      } catch (fallbackErr: any) {
        console.error("Gagal total update status:", fallbackErr);
        alert("Gagal update status: " + fallbackErr.message);
      }
    }
  };

  // Delete Order
  const handleDeleteOrder = async (order: any) => {
    const displayId = order.id_order || order.order_id || order.id;
    if (!window.confirm(`Yakin ingin menghapus orderan ${displayId}?`)) return;
    try {
      const docId = order.firestore_id || order.id;
      await deleteDoc(doc(db, 'orders', docId));
      console.log("Orderan berhasil dihapus");
    } catch (err: any) {
      console.error("Gagal hapus orderan:", err);
      try {
        const targetId = order.id_order || order.order_id || order.id;
        const q = query(collection(db, 'orders'), where('id_order', '==', targetId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, 'orders', snap.docs[0].id));
          console.log("Orderan berhasil dihapus via fallback");
          return;
        } else {
          const q2 = query(collection(db, 'orders'), where('order_id', '==', targetId));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            await deleteDoc(doc(db, 'orders', snap2.docs[0].id));
            return;
          }
        }
      } catch (fallbackErr: any) {}
      alert("Gagal menghapus: " + err.message);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'booking') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (s === 'diorder') return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (s === 'selesai' || s === 'completed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (s === 'cancel' || s === 'cancelled' || s === 'batal' || s === 'batal_tolak') return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // Filter agar dropdown HANYA memuat item dengan tipe/kategori "gift" atau "gamepass"
  const giftItems = useMemo(() => {
    const items: { name: string; price: number; id: string; category: string }[] = [];
    catalogs.forEach(cat => {
      const catCategory = (cat.category || '').toLowerCase();
      const catTitle = (cat.title || '').toLowerCase();
      const isGiftOrGamepass = catCategory === 'gift' || catCategory === 'gamepass' || catCategory.includes('gift') || catCategory.includes('gamepass') || catTitle.includes('gift') || catTitle.includes('gamepass');

      if (isGiftOrGamepass) {
        cat.pricelists?.forEach(p => {
          items.push({
            name: p.name,
            price: p.price,
            id: p.id,
            category: cat.title
          });
        });
      }
    });
    return items;
  }, [catalogs]);

  return (
    <div className="flex-1 p-3 md:p-6 overflow-y-auto space-y-4 bg-[#0b141a] text-slate-100 font-sans">
      
      {/* Header Banner & Live Operational Indicator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/90 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00E676]/10 text-[#00E676] flex items-center justify-center border border-[#00E676]/30 shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-black tracking-wide text-slate-100">Orderan Gift In-Game (Entong Store)</h2>
              {(() => {
                const { isLiveOpen, liveTimeStr } = getLiveGiftStatus();
                return isLiveOpen ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Jam Kirim Aktif ({liveTimeStr} • 13.00-20.45 WIB)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>Di Luar Jam Operasional ({liveTimeStr} • Proses Mulai 13.00 WIB)</span>
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Kelola pesanan gift item, gamepass, skin, atau diamond in-game dengan aman & terorganisir.</p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-extrabold rounded-xl text-xs shadow-lg shadow-[#00E676]/25 flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Tambah Order Gift Manual</span>
        </button>
      </div>

      {/* Filter Tabs, Date Filter & Search Bar */}
      <div className="flex flex-col gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 shadow-md">
        
        {/* Status Filter Tabs (5 Buttons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {['Semua', 'Booking', 'Diorder', 'Selesai', 'Cancel'].map((tab) => {
            const count = countStatus(tab);
            const isActive = activeTab.toLowerCase() === tab.toLowerCase();
            const isCancelTab = tab === 'Cancel';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? isCancelTab
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'bg-[#00E676] text-[#111b21] shadow-md shadow-[#00E676]/20'
                    : isCancelTab
                    ? 'bg-rose-950/30 text-rose-300 hover:bg-rose-950/50 border border-rose-500/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <span>{tab}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isActive
                    ? isCancelTab
                      ? 'bg-white text-rose-600'
                      : 'bg-[#111b21] text-[#00E676]'
                    : isCancelTab
                    ? 'bg-rose-900/60 text-rose-300'
                    : 'bg-slate-700 text-slate-200'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Filter & Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          
          {/* Quick Date Filters */}
          <div className="flex items-center gap-1.5 bg-[#111b21] p-1 rounded-xl border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('ALL');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dateFilterMode === 'ALL'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua Tanggal
            </button>

            <button
              type="button"
              onClick={() => {
                setDateFilterMode('TODAY');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                dateFilterMode === 'TODAY'
                  ? 'bg-[#00E676] text-[#111b21] shadow-sm'
                  : 'text-slate-400 hover:text-[#00E676]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Hari Ini</span>
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="relative flex items-center bg-[#111b21] border border-slate-700 rounded-xl px-2.5 py-1 text-xs shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 pointer-events-none" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                if (e.target.value) {
                  setDateFilterMode('CUSTOM');
                } else {
                  setDateFilterMode('ALL');
                }
              }}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              title="Pilih tanggal spesifik"
            />
            {customDate && (
              <button
                type="button"
                onClick={() => {
                  setCustomDate('');
                  setDateFilterMode('ALL');
                }}
                className="ml-1 text-slate-400 hover:text-white p-0.5"
                title="Hapus filter tanggal"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari ID Order, No WhatsApp, Username Roblox, atau Item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111b21] border border-slate-700 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00E676] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Orders List Table / Cards */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#00E676]" />
            <span>Memuat data orderan gift...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Gift className="w-8 h-8 text-slate-600 mb-1" />
            <span className="font-semibold text-slate-300">Belum ada orderan gift in-game</span>
            <span className="text-[11px] text-slate-500">Klik tombol "+ Tambah Order Gift Manual" di atas untuk membuat pesanan baru.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#111b21] text-slate-300 border-b border-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-3.5 font-bold">ID Order</th>
                  <th className="py-3 px-3 font-bold">WhatsApp & Customer</th>
                  <th className="py-3 px-3 font-bold">Username Roblox</th>
                  <th className="py-3 px-3 font-bold">Item Gift</th>
                  <th className="py-3 px-3 font-bold">Harga & Pembayaran</th>
                  <th className="py-3 px-3 font-bold">Status</th>
                  <th className="py-3 px-3.5 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((ord, idx) => {
                  const formattedDate = formatOrderDate(ord.created_at || (ord as any).createdAt || (ord as any).created);
                  const opInfo = getGiftOperatingHoursInfo(ord.created_at || (ord as any).createdAt || (ord as any).created);
                  const uniqueRowKey = ord.id ? `gift-row-${ord.id}-${idx}` : `gift-ord-${idx}`;

                  return (
                    <tr key={uniqueRowKey} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#00E676]">{ord.order_id}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(ord.order_id);
                              setCopiedId(ord.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="text-slate-400 hover:text-[#00E676] transition-colors p-0.5 cursor-pointer"
                            title="Salin ID Order"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{formattedDate}</span>
                        {/* Tag Jam Operasional Pemesanan */}
                        <div className="mt-1">
                          {opInfo.isWithinHours ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>{opInfo.timeStr} (Jam Kirim)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              <span>{opInfo.timeStr} (Di Luar Jam)</span>
                            </span>
                          )}
                        </div>
                        {copiedId === ord.id && <span className="text-[9px] text-[#00E676] font-bold block mt-0.5">Tersalin!</span>}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{ord.customer_phone || '-'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          {(() => {
                            let dName = ord.customer_name || 'Customer';
                            if (dName === 'Customer') {
                              const validId = (ord as any).userId || (ord as any).userUid || (ord as any).customerUid || (ord as any).customerId;
                              let found = null;
                              if (validId) found = customerList.find(c => c.id === validId || c.uid === validId);
                              if (!found) {
                                const cPhone = normalizePhoneForCheck((ord as any).whatsapp || (ord as any).phone || ord.customer_phone || (ord as any).customerPhone || '');
                                if (cPhone) {
                                  found = customerList.find(c => {
                                    const cp = normalizePhoneForCheck(c.whatsapp || c.phone || c.customer_phone || '');
                                    return cp === cPhone;
                                  });
                                }
                              }
                              if (found && found.name && found.name !== 'Customer') {
                                dName = found.name;
                              } else if (ord.game_user_id && ord.game_user_id !== '-') {
                                dName = ord.game_user_id;
                              }
                            }
                            return <span>{dName}</span>;
                          })()}
                        </div>
                        {/* Status Registrasi Web Customer */}
                        {(() => {
                          const isRegistered = checkIsRegisteredCustomer(ord);
                          if (!isRegistered) {
                            return (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/70 text-amber-400 border border-amber-500/40 whitespace-nowrap">
                                  <span>⚠️</span> Belum Register Web
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      <td className="py-3 px-3">
                        <div className="bg-[#111b21] border border-slate-700/80 px-2.5 py-1.5 rounded-xl font-mono text-xs text-amber-300 font-bold inline-flex items-center gap-1.5 max-w-[200px]" title={ord.game_user_id}>
                          <Gamepad2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{ord.game_user_id || '-'}</span>
                          {ord.game_user_id && ord.game_user_id !== '-' && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(ord.game_user_id);
                                setCopiedId(`${ord.id}-user`);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="text-slate-400 hover:text-amber-300 p-0.5 cursor-pointer ml-auto"
                              title="Salin Username Roblox"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1.5 py-1 min-w-[200px] max-w-[280px]">
                          {Array.isArray(ord.items) && ord.items.length > 0 ? (
                            ord.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-xs">
                                <span className="shrink-0 text-emerald-400 text-sm">🎁</span>
                                <div className="flex flex-wrap items-center gap-1 leading-tight">
                                  <span className="font-semibold text-white">
                                    {item.gameName ? `${item.gameName} - ` : ''}{item.packageName || item.name || item.title || 'Item Gift'}
                                  </span>
                                  {(item.quantity || item.qty) && Number(item.quantity || item.qty) > 1 && (
                                    <span className="text-amber-400 font-bold">
                                      (x{item.quantity || item.qty})
                                    </span>
                                  )}
                                  <span className="text-slate-400 text-[11px]">
                                    (Rp {Number(item.price || item.totalPrice || 0).toLocaleString('id-ID')})
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            /* Fallback jika order legacy tanpa array items */
                            <div className="flex items-center gap-1.5 text-xs text-white">
                              <span className="text-emerald-400 text-sm">🎁</span>
                              <span className="font-semibold">
                                {ord.item_name || ord.itemGift || (ord as any).packageName || (ord as any).serviceName || "Gift In-Game"}
                              </span>
                              {ord.price && (
                                <span className="text-slate-400 text-[11px]">
                                  (Rp {Number(ord.price).toLocaleString('id-ID')})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {ord.notes && (
                          <div className="text-[10px] text-slate-400 italic truncate max-w-[280px] mt-0.5" title={ord.notes}>
                            Catatan: {ord.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-black text-emerald-400 text-xs font-mono">
                          Rp {(ord.price || 0).toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5 flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-slate-500" />
                          <span>{ord.payment_method || 'QRIS'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        
                        <div className="relative">
                          {(() => {
                            const { label, colorClass } = normalizeOrderStatus(ord.status);
                            return (
                              <select
                                value={
                                  ord.status === 'HANGUS' || ord.status === 'Hangus' || ord.status === 'EXPIRED' ? 'Hangus' :
                                  ord.status === 'SELESAI' || ord.status === 'Selesai' ? 'Selesai' :
                                  ord.status === 'CANCEL' || ord.status === 'Cancel' || ord.status === 'DIBATALKAN' ? 'Cancel' :
                                  ord.status === 'READY' || ord.status === 'Ready' ? 'Ready' :
                                  ord.status === 'LOGUL' || ord.status === 'Logul' ? 'Logul' :
                                  ord.status === 'PROSES_WORKER' || ord.status === 'Proses' || ord.status === 'PROSES' || ord.status === 'Diorder' ? 'Diorder' : 
                                  'Booking'
                                }
                                onChange={(e) => handleUpdateStatus(ord, e.target.value)}
                                className={`appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition shadow-sm ${colorClass}`}
                              >
                                <option value="Booking">⏳ Booking</option>
                                <option value="Diorder">⚡ Diorder</option>
                                <option value="Ready">✨ Ready</option>
                                <option value="Selesai">✅ Selesai</option>
                                <option value="Cancel">❌ Cancel (Refund TC)</option>
                                <option value="Hangus">⚠️ Hangus (Tanpa Refund)</option>
                              </select>
                            );
                          })()}
                          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        </div>

                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          {/* 1. Direct Web Chat - Tampil jika user terdaftar */}
                          {(() => {
                            const isRegistered = checkIsRegisteredCustomer(ord);
                            if (isRegistered) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDirectChat(ord)}
                                  title="Buka Chat Web Customer"
                                  className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-[#00E676] border border-[#00E676]/40 transition-all active:scale-95 cursor-pointer flex-shrink-0 flex items-center justify-center shadow-sm"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              );
                            }
                            return null;
                          })()}

                          {/* 2. Direct WhatsApp - Tampil jika belum register */}
                          {(() => {
                            const isRegistered = checkIsRegisteredCustomer(ord);
                            if (!isRegistered) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    let phone = (ord.customer_phone || (ord as any).customer_whatsapp || (ord as any).whatsapp || (ord as any).phone || '').replace(/[^0-9]/g, '');
                                    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                                    if (phone) {
                                      const customerName = ord.customer_name || ord.game_user_id || 'Customer';
                                      const itemsSummary = Array.isArray(ord.items) && ord.items.length > 0
                                        ? ord.items.map((i: any) => `${i.gameName ? `${i.gameName} - ` : ''}${i.packageName || i.name || 'Item'} (x${i.quantity || i.qty || 1})`).join(', ')
                                        : (ord.item_name || 'Gift');
                                      const orderId = ord.order_id || ord.id;
                                      const text = encodeURIComponent(`Halo kak ${customerName}, mimin Entong Store mau konfirmasi orderan Gift ${itemsSummary} (ID: ${orderId})`);
                                      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                                    } else {
                                      alert('Nomor WhatsApp customer tidak ditemukan pada order ini.');
                                    }
                                  }}
                                  title="Hubungi via WhatsApp"
                                  className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 transition-all active:scale-95 cursor-pointer flex-shrink-0"
                                >
                                  <Phone className="w-4 h-4" />
                                </button>
                              );
                            }
                            return null;
                          })()}

                          {/* Tombol Hapus */}
                          <button
                            onClick={() => handleDeleteOrder(ord)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 transition-all active:scale-95 shadow-sm inline-flex items-center justify-center cursor-pointer flex-shrink-0"
                            title="Hapus Permanent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Order Gift Manual */}
      <AddGiftOrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSaveGiftOrder}
        customersList={customerList}
        formData={formData}
        setFormData={setFormData}
        giftItems={giftItems}
        isSubmitting={isSubmitting}
      />

    </div>
  );
};

interface AddGiftOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  customersList: any[];
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  giftItems: any[];
  isSubmitting: boolean;
}

const AddGiftOrderModal: React.FC<AddGiftOrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  customersList = [],
  formData,
  setFormData,
  giftItems = [],
  isSubmitting
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCustomers = customersList.filter((c: any) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (c.name || '').toLowerCase();
    const roblox = (c.roblox || '').toLowerCase();
    const whatsapp = (c.whatsapp || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    return name.includes(q) || roblox.includes(q) || whatsapp.includes(q) || email.includes(q);
  });

  const handleSelectCustomer = (c: any) => {
    const labelKontak = c.whatsapp ? c.whatsapp : (c.email || '');
    setSearchQuery(`${c.name} ${c.roblox ? `(@${c.roblox})` : ''} - ${labelKontak}`);
    setFormData((prev: any) => ({
      ...prev,
      game_user_id: c.roblox || '',
      customer_phone: c.whatsapp || c.email || ''
    }));
    setIsDropdownOpen(false);
  };

  const handleClearCustomer = () => {
    setSearchQuery('');
    setFormData((prev: any) => ({
      ...prev,
      game_user_id: '',
      customer_phone: ''
    }));
    setIsDropdownOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-[#111b21]">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#00E676]" />
            <h3 className="text-sm font-black text-slate-100">Tambah Order Gift In-Game Manual</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={onSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          
          <div className="space-y-1.5 mb-2 relative">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Pilih Pelanggan / Akun Google (Searchable)</span>
              <span className="text-[10px] text-emerald-400 font-semibold">✨ Autofill Otomatis</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Ketik Nama, @Roblox, No WA, atau Email Google..."
                className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3.5 py-3 pr-9 text-xs text-slate-100 focus:border-[#00E676] focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition cursor-pointer"
                  title="Hapus pilihan"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Popover */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-800">
                {filteredCustomers.length === 0 ? (
                  <div className="p-3.5 text-center text-xs text-slate-400">
                    Customer tidak ditemukan
                  </div>
                ) : (
                  filteredCustomers.map((c: any) => {
                    const labelKontak = c.whatsapp ? c.whatsapp : (c.email ? `[Google] ${c.email}` : 'Tanpa Kontak');
                    const labelRoblox = c.roblox ? `(@${c.roblox})` : '';
                    return (
                      <div
                        key={c.id || c.email || c.whatsapp}
                        onClick={() => handleSelectCustomer(c)}
                        className="p-3 hover:bg-slate-800 cursor-pointer text-xs flex flex-col transition"
                      >
                        <div className="font-bold text-slate-200 flex items-center justify-between">
                          <span>{c.name} {labelRoblox}</span>
                          <span className="text-[10px] text-emerald-400 font-mono font-semibold">{labelKontak}</span>
                        </div>
                        {c.email && c.whatsapp && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Email: {c.email}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Username Roblox *</label>
              <input
                type="text"
                required
                value={formData.game_user_id}
                onChange={(e) => setFormData({ ...formData, game_user_id: e.target.value })}
                placeholder="Contoh: GamerSejati123"
                className="w-full px-3.5 py-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">No. WhatsApp / Email *</label>
              <input
                type="text"
                required
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="08xxxxxxxxxx atau email@google.com"
                className="w-full px-3.5 py-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Pilih Item dari Katalog *</label>
            <select
              required
              value={formData.item_name}
              onChange={(e) => {
                const selectedName = e.target.value;
                const found = giftItems.find(item => item.name === selectedName);
                setFormData((prev: any) => ({
                  ...prev,
                  item_name: selectedName,
                  price: found ? found.price.toString() : prev.price
                }));
              }}
              className="w-full px-3.5 py-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676] cursor-pointer"
            >
              <option value="" disabled>-- Pilih Item Gift --</option>
              {giftItems.map((item, idx) => (
                <option key={`${item.id}-${idx}`} value={item.name}>
                  [{item.category}] {item.name}
                </option>
              ))}
              <option value="Item Custom / Manual">Lainnya (Input Manual)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nominal / Harga (Rp) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="50000"
                className="w-full px-3.5 py-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Metode Pembayaran</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676] font-bold cursor-pointer"
              >
                <option value="QRIS">QRIS All Payment</option>
                <option value="Transfer Bank">Transfer Bank (BCA/BRI/BNI)</option>
                <option value="Saldo Toko">Saldo Toko Entong</option>
                <option value="E-Wallet">E-Wallet (GoPay/DANA/OVO)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Status Pesanan</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3.5 py-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676] font-bold cursor-pointer"
            >
              <option value="Booking">Booking (Menunggu Diproses)</option>
              <option value="Diorder">Diorder (Sedang Dibeli Admin)</option>
              <option value="Proses">Proses (Dalam Pengiriman Gift)</option>
              <option value="Selesai">Selesai (Gift Berhasil Diterima)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Tulis instruksi khusus atau catatan gift..."
              className="w-full px-3.5 py-2.5 bg-[#111b21] border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676] resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl text-xs shadow-lg shadow-[#00E676]/20 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Order Gift</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default GiftOrdersPanel;
