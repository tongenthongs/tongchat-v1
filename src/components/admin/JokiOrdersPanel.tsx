import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gamepad2, 
  Search, 
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
  DollarSign,
  CreditCard,
  FileText,
  Calendar,
  Eye,
  EyeOff,
  Download,
  MessageSquare,
  ShieldCheck,
  Check,
  Zap,
  KeyRound
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { updateOrderStatusGlobal } from '../../utils/orderUtils';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { GameOrder, OrderStatus } from '../../types';
import { SafeImage } from '../common/SafeImage';
import { executeCancelOrderWithAutoRefund, isJunkBotOrder, purgeAllBotAndDummyOrders } from '../../lib/orderRefund';
import { matchOrderSearchAndCategory } from '../../utils/orderSearchHelper';

interface JokiOrdersPanelProps {
  onOpenChatWithOrder?: (orderId: string, customerName?: string, customerPhone?: string) => void;
}

const formatOrderDate = (timestamp: any) => {
  if (!timestamp) return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) {
      return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + 
           date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
};

export const JokiOrdersPanel: React.FC<JokiOrdersPanelProps> = ({ onOpenChatWithOrder }) => {
  const [orders, setOrders] = useState<GameOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'Semua' | 'Booking' | 'Proses' | 'Ready' | 'Logul' | 'Selesai' | 'Cancel'>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Visible passwords map
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Proof modal
  const [viewingProof, setViewingProof] = useState<{ isOpen: boolean; url: string; order?: GameOrder } | null>(null);

  // Registered customers map
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

        const result = Array.from(map.values());
        setCustomerList(result);
      } catch (err) {
        console.error("Gagal load all accounts:", err);
      }
    };
    loadAllUsersAndGoogleAccounts();
  }, []);



  // Realtime listener for orders filtered strictly for Joki / Leveling / Push Rank with limit
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders: GameOrder[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;

        // Skip bot / dummy / zero orders
        if (isJunkBotOrder({ ...d, id, docUniqueId: id })) {
          return;
        }
        
        const rawPkgName = (d.packageName || d.package_name || d.item_name || d.product_name || d.name || '').toString().toLowerCase();
        const rawCat = (d.category || d.service_type || '').toString().toLowerCase();
        const rawType = (d.type || d.orderType || '').toString().toLowerCase();
        const rawGame = (d.gameName || d.game_name || '').toString().toLowerCase();

        // 1. TOLAK MUTLAK PESANAN GIFT (TIDAK BOLEH MUNCUL DI PANEL JOKI)
        const isMarkedGift = d.isGift === true || rawCat === 'gift' || rawType === 'gift' || Boolean(d.itemGift) || Boolean(d.giftItemName);
        const hasExplicitJokiTag = d.isJoko === true || rawCat === 'joko' || rawCat === 'joki' || rawType === 'joko' || rawType === 'joki' || rawPkgName.includes('joko') || rawPkgName.includes('joki') || rawGame.includes('joko') || rawGame.includes('joki');

        if (isMarkedGift && !hasExplicitJokiTag) {
          return; // Tolak pesanan Gift dari Panel Joki
        }

        // 2. TERIMA HANYA PESANAN JOKI / JOKO
        const isJoko = hasExplicitJokiTag || 
                       rawPkgName.includes('leveling') ||
                       rawPkgName.includes('push rank') ||
                       rawPkgName.includes('joki rank') ||
                       rawPkgName.includes('joko cash');

        const isNotDeleted = d.isDeleted !== true && d.deleted !== true;
        
        if (!isJoko || !isNotDeleted) {
          return;
        }

        // Pemetaan lengkap Akun Target Roblox & Uang Awal (dengan pengecekan bersarang/nested object)
        const resolvedRobloxUser = (
          d.robloxUsername || 
          d.username || 
          d.formData?.username || 
          d.formData?.robloxUsername || 
          d.details?.robloxUsername || 
          d.accountData?.robloxUsername || 
          d.account?.username || 
          d.accountUser || 
          d.targetUser || 
          d.roblox_username || 
          d.roblox_user ||
          d.game_username || 
          d.game_user_id || 
          d.targetUsername || 
          d.gameUsername || 
          d.username_roblox || 
          '-'
        ).toString().trim();

        const resolvedRobloxPass = (
          d.robloxPassword || 
          d.password || 
          d.formData?.password || 
          d.formData?.robloxPassword || 
          d.details?.robloxPassword || 
          d.accountData?.robloxPassword || 
          d.account?.password || 
          d.accountPass || 
          d.roblox_password || 
          d.game_password || 
          d.gamePassword || 
          d.jokoPassword ||
          d.game_pass || 
          d.roblox_pass || 
          '-'
        ).toString().trim();

        const resolvedInitialMoney = (
          d.uangAwal || 
          d.initialCash || 
          d.formData?.uangAwal || 
          d.formData?.initialCash || 
          d.details?.uangAwal || 
          d.accountData?.uangAwal || 
          d.startMoney || 
          d.uang_awal || 
          d.initialMoney || 
          d.initial_money || 
          d.initialGameMoney || 
          d.uangSebelumJoko || 
          '-'
        ).toString().trim();

        allOrders.push({
          id: id,
          orderId: d.orderId || id,
          customer_id: d.customer_id || d.userId || d.uid || '',
          customer_name: d.customer_name || d.customerName || d.name || 'Customer',
          customer_phone: d.customer_phone || d.customerPhone || d.whatsapp || d.phone || '-',
          customer_email: d.customer_email || d.customerEmail || d.email || '',
          game_name: d.game_name || d.gameName || d.game || 'Roblox',
          package_name: d.package_name || d.packageName || d.item_name || d.title || 'Paket Joki',
          price: Number(d.price || d.totalPrice || d.total_price || d.totalAmount || d.amount || 0),
          status: d.status || d.orderStatus || 'BOOKING',
          orderStatus: d.orderStatus || d.status || 'BOOKING',
          game_username: resolvedRobloxUser,
          robloxUsername: resolvedRobloxUser,
          game_user_id: resolvedRobloxUser,
          game_password: resolvedRobloxPass,
          robloxPassword: resolvedRobloxPass,
          initial_money: resolvedInitialMoney,
          uangAwal: resolvedInitialMoney,
          notes: d.notes || d.orderNote || d.workerNotes || '',
          payment_method: d.payment_method || d.paymentMethod || 'QRIS',
          payment_proof: d.payment_proof || d.paymentProof || d.proofUrl || d.proof_url || '',
          created: d.created || d.created_at || d.createdAt || new Date().toISOString(),
          created_at: d.created_at || d.created || d.createdAt || new Date().toISOString(),
          updated: d.updated || d.updatedAt || new Date().toISOString()
        } as GameOrder);
      });

      // Sort descending by creation date
      allOrders.sort((a, b) => {
        const timeA = new Date(a.created || a.created_at || 0).getTime() || 0;
        const timeB = new Date(b.created || b.created_at || 0).getTime() || 0;
        return timeB - timeA;
      });

      setOrders(allOrders);
      setIsLoading(false);
    }, (err) => {
      console.warn("Joki orders listener warning:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Map status helper
  const normalizeStatus = (statusStr: string): 'Booking' | 'Proses' | 'Ready' | 'Logul' | 'Selesai' | 'Cancel' | 'Hangus' => {
    const s = (statusStr || '').toUpperCase();
    if (s === 'HANGUS' || s === 'EXPIRED' || s.includes('HANGUS')) return 'Hangus';
    if (s === 'SELESAI' || s === 'COMPLETED') return 'Selesai';
    if (s === 'BATAL' || s === 'CANCEL' || s === 'BATAL_TOLAK' || s === 'REJECTED') return 'Cancel';
    if (s === 'READY') return 'Ready';
    if (s === 'LOGUL' || s === 'BUTUH_LOGIN_ULANG') return 'Logul';
    if (s === 'PROSES' || s === 'PROSES_WORKER' || s === 'ANTRIAN_LOGIN' || s === 'DIORDER') return 'Proses';
    return 'Booking';
  };

  // Status Tab Counts
  const tabCounts = useMemo(() => {
    const counts = { Semua: orders.length, Booking: 0, Proses: 0, Ready: 0, Logul: 0, Selesai: 0, Cancel: 0, Hangus: 0 };
    orders.forEach(o => {
      const st = normalizeStatus(o.status);
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    });
    return counts;
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const st = normalizeStatus(o.status);
      if (activeTab !== 'Semua' && st !== activeTab) {
        return false;
      }

      if (dateFilter) {
        const oDate = new Date(o.created || o.created_at || '').toISOString().split('T')[0];
        if (oDate !== dateFilter) return false;
      }

      if (searchQuery.trim()) {
        const isMatched = matchOrderSearchAndCategory(o, searchQuery, "JOKI");
        if (!isMatched) return false;
      }

      return true;
    });
  }, [orders, activeTab, dateFilter, searchQuery]);

  // Update Status in Firestore with Auto-Refund on Cancel
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const nowIso = new Date().toISOString();
      const ordSnap = await getDoc(doc(db, 'orders', orderId));
      const ordData = ordSnap.exists() ? ordSnap.data() : {};
      const price = Number(ordData.price || ordData.totalPrice || 0);

      if (newStatus === 'Hangus') {
        const orderDisplayId = ordData.orderId || orderId;
        const confirmMsg = `Yakin ingin mengubah status pesanan #${orderDisplayId} menjadi HANGUS?\n\n⚠️ PENTING: Pesanan akan ditutup permanen TANPA REFUND (Zero Refund) saldo TongCoins sesuai kebijakan toko.`;
        if (!window.confirm(confirmMsg)) {
          return;
        }

        await updateOrderStatusGlobal(orderId, 'Hangus', ordData.customer_phone || ordData.whatsapp || '', ordData.userId || ordData.userUid || '');
        alert(`Status pesanan #${orderDisplayId} berhasil diubah menjadi HANGUS (Tanpa Refund).`);
        return;
      }

      if (newStatus === 'Cancel') {
        const confirmMsg = `Batalkan pesanan #${ordData.orderId || orderId} dan kembalikan dana sebesar Rp ${price.toLocaleString('id-ID')} ke saldo TongCoins customer?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }

        const res = await executeCancelOrderWithAutoRefund({
          ...ordData,
          id: orderId,
          docUniqueId: orderId,
          orderId: ordData.orderId || orderId,
          price
        });
        alert(res.message);
        return;
      }

      let firestoreStatus: OrderStatus = 'BOOKING';
      if (newStatus === 'Selesai') firestoreStatus = 'SELESAI';
      else if (newStatus === 'Proses') firestoreStatus = 'PROSES_WORKER';
      else if (newStatus === 'Ready') firestoreStatus = 'READY';
      else if (newStatus === 'Logul') firestoreStatus = 'LOGUL';
      else if (newStatus === 'Butuh Verifikasi' || newStatus === 'BUTUH_VERIFIKASI') firestoreStatus = 'BUTUH_VERIFIKASI' as any;
      else if (newStatus === 'Siap Login!' || newStatus === 'SIAP_LOGIN') firestoreStatus = 'SIAP_LOGIN' as any;
      else firestoreStatus = 'BOOKING';

      // Update doc
      const updatePayload: any = {
        status: firestoreStatus,
        orderStatus: firestoreStatus,
        updated: nowIso
      };

      await updateOrderStatusGlobal(orderId, firestoreStatus, ordData.customer_phone || ordData.whatsapp || '', ordData.userId || ordData.userUid || '');

    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert("Gagal memperbarui status order: " + (err?.message || 'Terjadi kesalahan'));
    }
  };

  const handleRequest2FA = async (ord: GameOrder) => {
    try {
      const orderId = ord.id;
      const targetChatId = (ord as any).chatId || ord.id;

      // 1. Update status order menjadi Butuh Verifikasi
      await updateDoc(doc(db, "orders", orderId), {
        status: "Butuh Verifikasi",
        statusCode: "BUTUH_VERIFIKASI",
        orderStatus: "BUTUH_VERIFIKASI",
        updatedAt: serverTimestamp()
      });

      // 2. Kirim pesan prompt ke room chat
      await addDoc(collection(db, "chats", targetChatId, "messages"), {
        text: "⚠️ [SISTEM] Akun membutuhkan kode verifikasi 2-Step. Silakan periksa instruksi di bawah ini.",
        sender: "admin",
        senderRole: "RESMI",
        is2FAPrompt: true,
        orderId: orderId,
        createdAt: serverTimestamp()
      });

      // 3. Update room chat badge
      await updateDoc(doc(db, "chats", targetChatId), {
        orderBadge: "BUTUH_VERIFIKASI",
        orderStatus: "BUTUH_VERIFIKASI",
        lastMessage: "⚠️ Admin meminta verifikasi 2-Step Akun Roblox",
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert("Permintaan verifikasi 2FA berhasil dikirim ke chat customer!");
    } catch (err: any) {
      console.error("Gagal request 2FA:", err);
      alert("Gagal mengirim permintaan verifikasi 2FA: " + (err?.message || ''));
    }
  };

  const handleCleanupBotData = async () => {
    if (!window.confirm("Bersihkan seluruh orderan bot sampah (Rp 0 / dummy) dari database?")) return;
    try {
      const { deletedCount } = await purgeAllBotAndDummyOrders();
      if (deletedCount > 0) {
        alert(`Berhasil menghapus ${deletedCount} orderan bot / dummy dari database!`);
      } else {
        alert("Database sudah bersih dari orderan bot!");
      }
    } catch (e: any) {
      alert("Gagal membersihkan data bot: " + (e?.message || ''));
    }
  };

  // Toggle Password Visibility
  const togglePassword = (orderId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add-on handler to append custom package name and price to an existing order
  const handleAddon = async (orderId: string, currentPackage: string, currentPrice: number) => {
    const addonName = window.prompt("Nama Tambahan (Contoh: +100JT):");
    if (!addonName || !addonName.trim()) return;

    const addonPriceInput = window.prompt("Harga Tambahan (Rp):", "0");
    if (addonPriceInput === null) return;
    const addonPrice = Number(addonPriceInput.replace(/[^0-9]/g, '')) || 0;

    const updatedPackage = `${currentPackage || 'Paket Joki'} | ${addonName.trim()}`;
    const updatedPrice = (Number(currentPrice) || 0) + addonPrice;

    try {
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

      // Perbarui state lokal
      setOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        package_name: updatedPackage,
        packageName: updatedPackage,
        price: updatedPrice
      } : o));

      alert(`Berhasil menambahkan add-on "${addonName.trim()}" (Rp ${addonPrice.toLocaleString('id-ID')}) ke pesanan #${orderId.slice(-6)}`);
    } catch (err: any) {
      console.error("Gagal update add-on order:", err);
      alert("Gagal menambahkan add-on: " + (err?.message || 'Error'));
    }
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const headers = ["ID Order", "Waktu", "Customer", "No WA", "Roblox Username", "Game & Paket", "Harga", "Metode Bayar", "Status"];
    const rows = filteredOrders.map(o => [
      `"${o.id}"`,
      `"${new Date(o.created || o.created_at || '').toLocaleString('id-ID')}"`,
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      `"${o.customer_phone || '-'}"`,
      `"${(o.game_user_id || '').replace(/"/g, '""')}"`,
      `"${(o.game_name + ' - ' + o.package_name).replace(/"/g, '""')}"`,
      `"${o.price}"`,
      `"${o.payment_method || 'QRIS'}"`,
      `"${normalizeStatus(o.status)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pesanan_joki_${activeTab.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* 🧭 HEADER & STATUS TABS */}
      <div className="bg-[#121927] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2.5">
              <Gamepad2 className="w-5 h-5 text-emerald-400" />
              <span>Panel Khusus Orderan Joki & Leveling</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola seluruh pesanan push rank, leveling, dan quest game Roblox secara terpisah dan realtime.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCleanupBotData}
              title="Hapus orderan bot / dummy / Rp 0 dari database"
              className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Bersihkan Bot / Rp 0</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-[#182234] hover:bg-[#223048] border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: 'Semua', count: tabCounts.Semua, color: 'text-slate-200' },
            { key: 'Booking', count: tabCounts.Booking, color: 'text-amber-400' },
            { key: 'Proses', count: tabCounts.Proses, color: 'text-blue-400' },
            { key: 'Ready', count: tabCounts.Ready, color: 'text-orange-400' },
            { key: 'Logul', count: tabCounts.Logul, color: 'text-purple-300' },
            { key: 'Selesai', count: tabCounts.Selesai, color: 'text-emerald-400' },
            { key: 'Cancel', count: tabCounts.Cancel, color: 'text-rose-400' }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-[#182234] text-slate-400 border border-slate-700/80 hover:text-slate-200'
              }`}
            >
              <span>{tab.key}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Date Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID Order, Nama Customer, WA, Akun Roblox, atau Paket Joki..."
              className="w-full pl-9 pr-4 py-2 bg-[#182234] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-[#182234] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-xs text-rose-400 hover:underline font-bold px-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 📋 TABLE JOKI ORDERS */}
      <div className="bg-[#121927] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0e1522] text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 min-w-[130px]">ID & Waktu</th>
                <th className="py-3 px-4 min-w-[150px]">Customer & WA</th>
                <th className="py-3 px-4 min-w-[180px]">Akun Target (Roblox)</th>
                <th className="py-3 px-4 min-w-[140px]">Layanan & Paket</th>
                <th className="py-3 px-4 min-w-[110px]">Harga & Bayar</th>
                <th className="py-3 px-4 min-w-[160px]">Status Pengerjaan</th>
                <th className="py-3 px-4 min-w-[100px] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    <span>Memuat pesanan joki...</span>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <span className="font-bold text-slate-400">Tidak Ada Orderan Joki Ditemukan</span>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const currentSt = normalizeStatus(ord.status);
                  const isPassVisible = !!visiblePasswords[ord.id];

                  return (
                    <tr key={ord.id} className="hover:bg-[#182234]/60 transition-colors">
                      {/* ID & Waktu */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-white">#{ord.id.slice(-6)}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(ord.id, ord.id)}
                            className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                            title="Salin ID Order"
                          >
                            {copiedId === ord.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatOrderDate(ord.created || ord.created_at || (ord as any).createdAt || (ord as any).orderDate)}
                        </div>
                      </td>

                      {/* Customer & WA */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100">
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
                            return dName;
                          })()}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{ord.customer_phone || '-'}</span>
                          {ord.customer_phone && ord.customer_phone !== '-' && (
                            <a
                              href={`https://wa.me/${ord.customer_phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline font-bold ml-1"
                            >
                              WA ↗
                            </a>
                          )}
                        </div>
                        {!checkIsRegisteredCustomer(ord) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/70 text-amber-400 border border-amber-500/40 whitespace-nowrap">
                              <span>⚠️</span> Belum Register Web
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Akun Target (Roblox) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-medium">User:</span>
                            <span className="font-mono font-bold text-emerald-300">{ord.game_user_id || '-'}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(ord.game_user_id || '-', `${ord.id}-user`)}
                              className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                              title="Salin Username"
                            >
                              {copiedId === `${ord.id}-user` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-medium">Pass:</span>
                            <span className="font-mono text-slate-200 text-xs">
                              {isPassVisible ? (ord.game_password || '-') : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePassword(ord.id)}
                              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                              title={isPassVisible ? "Sembunyikan" : "Lihat Password"}
                            >
                              {isPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-emerald-400" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(ord.game_password || '-', `${ord.id}-pass`)}
                              className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                              title="Salin Password"
                            >
                              {copiedId === `${ord.id}-pass` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                          </div>

                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span>Uang Awal:</span>
                            <span className="text-slate-300 font-mono">{ord.initial_money || '-'}</span>
                          </div>

                          {ord.notes && (
                            <div className="text-[10px] text-amber-300/90 italic bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-500/20 max-w-xs mt-1">
                              Note: {ord.notes}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Layanan & Paket */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#00E676]">{ord.game_name}</div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-slate-200 text-xs font-semibold">{ord.package_name}</span>
                          <button
                            type="button"
                            onClick={() => handleAddon(ord.id, ord.package_name || 'Paket Joki', ord.price || 0)}
                            className="px-1.5 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm active:scale-95"
                            title="Tambah Add-on ke Paket Joki"
                          >
                            <span>➕ Add-on</span>
                          </button>
                        </div>
                      </td>

                      {/* Harga & Bayar */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-white text-xs">
                          Rp {(ord.price || 0).toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[9px]">
                            {ord.payment_method || 'QRIS'}
                          </span>
                          {ord.payment_proof && (
                            <button
                              type="button"
                              onClick={() => setViewingProof({ isOpen: true, url: ord.payment_proof || '', order: ord })}
                              className="text-emerald-400 hover:underline text-[9px] font-bold cursor-pointer"
                            >
                              [Bukti]
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status Dropdown */}
                      <td className="py-3.5 px-4 whitespace-nowrap align-middle overflow-visible">
                        <select
                          value={currentSt}
                          onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer transition-all min-w-[130px] ${
                            currentSt === 'Selesai'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : currentSt === 'Proses'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : currentSt === 'Ready'
                              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              : currentSt === 'Logul'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : currentSt === 'Cancel'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : currentSt === 'Hangus'
                              ? 'bg-zinc-800 text-rose-400 border-rose-900/60'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          <option value="Booking" className="bg-[#121927] text-amber-300">Booking</option>
                          <option value="Proses" className="bg-[#121927] text-blue-300">Proses</option>
                          <option value="Ready" className="bg-[#121927] text-orange-400">Ready</option>
                          <option value="Logul" className="bg-[#121927] text-purple-300">Logul</option>
                          <option value="Butuh Verifikasi" className="bg-[#121927] text-amber-400">⏳ Butuh Verifikasi 2FA</option>
                          <option value="Siap Login!" className="bg-[#121927] text-emerald-400">⚡ Siap Login!</option>
                          <option value="Selesai" className="bg-[#121927] text-emerald-300">Selesai</option>
                          <option value="Cancel" className="bg-[#121927] text-rose-300">Cancel (Refund TC)</option>
                          <option value="Hangus" className="bg-[#121927] text-rose-400">🔥 Hangus (Tanpa Refund)</option>
                        </select>
                      </td>

                      {/* Aksi Chat, 2FA & Bukti */}
                      <td className="py-3.5 px-4 whitespace-nowrap align-middle text-right min-w-[140px]">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleRequest2FA(ord)}
                              title="Kirim permintaan verifikasi 2FA ke customer via chat"
                              className="px-2 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all flex items-center gap-1 font-bold text-[11px] cursor-pointer shadow"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              <span>Minta 2FA</span>
                            </button>
                            {checkIsRegisteredCustomer(ord) ? (
                              onOpenChatWithOrder && (
                                <button
                                  type="button"
                                  onClick={() => onOpenChatWithOrder(ord.id, ord.customer_name, ord.customer_phone)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#182234] hover:bg-emerald-500 hover:text-[#0a101b] text-emerald-400 border border-slate-700 transition-all flex items-center gap-1 font-bold text-xs cursor-pointer shadow"
                                  title="Buka Chat dengan Customer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Chat</span>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  let phone = (ord.customer_phone || (ord as any).whatsapp || (ord as any).phone || '').replace(/[^0-9]/g, '');
                                  if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                                  if (phone) {
                                    const customerName = ord.customer_name || ord.game_user_id || 'Customer';
                                    const itemName = ord.package_name || 'Joki';
                                    const orderId = (ord as any).order_id || ord.id;
                                    const text = encodeURIComponent(`Halo kak ${customerName}, mimin Entong Store mau konfirmasi orderan ${itemName} (ID: ${orderId})`);
                                    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                                  } else {
                                    alert('Nomor WhatsApp customer tidak ditemukan pada order ini.');
                                  }
                                }}
                                title="Hubungi via WhatsApp"
                                className="px-2.5 py-1.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 transition-all flex items-center gap-1 font-bold text-xs cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>WA</span>
                              </button>
                            )}
                          </div>
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

      {/* 🖼️ MODAL PROOF PREVIEW */}
      {viewingProof?.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121927] border border-slate-700 p-5 rounded-2xl max-w-md w-full shadow-2xl space-y-3 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-left">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Bukti Transfer #{viewingProof.order?.id?.slice(-6)}
              </span>
              <button
                onClick={() => setViewingProof(null)}
                className="text-slate-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <SafeImage
              src={viewingProof.url}
              alt="Bukti Transfer"
              className="max-h-96 w-full object-contain rounded-xl bg-black/50 border border-slate-800 mx-auto"
            />

            <button
              type="button"
              onClick={() => setViewingProof(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JokiOrdersPanel;
