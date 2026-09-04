import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, onSnapshot, orderBy, where, Timestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  User, TrendingUp, DollarSign, LogIn, Calendar,
  RefreshCw, ChevronDown, ChevronUp, Search
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

type DateFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

export const AdminLoginPanel: React.FC = () => {
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);

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

    // Date filter
    const now = new Date();
    if (dateFilter === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      base = base.filter(r => r.timestamp >= start);
    } else if (dateFilter === 'THIS_WEEK') {
      const day = now.getDay();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
      base = base.filter(r => r.timestamp >= start);
    } else if (dateFilter === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      base = base.filter(r => r.timestamp >= start);
    } else if (dateFilter === 'CUSTOM' && customStart) {
      const start = new Date(customStart).getTime();
      const end = customEnd ? new Date(customEnd).getTime() + 86400000 : Infinity;
      base = base.filter(r => r.timestamp >= start && r.timestamp <= end);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(r =>
        r.adminName.toLowerCase().includes(q) ||
        r.adminEmail.toLowerCase().includes(q) ||
        r.robloxUsername.toLowerCase().includes(q) ||
        r.orderId.toLowerCase().includes(q) ||
        r.cloudName.toLowerCase().includes(q)
      );
    }
    return base;
  }, [records, dateFilter, customStart, customEnd, search]);

  // Aggregate per staff
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
      s.totalLogin++;
      s.totalUpah += r.upah || UPAH_PER_LOGIN;
      s.records.push(r);
      if (r.timestamp > new Date(s.lastLogin).getTime()) s.lastLogin = r.loginAt;
    });
    return Array.from(map.values()).sort((a, b) => b.totalLogin - a.totalLogin);
  }, [filteredRecords]);

  const totalLogin = filteredRecords.length;
  const totalUpah = filteredRecords.reduce((s, r) => s + (r.upah || UPAH_PER_LOGIN), 0);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-slate-100 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-[#00E676]" />
            Admin Login
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Upah login joki: {formatRp(UPAH_PER_LOGIN)} / login</p>
        </div>
        {loading && <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-[#161b22] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Total Login</div>
          <div className="text-2xl font-black text-[#00E676]">{totalLogin}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">Semua staff</div>
        </div>
        <div className="bg-[#161b22] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Total Upah</div>
          <div className="text-2xl font-black text-emerald-400">{formatRp(totalUpah)}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">@{formatRp(UPAH_PER_LOGIN)} / login</div>
        </div>
        <div className="bg-[#161b22] border border-slate-800 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Total Staff</div>
          <div className="text-2xl font-black text-blue-400">{staffSummaries.length}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">Staff aktif</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Date filter buttons */}
        {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as DateFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              dateFilter === f
                ? 'bg-[#00E676] text-[#111b21]'
                : 'bg-[#161b22] text-slate-400 border border-slate-700 hover:bg-slate-800'
            }`}
          >
            {f === 'ALL' ? 'Semua' : f === 'TODAY' ? 'Hari Ini' : f === 'THIS_WEEK' ? 'Minggu Ini' : f === 'THIS_MONTH' ? 'Bulan Ini' : 'Custom'}
          </button>
        ))}
        {dateFilter === 'CUSTOM' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="bg-[#161b22] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#00E676]/50" />
            <span className="text-slate-500 text-xs">s/d</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="bg-[#161b22] border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#00E676]/50" />
          </div>
        )}
        {/* Search */}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari admin / order..."
            className="pl-8 pr-3 py-1.5 bg-[#161b22] border border-slate-700 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]/50 w-48"
          />
        </div>
      </div>

      {/* Staff Summary Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-slate-600 animate-spin" />
          <span className="ml-2 text-slate-500 text-sm">Memuat data...</span>
        </div>
      ) : staffSummaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <LogIn className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Belum ada data login</p>
          <p className="text-xs mt-1">Data akan muncul saat admin memasukkan orderan ke cloud</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffSummaries.map(staff => (
            <div key={staff.adminId} className="bg-[#161b22] border border-slate-800 rounded-xl overflow-hidden">
              {/* Staff header row */}
              <button
                onClick={() => setExpandedAdmin(expandedAdmin === staff.adminId ? null : staff.adminId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-[#00E676]/15 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[#00E676]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-100 truncate">{staff.adminName}</p>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                      {staff.adminRole}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{staff.adminEmail}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-black text-[#00E676]">{staff.totalLogin}x login</p>
                    <p className="text-[11px] text-emerald-400 font-semibold">{formatRp(staff.totalUpah)}</p>
                  </div>
                  {expandedAdmin === staff.adminId
                    ? <ChevronUp className="w-4 h-4 text-slate-500" />
                    : <ChevronDown className="w-4 h-4 text-slate-500" />
                  }
                </div>
              </button>

              {/* Expanded records */}
              {expandedAdmin === staff.adminId && (
                <div className="border-t border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-900/60 text-slate-500 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                          <th className="py-2 px-3 text-left">Waktu Login</th>
                          <th className="py-2 px-3 text-left">Order ID</th>
                          <th className="py-2 px-3 text-left">Username Roblox</th>
                          <th className="py-2 px-3 text-left">Cloud</th>
                          <th className="py-2 px-3 text-right">Upah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.records.map(r => (
                          <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{r.loginAtFormatted || formatDate(r.loginAt)}</td>
                            <td className="py-2 px-3 text-blue-400 font-mono">{r.orderId}</td>
                            <td className="py-2 px-3 text-slate-300">{r.robloxUsername || '-'}</td>
                            <td className="py-2 px-3 text-slate-400">{r.cloudName || '-'}</td>
                            <td className="py-2 px-3 text-emerald-400 font-bold text-right">{formatRp(r.upah || UPAH_PER_LOGIN)}</td>
                          </tr>
                        ))}
                        <tr className="bg-[#00E676]/5 font-bold">
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
