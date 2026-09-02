import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db, auth } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { 
  User, Shield, Laptop, Bell, CheckCircle2, 
  AlertCircle, Loader2, Lock, Eye, EyeOff, Save, Check, ArrowLeft
} from 'lucide-react';

interface CustomerSettingsProps {
  onBack?: () => void;
}

export const CustomerSettings: React.FC<CustomerSettingsProps> = ({ onBack }) => {
  const { currentUser, setCurrentUser, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'profil' | 'keamanan' | 'perangkat' | 'notifikasi'>('profil');

  // Profile Form States
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showPublicName, setShowPublicName] = useState(true);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification Toggle States
  const [notifDelivery, setNotifDelivery] = useState(true);
  const [notifReminder, setNotifReminder] = useState(true);
  const [notifMembership, setNotifMembership] = useState(false);

  // Real-time synchronization with Firestore users/{uid}
  useEffect(() => {
    if (!currentUser?.id) return;
    const userRef = doc(db, 'users', currentUser.id);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setName(data.name || data.username || '');
        setWhatsapp(data.whatsapp || data.phone || '');
        setShowPublicName(data.showPublicName !== false);
        
        if (data.settings?.notifications) {
          setNotifDelivery(data.settings.notifications.delivery !== false);
          setNotifReminder(data.settings.notifications.reminder !== false);
          setNotifMembership(data.settings.notifications.membership === true);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Save Profile Info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    try {
      setIsSavingProfile(true);
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        name,
        username: name,
        whatsapp,
        phone: whatsapp,
        showPublicName,
        updatedAt: new Date().toISOString()
      });

      if (setCurrentUser && currentUser) {
        setCurrentUser({ ...currentUser, name, username: name, phone: whatsapp, whatsappNumber: whatsapp });
      }

      setSaveProfileSuccess(true);
      setTimeout(() => setSaveProfileSuccess(false), 3000);
    } catch (err: any) {
      console.error("Gagal menyimpan profil:", err);
      alert("Gagal menyimpan profil: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Toggle Visibility Instant Update
  const handleToggleVisibility = async (val: boolean) => {
    setShowPublicName(val);
    if (!currentUser?.id) return;
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        showPublicName: val,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating visibility:", err);
    }
  };

  // Toggle Notification Instant Update
  const handleToggleNotif = async (type: 'delivery' | 'reminder' | 'membership', val: boolean) => {
    if (type === 'delivery') setNotifDelivery(val);
    if (type === 'reminder') setNotifReminder(val);
    if (type === 'membership') setNotifMembership(val);

    if (!currentUser?.id) return;
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`settings.notifications.${type}`]: val,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating notifications:", err);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok.');
      return;
    }

    const authUser = auth.currentUser;
    if (!authUser || !authUser.email) {
      setPasswordError('Sesi auth tidak valid.');
      return;
    }

    try {
      setIsChangingPassword(true);
      if (currentPassword) {
        const credential = EmailAuthProvider.credential(authUser.email, currentPassword);
        await reauthenticateWithCredential(authUser, credential);
      }
      await updatePassword(authUser, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      console.error("Gagal mengganti password:", err);
      if (err.code === 'auth/wrong-password') {
        setPasswordError('Password saat ini salah.');
      } else if (err.code === 'auth/requires-recent-login') {
        setPasswordError('Harap login ulang terlebih dahulu demi keamanan.');
      } else {
        setPasswordError(err.message || 'Gagal mengubah password.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // User Device Info
  const userAgent = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const browserName = userAgent.includes("Chrome") ? "Google Chrome" : userAgent.includes("Safari") ? "Safari" : userAgent.includes("Firefox") ? "Firefox" : "Browser Web";
  const osName = userAgent.includes("Windows") ? "Windows PC" : userAgent.includes("Mac") ? "macOS" : userAgent.includes("Android") ? "Android OS" : userAgent.includes("iPhone") ? "iOS Device" : "Linux / Lainnya";



  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-2 sm:px-4 animate-fade-in text-slate-100">
      {/* TOP HEADER */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/80 cursor-pointer shrink-0"
              title="Kembali ke Profil"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Pengaturan Akun - Entong Store
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Kelola informasi profil, preferensi keamanan, dan notifikasi transaksi Anda.
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill Header - Never clipped, supports horizontal swipe & wrap */}
        <div className="w-full flex items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800/80 overflow-x-auto whitespace-nowrap scrollbar-hide flex-nowrap sm:flex-wrap">
          <button
            onClick={() => setActiveTab('profil')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'profil'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profil</span>
          </button>

          <button
            onClick={() => setActiveTab('keamanan')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'keamanan'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Keamanan</span>
          </button>

          <button
            onClick={() => setActiveTab('perangkat')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'perangkat'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Perangkat</span>
          </button>

          <button
            onClick={() => setActiveTab('notifikasi')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'notifikasi'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifikasi</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT: PROFIL */}
      {activeTab === 'profil' && (
        <div className="space-y-6 animate-fade-in">

          {/* Form Info Profil & Visibility Toggle */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Informasi Pengguna
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Lengkap */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400">Nama Lengkap</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Nama Anda"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                  />
                </div>

                {/* Nomor WhatsApp */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400">Nomor WhatsApp</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                  />
                </div>

                {/* Email (Readonly Verified) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-400">Alamat Email</label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Email kamu udah diverifikasi
                    </span>
                  </div>
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    readOnly
                    disabled
                    className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              {/* Toggle Visibilitas Publik */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Tampilin nama saya di publik</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Jika dimatikan, nama Anda akan disensor (contoh: Gh****ng) pada halaman Leaderboard dan Ulasan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(!showPublicName)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    showPublicName ? 'bg-blue-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      showPublicName ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-2">
                {saveProfileSuccess && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                    <Check className="w-4 h-4" /> Perubahan profil berhasil disimpan!
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="ml-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: KEAMANAN */}
      {activeTab === 'keamanan' && (
        <div className="space-y-6 animate-fade-in">
          {/* Akun Tertaut (Google Only) */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Akun Tertaut
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Koneksi otentikasi login resmi Entong Store.
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-2 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Google Account</h4>
                  <p className="text-[11px] text-slate-400">{currentUser?.email || 'Terkoneksi'}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung
              </span>
            </div>
          </div>

          {/* Form Ubah Password */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl">
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Ubah Password
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Amankan akun Anda dengan password kombinasi yang kuat.
                </p>
              </div>

              {passwordError && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Password berhasil diperbarui!</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400">Password Saat Ini (Opsional)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400">Password Baru</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Minimal 6 karakter"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-400">Konfirmasi Password Baru</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Ulangi password baru"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-2xl text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>Perbarui Password</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PERANGKAT */}
      {activeTab === 'perangkat' && (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Perangkat & Sesi Aktif
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Daftar sesi browser dan perangkat yang sedang terhubung ke akun Anda.
            </p>
          </div>

          <div className="p-5 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-500 shrink-0">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{browserName} on {osName}</h4>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold rounded-md border border-emerald-500/20">
                    Sesi Ini
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isMobile ? 'Perangkat Mobile' : 'Perangkat Komputer / Desktop'} • Aktif Sekarang
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout && logout()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-700 cursor-pointer active:scale-95"
            >
              Keluar Sesi
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: NOTIFIKASI */}
      {activeTab === 'notifikasi' && (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Preferensi Notifikasi
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Atur bagaimana Anda menerima pembaruan terkait status pesanan dan layanan.
            </p>
          </div>

          <div className="space-y-4">
            {/* Toggle 1: Notifikasi Pengiriman */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Notifikasi Pengiriman</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pemberitahuan saat item atau layanan joko Anda selesai diproses oleh admin/staff.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleNotif('delivery', !notifDelivery)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  notifDelivery ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    notifDelivery ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Pengingat Pesanan */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Pengingat Pesanan</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pengingat status pembayaran tertunda dan informasi instruksi in-game gift.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleNotif('reminder', !notifReminder)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  notifReminder ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    notifReminder ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: Notifikasi Membership */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">Notifikasi Promo & Membership</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Informasi diskon eksklusif dan event cashback flash sale di Entong Store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleNotif('membership', !notifMembership)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  notifMembership ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    notifMembership ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
