import React, { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, syncUserToFirestore } from "../../lib/firebase";
import { useApp } from "../../context/AppContext";
import { UserProfile } from "../../types";

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
  isStandalone?: boolean;
}

export function AuthModal({ isOpen = true, onClose, isStandalone = false }: Props) {
  const { setCurrentUser, login } = useApp();
  const [activeTab, setActiveTab] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userData = await syncUserToFirestore(user);
      if (userData) {
        localStorage.setItem("entong_active_user", JSON.stringify(userData));
        if (typeof setCurrentUser === "function") setCurrentUser(userData as UserProfile);
        
        // Cek Role dan Redirect
        const isStaff = userData.isStaff === true || 
                       ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes((userData.role || '').toString().toUpperCase());
        if (isStaff) {
            window.location.href = '/';
        }
      }
      if (onClose) onClose();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setErrorMsg(err?.message || "Gagal masuk dengan Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const trimmedInput = identifier.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedInput || !trimmedPassword) {
      setErrorMsg("Mohon isi semua bidang yang diperlukan.");
      return;
    }

    setLoading(true);

    try {
      if (activeTab === "LOGIN") {
        const result = await login(trimmedInput, trimmedPassword);
        if (!result.success) {
          setErrorMsg(result.error || "Username/Email atau Password salah.");
          setLoading(false);
          return;
        }
        if (onClose) {
          onClose();
        } else {
          window.location.href = "/";
        }
      } else {
        if (trimmedPassword.length < 6) {
          setErrorMsg("Password minimal 6 karakter.");
          setLoading(false);
          return;
        }
        const targetEmail = trimmedInput.includes("@") ? trimmedInput : `${trimmedInput}@entongstore.com`;
        const cred = await createUserWithEmailAndPassword(auth, targetEmail, trimmedPassword);
        const userData = await syncUserToFirestore(cred.user, trimmedInput);
        if (userData) {
          localStorage.setItem("entong_active_user", JSON.stringify(userData));
          if (typeof setCurrentUser === "function") setCurrentUser(userData as UserProfile);
        }
        if (onClose) onClose();
      }
    } catch (err: any) {
      console.error("Auth action error:", err);
      if (err.code === "auth/email-already-in-use") {
        setErrorMsg("Akun sudah terdaftar. Silakan pindah ke tab Masuk.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setErrorMsg("Username/Email atau Password salah.");
      } else {
        setErrorMsg(err.message || "Gagal memproses autentikasi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className={`w-full max-w-[400px] bg-[#121212] border border-[#2a2a2a] rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col relative p-6 sm:p-8 animate-in zoom-in-95 duration-200 ${isStandalone ? "my-auto shadow-2xl" : ""}`}>

      {/* CLOSE BUTTON */}
      {onClose && !isStandalone && (
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#1e1e1e] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4"/>
        </button>
      )}

      {/* HEADER */}
      <div className="text-center mb-6 mt-2">
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Masuk ke Akun</h2>
        <p className="text-[13px] text-gray-400 leading-relaxed px-2">
          Kamu bisa langsung masuk pakai Google, atau email & password
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* GOOGLE BUTTON */}
      <button 
        type="button" 
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full py-3.5 px-4 bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#333] rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-white transition-colors mb-6 cursor-pointer disabled:opacity-50"
      >
        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
        Masuk dengan Google
      </button>

      {/* DIVIDER */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-[#2a2a2a]"></div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Atau</span>
        <div className="h-px flex-1 bg-[#2a2a2a]"></div>
      </div>

      {/* PILL TABS */}
      <div className="flex bg-[#1e1e1e] p-1 rounded-full mb-6 border border-[#2a2a2a]">
        <button
          type="button"
          onClick={() => { setActiveTab("LOGIN"); setErrorMsg(""); }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
            activeTab === "LOGIN" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
          }`}
        >
          Masuk
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("REGISTER"); setErrorMsg(""); }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
            activeTab === "REGISTER" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
          }`}
        >
          Daftar
        </button>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-bold text-white mb-2 block">
            Nomor WhatsApp, Username, atau Email
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Contoh: budi_gamer"
            className="w-full bg-[#f4f4f5] text-gray-900 font-medium text-sm px-4 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-white">Password</label>
            {activeTab === "LOGIN" && (
              <button type="button" className="text-[11px] font-bold text-gray-400 hover:text-white transition-colors">
                Lupa password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#f4f4f5] text-gray-900 font-medium text-sm px-4 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] mt-2 uppercase tracking-wide cursor-pointer disabled:opacity-50"
        >
          {loading ? "Memproses..." : activeTab === "LOGIN" ? "Masuk" : "Daftar"}
        </button>
      </form>

      {onClose && (
        <button 
          onClick={onClose}
          className="mt-6 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <span className="text-blue-500">↑</span> Balik ke beranda
        </button>
      )}

    </div>
  );

  if (isStandalone) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0F19] p-4">
        {modalContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {modalContent}
    </div>
  );
}

export default AuthModal;
