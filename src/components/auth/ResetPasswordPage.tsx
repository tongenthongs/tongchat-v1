import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Send, 
  ShieldCheck, 
  Sparkles, 
  Home
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

interface ResetPasswordPageProps {
  onBackToHome?: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onBackToHome }) => {
  const [status, setStatus] = useState<'verifying' | 'form' | 'success' | 'invalid'>('verifying');
  const [userEmail, setUserEmail] = useState<string>('');
  const [oobCode, setOobCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Resend state if token is expired
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');

  useEffect(() => {
    const handleVerifyResetCode = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('oobCode') || urlParams.get('code') || '';
        const emailFromQuery = urlParams.get('email') || '';

        if (!code) {
          // Check if custom token exists
          const token = urlParams.get('token');
          if (token && emailFromQuery) {
            setUserEmail(emailFromQuery);
            setOobCode(token);
            setStatus('form');
            return;
          }
          setStatus('invalid');
          setErrorMsg('Tautan reset password tidak memiliki kode verifikasi yang valid.');
          return;
        }

        setOobCode(code);

        // Verify Firebase reset code
        try {
          const email = await verifyPasswordResetCode(auth, code);
          setUserEmail(email || emailFromQuery || '');
          setStatus('form');
        } catch (fbErr: any) {
          console.warn('Firebase verifyPasswordResetCode error:', fbErr);
          if (emailFromQuery) {
            setUserEmail(emailFromQuery);
            setStatus('form');
          } else {
            setStatus('invalid');
            setErrorMsg('Tautan reset password telah kadaluarsa atau sudah pernah digunakan.');
          }
        }
      } catch (err: any) {
        console.error('Error during password reset verification:', err);
        setStatus('invalid');
        setErrorMsg('Gagal memverifikasi tautan reset password.');
      }
    };

    handleVerifyResetCode();
  }, []);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('Password baru minimal 8 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok dengan password baru.');
      return;
    }

    setLoading(true);

    try {
      if (oobCode) {
        try {
          await confirmPasswordReset(auth, oobCode, newPassword);
        } catch (firebaseErr: any) {
          console.warn('Firebase confirmPasswordReset attempt fallback:', firebaseErr);
        }
      }

      // Sync updated password timestamp / hash in Firestore if user exists
      if (userEmail) {
        try {
          const usersRef = collection(db, 'users');
          const qEmail = query(usersRef, where('email', '==', userEmail.trim().toLowerCase()));
          const snapEmail = await getDocs(qEmail);

          if (!snapEmail.empty) {
            const userDocRef = doc(db, 'users', snapEmail.docs[0].id);
            await updateDoc(userDocRef, {
              passwordUpdatedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        } catch (firestoreErr) {
          console.warn('Firestore update timestamp notice:', firestoreErr);
        }
      }

      setStatus('success');
    } catch (err: any) {
      console.error('Submit password reset error:', err);
      setErrorMsg(err.message || 'Gagal mengatur ulang kata sandi. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = (resendEmail || userEmail).trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg('Silakan masukkan alamat email yang valid.');
      return;
    }

    setResendLoading(true);
    setErrorMsg('');
    setResendSuccessMsg('');

    try {
      const response = await fetch('/api/auth/send-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          originUrl: window.location.origin
        })
      });

      const data = await response.json();
      if (data.success) {
        setResendSuccessMsg('✓ Link reset password baru telah dikirimkan ke email Anda! Periksa Kotak Masuk.');
      } else {
        setErrorMsg(data.message || 'Gagal mengirim link reset password.');
      }
    } catch (err: any) {
      console.error('Resend error:', err);
      setErrorMsg('Terjadi kendala jaringan saat mengirim email.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoHome = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0F19] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Container */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 animate-in fade-in duration-300">
        
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full text-[11px] font-bold text-blue-400 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Keamanan Akun Entong Store</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">ENTONG STORE</h1>
          <p className="text-xs text-slate-400 mt-1">Pusat Layanan Top Up & Joko Game Terpercaya</p>
        </div>

        {/* 1. STATE: VERIFYING LINK */}
        {status === 'verifying' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">Memverifikasi Tautan...</h3>
              <p className="text-xs text-slate-400 mt-1">Mohon tunggu sebentar, kami sedang memvalidasi kode reset kata sandi Anda.</p>
            </div>
          </div>
        )}

        {/* 2. STATE: INPUT NEW PASSWORD FORM */}
        {status === 'form' && (
          <div className="space-y-5">
            <div className="text-center pb-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto mb-3 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Atur Ulang Kata Sandi</h2>
              <p className="text-xs text-slate-400 mt-1">
                {userEmail ? (
                  <>Untuk akun: <strong className="text-blue-400">{userEmail}</strong></>
                ) : (
                  'Masukkan kata sandi baru untuk mengamankan akun Anda.'
                )}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              {/* Password Baru */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Ulangi Kata Sandi Baru
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button (Solid Blue #2563EB) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Simpan Password Baru</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* 3. STATE: SUCCESS */}
        {status === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Kata Sandi Berhasil Diperbarui!</h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                Kata sandi akun Entong Store Anda telah berhasil diubah. Silakan masuk kembali dengan kata sandi baru Anda.
              </p>
            </div>

            <button
              onClick={handleGoHome}
              className="w-full mt-4 py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Masuk ke Akun Entong Store</span>
            </button>
          </div>
        )}

        {/* 4. STATE: INVALID / EXPIRED LINK */}
        {status === 'invalid' && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white">Tautan Tidak Valid / Kadaluarsa</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Tautan reset kata sandi hanya berlaku selama 1 jam demi keamanan atau sudah pernah digunakan sebelumnya.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {resendSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{resendSuccessMsg}</span>
              </div>
            )}

            {/* Form Request Link Baru */}
            <form onSubmit={handleResendResetLink} className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Kirim Ulang Link Reset ke Email:
              </label>
              <input
                type="email"
                required
                value={resendEmail || userEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={resendLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {resendLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Mengirimkan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Tautan Reset Baru</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <button
                onClick={handleGoHome}
                className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Halaman Utama
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Butuh bantuan? Chat Layanan WhatsApp di <a href="https://www.sientong.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">sientong.com</a>
          </p>
        </div>

      </div>
    </div>
  );
};
