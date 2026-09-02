import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    __BUILD_HASH__?: string | number;
  }
}

export const AutoUpdateHandler: React.FC = () => {
  const currentVersionRef = useRef<string | number | null>(null);
  const isReloadingRef = useRef<boolean>(false);

  const clearCacheAndReload = async () => {
    if (isReloadingRef.current) return;
    isReloadingRef.current = true;

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (err) {
      console.error('Error clearing caches:', err);
    } finally {
      window.location.reload();
    }
  };

  useEffect(() => {
    // 1. Global ChunkLoadError Handler for Vercel deployment chunk mismatches
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed')
      ) {
        console.warn('⚠️ ChunkLoadError detected due to new Vercel deployment. Auto reloading app...');
        clearCacheAndReload();
      }
    };

    window.addEventListener('error', handleGlobalError);

    // 2. Service Worker Controller Change Listener
    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        console.log('🔄 New Service Worker activated! Auto updating...');
        clearCacheAndReload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      // Register or update SW
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updated Service Worker every 30 seconds
          setInterval(() => {
            registration.update().catch(() => {});
          }, 30000);
        })
        .catch((err) => {
          console.warn('SW registration failed:', err);
        });
    }

    // 3. Continuous Version & ETag Poller
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (res.ok) {
          const data = await res.json();
          const serverVersion = data.buildTime || data.version || data.buildHash;

          if (currentVersionRef.current === null) {
            currentVersionRef.current = serverVersion;
            window.__BUILD_HASH__ = serverVersion;
          } else if (serverVersion && serverVersion !== currentVersionRef.current) {
            console.log(`🚀 New deployment version detected (${serverVersion}). Auto reloading app...`);
            clearCacheAndReload();
          }
        }
      } catch (err) {
        // Silent catch for temporary offline/network issues
      }
    };

    // Initial check
    checkVersion();

    // Poll version.json every 30 seconds
    const intervalId = setInterval(checkVersion, 30000);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      clearInterval(intervalId);
    };
  }, []);

  return null;
};
