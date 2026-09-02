// Utility functions for Gift In-Game & Store Operating Hours

/**
 * Memeriksa apakah saat ini berada di luar jam operasional Gift In-Game (11.00 - 22.00 WIB).
 * Menggunakan zona waktu Asia/Jakarta (WIB) secara akurat.
 */
export const isGiftClosedTime = (): boolean => {
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      timeZone: 'Asia/Jakarta', 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
    
    const [hourStr, minuteStr] = timeString.split(':');
    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

    const openMinutes = 11 * 60; // 11:00 WIB
    const closeMinutes = 22 * 60; // 22:00 WIB

    // Tutup jika sebelum 11.00 WIB ATAU setelah/pada 22.00 WIB
    return currentMinutes < openMinutes || currentMinutes >= closeMinutes;
  } catch (err) {
    // Fallback menggunakan local time jika format Intl error
    const hours = new Date().getHours();
    return hours < 11 || hours >= 22;
  }
};

/**
 * Memeriksa apakah item merupakan kategori Gift In-Game
 */
export const isProductGift = (item: any): boolean => {
  if (!item) return false;
  const cat = (item.category || item.rawGame?.category || item.type || '').toLowerCase();
  const title = (item.title || item.name || item.game || item.package_name || item.game_name || '').toLowerCase();
  
  const isJokiOrJoko = cat.includes('joko') || cat.includes('joki') || cat.includes('jasa') ||
                       title.includes('joko') || title.includes('joki') || title.includes('jasa') || 
                       title.includes('rank') || title.includes('quest') || title.includes('level max');
  
  if (isJokiOrJoko) return false;
  return cat.includes('gift') || cat.includes('roblox') || title.includes('gift') || title.includes('robux') || cat === 'gift' || cat === '';
};

/**
 * Format jam operasional Gift In-Game
 */
export const GIFT_OPERATIONAL_HOURS = '11.00 - 22.00 WIB';

/**
 * Memeriksa apakah saat ini berada dalam jam operasional Gamepass (13:00 - 20:45 WIB).
 */
export const checkIsGamepassOpen = (): boolean => {
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      timeZone: 'Asia/Jakarta', 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
    const [hourStr, minuteStr] = timeString.split(':');
    const timeInMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

    const openTime = 13 * 60; // 13:00 -> 780
    const closeTime = 20 * 60 + 45; // 20:45 -> 1245

    return timeInMinutes >= openTime && timeInMinutes <= closeTime;
  } catch (err) {
    const now = new Date();
    const timeInMinutes = now.getHours() * 60 + now.getMinutes();
    const openTime = 13 * 60;
    const closeTime = 20 * 60 + 45;
    return timeInMinutes >= openTime && timeInMinutes <= closeTime;
  }
};

/**
 * Memeriksa apakah item merupakan kategori Gamepass
 */
export const isProductGamepass = (item: any): boolean => {
  if (!item) return false;
  const cat = (item.category || item.rawGame?.category || item.type || '').toLowerCase();
  const title = (item.title || item.name || item.game || item.package_name || item.game_name || '').toLowerCase();
  return cat.includes('gamepass') || title.includes('gamepass') || cat.includes('pass') || title.includes('pass');
};

