/**
 * HELPER FILTER & MULTI-KEY SEARCH UNIVERSAL (ENTONG STORE)
 * Mendukung pencarian Order ID, Username Roblox, Nomor WhatsApp, Nama Customer, dan Item/Produk.
 */
export const matchOrderSearchAndCategory = (
  order: any,
  searchQuery: string,
  targetCategory: "GIFT" | "JOKI"
): boolean => {
  if (!order) return false;

  // 1. Verifikasi Kategori
  const rawCat = (order.category || order.service_type || order.type || order.orderType || order.productType || '').toLowerCase().trim();
  const rawPkg = (order.packageName || order.package_name || order.item_name || order.product_name || order.name || order.itemGift || order.giftItemName || '').toLowerCase().trim();
  const rawGame = (order.gameName || order.game_name || '').toLowerCase().trim();

  const isJokiExplicit = order.isJoko === true || 
                         order.isJoki === true || 
                         rawCat === 'joko' || 
                         rawCat === 'joki' || 
                         rawCat.includes('joki') || 
                         rawPkg.includes('joko') || 
                         rawPkg.includes('joki') || 
                         rawPkg.includes('leveling') || 
                         rawPkg.includes('push rank') || 
                         rawPkg.includes('joki rank') || 
                         rawPkg.includes('joko cash') ||
                         rawGame.includes('joko') || 
                         rawGame.includes('joki');

  const isGiftExplicit = order.isGift === true || 
                         rawCat === 'gift' || 
                         rawCat.includes('gift') || 
                         Boolean(order.itemGift) || 
                         Boolean(order.giftItemName) ||
                         (Array.isArray(order.items) && order.items.length > 0);

  if (targetCategory === "GIFT") {
    // Masuk Gift jika explicit gift atau bukan joki
    if (isJokiExplicit) return false;
  } else if (targetCategory === "JOKI") {
    // Masuk Joki jika explicit joki atau bukan gift murni tanpa tag joki
    if (isGiftExplicit && !isJokiExplicit) return false;
  }

  // 2. Jika Tidak Ada Search Query, Langsung Lolos
  const cleanQ = (searchQuery || '').toLowerCase().trim().replace(/^@/, '').replace(/^#/, '');
  if (!cleanQ) return true;

  // 3. Pencarian Multi-Key (Order ID, Roblox Username, WA, Customer Name, Item, Package)
  const cleanOrderId = String(order.orderId || order.order_id || order.id_order || order.id || order.firestore_id || '').toLowerCase().replace(/^#/, '');
  const cleanRoblox = String(order.robloxUsername || order.roblox_username || order.game_username || order.game_user_id || order.username || order.targetUsername || order.username_roblox || '').toLowerCase().replace(/^@/, '');
  
  const rawWA = String(order.customerWhatsapp || order.customer_phone || order.whatsapp || order.phone || order.customerPhone || order.whatsappNumber || order.userPhone || '').toLowerCase();
  const cleanWA = rawWA.replace(/[^0-9]/g, '');
  const queryDigits = cleanQ.replace(/[^0-9]/g, '');

  const cleanCustomer = String(order.customerName || order.customer_name || order.name || order.displayName || '').toLowerCase();
  const cleanItem = String(order.packageName || order.package_name || order.itemGift || order.giftItemName || order.item_name || order.productName || order.product_name || order.name || '').toLowerCase();
  const cleanGame = String(order.gameName || order.game_name || '').toLowerCase();

  // Search items array if exists
  const matchInItemsArray = Array.isArray(order.items) && order.items.some((it: any) => {
    const itName = String(it.name || it.packageName || it.itemGift || it.title || '').toLowerCase();
    return itName.includes(cleanQ);
  });

  return (
    cleanOrderId.includes(cleanQ) ||
    cleanRoblox.includes(cleanQ) ||
    (queryDigits.length >= 3 && cleanWA.includes(queryDigits)) ||
    rawWA.includes(cleanQ) ||
    cleanCustomer.includes(cleanQ) ||
    cleanItem.includes(cleanQ) ||
    cleanGame.includes(cleanQ) ||
    Boolean(matchInItemsArray)
  );
};
