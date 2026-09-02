import { useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function triggerForceSystemRefresh(adminEmail?: string) {
  try {
    if (db) {
      await setDoc(doc(db, 'system_settings', 'app_version'), {
        version: `${Date.now()}`,
        updatedAt: serverTimestamp(),
        triggeredBy: adminEmail || 'Admin'
      }, { merge: true });
    }
    return true;
  } catch (err) {
    console.error('Failed to trigger system refresh signal:', err);
    return false;
  }
}

export const useAutoUpdateWatcher = () => {
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // 1. Abaikan jika sedang dijalankan di localhost / Google AI Studio Preview / iframe
    const isDevOrPreview = 
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' ||
       window.location.hostname.includes('127.0.0.1') ||
       window.location.hostname.includes('aistudio.google.com') ||
       window.location.hostname.includes('google') ||
       window.self !== window.top);

    if (isDevOrPreview) {
      return;
    }

    const checkAppVersion = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const timestamp = Date.now();
        const res = await fetch(`/version.json?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });

        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) return;

        const data = await res.json();
        const serverVersion = String(data.version || '').trim();
        if (!serverVersion) return;

        const currentLocalVersion = localStorage.getItem('app_build_version') || localStorage.getItem('app_active_version');

        if (!currentLocalVersion) {
          localStorage.setItem('app_build_version', serverVersion);
          localStorage.setItem('app_active_version', serverVersion);
        } else if (currentLocalVersion !== serverVersion) {
          console.log(`🚀 Deployment baru terdeteksi: ${currentLocalVersion} -> ${serverVersion}. Reloading...`);
          localStorage.setItem('app_build_version', serverVersion);
          localStorage.setItem('app_active_version', serverVersion);

          if ('caches' in window) {
            try {
              const cacheKeys = await caches.keys();
              await Promise.all(cacheKeys.map(k => caches.delete(k)));
            } catch (cacheErr) {
              console.warn('Cache clear warning:', cacheErr);
            }
          }

          window.location.reload();
        }
      } catch (err) {
        // Silent catch jaringan
      } finally {
        isCheckingRef.current = false;
      }
    };

    const initialTimer = setTimeout(checkAppVersion, 2000);
    const intervalTimer = setInterval(checkAppVersion, 20000);

    const onTabActive = () => {
      if (document.visibilityState === 'visible') {
        checkAppVersion();
      }
    };

    window.addEventListener('focus', checkAppVersion);
    document.addEventListener('visibilitychange', onTabActive);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('focus', checkAppVersion);
      document.removeEventListener('visibilitychange', onTabActive);
    };
  }, []);
};



