import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Download, Plus, Copy, Check, Gamepad2, 
  Clock, Zap, CheckCircle2, XCircle, ArrowRight, MessageSquare, 
  X, ChevronRight, ShoppingBag
} from 'lucide-react';
import { SafeImage } from '../common/SafeImage';

interface CustomerOrdersProps {
  orders: any[];
  onSelectOrder: (order: any) => void;
  onOpenChatWithConfirmation: (order: any) => void;
  onNavigateToCatalog: () => void;
  currentUser?: any;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  orders,
  onSelectOrder,
  onOpenChatWithConfirmation,
  onNavigateToCatalog,
  currentUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PROSES' | 'SELESAI' | 'BATAL'>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // State untuk Cek Pesanan Tamu / Guest Order Lookup
  const [lookupMode, setLookupMode] = useState<'INVOICE' | 'USER_DATA'>('INVOICE');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [userDataQuery, setUserDataQuery] = useState('');
  const [guestLookupResults, setGuestLookupResults] = useState<any[] | null>(null);
  const [isSearchingLookup, setIsSearchingLookup] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const handleGuestLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setGuestLookupResults(null);

    const qInvoice = invoiceQuery.trim();
    const qUser = userDataQuery.trim();

    if (lookupMode === 'INVOICE' && !qInvoice) {
      setLookupError('Silakan masukkan nomor invoice / ID pesanan.');
      return;
    }

    if (lookupMode === 'USER_DATA' && !qUser) {
      setLookupError('Silakan masukkan Username Roblox, Email, atau No. WhatsApp.');
      return;
    }

    setIsSearchingLookup(true);
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');

      // Ambil snapshot orders
      const ordersRef = collection(db, 'orders');
      const snap = await getDocs(ordersRef);

      const allOrders: any[] = snap.docs.map(d => {
        const data = d.data() || {};
        return {
          ...data,
          id: d.id,
          docUniqueId: d.id,
          firestoreId: d.id,
          orderId: (data as any).orderId || `#ORD-${d.id.slice(-6).toUpperCase()}`
        };
      });

      let results: any[] = [];

      if (lookupMode === 'INVOICE') {
        const cleanTarget = qInvoice.toLowerCase().replace(/^#/, '');
        results = allOrders.filter(ord => {
          const ordId = (ord.orderId || ord.id || '').toLowerCase().replace(/^#/, '');
          return ordId.includes(cleanTarget) || ord.id?.toLowerCase().includes(cleanTarget);
        });
      } else {
        const cleanUserTarget = qUser.toLowerCase();
        results = allOrders.filter(ord => {
          const rUser = (ord.robloxUsername || ord.roblox_username || ord.game_username || ord.targetUsername || '').toLowerCase();
          const email = (ord.email || ord.customerEmail || ord.customer_email || '').toLowerCase();
          const phone = (ord.whatsapp || ord.whatsappNumber || ord.customer_phone || ord.phone || '').toLowerCase();
          const name = (ord.customer_name || ord.customerName || ord.name || '').toLowerCase();

          return rUser.includes(cleanUserTarget) || email.includes(cleanUserTarget) || phone.includes(cleanUserTarget) || name.includes(cleanUserTarget);
        });
      }

      if (results.length === 0) {
        setLookupError('Pesanan tidak ditemukan. Pastikan data yang dimasukkan sudah benar.');
      } else {
        setGuestLookupResults(results);
      }
    } catch (err: any) {
      console.error("Gagal mencari pesanan:", err);
      setLookupError(err?.message || 'Gagal mencari pesanan. Silakan periksa koneksi internet Anda.');
    } finally {
      setIsSearchingLookup(false);
    }
  };

  const activeOrdersList = guestLookupResults !== null ? guestLookupResults : orders;

  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id);
      } else {
        const el = document.createElement('textarea');
        el.value = id;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  // Filtered orders computation
  const filteredOrders = useMemo(() => {
    return activeOrdersList.filter(order => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ordId = (order.orderId || order.id || order.docUniqueId || '').toLowerCase();
        const gName = (order.game_name || order.gameName || '').toLowerCase();
        const pName = (order.package_name || order.packageName || order.itemGift || '').toLowerCase();
        const rUser = (order.robloxUsername || order.roblox_username || order.game_username || order.targetUsername || order.formData?.username || '').toLowerCase();
        const phone = (order.customer_phone || order.whatsapp || order.phone || order.userPhone || '').toLowerCase();
        const custName = (order.customer_name || order.customerName || '').toLowerCase();

        if (
          !ordId.includes(q) &&
          !gName.includes(q) &&
          !pName.includes(q) &&
          !rUser.includes(q) &&
          !phone.includes(q) &&
          !custName.includes(q)
        ) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const st = (order.status || order.orderStatus || '').toUpperCase();
        if (statusFilter === 'PENDING') {
          if (!['PENDING', 'BOOKING', 'NEW', 'PENDING_VERIFICATION'].includes(st)) return false;
        } else if (statusFilter === 'PROSES') {
          if (!['DIORDER', 'PROSES', 'PROSES_WORKER', 'ANTRIAN_LOGIN', 'LOGUL', 'READY'].includes(st)) return false;
        } else if (statusFilter === 'SELESAI') {
          if (!['SELESAI', 'COMPLETED', 'SUCCESS'].includes(st)) return false;
        } else if (statusFilter === 'BATAL') {
          if (!['BATAL', 'BATAL_TOLAK', 'CANCEL', 'REJECTED'].includes(st)) return false;
        }
      }

      // 3. Date Filter
      if (dateFilter) {
        const rawTime = order.pureTime || order.createdAtMillis || (order.created ? new Date(order.created).getTime() : 0);
        if (rawTime > 0) {
          const d = new Date(rawTime);
          const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (isoDate !== dateFilter) return false;
        }
      }

      return true;
    });
  }, [activeOrdersList, searchQuery, statusFilter, dateFilter]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert("Tidak ada data pesanan untuk diekspor.");
      return;
    }

    const headers = ["Order ID", "Tanggal", "Game", "Paket Layanan", "Akun Target", "Total Harga (Rp)", "Metode Pembayaran", "Status Pesanan"];
    const rows = filteredOrders.map(o => {
      const rawId = o.orderId || o.id || '-';
      const cleanId = rawId.replace(/^#/, '');
      const rawTime = o.pureTime || o.createdAtMillis || (o.created ? new Date(o.created).getTime() : 0);
      const dateStr = rawTime > 0 ? new Date(rawTime).toLocaleDateString('id-ID') : '-';
      const game = (o.game_name || o.gameName || 'Roblox').replace(/"/g, '""');
      const pkg = (o.package_name || o.packageName || 'Layanan').replace(/"/g, '""');
      const target = (o.robloxUsername || o.roblox_username || o.game_username || '-').replace(/"/g, '""');
      const price = o.price || 0;
      const method = o.payment_method || o.paymentMethod || 'QRIS';
      const status = o.status || o.orderStatus || 'PENDING';

      return `"${cleanId}","${dateStr}","${game}","${pkg}","${target}",${price},"${method}","${status}"`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EntongStore_Pesanan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-fade-in px-4">
      {/* Cek Pesanan / Guest Order Lookup Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Search className="w-5 h-5 text-blue-400" />
              <span>Cek Status Pesanan</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Lacak progres pemrosesan pesanan Anda secara instan dan real-time
            </p>
          </div>

          {/* Two-Tab Switcher */}
          <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl self-start">
            <button
              type="button"
              onClick={() => {
                setLookupMode('INVOICE');
                setLookupError('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                lookupMode === 'INVOICE'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cari via Invoice ID
            </button>
            <button
              type="button"
              onClick={() => {
                setLookupMode('USER_DATA');
                setLookupError('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                lookupMode === 'USER_DATA'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cari via Username / WA
            </button>
          </div>
        </div>

        {/* ALERT KHUSUS ROBUX VIA LOGIN */}
        <div className="p-3.5 bg-blue-950/60 border border-blue-800/60 rounded-2xl flex items-start gap-3 text-blue-200 text-xs leading-relaxed shadow-sm">
          <span className="text-base shrink-0">💡</span>
          <div>
            <strong className="text-blue-300 font-bold block">Informasi Khusus:</strong>
            Kalau kamu beli <strong>Robux Via Login</strong>, pesanan hanya bisa dicari melalui <strong>Invoice ID</strong> demi keamanan data akun Anda.
          </div>
        </div>

        {/* Lookup Form */}
        <form onSubmit={handleGuestLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            {lookupMode === 'INVOICE' ? (
              <input
                type="text"
                placeholder="Masukkan No. Invoice (Contoh: ORD-123456 atau #ORD-123456)..."
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition"
              />
            ) : (
              <input
                type="text"
                placeholder="Masukkan Username Roblox, Email, atau No. WhatsApp Anda..."
                value={userDataQuery}
                onChange={(e) => setUserDataQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition"
              />
            )}
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="submit"
            disabled={isSearchingLookup}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-lg shadow-blue-600/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isSearchingLookup ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mencari...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Lacak Pesanan</span>
              </>
            )}
          </button>

          {guestLookupResults !== null && (
            <button
              type="button"
              onClick={() => {
                setGuestLookupResults(null);
                setInvoiceQuery('');
                setUserDataQuery('');
                setLookupError('');
              }}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </form>

        {lookupError && (
          <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-2xl text-rose-300 text-xs">
            {lookupError}
          </div>
        )}
      </div>

      {/* Header & Main Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white">Daftar Pesanan</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {guestLookupResults !== null
              ? `Hasil pencarian menemukan ${filteredOrders.length} pesanan`
              : `Kamu punya ${orders.length} pesanan di Entong Store`}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-800 transition shadow-sm cursor-pointer"
            title="Ekspor Pesanan ke CSV"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onNavigateToCatalog}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-red-600/25 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Order Baru</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Filter Tabs, Date */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Input (Span 7 on LG) */}
          <div className="lg:col-span-7 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari No. Invoice, Roblox username, atau No. WhatsApp..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown (Span 3 on LG) */}
          <div className="lg:col-span-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none transition font-medium cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">Menunggu Pembayaran</option>
              <option value="PROSES">Sedang Diproses</option>
              <option value="SELESAI">Selesai</option>
              <option value="BATAL">Dibatalkan</option>
            </select>
          </div>

          {/* Date Filter (Span 2 on LG) */}
          <div className="lg:col-span-2 flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none transition cursor-pointer [color-scheme:dark]"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                title="Hapus filter tanggal"
                className="p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
          <span>Menampilkan <strong>{filteredOrders.length}</strong> dari <strong>{orders.length}</strong> pesanan</span>
          {(searchQuery || statusFilter !== 'ALL' || dateFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setDateFilter('');
              }}
              className="text-red-400 hover:underline font-semibold cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Orders Grid (3 Columns on Desktop, 1 on Mobile) */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-xl">
          <Gamepad2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">Tidak Ada Pesanan Ditemukan</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {orders.length === 0 
              ? "Kamu belum memiliki riwayat pesanan. Buka katalog game dan mulai order sekarang!"
              : "Tidak ada pesanan yang sesuai dengan filter pencarian Anda."}
          </p>
          {orders.length === 0 ? (
            <button
              onClick={onNavigateToCatalog}
              className="mt-5 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs shadow-lg shadow-red-600/20 cursor-pointer"
            >
              Buka Katalog Game
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setDateFilter('');
              }}
              className="mt-4 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs border border-slate-800 cursor-pointer"
            >
              Hapus Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order, idx) => {
            const uniqueKey = order.docUniqueId || order.firestoreId || order.id || `ord-${idx}`;
            const rawId = order.orderId || (order.id?.startsWith('ORD-') ? order.id : `#${(order.id || 'ORD').substring(0, 10).toUpperCase()}`);
            const cleanId = rawId.replace(/^#/, '');
            
            const rawTime = order.pureTime || order.createdAtMillis || (order.created ? new Date(order.created).getTime() : 0);
            const dateStr = rawTime > 0 
              ? new Date(rawTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
              : (order.created ? new Date(order.created).toLocaleDateString('id-ID') : '-');

            const price = Number(order.price) || 0;
            const statusUpper = (order.status || order.orderStatus || 'PENDING').toUpperCase();
            const isCanceled = ['BATAL', 'BATAL_TOLAK', 'CANCEL', 'REJECTED'].includes(statusUpper);
            const isCompleted = ['SELESAI', 'COMPLETED', 'SUCCESS'].includes(statusUpper);
            const isPaid = order.payment_status === 'PAID' || order.paymentStatus === 'SUCCESS' || isCompleted || ['PROSES', 'PROSES_WORKER', 'READY', 'ANTRIAN_LOGIN'].includes(statusUpper) || Boolean(order.payment_proof);

            const robloxUser = order.robloxUsername || order.roblox_username || order.game_username || order.targetUsername || order.username || '';
            const robloxAvatar = robloxUser 
              ? `https://www.roblox.com/headshot-thumbnail/image?userName=${encodeURIComponent(robloxUser)}&width=150&height=150&format=png`
              : null;

            const productName = order.package_name || order.packageName || order.itemGift || 'Paket Layanan';
            const gameName = order.game_name || order.gameName || 'Game';

            let activeStep = 0;
            if (statusUpper === 'BOOKING' || statusUpper === 'PENDING_VERIFICATION' || statusUpper === 'NEW' || statusUpper === 'PENDING') activeStep = 0;
            else if (statusUpper === 'DIORDER' || statusUpper === 'PAID') activeStep = 1;
            else if (['READY', 'PROSES', 'PROSES_WORKER', 'ANTRIAN_LOGIN', 'LOGUL', 'BUTUH_LOGIN_ULANG'].includes(statusUpper)) activeStep = 2;
            else if (isCompleted) activeStep = 3;

            return (
              <div
                key={uniqueKey}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden transition-all group"
              >
                {/* Header Card: Order ID & Salin + Tanggal */}
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-mono font-black text-white truncate">
                        {rawId}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(cleanId, e)}
                        className="p-1 text-slate-500 hover:text-white rounded transition cursor-pointer"
                        title="Salin ID"
                      >
                        {copiedId === cleanId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {copiedId === cleanId && (
                        <span className="text-[10px] font-bold text-emerald-400">Disalin!</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium shrink-0">
                      {dateStr}
                    </span>
                  </div>

                  {/* Harga & Status Bayar */}
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Total Bayar
                      </span>
                      <span className="text-base font-black text-white">
                        Rp {price.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      {isPaid ? (
                        <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-extrabold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Udah Dibayar</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-[10px] font-extrabold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Belum Bayar</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Akun Target Roblox & Detail Item */}
                  <div className="my-3 p-3 bg-slate-950/70 border border-slate-800/60 rounded-2xl space-y-2.5">
                    {/* Item details */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-red-400 shrink-0 overflow-hidden">
                        {order.image || order.imageUrl ? (
                          <SafeImage 
                            src={order.image || order.imageUrl} 
                            alt={productName} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Gamepad2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase truncate block">
                          {gameName}
                        </span>
                        <h4 className="text-xs font-black text-white truncate">
                          {productName}
                        </h4>
                      </div>
                    </div>

                    {/* Target Roblox User */}
                    {robloxUser && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">Target Roblox:</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {robloxAvatar && (
                            <img 
                              src={robloxAvatar} 
                              alt={robloxUser} 
                              className="w-4 h-4 rounded-full object-cover shrink-0" 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20 text-[11px] truncate">
                            @{robloxUser}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Status Pengerjaan & Action Buttons */}
                <div className="space-y-3 pt-2">
                  {/* Status Indicator Bar */}
                  {isCanceled ? (
                    <div className="p-2 bg-red-950/40 border border-red-500/30 rounded-xl text-[11px] text-red-400 text-center font-bold">
                      ❌ Pesanan Dibatalkan
                    </div>
                  ) : (
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                        <span className="flex items-center gap-1">
                          {isCompleted ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Zap className="w-3 h-3 text-red-400" />}
                          <span>{isCompleted ? 'Selesai' : 'Pengerjaan'}</span>
                        </span>
                        <span className="text-red-400 font-black">
                          {isCompleted ? 'Selesai (4/4)' : activeStep === 2 ? 'Sedang Diproses (3/4)' : activeStep === 1 ? 'Diorder (2/4)' : 'Booking (1/4)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[0, 1, 2, 3].map(sIdx => (
                          <div 
                            key={sIdx}
                            className={`h-1.5 rounded-full transition-all ${
                              sIdx <= activeStep ? 'bg-red-500' : 'bg-slate-800'
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons: Chat Admin & Liat Detail */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenChatWithConfirmation(order)}
                      className="flex-1 py-2.5 px-3 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectOrder(order)}
                      className="flex-1 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer group/btn"
                    >
                      <span>Liat detail</span>
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
