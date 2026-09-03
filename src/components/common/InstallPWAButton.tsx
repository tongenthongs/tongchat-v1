import React, { useEffect, useState, useCallback } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'entong_pwa_install_dismissed_at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac
  return /Mac/.test(ua) && (navigator as any).maxTouchPoints > 1;
};

const isInStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as any).standalone === true;
  return standalone || iosStandalone;
};

export const InstallPWAButton: React.FC<{ variant?: 'navbar' | 'floating' }> = ({
  variant = 'navbar'
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);
  const [showIOSHint, setShowIOSHint] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isInStandalone()) {
      setInstalled(true);
      return;
    }

    const lastDismiss = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (lastDismiss && Date.now() - lastDismiss < DISMISS_TTL_MS) {
      setVisible(false);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
      try { localStorage.removeItem(DISMISS_KEY); } catch {}
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    if (isIOS()) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // Hanya tampilkan instruksi manual untuk iOS yang tidak support beforeinstallprompt
      if (isIOS()) {
        setShowIOSHint(true);
      }
      return;
    }
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setVisible(false);
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
      if (isIOS()) setShowIOSHint(true);
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
    setShowIOSHint(false);
  }, []);

  if (installed) return null;

  if (variant === 'floating') {
    // Hanya tampilkan jika ada deferredPrompt (browser support) atau iOS
    if (!visible || (!deferredPrompt && !isIOS())) return null;
    return (
      <>
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[1050] w-[calc(100%-1.5rem)] max-w-md pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-blue-900/30 backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-white truncate">Install Entong</div>
              <div className="text-[10px] text-slate-400 truncate">Pasang aplikasi untuk akses cepat & notif HP</div>
            </div>
            <button
              onClick={triggerInstall}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-400/40 transition-colors"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              aria-label="Tutup"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {showIOSHint && (
          <div className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowIOSHint(false)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Share className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black text-white">Install di iPhone/iPad</h3>
              </div>
              <ol className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <li className="flex gap-2"><span className="text-blue-400 font-black">1.</span>Tekan tombol <Share className="w-3 h-3 inline" /> <b>Share</b> di Safari.</li>
                <li className="flex gap-2"><span className="text-blue-400 font-black">2.</span>Pilih <b>Add to Home Screen</b> <Plus className="w-3 h-3 inline" />.</li>
                <li className="flex gap-2"><span className="text-blue-400 font-black">3.</span>Konfirmasi dengan <b>Add</b>.</li>
              </ol>
              <button onClick={() => setShowIOSHint(false)} className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-black">OK, Mengerti</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Tombol navbar: hanya tampilkan jika ada deferredPrompt atau iOS
  if (!deferredPrompt && !isIOS()) return null;

  return (
    <button
      onClick={triggerInstall}
      title="Install aplikasi ke HP"
      className="p-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-all shadow active:scale-95 flex items-center gap-1.5 cursor-pointer"
    >
      <Download className="w-4 h-4" />
      <span className="hidden lg:inline text-xs font-black">Install</span>
    </button>
  );
};

export default InstallPWAButton;
