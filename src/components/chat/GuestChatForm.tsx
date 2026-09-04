import React, { useState, useEffect } from 'react';
import { User, Phone, Loader2, CheckCircle2, AlertCircle, HelpCircle, ShieldCheck } from 'lucide-react';
import { fetchRobloxProfile } from '../../lib/roblox';
import { normalizePhone } from '../../utils/phoneUtils';

interface GuestChatFormProps {
  onSubmit: (guestData: {
    name: string;
    robloxUsername: string;
    robloxUserId: string;
    whatsapp: string;
  }) => void;
  onClose: () => void;
  isInline?: boolean;
}

export const GuestChatForm: React.FC<GuestChatFormProps> = ({ onSubmit, onClose, isInline = false }) => {
  const [name, setName] = useState('');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isCheckingRoblox, setIsCheckingRoblox] = useState(false);
  const [robloxProfile, setRobloxProfile] = useState<any>(null);
  const [robloxError, setRobloxError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-check Roblox username dengan debounce (seperti di GiftOrderFormModal)
  useEffect(() => {
    const clean = robloxUsername.trim().replace(/^@/, '');
    if (!clean || clean.length < 3) {
      setRobloxProfile(null);
      setRobloxError('');
      setIsCheckingRoblox(false);
      return;
    }

    setIsCheckingRoblox(true);
    setRobloxError('');

    const timer = setTimeout(async () => {
      try {
        const profile = await fetchRobloxProfile(clean);
        if (profile && profile.userId) {
          setRobloxProfile(profile);
          setRobloxError('');
        } else {
          setRobloxProfile(null);
          setRobloxError(`Username Roblox "${clean}" tidak ditemukan.`);
        }
      } catch (err: any) {
        setRobloxProfile(null);
        setRobloxError('Gagal memverifikasi username Roblox.');
      } finally {
        setIsCheckingRoblox(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [robloxUsername]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Nama wajib diisi');
      return;
    }

    const cleanUsername = robloxUsername.trim().replace(/^@/, '');
    if (!cleanUsername) {
      alert('Username Roblox wajib diisi');
      return;
    }

    if (!robloxProfile) {
      // Soft warning — allow unverified usernames (customer may have typo or account not on Roblox yet)
      const confirmed = window.confirm(
        `Username Roblox "${cleanUsername}" tidak dapat diverifikasi.\n\nLanjutkan tanpa verifikasi?`
      );
      if (!confirmed) return;
    }

    if (!whatsapp.trim()) {
      alert('Nomor WhatsApp wajib diisi');
      return;
    }

    const normalizedPhone = normalizePhone(whatsapp);
    if (!normalizedPhone) {
      alert('Format nomor WhatsApp tidak valid');
      return;
    }

    setIsSubmitting(true);
    onSubmit({
      name: name.trim(),
      robloxUsername: robloxProfile?.username || robloxProfile?.name || cleanUsername,
      robloxUserId: robloxProfile?.userId?.toString() || robloxProfile?.id?.toString() || '0',
      whatsapp: normalizedPhone
    });
  };

  const avatarUrl = robloxProfile?.avatarUrl || robloxProfile?.avatar || 
    `https://www.roblox.com/headshot-thumbnail/image?userId=0&width=150&height=150&format=png`;

  const renderFormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nama */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2">
          Nama <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama kamu"
            className="w-full px-4 py-3 pl-10 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
            required
          />
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>
      </div>

      {/* Username Roblox */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2">
          Username Roblox <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={robloxUsername}
            onChange={(e) => setRobloxUsername(e.target.value)}
            placeholder="Username Roblox kamu"
            autoComplete="off"
            className="w-full px-4 py-3 pl-10 pr-10 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm font-mono"
            required
          />
          <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isCheckingRoblox && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
            {!isCheckingRoblox && robloxProfile && (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
          </div>
        </div>

        {/* Roblox Error */}
        {robloxError && (
          <div className="mt-2 p-2.5 bg-red-950/30 border border-red-500/30 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{robloxError}</p>
          </div>
        )}

        {/* Roblox Profile Preview - Full Card Style */}
        {robloxProfile && (
          <div className="mt-3 p-3 bg-green-950/30 border border-green-500/30 rounded-xl animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-950 border-2 border-green-500/50 shrink-0 flex items-center justify-center">
                {robloxProfile.avatarUrl || robloxProfile.avatar ? (
                  <img
                    src={avatarUrl}
                    alt={robloxProfile.username || robloxProfile.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://www.roblox.com/headshot-thumbnail/image?userId=0&width=150&height=150&format=png`;
                    }}
                  />
                ) : (
                  <User className="w-6 h-6 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <p className="text-[10px] uppercase font-bold text-green-400 tracking-wider">
                    Akun Terverifikasi
                  </p>
                </div>
                <p className="text-sm font-black text-green-400 truncate">
                  @{robloxProfile.username || robloxProfile.name}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  ID: {robloxProfile.userId || robloxProfile.id}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isCheckingRoblox && !robloxError && (
          <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            <p className="text-xs text-slate-400">Mengecek username...</p>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2">
          WhatsApp <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full px-4 py-3 pl-10 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
            required
          />
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>
        <p className="text-xs text-slate-500 mt-1.5">Contoh: 081234567890</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        {!isInline && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-all"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !robloxProfile}
          className={`${isInline ? 'w-full' : 'flex-1'} px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold text-sm transition-all disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 disabled:shadow-none`}
        >
          {isSubmitting ? 'Memproses...' : 'Mulai Chat'}
        </button>
      </div>
    </form>
  );

  return (
    <>
      {!isInline && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700/50 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              </div>
              <h2 className="text-xl font-black text-white mb-2">👋 Selamat datang!</h2>
              <p className="text-sm text-slate-400">Isi dulu ya sebelum mulai chat ~</p>
            </div>
            {renderFormContent()}
          </div>
        </div>
      )}
      {isInline && renderFormContent()}
    </>
  );
};

export default GuestChatForm;
