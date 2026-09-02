export const formatRelativeTime = (timestamp: any) => {
  if (!timestamp) return "Baru saja";
  
  try {
    let date;
    if (typeof timestamp?.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      return "Baru saja";
    }

    if (isNaN(date.getTime())) return "Baru saja";

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 0 || diffInSeconds < 60) return "Baru saja";
    if (diffInSeconds < 120) return "Semenit yang lalu";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit yang lalu`;
    if (diffInSeconds < 7200) return "1 jam yang lalu";
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam yang lalu`;
    if (diffInSeconds < 172800) return "Kemarin";
    
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch (err) {
    console.warn("formatRelativeTime fallback error:", err);
    return "Baru saja";
  }
};

