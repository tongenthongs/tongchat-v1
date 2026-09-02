import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Coins, 
  ShieldCheck, 
  Gift, 
  Zap, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  CreditCard, 
  Upload, 
  Copy, 
  Check, 
  Download, 
  AlertCircle, 
  ShoppingBag, 
  Info,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  serverTimestamp,
  getDoc 
} from 'firebase/firestore';
import { CoinTransaction, TONGCOINS_TOS } from '../../types';
import { SafeImage } from '../common/SafeImage';

interface TongCoinsPageProps {
  onNavigateTab: (tab: any) => void;
  onOpenAuthModal?: () => void;
}

export function formatTransactionDate(dateInput: any, timestamp?: number) {
  let dateObj;
  if (timestamp) {
    dateObj = new Date(timestamp);
  } else if (dateInput?.toDate) {
    dateObj = dateInput.toDate();
  } else if (dateInput) {
    dateObj = new Date(dateInput);
  } else {
    dateObj = new Date();
  }

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj) + ' WIB';
}

const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];

export const TongCoinsPage: React.FC<TongCoinsPageProps> = ({ onNavigateTab, onOpenAuthModal }) => {
  const { currentUser, qrisImageUrl, danaNumber, danaName } = useApp();

  // Top Up Form State
  const [selectedPreset, setSelectedPreset] = useState<number>(50000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'DANA'>('QRIS');
  const [paymentProof, setPaymentProof] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [copiedDana, setCopiedDana] = useState<boolean>(false);
  const [showQrisZoom, setShowQrisZoom] = useState<boolean>(false);

  // Transactions Ledger State
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');

  const topUpCardRef = useRef<HTMLDivElement>(null);

  // Effective nominal
  const currentNominal = useMemo(() => {
    if (isCustom) {
      const parsed = parseInt(customAmount.replace(/[^0-9]/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return selectedPreset;
  }, [isCustom, customAmount, selectedPreset]);

  // Bonus calculations
  const bonusRate = useMemo(() => {
    if (currentNominal >= 100000) return 0.005; // 0.5% for >= 100.000 TC
    if (currentNominal > 0) return 0.003; // 0.3% for < 100.000 TC
    return 0;
  }, [currentNominal]);

  const bonusCoins = useMemo(() => {
    return Math.round(currentNominal * bonusRate);
  }, [currentNominal, bonusRate]);

  const totalCoinsReceived = useMemo(() => {
    return currentNominal + bonusCoins;
  }, [currentNominal, bonusCoins]);
  useEffect(() => {
    if (!currentUser?.id) {
      setTransactions([]);
      setIsLoadingTx(false);
      return;
    }

    setIsLoadingTx(true);
    const q = query(
      collection(db, 'coin_transactions'),
      where('userId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CoinTransaction[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: d.userId,
          userEmail: d.userEmail,
          userName: d.userName,
          userPhone: d.userPhone,
          type: d.type || 'TOPUP',
          amount: Number(d.amount || 0),
          orderId: d.orderId,
          description: d.description || 'Transaksi TongCoins',
          status: d.status || 'SUCCESS',
          paymentMethod: d.paymentMethod,
          proofUrl: d.proofUrl,
          rejectionReason: d.rejectionReason,
          adminNote: d.adminNote,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt
        });
      });

      // Sort descending by date
      list.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      setTransactions(list);
      setIsLoadingTx(false);
    }, (err) => {
      console.warn("Coin transactions listener warning:", err);
      setIsLoadingTx(false);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filterType !== 'ALL') {
        if (filterType === 'TOPUP' && tx.type !== 'TOPUP') return false;
        if (filterType === 'PAYMENT' && tx.type !== 'PAYMENT') return false;
        if (filterType === 'REFUND' && tx.type !== 'REFUND') return false;
        if (filterType === 'MANUAL' && !['MANUAL_ADD', 'MANUAL_SUB'].includes(tx.type)) return false;
      }
      if (filterDate) {
        const txDate = new Date(tx.createdAt).toISOString().split('T')[0];
        if (txDate !== filterDate) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterDate]);

  // Image compression helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 1000;
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
          if (!ctx) return resolve(e.target?.result as string);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle submit Top Up request
  const handleSubmitTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    if (currentNominal < 10000) {
      alert("Minimal Top Up TongCoins adalah Rp 10.000 (10.000 TC).");
      return;
    }

    if (!paymentProof) {
      alert("Mohon lampirkan foto/struk bukti transfer pembayaran!");
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const topupId = `TC-${Date.now().toString().slice(-6)}`;

      // 1. Catat di koleksi 'coin_transactions'
      const txDocRef = doc(collection(db, 'coin_transactions'), topupId);
      const txPayload: CoinTransaction = {
        id: topupId,
        userId: currentUser.id,
        userEmail: currentUser.email || '',
        userName: currentUser.name || currentUser.username || 'Customer',
        userPhone: currentUser.phone || currentUser.whatsappNumber || '',
        type: 'TOPUP',
        amount: totalCoinsReceived,
        orderId: topupId,
        description: `Top Up Saldo ${currentNominal.toLocaleString('id-ID')} TC ${bonusCoins > 0 ? `(+${bonusCoins.toLocaleString('id-ID')} TC Bonus Promo)` : ''}`.trim(),
        status: 'PENDING',
        paymentMethod: paymentMethod,
        proofUrl: paymentProof,
        adminNote: `Base: Rp ${currentNominal.toLocaleString('id-ID')}, Bonus: ${bonusCoins.toLocaleString('id-ID')} TC (${(bonusRate * 100).toFixed(1)}%), Total: ${totalCoinsReceived.toLocaleString('id-ID')} TC`,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      await setDoc(txDocRef, txPayload);

      // 2. Simpan secara EKSKLUSIF ke koleksi 'tc_topups' (DILARANG KERAS ke koleksi 'orders')
      const topupDocRef = doc(db, 'tc_topups', topupId);
      await setDoc(topupDocRef, {
        id: topupId,
        topupId: topupId,
        userId: currentUser.id,
        userName: currentUser.name || currentUser.username || 'Customer',
        userEmail: currentUser.email || '',
        userPhone: currentUser.phone || currentUser.whatsappNumber || '',
        amount: currentNominal,
        price: currentNominal,
        coinAmount: totalCoinsReceived,
        bonusCoins: bonusCoins,
        bonusRate: bonusRate,
        paymentMethod: paymentMethod,
        payment_method: paymentMethod,
        paymentProof: paymentProof,
        proofUrl: paymentProof,
        status: 'Menunggu Verifikasi', // Status transaksi saldo murni: 'Menunggu Verifikasi', 'Lunas', 'Ditolak'
        statusRaw: 'PENDING',
        type: 'topup_tc',
        notes: `Pengajuan Top Up TongCoins sebesar Rp ${currentNominal.toLocaleString('id-ID')} mendapatkan ${totalCoinsReceived.toLocaleString('id-ID')} TC (Bonus ${(bonusRate * 100).toFixed(1)}%)`,
        createdAt: serverTimestamp(),
        created: nowIso,
        updatedAt: nowIso
      });

      // 3. Notifikasi sistem ke subkoleksi messages chat room customer
      try {
        const roomId = `room_${currentUser.id}`;
        const chatMsgRef = doc(collection(db, 'chats', roomId, 'messages'));
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          text: `🪙 [PENGAJUAN TOP UP TC]\n\nID Transaksi: #${topupId}\nNominal Transfer: Rp ${currentNominal.toLocaleString('id-ID')}\nTotal Koin Didapat: ${totalCoinsReceived.toLocaleString('id-ID')} TC (Termasuk Bonus Promo ${bonusCoins.toLocaleString('id-ID')} TC)\nStatus: Menunggu Verifikasi Admin.`,
          message: `🪙 [PENGAJUAN TOP UP TC]\n\nID Transaksi: #${topupId}\nNominal Transfer: Rp ${currentNominal.toLocaleString('id-ID')}\nTotal Koin Didapat: ${totalCoinsReceived.toLocaleString('id-ID')} TC (Termasuk Bonus Promo ${bonusCoins.toLocaleString('id-ID')} TC)\nStatus: Menunggu Verifikasi Admin.`,
          sender: 'system',
          senderRole: 'system',
          sender_role: 'system',
          senderName: 'System TongCoins',
          sender_name: 'System TongCoins',
          sender_id: 'system',
          createdAt: serverTimestamp(),
          created: nowIso,
          isSystem: true,
          type: 'topup_tc_notification',
          topupId: topupId
        });
      } catch (chatErr) {
        console.warn("Chat notice warning:", chatErr);
      }

      setSubmitSuccess(`Pengajuan Top Up ${currentNominal.toLocaleString('id-ID')} TC (Total ${totalCoinsReceived.toLocaleString('id-ID')} TC) berhasil dikirim! Admin akan segera memverifikasi bukti pembayaran Anda.`);
      setPaymentProof('');
      setCustomAmount('');
      setIsCustom(false);
      setSelectedPreset(50000);
    } catch (err: any) {
      console.error("Topup submission error:", err);
      alert("Gagal mengirim pengajuan top-up: " + (err?.message || "Terjadi kesalahan"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy DANA number helper
  const handleCopyDana = () => {
    if (!danaNumber) return;
    navigator.clipboard.writeText(danaNumber);
    setCopiedDana(true);
    setTimeout(() => setCopiedDana(false), 2000);
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("Tidak ada transaksi untuk diekspor.");
      return;
    }

    const headers = ["ID Transaksi", "Tanggal", "Tipe", "Nominal (TC)", "Status", "Keterangan", "Metode Bayar"];
    const rows = filteredTransactions.map(tx => [
      `"${tx.id}"`,
      `"${new Date(tx.createdAt).toLocaleString('id-ID')}"`,
      `"${tx.type}"`,
      `"${tx.amount}"`,
      `"${tx.status}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      `"${tx.paymentMethod || '-'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `riwayat_tongcoins_${currentUser?.username || 'user'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const userBalance = Number(currentUser?.tc_balance || 0);

  if (!currentUser) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="bg-[#121927] border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
            <Coins className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Akses Dompet TongCoins</h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Silakan masuk ke akun Anda terlebih dahulu untuk melihat saldo TongCoins, riwayat transaksi, dan melakukan top up koin.
            </p>
          </div>
          <button
            onClick={onOpenAuthModal}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#0a101b] font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            Masuk / Buat Akun Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f18] text-slate-100 pb-24">
      {/* 🌟 HEADER TONGCOINS */}
      <div className="bg-gradient-to-b from-[#111c2e] to-[#0a0f18] border-b border-slate-800/80 pt-8 pb-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Dompet Digital Resmi Entong Store</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                <span className="bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  TongCoins
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold border border-emerald-500/40">
                  1 TC = Rp 1
                </span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-xl">
                Saldo digital buat transaksi lebih cepat, tanpa biaya admin, dan otomatis tersinkronisasi.
              </p>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  topUpCardRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Top Up Koin</span>
              </button>
              <button
                onClick={() => onNavigateTab('catalog')}
                className="px-4 py-2.5 bg-[#1a2333] hover:bg-[#222e42] border border-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <span>Belanja Produk</span>
              </button>
            </div>
          </div>

          {/* 3 BADGE PILL FITUR UNGGULAN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="bg-[#121b2a] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Tanpa Biaya Admin</div>
                <div className="text-[10px] text-slate-400">100% utuh tanpa potongan sepeser pun</div>
              </div>
            </div>

            <div className="bg-[#121b2a] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Bonus Setiap Top Up</div>
                <div className="text-[10px] text-slate-400">Dapatkan poin & cashback event promo</div>
              </div>
            </div>

            <div className="bg-[#121b2a] border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Bayar Instan 1-Klik</div>
                <div className="text-[10px] text-slate-400">Checkout cepat tanpa upload struk berulang</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 MAIN CONTENT 2-COLUMN LAYOUT */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ========================================================================= */}
          {/* KOLOM KIRI (5 COLS): KARTU SALDO UTAMA + KARTU TOP UP TONGCOINS */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-6">

            {/* 1. KARTU SALDO UTAMA (Hero Wallet Card) */}
            <div className="bg-gradient-to-br from-[#161b22] to-[#0d1117] border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-4">
              <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header row */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
                    <Coins className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Saldo Aktif TongCoins</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Saldo Aktif
                </span>
              </div>

              {/* Balance Display */}
              <div className="relative z-10 pt-1">
                <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 tracking-tight">
                  {userBalance.toLocaleString('id-ID')} TC
                </div>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  Setara dengan Rp {userBalance.toLocaleString('id-ID')}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-3 pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    topUpCardRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Top Up Koin</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('catalog')}
                  className="w-full py-2.5 px-4 bg-[#1c2738] hover:bg-[#253247] border border-cyan-500/30 text-cyan-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Belanja Produk</span>
                </button>
              </div>
            </div>

            {/* 2. KARTU FORM TOP UP TONGCOINS */}
            <div ref={topUpCardRef} className="bg-[#121927] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <span>Top Up TongCoins</span>
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  1 TC = Rp 1
                </span>
              </div>

              {submitSuccess && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-emerald-200">Pengajuan Berhasil Terkirim!</p>
                    <p className="text-[11px] text-emerald-300/90 mt-0.5">{submitSuccess}</p>
                  </div>
                  <button onClick={() => setSubmitSuccess(null)} className="text-emerald-400 hover:text-white text-xs font-bold">✕</button>
                </div>
              )}

              <form onSubmit={handleSubmitTopUp} className="space-y-4">
                {/* Interactive Input Form for Amount */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Jumlah Top Up
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      required
                      value={isCustom ? customAmount : (selectedPreset ? selectedPreset.toLocaleString('id-ID') : '50.000')}
                      onChange={(e) => {
                        setIsCustom(true);
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const num = parseInt(raw, 10);
                        setCustomAmount(isNaN(num) ? '' : num.toLocaleString('id-ID'));
                      }}
                      placeholder="50.000"
                      className="w-full pl-10 pr-16 py-3 bg-[#182234] border border-slate-700 focus:border-emerald-500 rounded-xl text-sm font-black font-mono text-white focus:outline-none transition-all shadow-inner"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold rounded">
                        TC
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 px-0.5">
                    <span>1 TongCoins = Rp1 (1 TC = 1 Rp)</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      Min. Rp 10.000
                    </span>
                  </div>

                  {/* Preset Quick Chips - 3 columns symmetrical */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {PRESET_AMOUNTS.map((amt) => {
                      const isActive = currentNominal === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setSelectedPreset(amt);
                            setIsCustom(false);
                            setCustomAmount('');
                          }}
                          className={`py-2 px-2 rounded-xl border text-xs font-bold font-mono transition-all text-center cursor-pointer ${
                            isActive
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm'
                              : 'bg-[#182234]/70 border-slate-700/80 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          }`}
                        >
                          {amt >= 1000000 ? `${amt / 1000000} Jt` : `${amt / 1000}k`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Kotak Info Promo Sederhana (Satu Baris Bersih) */}
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
                  <div className="text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
                    <span>🎁 Bonus Top Up: +0.3% (&lt; 100k) | +0.5% (≥ 100k)</span>
                  </div>

                  {/* Realtime Calculation Result Box */}
                  <div className="pt-2 border-t border-emerald-800/40 flex items-center justify-between text-xs">
                    <span className="text-slate-300">Total Koin Didapat:</span>
                    <div className="text-right">
                      <div className="font-mono font-black text-emerald-400 text-sm">
                        {totalCoinsReceived.toLocaleString('id-ID')} TC
                      </div>
                      {bonusCoins > 0 && (
                        <div className="text-[10px] text-emerald-300 font-mono">
                          ({currentNominal.toLocaleString('id-ID')} + {bonusCoins.toLocaleString('id-ID')} Bonus TC)
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metode Pembayaran Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="block text-xs font-bold text-slate-300">
                    Pilih Metode Pembayaran Transfer
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('QRIS')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === 'QRIS'
                          ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-500/10'
                          : 'bg-[#182234] border-slate-700 text-slate-400 hover:bg-[#1f2b42]'
                      }`}
                    >
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <span>QRIS (Barcode)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('DANA')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === 'DANA'
                          ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-500/10'
                          : 'bg-[#182234] border-slate-700 text-slate-400 hover:bg-[#1f2b42]'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <span>Transfer DANA</span>
                    </button>
                  </div>

                  {/* QRIS Container - Compact Sizing */}
                  {paymentMethod === 'QRIS' && (
                    <div className="bg-[#182234] p-3.5 rounded-xl border border-slate-700/80 flex flex-col items-center space-y-2.5 text-center">
                      <span className="text-[11px] font-bold text-slate-200">Scan Barcode QRIS Resmi Entong Store:</span>
                      <div onClick={() => setShowQrisZoom(true)} className="cursor-pointer">
                        <SafeImage
                          src={qrisImageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"}
                          alt="QRIS Barcode"
                          className="w-48 h-48 max-w-[200px] max-h-[200px] object-contain bg-white p-2 rounded-xl border border-slate-600 shadow-md hover:scale-102 transition-transform"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowQrisZoom(true)}
                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> Klik untuk Memperbesar Barcode
                      </button>
                    </div>
                  )}

                  {/* DANA Container */}
                  {paymentMethod === 'DANA' && (
                    <div className="bg-[#182234] p-3.5 rounded-xl border border-slate-700/80 space-y-2 text-xs">
                      <span className="block font-bold text-slate-200 text-[11px]">Rincian Transfer E-Wallet DANA:</span>
                      <div className="p-2.5 bg-[#0e1522] rounded-lg border border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Nomor DANA Admin</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">{danaNumber || '0812-XXXX-XXXX'}</span>
                          <span className="text-[10px] text-slate-300 block">A/N: {danaName || 'Entong Store'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyDana}
                          className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#0a101b] font-bold rounded-lg text-[10px] flex items-center gap-1 shadow cursor-pointer"
                        >
                          {copiedDana ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedDana ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Bukti Pembayaran */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-300">
                      Upload Bukti / Struk Transfer <span className="text-rose-400">*Wajib</span>
                    </label>
                    {paymentProof ? (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Terupload
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">Belum Diupload</span>
                    )}
                  </div>

                  <label className={`block w-full text-center py-3 px-3 bg-[#182234] hover:bg-[#202d44] text-slate-300 font-bold rounded-xl text-xs cursor-pointer border transition-all ${
                    !paymentProof ? 'border-dashed border-slate-600' : 'border-emerald-500/80 bg-emerald-950/20'
                  }`}>
                    <Upload className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                    {paymentProof ? 'Ganti Foto Bukti Transfer' : 'Pilih Foto Struk / Screenshot Bukti Transfer'}
                    <input
                      type="file"
                      accept="image/*"
                      required
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file);
                            setPaymentProof(compressed);
                          } catch (err) {
                            console.error("Compression error:", err);
                          }
                        }
                      }}
                    />
                  </label>

                  {paymentProof && (
                    <div className="mt-2 text-center">
                      <SafeImage
                        src={paymentProof}
                        alt="Bukti Transfer"
                        className="h-24 max-w-xs mx-auto rounded-lg border border-slate-700 shadow object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Ringkasan Biaya */}
                <div className="p-3 bg-[#0a111c] border border-slate-800 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Nominal Koin Didapat:</span>
                    <span className="font-mono font-bold text-white">{totalCoinsReceived.toLocaleString('id-ID')} TC</span>
                  </div>
                  {bonusCoins > 0 && (
                    <div className="flex justify-between text-emerald-400 text-[11px]">
                      <span>Bonus Promo ({(bonusRate * 100).toFixed(1)}%):</span>
                      <span className="font-mono font-bold">+{bonusCoins.toLocaleString('id-ID')} TC</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Biaya Layanan & Admin:</span>
                    <span className="font-mono font-bold text-emerald-400">Rp 0 (Gratis)</span>
                  </div>
                  <div className="h-px bg-slate-800 my-1" />
                  <div className="flex justify-between text-slate-200 font-bold">
                    <span>Total Pembayaran:</span>
                    <span className="font-mono text-emerald-400 text-sm">Rp {currentNominal.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {/* Terms of Service Notice inside card */}
                <div className="p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-300 text-[10px] leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-200">Ketentuan Layanan Saldo Resmi:</span>
                    1 TC = Rp 1. Saldo TC bersifat non-refundable (tidak dapat dicairkan kembali ke rekening/e-wallet) dan hanya berlaku untuk transaksi di Entong Store.
                  </div>
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || currentNominal < 10000 || !paymentProof}
                  className={`w-full py-3 rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isSubmitting || currentNominal < 10000 || !paymentProof
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#0a101b] shadow-emerald-500/25 active:scale-98 font-black'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Mengirim Pengajuan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Konfirmasi & Ajukan Top Up ({totalCoinsReceived.toLocaleString('id-ID')} TC)</span>
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* KOLOM KANAN (7 COLS): RIWAYAT TRANSAKSI TC (LEDGER CARD) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-6">

            <div className="bg-[#121927] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full min-h-[600px]">
              
              {/* Header Riwayat & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Riwayat Transaksi TongCoins</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Catatan mutasi koin masuk, belanja pesanan, dan pengembalian dana (refund).
                  </p>
                </div>

                {/* Export CSV Button */}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-[#182234] hover:bg-[#223048] border border-slate-700 text-slate-200 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                  title="Unduh laporan riwayat transaksi dalam format CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
              </div>

              {/* Filter Row */}
              <div className="flex flex-wrap items-center gap-2 pt-3 pb-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-[#182234] border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="ALL">Semua Mutasi</option>
                  <option value="TOPUP">Top Up Saja</option>
                  <option value="PAYMENT">Pembayaran Order</option>
                  <option value="REFUND">Refund / Pengembalian</option>
                  <option value="MANUAL">Penyesuaian Admin</option>
                </select>

                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-[#182234] border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
                />

                {(filterType !== 'ALL' || filterDate) && (
                  <button
                    onClick={() => {
                      setFilterType('ALL');
                      setFilterDate('');
                    }}
                    className="text-[10px] text-rose-400 hover:underline font-bold px-1 py-1"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Transactions List */}
              <div className="flex-1 overflow-y-auto max-h-[580px] space-y-2.5 pr-1">
                {isLoadingTx ? (
                  <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Memuat riwayat transaksi...</span>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2 bg-[#0d1420] rounded-xl border border-slate-800/80 p-6">
                    <Coins className="w-8 h-8 text-slate-600" />
                    <span className="font-bold text-slate-400">Belum Ada Transaksi</span>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      Transaksi top up, pembelian layanan, dan refund akan tercatat otomatis di sini.
                    </p>
                  </div>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isIncome = tx.type === 'TOPUP' || tx.type === 'REFUND' || tx.type === 'MANUAL_ADD' || (tx as any).isIncoming;
                    const isRefund = tx.type === 'REFUND';
                    const isTopup = tx.type === 'TOPUP';
                    const isPayment = tx.type === 'PAYMENT';
                    const isPending = tx.status === 'PENDING';
                    const isRejected = tx.status === 'REJECTED' || tx.status === 'CANCELLED';

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 bg-[#162030] hover:bg-[#1b273b] border border-slate-800/90 rounded-xl flex items-center justify-between gap-3 transition-all"
                      >
                        {/* Icon & Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            isIncome
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                          }`}>
                            {isIncome ? (
                              <ArrowDownLeft className="w-5 h-5" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-100 truncate">
                                {tx.description}
                              </span>

                              {/* Status Badge */}
                              {isPending ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  Menunggu Verifikasi
                                </span>
                              ) : isRejected ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  Ditolak
                                </span>
                              ) : isRefund ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  Refund Koin (+)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  Berhasil
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap sm:flex-nowrap whitespace-nowrap">
                              <span>
                                {formatTransactionDate(tx.createdAt, (tx as any).timestamp)}
                              </span>
                              {tx.orderId && (
                                <span className="font-mono text-slate-400">
                                  | #{tx.orderId}
                                </span>
                              )}
                              {tx.paymentMethod && (
                                <span className="text-slate-400">
                                  via {tx.paymentMethod}
                                </span>
                              )}
                            </div>

                            {tx.rejectionReason && (
                              <div className="text-[10px] text-rose-400 mt-1">
                                Alasan Ditolak: <em>{tx.rejectionReason}</em>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-black font-mono ${
                            isRejected
                              ? 'text-slate-500 line-through'
                              : isPending
                              ? 'text-amber-400'
                              : isIncome
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}>
                            {isIncome ? '+' : '-'}{Math.abs(tx.amount).toLocaleString('id-ID')} TC
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Rp {Math.abs(tx.amount).toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>

        </div>

        {/* 📜 FOOTER TERMS OF SERVICE EXCLUSIVE ACCORDION / BOX */}
        <div className="mt-8 bg-[#121b2a] border border-slate-800/90 rounded-2xl p-5 text-slate-400 text-xs space-y-3 shadow-lg">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Ketentuan Layanan Resmi TongCoins (TC)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-300">
            {TONGCOINS_TOS}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-[10px] text-slate-400 border-t border-slate-800">
            <div>✓ Kurs Tetap: 1 TC = Rp 1</div>
            <div>✓ Bebas Biaya Layanan & Admin</div>
            <div>✓ Garansi Refund jika Order Batal</div>
            <div>✓ Keamanan Transaksi Enkripsi 24/7</div>
          </div>
        </div>
      </div>

      {/* 🔍 MODAL ZOOM QRIS */}
      {showQrisZoom && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121927] border border-slate-700 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-400" />
                Barcode QRIS Resmi Entong Store
              </span>
              <button
                onClick={() => setShowQrisZoom(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <SafeImage
              src={qrisImageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80"}
              alt="QRIS Zoom"
              className="w-64 h-64 mx-auto object-contain bg-white p-3 rounded-xl shadow-lg border border-slate-600"
            />
            <p className="text-[11px] text-slate-300">
              Pindai kode QRIS di atas menggunakan aplikasi m-Banking atau E-Wallet (BCA, Mandiri, BRI, GoPay, OVO, ShopeePay, DANA).
            </p>
            <button
              type="button"
              onClick={() => setShowQrisZoom(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
            >
              Tutup Barcode
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TongCoinsPage;
