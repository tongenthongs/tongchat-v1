import React, { useEffect, useState } from 'react';
import { applyActionCode } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, ShieldCheck, Mail, ArrowRight, RefreshCw, Home } from 'lucide-react';

interface VerifyEmailPageProps {
  onBackToHome: () => void;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ onBackToHome }) => {
  const { currentUser } = useApp();
  const [status, setStatus] = useState<'loading' | 'success' | 'expired' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const processVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const oobCode = urlParams.get('oobCode') || urlParams.get('code');
      const emailParam = urlParams.get('email');
      const tokenParam = urlParams.get('token');

      if (emailParam) {
        setResendEmail(emailParam);
      } else if (currentUser?.email) {
        setResendEmail(currentUser.email);
      }

      // If oobCode is present (Official Firebase Action Code)
      if (oobCode) {
        try {
          await applyActionCode(auth, oobCode);
          
          // Reload Firebase currentUser if active
          if (auth.currentUser) {
            await auth.currentUser.reload();
            if (auth.currentUser.uid) {
              try {
                await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                  emailVerified: true,
                  updatedAt: new Date().toISOString()
                });
              } catch (dbErr) {
                console.warn("Could not sync emailVerified to firestore doc:", dbErr);
              }
            }
          }

          setStatus('success');
        } catch (err: any) {
          console.error("Apply action code error:", err);
          const code = err?.code || '';
          if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
            setStatus('expired');
            setErrorMessage('Link verifikasi sudah kadaluarsa atau tidak valid.');
          } else {
            setStatus('error');
            setErrorMessage(err?.message || 'Gagal memverifikasi email. Silakan coba lagi.');
          }
        }
        return;
      }

      // Fallback: If custom verification token is provided
      if (tokenParam) {
        try {
          if (auth.currentUser) {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              emailVerified: true,
              updatedAt: new Date().toISOString()
            });
          }
          setStatus('success');
        } catch (err: any) {
          setStatus('expired');
          setErrorMessage('Link verifikasi sudah kadaluarsa.');
        }
        return;
      }

      // No code provided in URL
      setStatus('expired');
      setErrorMessage('Kode verifikasi tidak ditemukan pada tautan ini.');
    };

    processVerification();
  }, [currentUser]);

  const handleResend = async () => {
    const targetEmail = resendEmail.trim() || currentUser?.email || '';
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('Masukkan alamat email yang valid.');
      return;
    }

    setIsResending(true);
    setResendSuccess(false);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          name: currentUser?.name || currentUser?.username || 'Pelanggan',
          originUrl: window.location.origin
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResendSuccess(true);
      } else {
        alert(data.message || 'Gagal mengirim ulang email verifikasi.');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim ulang verifikasi.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0F19] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background radial highlight */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-[#131926] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 mb-3 shadow-lg shadow-blue-500/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">ENTONG STORE</h1>
          <p className="text-xs font-semibold text-blue-400 mt-0.5">Sistem Verifikasi Akun Resmi</p>
        </div>

        {/* 1. LOADING STATE */}
        {status === 'loading' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h2 className="text-base font-bold text-white">Memverifikasi email...</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Mohon tunggu sebentar, kami sedang memvalidasi tautan verifikasi akun Entong Store Anda.
              </p>
            </div>
          </div>
        )}

        {/* 2. SUCCESS STATE */}
        {status === 'success' && (
          <div className="text-center py-4 space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-white">Email Berhasil Diverifikasi!</h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                Akun Entong Store Anda kini terlindungi. Anda dapat menikmati akses penuh dan melakukan reset password dengan aman jika lupa.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onBackToHome}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition shadow-lg shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Menuju Dashboard Entong Store</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 3. EXPIRED / INVALID / ERROR STATE */}
        {(status === 'expired' || status === 'error') && (
          <div className="text-center py-4 space-y-5">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-white">Tautan Tidak Valid atau Kadaluarsa</h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                {errorMessage || 'Link verifikasi sudah kadaluarsa atau tidak valid.'}
              </p>
            </div>

            {/* Resend Section */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-left space-y-3">
              <label className="text-[11px] font-bold text-slate-300 block">
                Kirim Ulang Link Verifikasi Resmi:
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Masukkan alamat email Anda"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {resendSuccess && (
                <p className="text-[11px] font-semibold text-emerald-400">
                  ✓ Link verifikasi baru berhasil dikirim! Silakan periksa Kotak Masuk (Inbox) email Anda.
                </p>
              )}

              <button
                onClick={handleResend}
                disabled={isResending}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                <span>{isResending ? 'Mengirim...' : 'Kirim Ulang Verifikasi'}</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={onBackToHome}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Kembali ke Beranda</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
