import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import './index.css';

// Global Chunk Load Error Handler (Vite Dynamic Import Recovery)
if (typeof window !== 'undefined') {
  const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
    const error = 'error' in event ? event.error : (event as PromiseRejectionEvent).reason;
    const msg = (event instanceof ErrorEvent ? event.message : '') || (error?.message || error || '').toString();
    
    const isChunkError =
      msg.includes('Loading chunk') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('import() failed');

    if (isChunkError) {
      try {
        const lastReload = Number(sessionStorage.getItem('chunk_reload_lock') || 0);
        if (Date.now() - lastReload > 15000) {
          sessionStorage.setItem('chunk_reload_lock', String(Date.now()));
          console.warn('Chunk load error terdeteksi. Merefresh bundle...');
          window.location.reload();
        }
      } catch (err) {
        // Fallback reload
      }
    }
  };

  window.addEventListener('error', handleChunkError);
  window.addEventListener('unhandledrejection', handleChunkError);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}


