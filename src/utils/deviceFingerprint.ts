export const getDeviceHwid = (): string => {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 'hwid_ssr_default';
    }

    let canvasHash = '';
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("EntongStoreHWID_2026", 2, 15);
        canvasHash = canvas.toDataURL().slice(-50);
      }
    } catch (err) {
      canvasHash = 'canvas_blocked';
    }

    const screenWidth = window.screen?.width || 1920;
    const screenHeight = window.screen?.height || 1080;
    const colorDepth = window.screen?.colorDepth || 24;
    const screenRes = `${screenWidth}x${screenHeight}x${colorDepth}`;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'desktop_agent';
    const timeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Jakarta';
    const hardwareConcurrency = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    
    const rawString = `${canvasHash}-${screenRes}-${userAgent}-${timeZone}-${hardwareConcurrency}`;
    
    // Simple fast hashing
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `hwid_${Math.abs(hash)}`;
  } catch (e) {
    const fallbackWidth = typeof window !== 'undefined' && window.screen?.width ? window.screen.width : 1920;
    const fallbackHw = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
    return `hwid_fallback_${fallbackWidth}_${fallbackHw}`;
  }
};

export const formatTimerHHMMSS = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};
