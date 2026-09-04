import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, getDocs, where
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import {
  User, TrendingUp, DollarSign, LogIn, Calendar,
  RefreshCw, ChevronDown, ChevronUp, Search, Plus, X,
  CheckCircle2, AlertCircle, Gamepad2, Clock
} from 'lucide-react';

const UPAH_PER_LOGIN = 2500;

interface LoginRecord {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  orderId: string;
  cloudId: string;
  cloudName: string;
  robloxUsername: string;
  customerName: string;
  packageName: string;
  loginAtFormatted: string;
  loginAt: string;
  upah: number;
  createdAt: any;
  timestamp: number;
}

interface StaffSummary {
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  totalLogin: number;
  totalUpah: number;
  lastLogin: string;
  records: LoginRecord[];
}

interface JokiOrder {
  id: string;
  firestoreId: string;
  robloxUsername: string;
  customerName: string;
  packageName: string;
  status: string;
  createdAt: any;
}

type DateFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

// ─── Modal Input Login Sendiri ────────────────────────────────────────────────
const AddLoginModal: React.FC<{
  onClose: () => void;
  currentUser: any;
  existingRecords: LoginRecord[];
}> = ({ onClose, currentUser, existingRecords }) => {
  const [jokiOrders, setJokiOrders] = useState<JokiOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [searchOrder, setSearchOrder] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);

  // Ambil order joki yang aktif
  useEffect(() => {
    setLoadingOrders(true);
    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const mapped: JokiOrder[] = [];
        snap.docs.forEach(d => {
          const x = d.data();
          const rawCat = (x.category || x.type || x.orderType || x.service_type || '').toLowerCase();
          const isJoki = rawCat === 'joko' || rawCat === 'joki' || rawCat.includes('joko') || x.isJoko === true || x.isJokiOrder === true;
          const status = (x.status || x.orderStatus || '').toUpperCase();
          if (!isJoki) return;
          if (['SELESAI', 'BATAL', 'CANCEL', 'HANGUS', 'EXPIRED', 'BATAL_TOLAK'].includes(status)) return;
          mapped.push({
            id: x.id || d.id,
            firestoreId: d.id,
            robloxUsername: x.robloxUsername || x.game_username || x.targetUsername || '-',
            customerName: x.customer_name || x.customerName || '-',
            packageName: x.packageName || x.package_name || x.gameName || '-',
            status,
            createdAt: x.createdAt || x.created_at || null,
          });
        });
        mapped.sort((a, b) => {
          const getMs = (ts: any) => {
            if (!ts) return 0;
            if (ts?.toDate) return ts.toDate().getTime();
            if (ts?.seconds) return ts.seconds * 1000;
            return new Date(ts).getTime() || 0;
          };
          return getMs(b.createdAt) - getMs(a.createdAt);
        });
        setJokiOrders(mapped);
        setLoadingOrders(false);
      },
      () => setLoadingOrders(false)
    );
    return () => unsub();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!searchOrder.trim()) return jokiOrders;
    const q = searchOrder.toLowerCase();
    return jokiOrders.filter(o =>
      o.robloxUsername.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.packageName.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  }, [jokiOrders, searchOrder]);

  const selectedOrder = useMemo(() =>
    jokiOrders.find(o => o.firestoreId === selectedOrderId || o.id === selectedOrderId),
    [jokiOrders, selectedOrderId]
  );

  const handleSubmit = async () => {
    if (!selectedOrderId || !selectedOrder) {
      setError('Pilih order joki terlebih dahulu.');
      return;
    }

    // Cek apakah order ini sudah pernah dihitung untuk admin ini
    const isDuplicate = existingRecords.some(r =>
      r.orderId === selectedOrderId &&
      r.adminId === (currentUser?.uid || currentUser?.id || currentUser?.email)
    );

    if (isDuplicate) {
      setShowDuplicateAlert(true);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const now = new Date();
      const adminId = currentUser?.uid || currentUser?.id || currentUser?.email || 'unknown';
      const adminName = currentUser?.name || currentUser?.displayName || currentUser?.username || 'Admin';
      const adminEmail = currentUser?.email || '';
      const adminRole = currentUser?.role || 'ADMIN';

      await addDoc(collection(db, 'admin_logins'), {
        adminId,
        adminName,
        adminEmail,
        adminRole,
        orderId: selectedOrderId,
        cloudId: '',
        cloudName: '',
        robloxUsername: selectedOrder.robloxUsername,
        customerName: selectedOrder.customerName,
        packageName: selectedOrder.packageName,
        loginAt: now.toISOString(),
        loginAtFormatted: now.toLocaleDateString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        upah: UPAH_PER_LOGIN,
        timestamp: now.getTime(),
        createdAt: serverTimestamp(),
        inputMethod: 'manual_self',
      });

      setSuccess(`Login untuk order ${selectedOrder.robloxUsername} berhasil dicatat! +${formatRp(UPAH_PER_LOGIN)}`);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan record login.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#1e2d3a] border border-[#00E676]/20 rounded-2xl shadow-[0_0_40px_rgba(0,230,118,0.1)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#00E676]/5 rounded-t-2xl">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <LogIn className="w-4 h-4 text-[#00E676]" />
              Catat Login Saya
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Pilih order joki yang kamu kerjakan untuk dicatat upahnya</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-400 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#1e2d3a] rounded-b-2xl">
          {/* Duplicate Alert */}
          {showDuplicateAlert && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-400">Sudah Dihitung!</p>
                <p className="text-xs text-amber-300/80 mt-0.5">Order ini sudah pernah kamu catat sebelumnya. Sistem menolak duplikasi.</p>
                <button
                  onClick={() => setShowDuplicateAlert(false)}
                  className="mt-2 text-xs text-amber-400 underline"
                >
                  Tutup peringatan
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-start gap-3 px-4 py-3 bg-[#00E676]/10 border border-[#00E676]/30 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-[#00E676] flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-[#00E676]">{success}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Admin info */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 rounded-xl border border-slate-700/30">
            <div className="w-9 h-9 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center text-[#00E676] font-black text-sm flex-shrink-0">
              {(currentUser?.name || currentUser?.username || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">{currentUser?.name || currentUser?.displayName || 'Admin'}</p>
              <p className="text-xs text-slate-500">{currentUser?.role || 'ADMIN'} · Upah: {formatRp(UPAH_PER_LOGIN)}/login</p>
            </div>
          </div>

          {/* Search order */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pilih Order Joki *</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                value={searchOrder}
                onChange={e => setSearchOrder(e.target.value)}
                placeholder="Cari username, nama customer, paket..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]/50 transition-all"
              />
            </div>

            {loadingOrders ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-600">
                {searchOrder ? 'Order tidak ditemukan' : 'Tidak ada order joki aktif saat ini'}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredOrders.map(order => {
                  const isSelected = selectedOrderId === order.firestoreId || selectedOrderId === order.id;
                  const alreadyCounted = existingRecords.some(r =>
                    r.orderId === (order.firestoreId || order.id) &&
                    r.adminId === (currentUser?.uid || currentUser?.id || currentUser?.email)
                  );
                  return (
                    <button
                      key={order.firestoreId}
                      type="button"
                      onClick={() => {
                        if (alreadyCounted) { setShowDuplicateAlert(true); return; }
                        setSelectedOrderId(order.firestoreId || order.id);
                        setShowDuplicateAlert(false);
                        setError('');
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]'
                          : alreadyCounted
                            ? 'bg-amber-500/5 border-amber-500/20 text-amber-400/60 cursor-not-allowed'
                            : 'bg-slate-900/50 border-slate-700/40 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-[#00E676]/20' : 'bg-blue-500/15'
                      }`}>
                        {alreadyCounted
                          ? <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          : <Gamepad2 className="w-4 h-4 text-blue-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{order.robloxUsername}</p>
                        <p className="text-xs opacity-60 truncate">{order.packageName} · {order.customerName}</p>
                      </div>
                      {alreadyCounted && (
                        <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                          Sudah dihitung
                        </span>
                      )}
                      {isSelected && !alreadyCounted && (
                        <CheckCircle2 className="w-4 h-4 text-[#00E676] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected order preview */}
          {selectedOrder && (
            <div className="px-4 py-3 bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl space-y-1.5">
              <p className="text-xs font-bold text-[#00E676] uppercase tracking-widest">Order Dipilih</p>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Username</span>
                <span className="text-slate-200 font-semibold">{selectedOrder.robloxUsername}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Paket</span>
                <span className="text-slate-200 font-semibold truncate ml-4 max-w-[180px]">{selectedOrder.packageName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Upah</span>
                <span className="text-emerald-400 font-black">{formatRp(UPAH_PER_LOGIN)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedOrderId || !!success}
            className="flex-1 py-2.5 bg-[#00E676] hover:bg-[#00c853] disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-[#111b21] text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" />Menyimpan...</> : <><LogIn className="w-4 h-4" />Catat Login</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────
export const AdminLoginPanel: React.FC<{ currentUser?: any }> = ({ currentUser: propCurrentUser }) => {
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Ambil currentUser dari Firebase Auth jika tidak disediakan via props
  const currentUser = propCurrentUser || (auth.currentUser ? {
    uid: auth.currentUser.uid,
    id: auth.currentUser.uid,
    name: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Admin',
    email: auth.currentUser.email || '',
    role: 'ADMIN',
  } : null);

  // Real-time listener ke admin_logins
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'admin_logins'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data: LoginRecord[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<LoginRecord, 'id'>),
      }));
      setRecords(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Filter by date
  const filteredRecords = useMemo(() => {
    let base = records;

    const now = new Date();
    if (dateFilter === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      base = base.filter(r => r.loginAt?.startsWith(todayStr));
    } else if (dateFilter === 'THIS_WEEK') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      base = base.filter(r => new Date(r.loginAt) >= weekAgo);
    } else if (dateFilter === 'THIS_MONTH') {
      const monthStr = now.toISOString().slice(0, 7);
      base = base.filter(r => r.loginAt?.startsWith(monthStr));
    } else if (dateFilter === 'CUSTOM' && customStart && customEnd) {
      base = base.filter(r => {
        const d = r.loginAt?.split('T')[0];
        return d >= customStart && d <= customEnd;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(r =>
        r.adminName?.toLowerCase().includes(q) ||
        r.robloxUsername?.toLowerCase().includes(q) ||
        r.orderId?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q)
      );
    }

    return base;
  }, [records, dateFilter, customStart, customEnd, search]);

  // Group by admin
  const staffSummaries = useMemo((): StaffSummary[] => {
    const map = new Map<string, StaffSummary>();
    filteredRecords.forEach(r => {
      const key = r.adminId || r.adminEmail;
      if (!map.has(key)) {
        map.set(key, {
          adminId: r.adminId,
          adminName: r.adminName,
          adminEmail: r.adminEmail,
          adminRole: r.adminRole,
          totalLogin: 0,
          totalUpah: 0,
          lastLogin: r.loginAt,
          records: [],
        });
      }
      const s = map.get(key)!;
      s.totalLogin += 1;
      s.totalUpah += r.upah || UPAH_PER_LOGIN;
      if (r.loginAt > s.lastLogin) s.lastLogin = r.loginAt;
      s.records.push(r);
    });
    return Array.from(map.values()).sort((a, b) => b.totalLogin - a.totalLogin);
  }, [filteredRecords]);

  const totalUpahAll = useMemo(() => staffSummaries.reduce((a, s) => a + s.totalUpah, 0), [staffSummaries]);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 max-w-5xl">
      {/* Add Login Modal */}
      {showAddModal && currentUser && (
        <AddLoginModal
          onClose={() => setShowAddModal(false)}
          currentUser={currentUser}
          existingRecords={records}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-[#00E676]" />
            Panel Admin Login
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Rekap login akun joki setiap staf dan upah yang didapat</p>
        </div>
        {currentUser && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] text-sm font-black rounded-xl transition-all shadow-lg shadow-[#00E676]/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Catat Login Saya
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">Total Login</p>
          <p className="text-2xl font-black text-slate-100 mt-1">{filteredRecords.length}</p>
        </div>
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest">Total Upah</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{formatRp(totalUpahAll)}</p>
        </div>
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest">Jumlah Staf</p>
          <p className="text-2xl font-black text-blue-300 mt-1">{staffSummaries.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama staf, username, order..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/40 border border-slate-700/40 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-800/40 p-1 rounded-xl border border-slate-700/30">
          {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as DateFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                dateFilter === f ? 'bg-[#00E676] text-[#111b21]' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f === 'ALL' ? 'Semua' : f === 'TODAY' ? 'Hari ini' : f === 'THIS_WEEK' ? 'Minggu ini' : f === 'THIS_MONTH' ? 'Bulan ini' : 'Custom'}
            </button>
          ))}
        </div>
        {dateFilter === 'CUSTOM' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none" />
            <span className="text-slate-600 text-xs">s/d</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none" />
          </div>
        )}
      </div>

      {/* List staf */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : staffSummaries.length === 0 ? (
        <div className="text-center py-16">
          <LogIn className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Belum ada data login</p>
          <p className="text-xs text-slate-600 mt-1">Tekan "Catat Login Saya" untuk mencatat login pertama</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffSummaries.map(staff => (
            <div key={staff.adminId} className="bg-[#111b21] border border-slate-800/60 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedAdmin(expandedAdmin === staff.adminId ? null : staff.adminId)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center font-black text-[#00E676] text-sm flex-shrink-0">
                    {(staff.adminName || 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-slate-100 truncate">{staff.adminName}</p>
                    <p className="text-xs text-slate-500 truncate">{staff.adminEmail} · {staff.adminRole}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Login</p>
                    <p className="text-sm font-black text-blue-300">{staff.totalLogin}×</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Upah</p>
                    <p className="text-sm font-black text-emerald-400">{formatRp(staff.totalUpah)}</p>
                  </div>
                  {expandedAdmin === staff.adminId
                    ? <ChevronUp className="w-4 h-4 text-slate-500" />
                    : <ChevronDown className="w-4 h-4 text-slate-500" />
                  }
                </div>
              </button>

              {expandedAdmin === staff.adminId && (
                <div className="border-t border-slate-800/60 px-5 pb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-3 mb-2">
                    Riwayat Login ({staff.records.length})
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-800/60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-800/60">
                          <th className="py-2 px-3 text-left text-slate-500 font-semibold">Waktu</th>
                          <th className="py-2 px-3 text-left text-slate-500 font-semibold">Order ID</th>
                          <th className="py-2 px-3 text-left text-slate-500 font-semibold">Username</th>
                          <th className="py-2 px-3 text-left text-slate-500 font-semibold">Cloud</th>
                          <th className="py-2 px-3 text-right text-slate-500 font-semibold">Upah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.records.map(r => (
                          <tr key={r.id} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                            <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{formatDate(r.loginAt)}</td>
                            <td className="py-2 px-3 text-blue-400 font-mono">{r.orderId}</td>
                            <td className="py-2 px-3 text-slate-300">{r.robloxUsername || '-'}</td>
                            <td className="py-2 px-3 text-slate-400">{r.cloudName || '-'}</td>
                            <td className="py-2 px-3 text-emerald-400 font-bold text-right">{formatRp(r.upah || UPAH_PER_LOGIN)}</td>
                          </tr>
                        ))}
                        <tr className="bg-[#00E676]/5 font-bold border-t border-slate-800/60">
                          <td colSpan={4} className="py-2 px-3 text-slate-400">Total</td>
                          <td className="py-2 px-3 text-emerald-400 text-right">{formatRp(staff.totalUpah)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLoginPanel;
