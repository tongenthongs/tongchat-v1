/**
 * Helper pengecekan jam operasional Gift In-Game (13.00 - 20.45 WIB)
 * Zona Waktu: Asia/Jakarta (WIB / UTC+7)
 */
export const getGiftOperatingStatus = () => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Jakarta', hour12: false, hour: 'numeric', minute: 'numeric' };
  const formatter = new Intl.DateTimeFormat([], options);
  const parts = formatter.formatToParts(now);

  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  const totalMinutes = hour * 60 + minute;
  const startMinutes = 13 * 60; // 13:00 WIB
  const endMinutes = 20 * 60 + 45; // 20:45 WIB

  const isOperatingHours = totalMinutes >= startMinutes && totalMinutes <= endMinutes;

  return {
    isOperatingHours,
    scheduleText: '13.00 - 20.45 WIB',
    message: isOperatingHours 
      ? '⚡ Gift In-Game sedang OPEN (Fast Process)' 
      : '🕒 Saat ini di luar jam proses Gift (13.00 - 20.45 WIB). Anda tetap bisa order & checkout sekarang, pesanan akan diproses otomatis saat jam operasional buka.'
  };
};
