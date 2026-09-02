import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck, Trash2, Sparkles } from 'lucide-react';
import { safeClearAllStorage } from '../../utils/safeStorage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo?: ErrorInfo | null;
  autoReloadSeconds: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  private timer: any = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    autoReloadSeconds: 1.5,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, autoReloadSeconds: 1.5 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRITICAL] System Error Captured by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });

    // Only auto-reload if it is strictly a chunk import error, and only once per 30s
    const msg = (error?.message || '').toString();
    const isChunkError =
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Loading chunk .* failed/i.test(msg) ||
      /ChunkLoadError/i.test(msg) ||
      /Importing a module script failed/i.test(msg);

    if (isChunkError) {
      try {
        const lastReload = Number(sessionStorage.getItem('chunk_reload_ts') || '0');
        const now = Date.now();
        if (now - lastReload > 30000) {
          sessionStorage.setItem('chunk_reload_ts', now.toString());
          if (this.timer) clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            this.handleAutoRecover();
          }, 1500);
        }
      } catch (e) {}
    }
  }

  public componentWillUnmount() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private handleAutoRecover = async () => {
    try {
      if (typeof window !== 'undefined') {
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        window.location.reload();
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  private handleReload = () => {
    if (this.timer) clearTimeout(this.timer);
    this.setState({ hasError: false, error: null });
    this.handleAutoRecover();
  };

  private handleCleanCacheAndReload = async () => {
    if (this.timer) clearTimeout(this.timer);
    try {
      safeClearAllStorage();

      if (typeof window !== 'undefined') {
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }

        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }

        window.location.href = '/';
      }
    } catch (err) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b141a] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 text-center font-sans">
          <div className="w-full max-w-md bg-[#111b21] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-[#00E676]/30 flex items-center justify-center text-[#00E676] mx-auto mb-4 shadow-lg shadow-[#00E676]/10 animate-pulse">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-black text-slate-100 mb-1 tracking-tight">Entong Store Auto-Recovery</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Sistem mendeteksi pembaruan versi dan secara otomatis memulihkan cache agar halaman terbuka normal.
            </p>

            <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 py-2 px-3 rounded-xl text-xs font-bold mb-5">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Memulihkan aplikasi otomatis dalam 1.5 detik...</span>
            </div>

            <div className="bg-[#1a2730] p-3.5 rounded-2xl border border-slate-700/60 text-left text-[11px] font-mono text-amber-300 mb-6 max-h-28 overflow-y-auto">
              <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Status Pemulihan:</span>
              </div>
              <p className="break-all opacity-90">
                {this.state.error?.message || 'Cache versi lama sedang dibersihkan secara otomatis'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00E676]/20 transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Pulihkan & Muat Ulang Sekarang</span>
              </button>

              <button
                type="button"
                onClick={this.handleCleanCacheAndReload}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold border border-rose-500/30 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Bersihkan Total Cache & Sesi</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

