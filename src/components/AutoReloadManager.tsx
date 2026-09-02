import { useEffect } from 'react';

export const AutoReloadManager = () => {
  useEffect(() => {
    // Graceful background handler for stale chunk recovery without aggressive loops
    if (typeof window === 'undefined') return;

    let lastChunkReloadTime = 0;
    const handleChunkError = (e: any) => {
      const msg = (e?.message || e?.reason?.message || e?.reason || '').toString();
      if (
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed')
      ) {
        const now = Date.now();
        if (now - lastChunkReloadTime > 20000) {
          lastChunkReloadTime = now;
          console.warn('⚠️ ChunkLoadError detected. Refreshing app gracefully...');
          try {
            window.location.reload();
          } catch (err) {}
        }
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return null;
};

