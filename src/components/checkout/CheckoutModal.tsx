import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Trash2, ShieldCheck, QrCode, 
  CreditCard, Eye, EyeOff, Copy, Check, Upload, AlertCircle, FileText, Coins, Sparkles, ArrowRight, Clock, UserCheck, Loader2, Phone
} from 'lucide-react';
import { CartEntry, UserProfile } from '../../types';
import { SafeImage } from '../common/SafeImage';
import { ROBLOX_JOKI_RULES } from '../../utils/rulesConstants';
import { getGiftOperatingStatus } from '../../utils/giftTimeHelper';
import { validateOrderEligibility } from '../../services/orderService';

interface CheckoutModalProps {
  onClose: () => void;
  cart: CartEntry[];
  cartTotalPrice: number;
  updateCartQty: (itemId: string, diff: number) => void;
  removeFromCart: (itemId: string) => void;
  gameUsername: string;
  setGameUsername: (val: string) => void;
  customerPhone?: string;
  setCustomerPhone?: (val: string) => void;
  customerEmail?: string;
  setCustomerEmail?: (val: string) => void;
  gamePassword?: string;
  setGamePassword?: (val: string) => void;
  initialGameMoney?: string;
  setInitialGameMoney?: (val: string) => void;
  orderNote?: string;
  setOrderNote?: (val: string) => void;
  paymentMethod: string;
  setPaymentMethod: (val: string) => void;
  qrisImageUrl: string;
  danaNumber: string;
  danaName: string;
  paymentProof: string;
  setPaymentProof: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  setShowQrisExpand: (val: boolean) => void;
  currentUser?: UserProfile | null;
  onOpenTongCoins?: () => void;
}

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
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  onClose,
  cart,
  cartTotalPrice,
  updateCartQty,
  removeFromCart,
  gameUsername,
  setGameUsername,
  customerPhone = '',
  setCustomerPhone = () => {},
  customerEmail = '',
  setCustomerEmail = () => {},
  gamePassword = '',
  setGamePassword = () => {},
  initialGameMoney = '',
  setInitialGameMoney = () => {},
  orderNote = '',
  setOrderNote = () => {},
  paymentMethod,
  setPaymentMethod,
  qrisImageUrl,
  danaNumber,
  danaName,
  paymentProof,
  setPaymentProof,
  onSubmit,
  isSubmitting,
  setShowQrisExpand,
  currentUser,
  onOpenTongCoins
}) => {
  const [copiedDana, setCopiedDana] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [agreedToRules, setAgreedToRules] = useState<boolean>(false);
  const [showOffHoursModal, setShowOffHoursModal] = useState<boolean>(false);
  const [confirmedOffHours, setConfirmedOffHours] = useState<boolean>(false);
  const [otherPaymentSubtype, setOtherPaymentSubtype] = useState<'QRIS' | 'DANA'>('QRIS');

  // Countdown timer 59:58 (3598 seconds)
  const [secondsLeft, setSecondsLeft] = useState<number>(3598);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const userTc = Number(currentUser?.tc_balance || 0);
  const isTcEnough = userTc >= cartTotalPrice;

  const hasJoko = cart.some(c => {
    const cat = (c.item.category || '').toLowerCase();
    const game = (c.item.game_name || '').toLowerCase();
    const pkg = (c.item.package_name || '').toLowerCase();
    return cat.includes('joko') || cat.includes('joki') || game.includes('joko') || game.includes('joki') || pkg.includes('joko') || pkg.includes('joki');
  });

  const handleFormSubmitInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || cartTotalPrice <= 0) {
      alert('Keranjang belanja kosong atau total harga tidak valid (Rp 0).');
      return;
    }

    if (paymentMethod === 'TC' && !isTcEnough) {
      alert(`Saldo TongCoins Anda (${userTc.toLocaleString('id-ID')} TC) tidak cukup untuk membayar pesanan sebesar Rp ${cartTotalPrice.toLocaleString('id-ID')}.\n\nSilakan Top Up TC terlebih dahulu.`);
      return;
    }

    if (hasJoko && !gamePassword.trim()) {
      alert('Mohon isi Password Roblox target sebelum checkout!');
      return;
    }

    // Gift In-Game off-hours confirmation modal check
    if (!hasJoko && !confirmedOffHours) {
      const giftStatus = getGiftOperatingStatus();
      if (!giftStatus.isOperatingHours) {
        setShowOffHoursModal(true);
        return;
      }
    }

    // Hanya tampilkan modal ToS Rules jika bertipe Joko. Gift / Gamepass / Robux otomatis lewati (BYPASS)!
    if (hasJoko && !agreedToRules) {
      setShowRulesModal(true);
      return;
    }

    if (isSubmitting || isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    try {
      // 🔒 Validasi Multi-Produk Concurrent Order Rule
      if (gameUsername.trim() && cart.length > 0) {
        for (const cartItem of cart) {
          const validationResult = await validateOrderEligibility({
            robloxUsername: gameUsername,
            packageName: cartItem.item.package_name,
            itemGift: (cartItem.item as any).itemGift || cartItem.item.package_name,
            category: cartItem.item.category,
            catalogId: cartItem.item.id
          });

          if (!validationResult.allowed) {
            alert(validationResult.reason || `Kamu masih memiliki pesanan aktif untuk produk ${cartItem.item.package_name}.`);
            setIsSubmittingOrder(false);
            return;
          }
        }
      }

      await onSubmit(e);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCopyDana = () => {
    navigator.clipboard.writeText(danaNumber);
    setCopiedDana(true);
    setTimeout(() => setCopiedDana(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-16 pb-28 md:py-10 overflow-y-auto bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-xl max-h-[85vh] bg-[#111b21] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto flex flex-col relative">
        
        {/* Modal Header */}
        <div className="bg-[#202c33] p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#00E676]" />
            Keranjang Belanja & Checkout Entong Store
          </h3>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleFormSubmitInternal} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* CART ITEMS LIST */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">Rincian Paket Game Dalam Keranjang</label>
            {cart.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-[#202c33] rounded-xl text-center">Keranjang Anda masih kosong.</p>
            ) : (
              <div className="space-y-2">
                {cart.map((entry, idx) => (
                  <div key={entry.item?.id ? `chk-${entry.item.id}-${idx}` : `chk-${idx}`} className="p-3 bg-[#202c33] rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#00E676]">{entry.item.game_name}</div>
                      <div className="text-slate-200">{entry.item.package_name}</div>
                      <div className="text-emerald-400 font-semibold">Rp {(entry?.item?.price ?? 0)?.toLocaleString?.('id-ID')} / unit</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-slate-600 rounded-lg overflow-hidden bg-[#111b21]">
                        <button
                          type="button"
                          onClick={() => updateCartQty(entry.item.id, -1)}
                          className="px-2 py-1 text-slate-300 hover:bg-slate-700 font-bold"
                        >
                          -
                        </button>
                        <span className="px-2.5 text-xs font-bold text-slate-100">{entry.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(entry.item.id, 1)}
                          className="px-2 py-1 text-slate-300 hover:bg-slate-700 font-bold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(entry.item.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-[#005C4B]/30 border border-[#00E676]/30 rounded-xl flex items-center justify-between font-bold text-xs">
                  <span>Total Biaya Pesanan:</span>
                  <span className="text-base text-emerald-400 font-mono">Rp {(cartTotalPrice ?? 0)?.toLocaleString?.('id-ID')}</span>
                </div>
              </div>
            )}
          </div>

          {/* 💳 KARTU MODERN PEMILIHAN PEMBAYARAN SESUAI REFERENSI DESAIN */}
          <div className="space-y-3 pt-3 border-t border-slate-800">

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-[11px] text-slate-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-emerald-300">Data Roblox & WhatsApp sudah tersimpan</p>
                <p className="text-slate-400 text-[10px]">
                  Silakan pilih metode pembayaran, lalu klik tombol <strong>Bayar Sekarang</strong>.
                </p>
              </div>
            </div>
            {/* Header Pembayaran & Countdown Timer */}
            <div className="flex items-center justify-between bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>💳 Mau Bayar Pakai Apa?</span>
                </h4>
                <p className="text-[10px] text-slate-400">Pilih cara bayar buat pesanan ini.</p>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Pilih dalam: {formatTimer(secondsLeft)}</span>
              </div>
            </div>

            {/* KARTU OPSI 1: TONGCOINS (TC) */}
            <div 
              onClick={() => {
                setPaymentMethod('TC');
                if (isTcEnough) {
                  setPaymentProof('TONGCOINS_INSTANT_PAYMENT');
                }
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                paymentMethod === 'TC' 
                  ? 'bg-amber-950/20 border-amber-500/80 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/10' 
                  : 'bg-[#182234] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center">
                    {paymentMethod === 'TC' && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-500/40">
                        <Coins className="w-3 h-3 text-amber-400" />
                        <span>TC</span>
                      </div>
                      <span className="font-extrabold text-xs text-white">TongCoins</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-extrabold text-[9px] border border-emerald-500/30">
                        Gratis Biaya
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      Bayar langsung tanpa biaya tambahan & instan lunas
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block">Saldo Anda:</span>
                  <span className="font-mono font-black text-amber-400 text-xs">
                    {userTc.toLocaleString('id-ID')} TC
                  </span>
                </div>
              </div>

              {/* Detail Saldo TC Saat Dipilih */}
              {paymentMethod === 'TC' && (
                <div className="mt-3 pt-3 border-t border-amber-500/20">
                  {isTcEnough ? (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-[11px]">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Saldo Mencukupi untuk Pembayaran Instan!</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-300 pt-1 border-t border-emerald-500/20">
                        <span>Total Tagihan:</span>
                        <span className="font-mono font-bold text-white">{cartTotalPrice.toLocaleString('id-ID')} TC</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-300">
                        <span>Sisa Saldo Setelah Transaksi:</span>
                        <span className="font-mono font-bold text-emerald-400">{(userTc - cartTotalPrice).toLocaleString('id-ID')} TC</span>
                      </div>
                      <p className="text-[10px] text-emerald-400/90 italic pt-0.5">
                        ⚡ Tidak perlu upload struk transfer. Saldo akan otomatis dipotong saat klik tombol bayar.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs space-y-2">
                      <div className="flex items-center gap-1.5 text-rose-300 font-bold text-[11px]">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Saldo TongCoins Tidak Cukup</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Kurang <strong className="text-rose-400 font-mono">{(cartTotalPrice - userTc).toLocaleString('id-ID')} TC</strong> untuk menyelesaikan pembayaran ini.
                      </p>
                      {onOpenTongCoins && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenTongCoins();
                          }}
                          className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0a101b] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Top Up TongCoins Sekarang</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* KARTU OPSI 2: METODE LAIN (QRIS & TF DANA) */}
            <div 
              onClick={() => {
                if (paymentMethod === 'TC') {
                  setPaymentMethod(otherPaymentSubtype);
                  setPaymentProof('');
                }
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                paymentMethod !== 'TC' 
                  ? 'bg-blue-950/20 border-blue-500/80 ring-1 ring-blue-500/40 shadow-lg shadow-blue-500/10' 
                  : 'bg-[#182234] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center">
                  {paymentMethod !== 'TC' && <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-white">Metode Lain</span>
                    <span className="text-[10px] text-slate-400 font-medium">QRIS & Transfer DANA</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    QRIS, E-Wallet, atau Transfer DANA
                  </p>
                </div>
              </div>

              {/* Sub-Selection QRIS / DANA saat Metode Lain dipilih */}
              {paymentMethod !== 'TC' && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOtherPaymentSubtype('QRIS');
                        setPaymentMethod('QRIS');
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === 'QRIS'
                          ? 'bg-[#005C4B]/40 border-[#00E676] text-white'
                          : 'bg-[#111b21] border-slate-700 text-slate-400'
                      }`}
                    >
                      <QrCode className="w-4 h-4 text-[#00E676]" />
                      <span>QRIS All Payment</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOtherPaymentSubtype('DANA');
                        setPaymentMethod('DANA');
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === 'DANA'
                          ? 'bg-[#005C4B]/40 border-[#00E676] text-white'
                          : 'bg-[#111b21] border-slate-700 text-slate-400'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <span>Transfer DANA</span>
                    </button>
                  </div>

                  {/* Tampilan QRIS */}
                  {paymentMethod === 'QRIS' && (
                    <div className="bg-[#111b21] p-3 rounded-xl border border-slate-700 flex flex-col items-center space-y-2 text-center">
                      <span className="text-xs font-bold text-slate-200">Scan Barcode QRIS di Bawah:</span>
                      <div onClick={() => setShowQrisExpand(true)} className="cursor-pointer">
                        <SafeImage 
                          src={qrisImageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"} 
                          alt="QRIS Barcode" 
                          className="w-40 h-40 object-contain bg-white p-2 rounded-xl border border-slate-600 shadow-lg"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowQrisExpand(true)}
                        className="text-[10px] text-[#00E676] hover:underline flex items-center gap-1 font-semibold animate-pulse cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Perbesar / Simpan Barcode QRIS
                      </button>
                    </div>
                  )}

                  {/* Tampilan DANA */}
                  {paymentMethod === 'DANA' && (
                    <div className="bg-[#111b21] p-3 rounded-xl border border-slate-700 space-y-2 text-xs">
                      <span className="block font-bold text-slate-200">Rincian Transfer E-Wallet DANA:</span>
                      <div className="p-2.5 bg-[#182234] rounded-lg border border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Nomor DANA</span>
                          <span className="font-mono font-bold text-[#00E676] text-sm">{danaNumber}</span>
                          <span className="text-[10px] text-slate-300 block mt-0.5">A/N: {danaName}</span>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyDana}
                          className="px-3 py-1.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-md cursor-pointer"
                        >
                          {copiedDana ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedDana ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* UPLOAD BUKTI TRANSFER (Only for QRIS & DANA) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-300">
                        Upload Struk / Bukti Transfer Pembayaran <span className="text-rose-400 font-extrabold">*Wajib</span>
                      </label>
                      {!paymentProof && (
                        <span className="text-[10px] text-amber-400 font-bold animate-pulse">Belum Diupload</span>
                      )}
                    </div>
                    <label className={`block w-full text-center py-3 px-4 bg-[#111b21] hover:bg-slate-800 text-slate-200 font-bold rounded-xl text-xs cursor-pointer border ${!paymentProof ? 'border-dashed border-rose-500/80 bg-rose-950/10' : 'border-emerald-500 bg-emerald-950/20'} transition-all`}>
                      <Upload className={`w-4 h-4 mx-auto mb-1 ${!paymentProof ? 'text-rose-400' : 'text-[#00E676]'}`} />
                      {paymentProof ? '✓ Bukti Transfer Terupload (Klik untuk Ganti)' : 'Pilih Foto Bukti Transfer (WAJIB DILAMPIRKAN)'}
                      <input
                        type="file"
                        accept="image/*"
                        required={paymentMethod !== 'TC'}
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImageFile(file);
                              setPaymentProof(compressed);
                            } catch (err) {
                              console.error('Error compressing image:', err);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setPaymentProof(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }
                        }}
                      />
                    </label>

                    {paymentProof && (
                      <div className="mt-2 text-center">
                        <SafeImage src={paymentProof} alt="Bukti Transfer" className="h-24 max-w-xs mx-auto rounded-lg border border-slate-700 shadow" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* GIFT OFF-HOURS NOTICE */}
          {(() => {
            const giftStatus = getGiftOperatingStatus();
            const hasGift = !hasJoko;
            return !giftStatus.isOperatingHours && hasGift ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span>
                  Orderan Anda akan berstatus <strong>Booking</strong> dan diproses admin mulai pukul <strong>13.00 WIB</strong>.
                </span>
              </div>
            ) : null;
          })()}

          {/* 🧾 RINGKASAN SUB-TOTAL & TOMBOL BAYAR SEKARANG */}
          <div className="space-y-2 pt-3 border-t border-slate-800 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal Pesanan</span>
              <span className="font-mono text-white">Rp {cartTotalPrice.toLocaleString('id-ID')}</span>
            </div>

            <div className="flex justify-between text-xs text-slate-400">
              <span>Biaya Metode Pembayaran</span>
              <span className="font-bold text-emerald-400">Gratis</span>
            </div>

            <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
              <span>Total Bayar</span>
              <span className="font-mono text-emerald-400 text-base">
                Rp {cartTotalPrice.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 bg-[#202c33] hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isSubmittingOrder}
                onClick={(e) => {
                  if (!gameUsername.trim()) {
                    e.preventDefault();
                    alert('Data Roblox belum lengkap. Silakan kembali ke langkah sebelumnya dan lengkapi username Roblox target.');
                    return;
                  }
                  if (!customerPhone.trim()) {
                    e.preventDefault();
                    alert('Nomor WhatsApp wajib diisi agar admin dapat menghubungi Anda.');
                    return;
                  }
                  if (hasJoko && !gamePassword.trim()) {
                    e.preventDefault();
                    alert('Password Roblox target wajib diisi untuk kategori Joko.');
                    return;
                  }
                  if (paymentMethod === 'TC' && !isTcEnough) {
                    e.preventDefault();
                    alert(`Saldo TongCoins Anda (${userTc.toLocaleString('id-ID')} TC) tidak cukup untuk membayar pesanan sebesar Rp ${cartTotalPrice.toLocaleString('id-ID')}.\n\nSilakan Top Up TC terlebih dahulu.`);
                    return;
                  }
                  if (!paymentProof && paymentMethod !== 'TC') {
                    e.preventDefault();
                    alert('Silakan upload bukti transfer pembayaran (QRIS/DANA) terlebih dahulu sebelum melanjutkan.');
                    return;
                  }
                }}
                className={`flex-1 py-3 font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                  (isSubmitting || isSubmittingOrder)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50 shadow-none'
                    : 'bg-[#00E676] hover:bg-[#00c853] text-[#111b21] shadow-[#00E676]/20 cursor-pointer active:scale-95'
                }`}
              >
                {(isSubmitting || isSubmittingOrder)
                  ? 'Sedang Memproses...'
                  : `✓ Bayar Sekarang (Rp ${(cartTotalPrice ?? 0)?.toLocaleString?.('id-ID')})`}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* RULES AGREEMENT POPUP MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#151b22] border border-emerald-500/50 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-[#00E676] flex items-center gap-2">
                <FileText className="w-4 h-4" /> Syarat & Ketentuan (Rules) Joko Roblox
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-black/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono mb-4">
              {ROBLOX_JOKI_RULES}
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-800">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200 font-medium select-none">
                <input
                  type="checkbox"
                  checked={agreedToRules}
                  onChange={(e) => setAgreedToRules(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#00E676] rounded cursor-pointer"
                />
                <span>
                  Saya telah membaca, memahami, dan menyetujui seluruh Syarat & Ketentuan (Rules) di atas. Saya paham risiko dan aturan joko Roblox Entong Store.
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!agreedToRules}
                  onClick={(e) => {
                    if (!agreedToRules) return;
                    setShowRulesModal(false);
                    const fakeEv = { preventDefault: () => {} } as React.FormEvent;
                    handleFormSubmitInternal(fakeEv);
                  }}
                  className={`flex-1 py-3 font-black rounded-xl text-xs transition shadow-lg ${
                    !agreedToRules 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                      : 'bg-[#00E676] hover:bg-[#00c853] text-[#111b21] cursor-pointer'
                  }`}
                >
                  ✓ Setuju & Lanjutkan Pesanan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFF-HOURS GIFT CONFIRMATION MODAL */}
      {showOffHoursModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#151b22] border border-amber-500/50 rounded-2xl p-6 shadow-2xl flex flex-col text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-400">Pemberitahuan Jam Proses Gift In-Game</h3>
                <p className="text-[11px] text-slate-400">Jam Operasional: 13.00 – 20.45 WIB</p>
              </div>
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
              {`Layanan pengiriman Gift In-Game beroperasi setiap hari pukul 13.00 – 20.45 WIB.\n\nKamu tetap bisa memesan dan membayar sekarang. Pesananmu akan otomatis masuk antrean dan langsung diproses saat jam operasional buka kembali (13.00 WIB).`}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowOffHoursModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal / Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOffHoursModal(false);
                  setConfirmedOffHours(true);
                  const fakeEv = { preventDefault: () => {} } as React.FormEvent;
                  handleFormSubmitInternal(fakeEv);
                }}
                className="flex-1 py-3 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl text-xs shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                Mengerti, Lanjutkan Pesanan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
