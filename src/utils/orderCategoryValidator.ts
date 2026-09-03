export const isStrictGiftBookingOrder = (order: any): boolean => {
  if (!order) return false;

  const category = (order.category || '').toLowerCase().trim();
  const type = (order.type || '').toLowerCase().trim();

  // 1. Tolak Mutlak Flag Joki / Joko / Worker / Topup Cash Joki
  if (
    category === 'joko' || category === 'joki' || category === 'joki_cash' || category === 'joki_leveling' ||
    type === 'joko' || type === 'joki' || type === 'joki_cash' || type === 'joki_leveling' ||
    order.isJoko === true || order.isJoki === true || order.isWorkerOrder === true
  ) {
    return false;
  }

  // 2. Inspeksi Seluruh String Nama Item & Paket
  const combinedNames = [
    order.packageName,
    order.package_name,
    order.itemGift,
    order.serviceName,
    order.gameName,
    order.game_name,
    order.notes,
    ...(Array.isArray(order.items) ? order.items.map((i: any) => `${i.name || ''} ${i.packageName || ''} ${i.package_name || ''}`) : [])
  ].filter(Boolean).join(' ').toLowerCase();

  // Jika terdapat indikasi pengerjaan akun/joki/worker/cash joki -> TOLAK
  if (
    combinedNames.includes('joki') ||
    combinedNames.includes('joko') ||
    combinedNames.includes('worker') ||
    combinedNames.includes('leveling') ||
    combinedNames.includes('700 juta') ||
    combinedNames.includes('400 juta') ||
    combinedNames.includes('300 juta') ||
    combinedNames.includes('1 miliar') ||
    combinedNames.includes('miliar') ||
    combinedNames.includes('juta cash') ||
    combinedNames.includes('joki cash')
  ) {
    return false;
  }

  // 3. Pastikan merupakan produk Gift / Pass / Item In-Game yang valid
  const isGiftIdentified = 
    category === 'gift' ||
    type === 'gift' ||
    order.isGift === true ||
    combinedNames.includes('gift') ||
    combinedNames.includes('pass') ||
    combinedNames.includes('luxury') ||
    combinedNames.includes('dragspec') ||
    combinedNames.includes('advance paint') ||
    combinedNames.includes('exclusive rims') ||
    combinedNames.includes('custom plate') ||
    combinedNames.includes('plate') ||
    combinedNames.includes('police') ||
    combinedNames.includes('drag drive') ||
    combinedNames.includes('car driving') ||
    combinedNames.includes('blox fruits') ||
    combinedNames.includes('fish it') ||
    combinedNames.includes('rivals');

  return isGiftIdentified;
};

export const filterStrictGiftBookingOnly = (orders: any[]): any[] => {
  if (!Array.isArray(orders)) return [];
  return orders.filter(order => {
    if (!isStrictGiftBookingOrder(order)) return false;
    const st = (order.status || order.orderStatus || '').toLowerCase().trim();
    return st === 'booking' || st === 'new' || st === 'pending_verification';
  });
};

export const isStrictGiftOrder = isStrictGiftBookingOrder;

