/**
 * Helper pengecekan jam operasional toko Entong Store (11.00 - 23.00 WIB)
 * Zona Waktu: Asia/Jakarta (WIB / UTC+7)
 */
export const checkStoreOperatingStatus = () => {
  // Ambil waktu saat ini dalam format zona WIB (Asia/Jakarta)
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'Asia/Jakarta', 
    hour12: false, 
    hour: 'numeric', 
    minute: 'numeric' 
  };
  const formatter = new Intl.DateTimeFormat([], options);
  const parts = formatter.formatToParts(now);

  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);

  // Jam operasional: 11.00 WIB s/d 23.00 WIB
  const isOpen = hour >= 11 && hour < 23;

  return {
    isOpen,
    statusText: isOpen ? 'Online' : 'Offline',
    statusColor: isOpen ? 'bg-emerald-500' : 'bg-rose-500',
    bannerMessage: isOpen 
      ? null 
      : 'Toko saat ini sedang Tutup / Offline. Jam operasional CS: 11.00 - 23.00 WIB. Pesanmu akan dibalas saat toko kembali buka.'
  };
};
