import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Copy, Check, Gamepad2, MessageSquare, Star, 
  ExternalLink, UserCheck, Clock, Zap, CheckCircle2, XCircle,
  AlertCircle, ShieldCheck, FileText, ChevronRight, Upload, Eye,
  DollarSign, TrendingUp, TrendingDown
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SafeImage } from '../common/SafeImage';
import { OrderProgressStepper } from '../orders/OrderProgressStepper';
import { GiftJoinServerBanner } from '../orders/GiftJoinServerBanner';

interface OrderDetailProps {
  order: any;
  onBack: () => void;
  onOpenChatWithConfirmation: (order: any) => void;
  onViewProof?: (order: any) => void;
  onOpenReview?: (order: any) => void;
}

const checkIsConfirmedLocally = (order: any): boolean => {
  if (!order) return false;
  try {
    const idsToCheck = [
      order.docUniqueId,
      order.firestoreId,
      order.id,
      order.orderId,
      order.orderId ? String(order.orderId).replace(/^#/, '') : null,
      order.id ? String(order.id).replace(/^#/, '') : null
    ].filter(Boolean);

    const confirmedOrders = JSON.parse(localStorage.getItem('confirmed_chat_orders') || '[]');
    if (!Array.isArray(confirmedOrders)) return false;
    return idsToCheck.some(id => confirmedOrders.includes(id));
  } catch (_) {
    return false;
  }
};

export const OrderDetail: React.FC<OrderDetailProps> = ({
  order,
  onBack,
  onOpenChatWithConfirmation,
  onViewProof,
  onOpenReview
}) => {
  const [copied, setCopied] = useState(false);
  const [isLocallyConfirmed, setIsLocallyConfirmed] = useState<boolean>(() => {
    return order?.isChatConfirmed === true || checkIsConfirmedLocally(order);
  });

  useEffect(() => {
    if (order?.isChatConfirmed === true || checkIsConfirmedLocally(order)) {
      setIsLocallyConfirmed(true);
    }
  }, [order?.id, order?.docUniqueId, order?.orderId, order?.isChatConfirmed]);

  if (!order) return null;

  const rawOrderId = order.orderId || (order.id?.startsWith('ORD-') ? order.id : `#${(order.id || 'ORDER').substring(0, 10).toUpperCase()}`);
  const cleanOrderId = rawOrderId.replace(/^#/, '');
  const productName = order.package_name || order.packageName || order.itemGift || order.game_name || 'Paket Layanan';
  const gameName = order.game_name || order.gameName || 'Roblox';
  const price = Number(order.price) || 0;
  const paymentMethod = (order.payment_method || order.paymentMethod || 'QRIS').toUpperCase();
  const robloxUser = order.robloxUsername || order.roblox_username || order.game_username || order.targetUsername || order.username || '';
  const robloxAvatar = robloxUser 
    ? `https://www.roblox.com/headshot-thumbnail/image?userName=${encodeURIComponent(robloxUser)}&width=150&height=150&format=png`
    : null;

  const handleCopy = (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  // 💬 Handle auto-paste chat confirmation to admin and update status flag
  const handleChatConfirmation = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 1. Optimistic Instant Hide: update local state immediately
    setIsLocallyConfirmed(true);

    // 2. Persist to localStorage
    try {
      const docId = order.docUniqueId || order.firestoreId || order.id || order.orderId;
      const rawId = order.orderId || (order.id?.startsWith('ORD-') ? order.id : `#${(order.id || 'ORDER').substring(0, 10).toUpperCase()}`);
      const cleanId = rawId.replace(/^#/, '');

      const idsToAdd = [docId, order.id, order.orderId, cleanId].filter(Boolean);
      const confirmedOrders = JSON.parse(localStorage.getItem('confirmed_chat_orders') || '[]');
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
    } catch (err) {
      console.warn("Gagal simpan status konfirmasi lokal:", err);
    }

    // 3. Update flag in Firestore database
    try {
      const docId = order.docUniqueId || order.firestoreId || order.id || order.orderId;
      if (docId) {
        const orderRef = doc(db, "orders", docId);
        await updateDoc(orderRef, {
          isChatConfirmed: true,
          chatConfirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Gagal update flag konfirmasi chat di Firestore:", err);
    }

    // 4. Trigger chat open in parent
    onOpenChatWithConfirmation(order);
  };

  const statusUpper = (order.status || order.orderStatus || 'PENDING').toUpperCase();
  const isCanceled = ['BATAL', 'BATAL_TOLAK', 'CANCEL', 'REJECTED'].includes(statusUpper);
  const isCompleted = ['SELESAI', 'COMPLETED', 'SUCCESS'].includes(statusUpper);
  const isPaid = order.payment_status === 'PAID' || order.paymentStatus === 'SUCCESS' || isCompleted || ['PROSES', 'PROSES_WORKER', 'READY', 'ANTRIAN_LOGIN'].includes(statusUpper) || Boolean(order.payment_proof);

  // Banner display logic: only show if NOT confirmed, NOT completed, and NOT canceled
  const isChatConfirmed = order.isChatConfirmed === true || isLocallyConfirmed;
  const shouldShowBanner = !isChatConfirmed && !isCompleted && !isCanceled;

  let activeStep = 0;
  if (statusUpper === 'BOOKING' || statusUpper === 'PENDING_VERIFICATION' || statusUpper === 'NEW' || statusUpper === 'PENDING') activeStep = 0;
  else if (statusUpper === 'DIORDER' || statusUpper === 'PAID') activeStep = 1;
  else if (['READY', 'PROSES', 'PROSES_WORKER', 'ANTRIAN_LOGIN', 'LOGUL', 'BUTUH_LOGIN_ULANG'].includes(statusUpper)) activeStep = 2;
  else if (isCompleted) activeStep = 3;

  const steps = [
    { label: 'Booking', desc: 'Pesanan Dibuat' },
    { label: 'Diorder', desc: 'Dikonfirmasi Admin' },
    { label: statusUpper === 'READY' ? 'Ready' : (statusUpper === 'LOGUL' || statusUpper === 'BUTUH_LOGIN_ULANG' ? 'Butuh OTP' : 'Proses'), desc: 'Pengerjaan / Gift' },
    { label: 'Selesai', desc: 'Pesanan Selesai' }
  ];

  const orderTimeStr = (() => {
    const rawTime = order.pureTime || order.createdAtMillis || (order.created ? new Date(order.created).getTime() : 0);
    if (rawTime > 0) {
      const d = new Date(rawTime);
      return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} pukul ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')} WIB`;
    }
    return order.created ? new Date(order.created).toLocaleDateString('id-ID') : '-';
  })();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-fade-in px-4">
      {/* Top Navigation & Action Header */}
      <div className="flex items-center justify-between gap-4 bg-[#0b1120] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl border border-slate-800 transition cursor-pointer active:scale-95"
            title="Kembali ke Daftar Pesanan"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">Detail Pesanan</h1>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-0.5 rounded-lg">
                {rawOrderId}
              </span>
              <button
                onClick={() => handleCopy(cleanOrderId)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="Salin Order ID"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Dibuat pada {orderTimeStr}
            </p>
          </div>
        </div>
      </div>

      {/* 🟦 BLUE ACCENT BANNER "PERLU KONFIRMASI ADMIN" */}
      {shouldShowBanner && (
        <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg transition-all duration-300 animate-fade-in">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-xl shrink-0">
              💬
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>Hubungi Admin Pesanan</span>
                <span className="text-[10px] uppercase font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/30">
                  Wajib Chat
                </span>
              </h3>
              <p className="text-xs text-cyan-200/80 mt-0.5 leading-relaxed">
                Segera chat admin untuk konfirmasi pengerjaan pesanan kamu!
              </p>
            </div>
          </div>
          <button
            onClick={handleChatConfirmation}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 shrink-0 transition active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Admin Sekarang</span>
          </button>
        </div>
      )}

      {/* Grid Overview: Status Card & Stepper Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Card Overview */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
              Ringkasan Status
            </span>
            <div className="flex items-center gap-2.5">
              {isPaid ? (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Udah Dibayar</span>
                </span>
              ) : (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Menunggu Pembayaran</span>
                </span>
              )}

              {isCompleted ? (
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold">
                  Selesai
                </span>
              ) : isCanceled ? (
                <span className="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold">
                  Dibatalkan
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold">
                  Diproses
                </span>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Pembayaran</span>
              <span className="text-base font-black text-emerald-400">
                Rp {price.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Metode Bayar</span>
              <span className="font-bold text-slate-200 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {paymentMethod}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Waktu Order</span>
              <span className="font-medium text-slate-300 text-[11px] truncate max-w-[180px]">
                {orderTimeStr}
              </span>
            </div>

            {/* Uang Awal & Uang Terakhir — khusus order joki */}
            {(() => {
              const isJoki = (order.category || order.type || order.orderType || '').toLowerCase().includes('joko') || order.isJoko === true || order.isJokiOrder === true;
              if (!isJoki) return null;
              const uangAwal = order.uangAwal || order.initialMoney || order.uangSebelumJoko || order.initialCash || null;
              const uangTerakhir = order.uangTerakhir || order.lastMoney || order.uangSetelahJoko || null;
              const updatedAt = order.lastMoneyUpdatedAt || order.updatedAt || null;

              const timeAgo = (ts: any): string => {
                if (!ts) return '';
                let ms: number;
                if (ts?.toMillis) ms = ts.toMillis();
                else if (ts?.seconds) ms = ts.seconds * 1000;
                else ms = new Date(ts).getTime() || 0;
                if (!ms) return '';
                const diff = Date.now() - ms;
                const mins = Math.floor(diff / 60000);
                const hours = Math.floor(mins / 60);
                const days = Math.floor(hours / 24);
                if (days > 0) return `${days} hari yang lalu`;
                if (hours > 0) return `${hours} jam yang lalu`;
                if (mins > 0) return `${mins} menit yang lalu`;
                return 'baru saja';
              };

              if (!uangAwal && !uangTerakhir) return null;
              return (
                <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">
                    <DollarSign className="w-3 h-3" />
                    Info Keuangan Joki
                  </div>
                  {uangAwal && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-amber-400" />
                        Uang Awal
                      </span>
                      <span className="font-bold text-amber-300 font-mono">{uangAwal}</span>
                    </div>
                  )}
                  {uangTerakhir && (
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-violet-400" />
                          Uang Terakhir
                        </span>
                        <span className="font-bold text-violet-300 font-mono">{uangTerakhir}</span>
                      </div>
                      {updatedAt && (
                        <div className="flex justify-end">
                          <span className="text-[10px] text-slate-600 italic">
                            Diupdate {timeAgo(updatedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Dynamic Stepper Card in Grid */}
        <div className="lg:col-span-2">
          <OrderProgressStepper
            status={order.status || order.orderStatus || 'BOOKING'}
            statusCode={order.statusCode}
            orderType={order.type || order.orderType}
            category={order.category}
            packageName={productName}
            itemGift={order.itemGift}
            orderData={order}
          />
        </div>
      </div>

      {/* 3. BANNER BANTUAN JOIN SERVER (HANYA MUNCUL PADA GIFT IN-GAME) */}
      <GiftJoinServerBanner
        orderData={order}
        onOpenChat={() => handleChatConfirmation()}
      />

      {/* Card Produk & Kredensial Rinci */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Rincian Produk & Kredensial</h3>
              <span className="text-[11px] text-slate-400">Informasi paket joko / item dan akun tujuan</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Product Info */}
          <div className="bg-[#070b14] border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#0b1120] border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {order.image || order.imageUrl || order.catalogImage ? (
                  <SafeImage 
                    src={order.image || order.imageUrl || order.catalogImage} 
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Gamepad2 className="w-8 h-8 text-slate-700" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider block">
                  {gameName}
                </span>
                <h4 className="text-base font-black text-white truncate">
                  {productName}
                </h4>
                <span className="text-xs font-bold text-emerald-400">
                  Rp {price.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Worker Bertugas</span>
                <span className="font-semibold text-slate-200">
                  {order.worker_name || order.workerName || 'Menunggu Penugasan Worker'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Metode Login</span>
                <span className="font-semibold text-slate-200">
                  {order.login_method || order.loginMethod || 'Password'}
                </span>
              </div>
              {order.notes && (
                <div className="pt-2">
                  <span className="text-slate-400 block mb-1 font-medium">Catatan Pesanan:</span>
                  <div className="bg-[#0b1120] p-2.5 rounded-xl border border-slate-800 text-slate-300 text-xs">
                    {order.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Roblox Target Account & Bukti Bayar */}
          <div className="space-y-4">
            {/* Roblox Target Profile Box */}
            <div className="bg-[#070b14] border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-[#0b1120] border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {robloxAvatar ? (
                  <img 
                    src={robloxAvatar} 
                    alt={robloxUser}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-lg font-black text-slate-500">R</span>
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Akun Target Roblox
                </span>
                <div className="text-sm font-black text-blue-400 font-mono">
                  @{robloxUser || 'Tidak Tercantum'}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Pastikan nama akun tepat untuk kemudahan verifikasi.
                </span>
              </div>
            </div>

            {/* Bukti Bayar Action Box */}
            <div className="bg-[#070b14] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Bukti Pembayaran</span>
                <span className="text-[11px] text-slate-400">
                  {order.payment_proof ? '✅ Bukti transfer telah terunggah' : '⚠️ Belum ada bukti transfer'}
                </span>
              </div>
              {onViewProof && (
                <button
                  onClick={() => onViewProof(order)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer"
                >
                  {order.payment_proof ? 'Lihat Bukti' : 'Upload Bukti'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-800">
          {isCompleted && onOpenReview && (
            <button
              onClick={() => onOpenReview(order)}
              className="w-full sm:flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
            >
              <Star className="w-4 h-4 fill-slate-950" />
              <span>Beri Ulasan Bintang 5</span>
            </button>
          )}

          <button
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs border border-slate-800 transition cursor-pointer"
          >
            Kembali ke Pesanan
          </button>
        </div>
      </div>
    </div>
  );
};
