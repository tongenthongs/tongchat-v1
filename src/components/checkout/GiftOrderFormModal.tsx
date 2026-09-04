import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, User, X, Sparkles, ArrowRight, AlertCircle, Phone } from 'lucide-react';
import { lookupRobloxProfile, RobloxProfile } from '../../lib/roblox';
import { GameItem } from '../../types';

interface GiftOrderFormModalProps {
  item: GameItem & { imageUrl?: string | null };
  initialPhone?: string;
  onClose: () => void;
  onConfirm: (params: {
    robloxUsername: string;
    robloxProfile: RobloxProfile | null;
    customerPhone: string;
  }) => void;
}

export const GiftOrderFormModal: React.FC<GiftOrderFormModalProps> = ({
  item,
  initialPhone = '',
  onClose,
  onConfirm,
}) => {
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<RobloxProfile | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerPhone, setCustomerPhone] = useState(initialPhone);

  useEffect(() => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean || clean.length < 3) {
      setProfile(null);
      setError(null);
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const result = await lookupRobloxProfile(clean);
        if (result.status === 'found') {
          setProfile(result.profile);
          setError(null);
        } else if (result.status === 'notfound') {
          setProfile(null);
          setError(`Username Roblox "${clean}" tidak ditemukan.`);
        } else {
          // 'error' = proxy/network unreachable — don't say "not found"
          setProfile(null);
          setError('Tidak dapat memverifikasi username. Periksa koneksi atau coba lagi.');
        }
      } catch {
        setProfile(null);
        setError('Gagal memverifikasi username Roblox.');
      } finally {
        setIsChecking(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [username]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().replace(/^@/, '');
    if (!clean) {
      setError('Username Roblox wajib diisi.');
      return;
    }
    if (!profile) {
      // Soft warning — allow unverified username
      setError('Username tidak terverifikasi di Roblox. Pastikan username benar sebelum lanjut.');
      // Don't block — allow submit
    }
    const phoneClean = customerPhone.trim().replace(/[^0-9]/g, '');
    if (phoneClean.length < 8) {
      setError('Nomor WhatsApp wajib diisi (minimal 8 digit).');
      return;
    }
    setSubmitting(true);
    onConfirm({ robloxUsername: clean, robloxProfile: profile || null, customerPhone: customerPhone.trim() });
  };

  const avatarUrl =
    profile?.avatarUrl ||
    `https://www.roblox.com/headshot-thumbnail/image?userId=0&width=150&height=150&format=png`;

  const phoneValid = customerPhone.trim().replace(/[^0-9]/g, '').length >= 8;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#111b21] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        <div className="bg-[#202c33] p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            Form Order Gift In-Game
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-[#202c33] rounded-xl border border-slate-700">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.package_name}
                className="w-14 h-14 rounded-xl object-contain bg-slate-950"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-950 flex items-center justify-center text-blue-400">
                <Sparkles className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                {item.game_name}
              </p>
              <p className="text-sm font-bold text-white truncate">{item.package_name}</p>
              <p className="text-xs text-emerald-400 font-black mt-0.5">
                Rp {Number(item.price || 0).toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                <User className="w-3.5 h-3.5 inline mr-1" />
                Username Roblox Penerima Gift <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="contoh: JohnDoe123"
                  autoComplete="off"
                  className="w-full p-2.5 pl-3 pr-10 bg-[#202c33] border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isChecking && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                  {!isChecking && profile && (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
              </div>
              {error && (
                <p className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#202c33] rounded-xl border border-slate-700 min-h-[64px]">
              <div
                className="w-14 h-14 rounded-full overflow-hidden bg-slate-950 border border-slate-700 shrink-0 flex items-center justify-center"
                style={{ borderRadius: '9999px' }}
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = avatarUrl;
                    }}
                  />
                ) : (
                  <User className="w-6 h-6 text-slate-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {profile ? (
                  <>
                    <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Akun Terverifikasi
                    </p>
                    <p className="text-sm font-black text-white truncate">
                      @{profile.username}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {profile.displayName && profile.displayName !== profile.username
                        ? `Display: ${profile.displayName}`
                        : `ID: ${profile.userId}`}
                    </p>
                  </>
                ) : isChecking ? (
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengecek username...
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Avatar akan muncul otomatis setelah username valid.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                Nomor WhatsApp Aktif <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  autoComplete="off"
                  className="w-full p-2.5 pl-3 pr-3 bg-[#202c33] border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Untuk konfirmasi & pengiriman gift oleh admin.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!profile || !phoneValid || submitting}
                className={`flex-1 py-2.5 font-black rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2 ${
                  !profile || !phoneValid || submitting
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                }`}
              >
                <span>Lanjut ke Pembayaran</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
