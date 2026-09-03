import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ShoppingBag, Plus, X, Search, Trash2, CheckCircle2,
  RefreshCw, User, Phone, ChevronDown, ChevronUp, Gamepad2,
  Gift, AlertCircle, Check, Calendar, MessageSquare, Layers,
  Globe, Smartphone, Zap, Package
} from 'lucide-react';
import {
  collection, query, onSnapshot, limit, orderBy,
  serverTimestamp, getDocs, where, setDoc, doc, updateDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { fetchRobloxProfile, RobloxProfile } from '../../lib/roblox';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogOption {
  id: string;
  gameName: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string | null;
}

interface SelectedItem {
  id: string;
  option: CatalogOption;
  qty: number;
}

interface PanelOrder {
  id: string;
  firestoreId: string;
  robloxUsername: string;
  customerPhone: string;
  customerName: string;
  robloxAvatarUrl?: string | null;
  items: Array<{
    catalogId?: string;
    gameName?: string;
    name?: string;
    packageName?: string;
    category?: string;
    price?: number;
    qty?: number;
    quantity?: number;
    imageUrl?: string | null;
  }>;
  packageName: string;
  status: string;
  category: string;
  source: string;
  createdAt: any;
  totalPrice?: number;
  uangAwal?: string;
  jumlahTabrak?: number;
  tanggalLogin?: any;
  cloudNumber?: string;
}

interface OrderanPanelProps {
  onOpenChatWithOrder?: (orderId: string, custName?: string, custPhone?: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sanitizePayload = (obj: Record<string, any>) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));

const fmtDate = (ts: any): string => {
  if (!ts) return '-';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts?.seconds ? ts.seconds * 1000 : ts);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '-'; }
};

const fmtTime = (ts: any): string => {
  if (!ts) return '';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts?.seconds ? ts.seconds * 1000 : ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const JOKI_STATUSES = ['BOOKING', 'PROSES', 'READY', 'LOGUL', 'SELESAI', 'BATAL'];
const GP_STATUSES   = ['BOOKING', 'DIORDER', 'PROSES', 'SELESAI', 'BATAL'];

interface StatusConfig { label: string; dot: string; pill: string; glow: string; }
const STATUS_CFG: Record<string, StatusConfig> = {
  BOOKING:       { label: 'Booking',      dot: 'bg-blue-400',    pill: 'bg-blue-500/10 text-blue-300 border-blue-500/20',    glow: '' },
  PROSES:        { label: 'Proses',       dot: 'bg-violet-400',  pill: 'bg-violet-500/10 text-violet-300 border-violet-500/20', glow: '' },
  PROSES_WORKER: { label: 'Proses',       dot: 'bg-violet-400',  pill: 'bg-violet-500/10 text-violet-300 border-violet-500/20', glow: '' },
  READY:         { label: 'Ready',        dot: 'bg-cyan-400',    pill: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',    glow: 'shadow-cyan-500/20' },
  LOGUL:         { label: 'Login Ulang',  dot: 'bg-orange-400',  pill: 'bg-orange-500/10 text-orange-300 border-orange-500/20', glow: '' },
  SELESAI:       { label: 'Selesai',      dot: 'bg-emerald-400', pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', glow: 'shadow-emerald-500/20' },
  BATAL:         { label: 'Batal',        dot: 'bg-red-400',     pill: 'bg-red-500/10 text-red-300 border-red-500/20',       glow: '' },
  CANCEL:        { label: 'Batal',        dot: 'bg-red-400',     pill: 'bg-red-500/10 text-red-300 border-red-500/20',       glow: '' },
  DIORDER:       { label: 'Diorder',      dot: 'bg-teal-400',    pill: 'bg-teal-500/10 text-teal-300 border-teal-500/20',    glow: '' },
  PENDING_VERIFICATION: { label: 'Verifikasi', dot: 'bg-amber-400', pill: 'bg-amber-500/10 text-amber-300 border-amber-500/20', glow: '' },
};
const getCfg = (s: string): StatusConfig =>
  STATUS_CFG[(s || '').toUpperCase()] ?? { label: s || '-', dot: 'bg-slate-500', pill: 'bg-slate-700/40 text-slate-400 border-slate-600/30', glow: '' };

// ─── Roblox Avatar (staggered queue, in-memory cache) ────────────────────────
const avatarCache  = new Map<string, string>();
const avatarFailed = new Set<string>();
// Stagger queue: index increments per card render, spreads requests 300ms apart
let queueIndex = 0;

const fetchAvatarStaggered = (username: string, cb: (url: string | null) => void) => {
  const delay = (queueIndex++ % 20) * 300; // max 20 slots × 300ms = 6s spread
  setTimeout(async () => {
    try {
      // Primary: server proxy (Express serves both API and frontend on same port)
      const r = await fetch(`/api/roblox-checker?username=${encodeURIComponent(username)}`);
      const data = r.ok ? await r.json() : null;
      if (data?.success && data?.data?.avatarUrl) {
        cb(data.data.avatarUrl);
      } else if (data?.success && data?.data?.userId) {
        cb(`https://www.roblox.com/headshot-thumbnail/image?userId=${data.data.userId}&width=150&height=150&format=png`);
      } else {
        cb(null);
      }
    } catch {
      // Fallback: direct Roblox POST (works if not CORS-blocked)
      try {
        const r2 = await fetch('https://users.roblox.com/v1/usernames/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
        });
        const d2 = r2.ok ? await r2.json() : null;
        const u = d2?.data?.[0];
        cb(u?.id ? `https://www.roblox.com/headshot-thumbnail/image?userId=${u.id}&width=150&height=150&format=png` : null);
      } catch {
        cb(null);
      }
    }
  }, delay);
};

const RobloxAvatar: React.FC<{
  username: string;
  storedAvatarUrl?: string | null;
  size?: string;
  ringColor?: string;
  fallbackColors?: string;
}> = ({ username, storedAvatarUrl, size = 'w-11 h-11', ringColor = 'border-blue-500/25', fallbackColors = 'bg-blue-500/20 text-blue-300' }) => {
  const clean = (username || '').trim();
  const initials = clean.slice(0, 2).toUpperCase() || '??';

  const init = (): string | null => {
    if (storedAvatarUrl) { avatarCache.set(clean, storedAvatarUrl); return storedAvatarUrl; }
    return avatarCache.get(clean) ?? null;
  };

  const [avatarUrl, setAvatarUrl] = useState<string | null>(init);
  const [loading,   setLoading]   = useState(!init() && !avatarFailed.has(clean));
  const [imgErr,    setImgErr]    = useState(false);

  useEffect(() => {
    if (storedAvatarUrl) {
      avatarCache.set(clean, storedAvatarUrl);
      setAvatarUrl(storedAvatarUrl); setLoading(false); setImgErr(false); return;
    }
    if (!clean || clean === '-' || clean.length < 2) { setLoading(false); return; }
    if (avatarCache.has(clean)) { setAvatarUrl(avatarCache.get(clean)!); setLoading(false); return; }
    if (avatarFailed.has(clean)) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    fetchAvatarStaggered(clean, (url) => {
      if (cancelled) return;
      if (url) { avatarCache.set(clean, url); setAvatarUrl(url); }
      else avatarFailed.add(clean);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [clean, storedAvatarUrl]);

  if (avatarUrl && !imgErr) {
    return (
      <img src={avatarUrl} alt={clean}
        className={`${size} rounded-xl border-2 ${ringColor} object-cover flex-shrink-0`}
        onError={() => { avatarFailed.add(clean); setImgErr(true); }}
      />
    );
  }

  return (
    <div className={`${size} rounded-xl border flex items-center justify-center font-black text-sm flex-shrink-0 ${fallbackColors} ${loading ? 'animate-pulse opacity-50' : ''}`}>
      {loading ? '' : initials}
    </div>
  );
};

// ─── Status Dropdown ──────────────────────────────────────────────────────────
const StatusPill: React.FC<{
  orderId: string; status: string; category: string; onChanged: (ns: string) => void;
}> = ({ orderId, status, category, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = getCfg(status);
  const list = category === 'gift' ? GP_STATUSES : JOKI_STATUSES;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = async (s: string) => {
    if (s === (status || '').toUpperCase()) { setOpen(false); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: s, orderStatus: s,
        updatedAt: serverTimestamp(), updated_at: new Date().toISOString()
      });
      onChanged(s);
    } catch { /**/ } finally { setSaving(false); setOpen(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer hover:opacity-80 active:scale-95 transition-all select-none ${cfg.pill}`}
      >
        {saving
          ? <RefreshCw className="w-2.5 h-2.5 animate-spin" />
          : <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
        }
        {cfg.label}
        <ChevronDown className="w-2.5 h-2.5 opacity-40" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-[#182530] border border-slate-700/60 rounded-xl shadow-2xl shadow-black/40 overflow-hidden min-w-[150px] py-1">
          {list.map(s => {
            const sc = getCfg(s);
            const active = s === (status || '').toUpperCase();
            return (
              <button key={s} onClick={() => pick(s)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] hover:bg-slate-700/30 text-left transition-colors ${active ? 'bg-slate-700/20' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${sc.dot} flex-shrink-0`} />
                <span className={`flex-1 font-medium ${active ? 'text-slate-100' : 'text-slate-300'}`}>{sc.label}</span>
                {active && <Check className="w-3.5 h-3.5 text-[#00E676]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Roblox Checker ───────────────────────────────────────────────────────────
const RobloxChecker: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onProfile?: (profile: import('../../lib/roblox').RobloxProfile | null) => void;
}> = ({ value, onChange, onProfile }) => {
  const [profile, setProfile] = useState<import('../../lib/roblox').RobloxProfile | null>(null);
  const [st, setSt] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle');
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!value.trim() || value.trim().length < 3) {
      setProfile(null); setSt('idle');
      onProfile?.(null);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSt('loading');
      try {
        const result = await fetchRobloxProfile(value.trim());
        if (result) {
          setProfile(result);
          setSt('found');
          // Pre-cache avatar for immediate display
          if (result.avatarUrl) avatarCache.set(value.trim(), result.avatarUrl);
          onProfile?.(result);
        } else {
          setProfile(null);
          setSt('notfound');
          onProfile?.(null);
        }
      } catch {
        setProfile(null);
        setSt('notfound');
        onProfile?.(null);
      }
    }, 600);
    return () => clearTimeout(timer.current);
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="Username Roblox..."
          className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]/50 focus:ring-1 focus:ring-[#00E676]/10 transition-all" />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {st === 'loading'  && <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />}
          {st === 'found'    && <Check className="w-4 h-4 text-[#00E676]" />}
          {st === 'notfound' && <AlertCircle className="w-4 h-4 text-red-400" />}
        </div>
      </div>
      {st === 'found' && profile && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl">
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt="" className="w-9 h-9 rounded-full border-2 border-[#00E676]/30 object-cover flex-shrink-0" />
            : <div className="w-9 h-9 rounded-full bg-[#00E676]/15 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-[#00E676]" /></div>
          }
          <div>
            <p className="text-sm font-bold text-[#00E676]">{profile.displayName}</p>
            <p className="text-xs text-slate-500">@{profile.username} · ID {profile.userId}</p>
          </div>
        </div>
      )}
      {st === 'notfound' && value.trim().length >= 3 && (
        <p className="text-xs text-red-400 px-1">Username tidak ditemukan di Roblox</p>
      )}
    </div>
  );
};

// ─── Input Order Form ─────────────────────────────────────────────────────────
const InputOrderForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [roblox, setRoblox] = useState('');
  const [robloxProfile, setRobloxProfile] = useState<import('../../lib/roblox').RobloxProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [search, setSearch] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingCat(true);
    const parseOpts = (raw: any[]): CatalogOption[] => {
      const out: CatalogOption[] = [];
      raw.forEach(cat => {
        if (cat.pricelists && Array.isArray(cat.pricelists)) {
          cat.pricelists.forEach((pkg: any) => {
            if (pkg.is_closed) return;
            const gameName = cat.title || cat.game_name || cat.name || 'Roblox';
            const pkgName = pkg.name || pkg.package_name || 'Paket';
            const rawCat = (pkg.category || cat.category || cat.service_type || '').toLowerCase();
            const isGift = rawCat === 'gift' || rawCat === 'gamepass' || rawCat === 'item'
              || rawCat.includes('gift') || rawCat.includes('gamepass') || rawCat.includes('robux');
            out.push({
              id: pkg.id || `${cat.id}-${pkgName}`,
              gameName, name: pkgName,
              category: isGift ? 'gift' : 'joko',
              price: Number(pkg.price || 0),
              imageUrl: pkg.imageUrl || pkg.image || cat.imageUrl || cat.image || null
            });
          });
        } else if (cat.game_name || cat.package_name || cat.name || cat.title) {
          const gameName = cat.game_name || cat.gameName || cat.title || 'Roblox';
          const pkgName = cat.package_name || cat.packageName || cat.name || 'Paket';
          const rawCat = (cat.category || cat.service_type || cat.type || '').toLowerCase();
          const isGift = rawCat === 'gift' || rawCat === 'gamepass' || rawCat === 'item'
            || rawCat.includes('gift') || rawCat.includes('gamepass') || rawCat.includes('robux');
          out.push({
            id: cat.id || pkgName,
            gameName, name: pkgName,
            category: isGift ? 'gift' : 'joko',
            price: Number(cat.price || 0),
            imageUrl: cat.imageUrl || cat.image || cat.thumbnail || null
          });
        }
      });
      return out;
    };

    // Try 'catalogs' first, then 'items' as fallback — no orderBy to avoid index requirement
    const unsubCatalogs = onSnapshot(
      query(collection(db, 'catalogs'), limit(100)),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const parsed = parseOpts(list);
        setCatalog(parsed);
        setLoadingCat(false);
      },
      () => {
        // fallback to 'items' collection
        const unsubItems = onSnapshot(
          query(collection(db, 'items'), limit(100)),
          snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setCatalog(parseOpts(list));
            setLoadingCat(false);
          },
          () => setLoadingCat(false)
        );
        return () => unsubItems();
      }
    );
    return () => unsubCatalogs();
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const cleanPhone = useMemo(() => {
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    if (p.startsWith('8')) p = '62' + p;
    return p;
  }, [phone]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? catalog.filter(o => o.name.toLowerCase().includes(q) || o.gameName.toLowerCase().includes(q)).slice(0, 20) : catalog.slice(0, 25);
  }, [catalog, search]);

  const totalPrice = items.reduce((s, i) => s + i.option.price * i.qty, 0);
  const totalQty   = items.reduce((s, i) => s + i.qty, 0);
  const autoType   = items.every(i => i.option.category === 'gift') && items.length > 0 ? 'gift' : 'joko';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (submittingRef.current || submitting) return;
    if (!cleanPhone || cleanPhone.length < 8) { setErr('Nomor WA wajib diisi minimal 8 digit.'); return; }
    if (!roblox.trim()) { setErr('Username Roblox wajib diisi.'); return; }
    if (items.length === 0) { setErr('Pilih minimal 1 item dari katalog.'); return; }
    submittingRef.current = true; setSubmitting(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('phone', 'in', [cleanPhone, '0' + cleanPhone.slice(2)]))).catch(() => null);
      const eu = snap && !snap.empty ? { uid: snap.docs[0].id, ...snap.docs[0].data() } : null;
      const uid = Math.floor(100000 + Math.random() * 900000).toString();
      const oid = `ORD-${uid}`;
      const custName = (eu as any)?.name || `CUST-${cleanPhone.slice(-5)}`;
      const summary  = items.length === 1
        ? `${items[0].option.name} (x${items[0].qty})`
        : `${totalQty} item: ${items.map(i => `${i.option.name} x${i.qty}`).join(', ')}`;

      // Tulis semua field yang dibutuhkan customer portal untuk lookup & display
      await setDoc(doc(db, 'orders', oid), sanitizePayload({
        id: oid, orderId: oid, displayOrderId: `#${uid}`,
        whatsapp: cleanPhone, phone: cleanPhone, customer_phone: cleanPhone, customerPhone: cleanPhone,
        robloxUsername: roblox.trim(), roblox_username: roblox.trim(), game_username: roblox.trim(),
        robloxAvatarUrl: robloxProfile?.avatarUrl || null,
        robloxDisplayName: robloxProfile?.displayName || null,
        robloxUserId: robloxProfile?.userId || null,
        customerName: custName, customer_name: custName,
        userId: (eu as any)?.uid || null, customer_id: (eu as any)?.uid || null,
        isRegistered: !!eu, isManualWA: true,
        // ← field ini yang menentukan tampil di tab "Orderan" (bukan "Orderan Web")
        orderSource: 'panel', source: 'manual_wa',
        category: autoType, type: autoType, orderType: autoType, service_type: autoType,
        isGift: autoType === 'gift', isJoko: autoType === 'joko',
        gameName: items[0]?.option.gameName || 'Roblox',
        packageName: summary,         // dibaca CustomerPortal sebagai nama produk
        itemGift: summary,
        items: items.map(i => ({
          catalogId: i.option.id, gameName: i.option.gameName, name: i.option.name,
          packageName: i.option.name, category: i.option.category,
          price: i.option.price, totalPrice: i.option.price * i.qty,
          qty: i.qty, quantity: i.qty, imageUrl: i.option.imageUrl || null
        })),
        totalPrice, finalPrice: totalPrice, price: totalPrice, amount: totalPrice,
        status: 'BOOKING', orderStatus: 'BOOKING',  // dibaca CustomerPortal untuk warna badge
        paymentStatus: 'LUNAS', paymentMethod: 'MANUAL_WA',
        isDeleted: false, deleted: false,
        createdAt: serverTimestamp(), created_at: new Date().toISOString(),
        orderDate: new Date().toISOString(),           // fallback tanggal untuk CustomerPortal
        updatedAt: serverTimestamp(), updated_at: new Date().toISOString()
      }));
      setOk(`Order #${uid} tersimpan! Customer bisa cek di halaman pesanan.`);
      setRoblox(''); setPhone(''); setItems([]);
      setTimeout(() => { setOk(''); onSuccess(); }, 2000);
    } catch (ex: any) { setErr(ex.message || 'Gagal menyimpan order.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Username Roblox *</label>
          <RobloxChecker value={roblox} onChange={v => { setRoblox(v); if (!v.trim()) setRobloxProfile(null); }} onProfile={setRobloxProfile} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Nomor WhatsApp *</label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="628xxxxxxxxxx"
              className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]/50 focus:ring-1 focus:ring-[#00E676]/10 transition-all" />
            {cleanPhone.length >= 8 && <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00E676]" />}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pilih Item / Paket *</label>
        <div ref={dropRef} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
          <input value={search} onChange={e => { setSearch(e.target.value); setDropOpen(true); }} onFocus={() => setDropOpen(true)}
            placeholder={loadingCat ? 'Memuat katalog...' : 'Cari item dari katalog...'}
            disabled={loadingCat}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/50 rounded-xl text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]/50 focus:ring-1 focus:ring-[#00E676]/10 transition-all disabled:opacity-50" />
          {dropOpen && filtered.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-[#182530] border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 max-h-56 overflow-y-auto">
              {filtered.map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => { setItems(p => { const ex = p.find(i => i.id === opt.id); return ex ? p.map(i => i.id === opt.id ? { ...i, qty: i.qty + 1 } : i) : [...p, { id: opt.id, option: opt, qty: 1 }]; }); setSearch(''); setDropOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 text-left border-b border-slate-800/50 last:border-0 transition-colors">
                  {opt.imageUrl
                    ? <img src={opt.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    : <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${opt.category === 'gift' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                        {opt.category === 'gift' ? <Gift className="w-4 h-4 text-purple-400" /> : <Gamepad2 className="w-4 h-4 text-blue-400" />}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{opt.name}</p>
                    <p className="text-xs text-slate-500">{opt.gameName} · {opt.category === 'gift' ? 'GP/Gift' : 'Joki'}</p>
                  </div>
                  <span className="text-xs font-bold text-[#00E676] whitespace-nowrap">Rp {opt.price.toLocaleString('id-ID')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-3 space-y-2">
            {items.map(it => (
              <div key={it.id} className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-900/50 border border-slate-700/40 rounded-xl">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${it.option.category === 'gift' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                  {it.option.category === 'gift' ? <Gift className="w-3.5 h-3.5 text-purple-400" /> : <Gamepad2 className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{it.option.name}</p>
                  <p className="text-xs text-slate-500">{it.option.gameName}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setItems(p => p.map(i => i.id === it.id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i))}
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold flex items-center justify-center transition-colors">-</button>
                  <span className="w-6 text-center text-sm font-bold text-slate-100">{it.qty}</span>
                  <button type="button" onClick={() => setItems(p => p.map(i => i.id === it.id ? { ...i, qty: i.qty + 1 } : i))}
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold flex items-center justify-center transition-colors">+</button>
                </div>
                <span className="text-sm font-bold text-[#00E676] w-24 text-right whitespace-nowrap">Rp {(it.option.price * it.qty).toLocaleString('id-ID')}</span>
                <button type="button" onClick={() => setItems(p => p.filter(i => i.id !== it.id))} className="text-slate-600 hover:text-red-400 transition-colors ml-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="flex justify-between items-center px-3.5 py-2 bg-[#00E676]/8 border border-[#00E676]/20 rounded-xl">
              <span className="text-xs font-semibold text-[#00E676]">{totalQty} item · <span className="opacity-70">{autoType === 'joko' ? 'Joki' : 'GP/Gift'}</span></span>
              <span className="text-sm font-black text-[#00E676]">Total: Rp {totalPrice.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}
      </div>

      {err && <div className="flex items-start gap-2.5 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" /><p className="text-sm text-red-300">{err}</p></div>}
      {ok  && <div className="flex items-start gap-2.5 px-4 py-3 bg-[#00E676]/8 border border-[#00E676]/20 rounded-xl"><CheckCircle2 className="w-4 h-4 text-[#00E676] flex-shrink-0 mt-0.5" /><p className="text-sm text-[#00E676]">{ok}</p></div>}

      <button type="submit" disabled={submitting || !cleanPhone || !roblox.trim() || items.length === 0}
        className="w-full py-3 bg-[#00E676] hover:bg-[#00c853] disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-[#111b21] text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00E676]/10 active:scale-[0.99]">
        {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="w-4 h-4" />Simpan Order ({totalQty} item)</>}
      </button>
    </form>
  );
};

// ─── Order Card ───────────────────────────────────────────────────────────────
const OrderCard: React.FC<{
  order: PanelOrder; cloud?: any;
  onHide: (id: string) => void;
  onStatusChange: (id: string, ns: string) => void;
  onChat?: (o: PanelOrder) => void;
}> = ({ order, cloud, onHide, onStatusChange, onChat }) => {
  const [expanded, setExpanded] = useState(false);
  const isJoki = order.category === 'joko';
  const multi  = order.items && order.items.length > 1;

  const crashCount = cloud?.crashCount ?? cloud?.jumlahTabrak ?? order.jumlahTabrak ?? 0;
  const uangAwal   = cloud?.uangAwal ?? cloud?.initialMoney ?? cloud?.uangSebelumJoko ?? order.uangAwal ?? null;
  const tglLogin   = cloud?.lastLogin ?? cloud?.tanggalLogin ?? order.tanggalLogin ?? null;

  return (
    <div className={`group relative flex flex-col rounded-2xl overflow-visible transition-all duration-200 hover:shadow-xl hover:scale-[1.01] ${
      isJoki
        ? 'bg-gradient-to-br from-[#1a2c45] to-[#162236] border border-blue-800/40 hover:border-blue-600/50 hover:shadow-blue-900/30'
        : 'bg-gradient-to-br from-[#221a38] to-[#1a1530] border border-purple-800/40 hover:border-purple-600/50 hover:shadow-purple-900/30'
    }`}>
      {/* ── Top strip accent ── */}
      <div className={`h-1 w-full rounded-t-2xl ${isJoki ? 'bg-gradient-to-r from-blue-500 via-blue-400/60 to-transparent' : 'bg-gradient-to-r from-purple-500 via-purple-400/60 to-transparent'}`} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* ── Header row ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Roblox Avatar — lazy fetch dengan cache */}
            <RobloxAvatar
              username={order.robloxUsername}
              storedAvatarUrl={order.robloxAvatarUrl}
              size="w-11 h-11"
              ringColor={isJoki ? 'border-blue-500/30' : 'border-purple-500/30'}
              fallbackColors={isJoki ? 'bg-blue-500/20 text-blue-300 border-blue-500/25' : 'bg-purple-500/20 text-purple-300 border-purple-500/25'}
            />
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-100 truncate leading-snug">{order.robloxUsername || '-'}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{order.customerPhone || '-'}</p>
            </div>
          </div>
          {/* Hide btn — shows on hover */}
          <button onClick={() => onHide(order.firestoreId)} title="Sembunyikan dari panel"
            className="w-7 h-7 rounded-xl bg-transparent hover:bg-red-500/15 text-slate-700 hover:text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Badge row ── */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${isJoki ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-purple-500/10 text-purple-300 border-purple-500/20'}`}>
            {isJoki ? <Gamepad2 className="w-3 h-3" /> : <Gift className="w-3 h-3" />}
            {isJoki ? 'Joki' : 'GP/Gift'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${order.source === 'web' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' : 'bg-[#00E676]/8 text-[#00E676] border-[#00E676]/20'}`}>
            {order.source === 'web' ? <Globe className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
            {order.source === 'web' ? 'Web' : 'Panel'}
          </span>
        </div>

        {/* ── Divider ── */}
        <div className={`h-px ${isJoki ? 'bg-blue-900/50' : 'bg-purple-900/50'}`} />

        {/* ── Metadata ── */}
        <div className="space-y-3 flex-1">
          {/* Status */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <StatusPill orderId={order.firestoreId} status={order.status} category={order.category} onChanged={ns => onStatusChange(order.firestoreId, ns)} />
          </div>

          {/* Orderan */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-600 flex-shrink-0 pt-0.5">Orderan</span>
            <div className="text-right min-w-0 flex-1">
              {multi ? (
                <button type="button" onClick={() => setExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 transition-colors ml-auto">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>{order.items.length} item</span>
                  {expanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                </button>
              ) : (
                <p className="text-xs font-semibold text-slate-300 truncate">
                  {order.items?.[0]?.name || order.items?.[0]?.packageName || order.packageName || '-'}
                </p>
              )}
            </div>
          </div>

          {/* Multi-item expand */}
          {multi && expanded && (
            <div className="border border-slate-700/40 rounded-xl overflow-hidden -mt-1">
              {order.items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-900/40 border-b border-slate-800/50 last:border-0">
                  {it.imageUrl
                    ? <img src={it.imageUrl} alt="" className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
                    : <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isJoki ? 'bg-blue-500/15' : 'bg-purple-500/15'}`}>
                        {isJoki ? <Gamepad2 className="w-3 h-3 text-blue-400" /> : <Gift className="w-3 h-3 text-purple-400" />}
                      </div>
                  }
                  <p className="text-xs text-slate-300 flex-1 truncate">{it.name || it.packageName || '-'}</p>
                  <span className="text-[10px] text-slate-500 flex-shrink-0">×{it.quantity || it.qty || 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* Roblox username field */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">Username</span>
            <span className="text-xs font-semibold text-slate-300 truncate max-w-[150px]">{order.robloxUsername || '-'}</span>
          </div>

          {/* Joki extra stats */}
          {isJoki && (
            <div className="space-y-2 pt-1">
              {/* Cloud number badge */}
              {(cloud?.cloudNumber || cloud?.cloud_number || cloud?.cloudNum || order.cloudNumber) && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-black text-blue-300">☁</span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-300">
                    Cloud {cloud?.cloudNumber || cloud?.cloud_number || cloud?.cloudNum || order.cloudNumber}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Uang Awal', val: uangAwal ? `${Number(String(uangAwal).replace(/\D/g, '') || 0).toLocaleString('id-ID')}` : '-', cls: 'text-amber-300' },
                  { label: 'Tabrak',    val: `${crashCount}×`, cls: crashCount > 0 ? 'text-orange-300' : 'text-slate-500' },
                  { label: 'Login',     val: tglLogin ? fmtDate(tglLogin) : '-', cls: 'text-slate-400' },
                ].map(st => (
                  <div key={st.label} className="px-2.5 py-2 bg-blue-900/20 border border-blue-800/30 rounded-xl text-center">
                    <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">{st.label}</p>
                    <p className={`text-xs font-bold truncate ${st.cls}`}>{st.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={`h-px ${isJoki ? 'bg-blue-900/50' : 'bg-purple-900/50'}`} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-3 h-3" />
            <span>{fmtDate(order.createdAt)}</span>
            {fmtTime(order.createdAt) && <span className="text-slate-700">· {fmtTime(order.createdAt)}</span>}
          </div>
          {onChat && (
            <button onClick={() => onChat(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/15 text-sky-300 text-xs font-semibold rounded-lg transition-colors active:scale-95">
              <MessageSquare className="w-3 h-3" /> Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; accent: string }> = ({ label, value, icon, accent }) => (
  <div className={`flex items-center gap-3 px-4 py-3 bg-[#141e28] border rounded-xl border-slate-800/50`}>
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</div>
    <div>
      <p className="text-xl font-black text-slate-100 leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  </div>
);

// ─── Main Panel ───────────────────────────────────────────────────────────────
export const OrderanPanel: React.FC<OrderanPanelProps> = ({ onOpenChatWithOrder }) => {
  const [mainFilter, setMainFilter] = useState<'web' | 'manual'>('manual');
  const [subTab,     setSubTab]     = useState<'joko' | 'gift'>('joko');
  const [statusFilter, setStatusFilter] = useState('SEMUA');
  const [search,     setSearch]     = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  const [orders,  setOrders]  = useState<PanelOrder[]>([]);
  const [clouds,  setClouds]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('op_hidden') || '[]')); } catch { return new Set(); }
  });
  const saveHidden = (s: Set<string>) => {
    setHiddenIds(s);
    try { localStorage.setItem('op_hidden', JSON.stringify([...s])); } catch { /**/ }
  };

  // Realtime orders — NO limit so ALL orders sync 100% with DB
  useEffect(() => {
    setLoading(true);
    // Try with orderBy first (needs Firestore index), fallback to no orderBy
    const handleSnap = (snap: any) => {
      const mapped = snap.docs.map((d: any) => {
        const x = d.data();
        const rawCat = (x.category || x.type || x.orderType || x.service_type || '').toLowerCase();
        const isGift  = rawCat === 'gift' || rawCat === 'gamepass' || x.isGift === true;
        const isPanel = x.orderSource === 'panel';
        return {
          id: x.id || d.id, firestoreId: d.id,
          robloxUsername: x.robloxUsername || x.roblox_username || x.game_username || x.username || '-',
          customerPhone: x.customer_phone || x.customerPhone || x.phone || x.whatsapp || '-',
          customerName: x.customer_name || x.customerName || x.displayName || '-',
          robloxAvatarUrl: x.robloxAvatarUrl || null,
          items: Array.isArray(x.items) && x.items.length > 0 ? x.items : [{
            name: x.packageName || x.package_name || x.item_name || 'Paket',
            packageName: x.packageName || x.package_name || '-',
            gameName: x.gameName || x.game_name || '-',
            imageUrl: x.imageUrl || null, price: x.price || 0, qty: 1, quantity: 1
          }],
          packageName: x.packageName || x.package_name || x.item_name || '-',
          status: x.status || x.orderStatus || 'BOOKING',
          category: isGift ? 'gift' : 'joko',
          source: isPanel ? 'manual' : 'web',
          createdAt: x.createdAt || x.created_at || null,
          totalPrice: x.totalPrice || x.finalPrice || x.price || 0,
          uangAwal: x.uangAwal || x.uangSebelumJoko || x.initialMoney || null,
          jumlahTabrak: x.jumlahTabrak || x.crashCount || 0,
          tanggalLogin: x.tanggalLogin || x.lastLogin || null,
          cloudNumber: x.cloud_number || x.cloudNumber || x.cloudNum || null,
        } as PanelOrder;
      }).filter((o: PanelOrder) => (o.status || '').toUpperCase() !== 'BELUM_ORDER');
      // Sort newest first client-side
      mapped.sort((a: PanelOrder, b: PanelOrder) => {
        const getMs = (ts: any) => {
          if (!ts) return 0;
          if (ts?.toDate) return ts.toDate().getTime();
          if (ts?.seconds) return ts.seconds * 1000;
          return new Date(ts).getTime() || 0;
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
      });
      setOrders(mapped);
      setLoading(false);
    };

    // Try orderBy (requires Firestore index)
    const unsubOrdered = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      handleSnap,
      // Fallback: no orderBy, no limit — fetch all, sort client-side
      () => {
        const unsubFallback = onSnapshot(
          collection(db, 'orders'),
          handleSnap,
          () => setLoading(false)
        );
        // Store fallback unsub for cleanup
        (unsubRef as any).current = unsubFallback;
      }
    );
    unsubRef.current = unsubOrdered;
    return () => unsubRef.current?.();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'clouds'), snap => {
      setClouds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => { /**/ });
    return () => unsub();
  }, []);

  const cloudMap = useMemo(() => {
    const m: Record<string, any> = {};
    clouds.forEach(c => { const oid = c.orderId || c.order_id || c.assignedOrderId; if (oid) m[oid] = c; });
    return m;
  }, [clouds]);

  const handleStatusChange = useCallback((fid: string, ns: string) => {
    setOrders(prev => prev.map(o => o.firestoreId === fid ? { ...o, status: ns } : o));
  }, []);

  const statusList = ['SEMUA', ...(subTab === 'gift' ? GP_STATUSES : JOKI_STATUSES)];

  const baseOrders = useMemo(() =>
    orders.filter(o => !hiddenIds.has(o.firestoreId) && o.source === mainFilter && o.category === subTab),
    [orders, hiddenIds, mainFilter, subTab]
  );

  const visible = useMemo(() => {
    return baseOrders.filter(o => {
      if (statusFilter !== 'SEMUA') {
        const st = (o.status || '').toUpperCase();
        if (statusFilter === 'BATAL' && st !== 'BATAL' && st !== 'CANCEL') return false;
        if (statusFilter !== 'BATAL' && st !== statusFilter && st !== `${statusFilter}_WORKER`) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return o.robloxUsername.toLowerCase().includes(q) || o.customerPhone.includes(q) || o.customerName.toLowerCase().includes(q) || o.packageName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [baseOrders, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { SEMUA: baseOrders.length };
    baseOrders.forEach(o => {
      const k = (o.status || '').toUpperCase() === 'CANCEL' ? 'BATAL' : (o.status || '').toUpperCase();
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [baseOrders]);

  const webTotal    = useMemo(() => orders.filter(o => !hiddenIds.has(o.firestoreId) && o.source === 'web').length, [orders, hiddenIds]);
  const manualTotal = useMemo(() => orders.filter(o => !hiddenIds.has(o.firestoreId) && o.source === 'manual').length, [orders, hiddenIds]);

  // Stats
  const activeCount  = useMemo(() => orders.filter(o => !hiddenIds.has(o.firestoreId) && !['SELESAI','BATAL','CANCEL'].includes((o.status||'').toUpperCase())).length, [orders, hiddenIds]);
  const doneCount    = useMemo(() => orders.filter(o => !hiddenIds.has(o.firestoreId) && (o.status||'').toUpperCase() === 'SELESAI').length, [orders, hiddenIds]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d1b22]">

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 border-b border-slate-800/60">
        <div className="px-6 pt-6 pb-5 space-y-5">

          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight">Panel Orderan</h1>
              <p className="text-sm text-slate-500 mt-1">Sinkron realtime — klik badge status untuk ubah langsung</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${showSearch ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-800/50 border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}>
                <Search className="w-4 h-4" />
              </button>
              <button onClick={() => setShowForm(v => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${showForm ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-[#00E676] hover:bg-[#00c853] border-transparent text-[#111b21] shadow-lg shadow-[#00E676]/15'}`}>
                {showForm ? <><X className="w-4 h-4" />Tutup</> : <><Plus className="w-4 h-4" />Input Order</>}
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Orderan" value={orders.filter(o => !hiddenIds.has(o.firestoreId)).length} icon={<ShoppingBag className="w-4 h-4 text-slate-400" />} accent="bg-slate-800/60" />
            <StatCard label="Sedang Aktif"  value={activeCount} icon={<Zap className="w-4 h-4 text-amber-400" />}    accent="bg-amber-500/10" />
            <StatCard label="Selesai"       value={doneCount}   icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} accent="bg-emerald-500/10" />
            <StatCard label="Via Web"       value={webTotal}    icon={<Globe className="w-4 h-4 text-sky-400" />}    accent="bg-sky-500/10" />
          </div>

          {/* Main filter: Orderan vs Orderan Web */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              ['manual', 'Orderan',     Smartphone, manualTotal],
              ['web',    'Orderan Web', Globe,      webTotal],
            ] as const).map(([key, label, Icon, count]) => (
              <button key={key}
                onClick={() => { setMainFilter(key); setStatusFilter('SEMUA'); setSearch(''); }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                  mainFilter === key
                    ? 'bg-[#1a2d3d] border-[#00E676]/40 text-[#00E676] shadow-sm'
                    : 'bg-transparent border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${mainFilter === key ? 'bg-[#00E676]/20 text-[#00E676]' : 'bg-slate-800 text-slate-500'}`}>{count}</span>
              </button>
            ))}

            {/* Sub tab: Joki / GP */}
            <div className="ml-auto flex items-center gap-1 bg-slate-800/40 p-1 rounded-xl border border-slate-700/30">
              {([['joko', 'Joki', Gamepad2], ['gift', 'GP', Gift]] as const).map(([key, label, Icon]) => {
                const cnt = orders.filter(o => !hiddenIds.has(o.firestoreId) && o.source === mainFilter && o.category === key).length;
                return (
                  <button key={key}
                    onClick={() => { setSubTab(key); setStatusFilter('SEMUA'); }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      subTab === key
                        ? key === 'joko'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20 shadow-sm'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/20 shadow-sm'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                    <span className={`px-1.5 rounded-full text-[9px] font-black ${subTab === key ? 'bg-white/10' : 'bg-slate-700/50 text-slate-600'}`}>{cnt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {statusList.map(sf => {
              const count = sf === 'SEMUA' ? counts['SEMUA'] || 0 : (counts[sf] || 0);
              return (
                <button key={sf} onClick={() => setStatusFilter(sf)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                    statusFilter === sf
                      ? 'bg-[#00E676] text-[#111b21] border-transparent shadow-sm font-bold'
                      : 'bg-transparent text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600'
                  }`}>
                  {sf === 'SEMUA' ? 'Semua' : getCfg(sf).label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${statusFilter === sf ? 'bg-[#111b21]/20' : 'bg-slate-800 text-slate-600'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
                placeholder="Cari username, nomor WA, atau nama..."
                className="w-full pl-11 pr-10 py-3 bg-slate-800/40 border border-slate-700/40 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-600 transition-colors" />
              {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>}
            </div>
          )}
        </div>
      </div>

      {/* ══ INPUT FORM ═══════════════════════════════════════════════════ */}
      {showForm && (
        <div className="flex-shrink-0 border-b border-slate-800/60 bg-[#0d1b22]">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-base font-black text-slate-100 flex items-center gap-2"><Zap className="w-4 h-4 text-[#00E676]" /> Input Order Baru</p>
                <p className="text-xs text-slate-500 mt-0.5">Order akan langsung tampil di panel dan bisa dicek customer via halaman pesanan</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <InputOrderForm onSuccess={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {/* ══ GRID ═════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Memuat data...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/30 flex items-center justify-center">
              <Package className="w-7 h-7 text-slate-700" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-slate-600">Tidak ada orderan</p>
              <p className="text-sm text-slate-700 mt-1">
                {mainFilter === 'manual' ? 'Klik "Input Order" untuk tambah orderan baru' : 'Belum ada orderan dari web'}
              </p>
            </div>
            {hiddenIds.size > 0 && (
              <button onClick={() => saveHidden(new Set())} className="text-xs text-slate-600 hover:text-slate-400 underline transition-colors">
                Tampilkan {hiddenIds.size} orderan tersembunyi
              </button>
            )}
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visible.map(o => (
                <OrderCard
                  key={o.firestoreId}
                  order={o}
                  cloud={cloudMap[o.id] || cloudMap[o.firestoreId]}
                  onHide={fid => saveHidden(new Set([...hiddenIds, fid]))}
                  onStatusChange={handleStatusChange}
                  onChat={onOpenChatWithOrder ? ord => onOpenChatWithOrder(ord.firestoreId, ord.customerName, ord.customerPhone) : undefined}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/40">
              <p className="text-xs text-slate-600">{visible.length} dari {baseOrders.length} orderan</p>
              {hiddenIds.size > 0 && (
                <button onClick={() => saveHidden(new Set())} className="text-xs text-slate-600 hover:text-slate-400 underline transition-colors">
                  + Tampilkan {hiddenIds.size} tersembunyi
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderanPanel;
