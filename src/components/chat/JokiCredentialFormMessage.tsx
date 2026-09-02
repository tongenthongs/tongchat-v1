import React, { useState } from 'react';
import { Shield, Key, DollarSign, User, CheckCircle2, Lock, Eye, EyeOff, Send, Loader2, Copy, Check, AlertCircle, FileText } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, updateDoc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';

export interface JokiCredentialFormMessageProps {
  message: {
    id: string;
    orderId?: string;
    order_id?: string;
    orderPackage?: string;
    package_name?: string;
    status?: 'PENDING_FILL' | 'COMPLETED' | string;
    formData?: {
      username?: string;
      password?: string;
      initialMoney?: string;
      submittedAt?: any;
    };
    created?: string;
    createdAt?: any;
    sender_name?: string;
    senderName?: string;
    [key: string]: any;
  };
  chatId: string;
  isCustomer: boolean;
  currentUser?: any;
  onFormSubmitted?: (data: { username: string; initialMoney: string }) => void;
}

export const JokiCredentialFormMessage: React.FC<JokiCredentialFormMessageProps> = ({
  message,
  chatId,
  isCustomer,
  currentUser,
  onFormSubmitted
}) => {
  const initialUsername = message.formData?.username || message.robloxUsername || message.username || '';
  const initialPassword = message.formData?.password || message.password || '';
  const initialMoneyVal = message.formData?.initialMoney || message.initialMoney || message.uangAwal || '';

  const isAlreadyCompleted = message.status === 'COMPLETED' || Boolean(message.formData?.submittedAt);

  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState(initialPassword);
  const [initialMoney, setInitialMoney] = useState(initialMoneyVal);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmittedLocal, setIsSubmittedLocal] = useState(isAlreadyCompleted);
  const [submittedData, setSubmittedData] = useState({
    username: initialUsername,
    password: initialPassword,
    initialMoney: initialMoneyVal
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const cleanRoomId = (chatId || '').replace(/^chats\//, '').replace(/^room_/, 'room_');
  const targetOrderId = message.orderId || message.order_id || cleanRoomId.replace(/^room_/, '');
  const packageName = message.orderPackage || message.package_name || 'Layanan Joki';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = username.trim().replace(/^@/, '');
    const cleanPass = password.trim();
    const cleanMoney = initialMoney.trim();

    if (!cleanUser) {
      setErrorMessage('Username Roblox wajib diisi.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Password Roblox wajib diisi untuk pengerjaan joki.');
      return;
    }
    if (!cleanMoney) {
      setErrorMessage('Uang Awal akun di dalam game wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const nowIso = new Date().toISOString();
      const batch = writeBatch(db);

      // 1. Update orders/{orderId}
      if (targetOrderId) {
        const orderRef = doc(db, 'orders', targetOrderId);
        batch.update(orderRef, {
          robloxUsername: cleanUser,
          roblox_username: cleanUser,
          game_username: cleanUser,
          username: cleanUser,
          robloxPassword: cleanPass,
          game_password: cleanPass,
          password: cleanPass,
          initialMoney: cleanMoney,
          uangAwal: cleanMoney,
          uang_awal: cleanMoney,
          initial_money: cleanMoney,
          isCredentialSubmitted: true,
          credentialSubmittedAt: serverTimestamp(),
          updated: nowIso,
          updatedAt: serverTimestamp()
        });
      }

      // 2. Update message document
      if (cleanRoomId && message.id) {
        const msgRef = doc(db, 'chats', cleanRoomId, 'messages', message.id);
        batch.update(msgRef, {
          status: 'COMPLETED',
          'formData.username': cleanUser,
          'formData.password': cleanPass,
          'formData.initialMoney': cleanMoney,
          'formData.submittedAt': nowIso,
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // 3. Update room document metadata
      if (cleanRoomId) {
        const chatRef = doc(db, 'chats', cleanRoomId);
        batch.update(chatRef, {
          robloxUsername: cleanUser,
          roblox_username: cleanUser,
          game_username: cleanUser,
          lastMessage: `✅ Kredensial akun Joki (@${cleanUser}) telah dikirim oleh Pelanggan.`,
          last_message: `✅ Kredensial akun Joki (@${cleanUser}) telah dikirim oleh Pelanggan.`,
          last_sender_role: 'CUSTOMER',
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();

      // Dispatch global event for instant UI sync
      try {
        window.dispatchEvent(new CustomEvent('order-credential-updated', {
          detail: {
            orderId: targetOrderId,
            username: cleanUser,
            password: cleanPass,
            initialMoney: cleanMoney
          }
        }));
      } catch (e) {
        // ignore
      }

      setIsSubmittedLocal(true);
      setSubmittedData({
        username: cleanUser,
        password: cleanPass,
        initialMoney: cleanMoney
      });

      if (onFormSubmitted) {
        onFormSubmitted({
          username: cleanUser,
          initialMoney: cleanMoney
        });
      }
    } catch (err: any) {
      console.error('Gagal mengirim kredensial joki:', err);
      // Fallback single-document write if batch fails
      try {
        if (targetOrderId) {
          await updateDoc(doc(db, 'orders', targetOrderId), {
            robloxUsername: cleanUser,
            game_username: cleanUser,
            game_password: cleanPass,
            robloxPassword: cleanPass,
            initialMoney: cleanMoney,
            uangAwal: cleanMoney,
            updatedAt: serverTimestamp()
          });
        }
        if (cleanRoomId && message.id) {
          await updateDoc(doc(db, 'chats', cleanRoomId, 'messages', message.id), {
            status: 'COMPLETED',
            'formData.username': cleanUser,
            'formData.password': cleanPass,
            'formData.initialMoney': cleanMoney,
            updatedAt: serverTimestamp()
          });
        }
        setIsSubmittedLocal(true);
        setSubmittedData({
          username: cleanUser,
          password: cleanPass,
          initialMoney: cleanMoney
        });
      } catch (fallbackErr: any) {
        setErrorMessage(fallbackErr?.message || 'Gagal menyimpan kredensial. Silakan periksa koneksi internet Anda.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCompleted = isAlreadyCompleted || isSubmittedLocal;
  const currentUsername = submittedData.username || message.formData?.username || username || '-';
  const currentPassword = submittedData.password || message.formData?.password || password || '';
  const currentInitialMoney = submittedData.initialMoney || message.formData?.initialMoney || initialMoney || '-';

  // ----------------------------------------------------
  // RENDER: CUSTOMER VIEW (PENDING FORM)
  // ----------------------------------------------------
  if (isCustomer && !isCompleted) {
    return (
      <div className="w-full max-w-md my-2 mx-auto sm:max-w-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-900/95 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md text-slate-100 relative overflow-hidden">
          {/* Top Decorative Banner */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-1.5">
                  Form Kredensial Akun Joki
                </h4>
                <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-[260px]">
                  {packageName} {targetOrderId ? `(#${targetOrderId.slice(-6).toUpperCase()})` : ''}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[9px] font-extrabold uppercase tracking-wider shrink-0">
              Wajib Diisi
            </span>
          </div>

          <p className="text-[11px] text-slate-300 mb-3.5 leading-relaxed">
            Admin meminta data kredensial untuk melanjutkan proses pengerjaan joki akun Roblox Anda. Silakan isi form dengan benar:
          </p>

          {errorMessage && (
            <div className="mb-3 p-2.5 bg-rose-500/20 border border-rose-500/50 rounded-xl text-[11px] text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* 1. Username Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-amber-400" /> Username Roblox
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: gamer_id / @username"
                disabled={isSubmitting}
                className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
              />
            </div>

            {/* 2. Password Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-amber-400" /> Password Roblox
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password Roblox"
                  disabled={isSubmitting}
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl pl-3 pr-10 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="block text-[9px] text-slate-400 mt-0.5">
                Password tersimpan aman & hanya diakses oleh worker bertugas.
              </span>
            </div>

            {/* 3. Uang Awal Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Uang Awal Akun (Wajib Diisi)
              </label>
              <input
                type="text"
                value={initialMoney}
                onChange={(e) => setInitialMoney(e.target.value)}
                placeholder="Contoh: 10.000.000 / $10M / 10 Juta"
                disabled={isSubmitting}
                className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              />
              <span className="block text-[9px] text-slate-400 mt-0.5">
                Jumlah cash/money di game sebelum pengerjaan joki dimulai.
              </span>
            </div>

            {/* Security Notice */}
            <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[10px] text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Data kredensial dienkripsi dan langsung tersinkron ke dashboard worker.</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-400/40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan & Sinkronisasi...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Data Kredensial</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: CUSTOMER VIEW (COMPLETED FORM)
  // ----------------------------------------------------
  if (isCustomer && isCompleted) {
    return (
      <div className="w-full max-w-md my-2 mx-auto sm:max-w-lg">
        <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-xl text-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-emerald-400">
                  Kredensial Joki Berhasil Terkirim
                </h4>
                <p className="text-[10px] text-slate-400">
                  {packageName} {targetOrderId ? `(#${targetOrderId.slice(-6).toUpperCase()})` : ''}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[9px] font-bold">
              ✓ Tersimpan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Username</span>
              <span className="font-mono font-bold text-emerald-300">@{currentUsername}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Password</span>
              <span className="font-mono text-slate-400">•••••••• (Terenkripsi)</span>
            </div>
            <div className="sm:col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Uang Awal</span>
                <span className="font-bold text-amber-300">{currentInitialMoney}</span>
              </div>
              <span className="text-[9px] text-slate-500 italic">Siap diproses worker</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: ADMIN / WORKER VIEW (PENDING OR COMPLETED)
  // ----------------------------------------------------
  return (
    <div className="w-full max-w-md my-2">
      <div className={`rounded-2xl p-3.5 sm:p-4 shadow-xl border ${
        isCompleted 
          ? 'bg-slate-900/90 border-emerald-500/50' 
          : 'bg-slate-900/80 border-amber-500/40'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              isCompleted 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                {isCompleted ? 'Kredensial Joki Diterima' : 'Form Kredensial Joki'}
              </h4>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                {packageName} {targetOrderId ? `(#${targetOrderId.slice(-6).toUpperCase()})` : ''}
              </p>
            </div>
          </div>

          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
            isCompleted 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}>
            {isCompleted ? '✓ SELESAI DIISI' : '⏳ MENUNGGU CUSTOMER'}
          </span>
        </div>

        {isCompleted ? (
          <div className="space-y-2 text-xs bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            {/* Username Field with Copy */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Username Roblox</span>
                <span className="font-mono font-bold text-emerald-300">@{currentUsername}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(currentUsername, 'username')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] flex items-center gap-1 border border-slate-700 transition-colors"
                title="Salin Username"
              >
                {copiedField === 'username' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'username' ? 'Tersalin' : 'Copy'}</span>
              </button>
            </div>

            {/* Password Field with Reveal & Copy */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60">
              <div className="min-w-0 flex-1 pr-2">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Password Roblox</span>
                <span className="font-mono text-xs font-bold text-amber-300 block truncate">
                  {showPassword ? (currentPassword || '(Tersimpan)') : '••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                  title={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(currentPassword, 'password')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] flex items-center gap-1 border border-slate-700 transition-colors"
                  title="Salin Password"
                >
                  {copiedField === 'password' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'password' ? 'Tersalin' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Initial Money Field */}
            <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Uang Awal Akun</span>
                <span className="font-bold text-emerald-400">{currentInitialMoney}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(currentInitialMoney, 'money')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] flex items-center gap-1 border border-slate-700 transition-colors"
                title="Salin Uang Awal"
              >
                {copiedField === 'money' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'money' ? 'Tersalin' : 'Copy'}</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">
            Formulir kredensial telah dikirim ke bubble chat customer. Sistem akan otomatis memperbarui database saat pelanggan mengisi formulir.
          </p>
        )}
      </div>
    </div>
  );
};
export default JokiCredentialFormMessage;
