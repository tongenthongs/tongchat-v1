/**
 * 🛡️ ENTONG STORE CUSTOMER NAME RESOLUTION UTILITY
 * Mencegah overwrite nama customer menjadi format acak "Customer #xxxx"
 * Prioritas:
 * 1. Nama akun terdaftar dari users/users document (displayName, fullName, name)
 * 2. Username Roblox (robloxUsername / username / game_username)
 * 3. Nama customer awal saat room/order dibuat (initialCustomerName, customer_name, customerName)
 * 4. Nomor WhatsApp / Phone (format Cust-XXXX)
 * JANGAN PERNAH membuat fallback string acak 'Customer #' + randomId jika user/order memiliki data nama atau nomor WhatsApp.
 */

export const resolveCustomerName = (data: any, usersList: any[] = []): string => {
  if (!data) return 'Pelanggan';

  // Cek jika data memiliki relasi UID/customerId untuk lookup ke users collection
  const uid = data.userId || data.customerUid || data.userUid || data.customerId || data.customer_id;
  if (uid && usersList && usersList.length > 0) {
    const matchedUser = usersList.find((u: any) => u.id === uid || u.uid === uid);
    if (matchedUser) {
      const regName = matchedUser.displayName || matchedUser.fullName || matchedUser.name;
      if (regName && typeof regName === 'string' && regName.trim() && !regName.startsWith('Customer #') && !regName.startsWith('Cust-')) {
        return regName.trim();
      }
    }
  }

  // Prioritas 1: Nama langsung dari dokumen (order/chat/user)
  const directName = data.customerName || data.customer_name || data.name || data.userName || data.displayName || data.initialCustomerName;
  if (directName && typeof directName === 'string' && directName.trim() && !directName.startsWith('Customer #')) {
    return directName.trim();
  }

  // Prioritas 2: Username Roblox / Game
  const roblox = data.robloxUsername || data.roblox_username || data.game_username || data.targetUsername || data.username;
  if (roblox && typeof roblox === 'string' && roblox.trim() && roblox.trim() !== '-' && !roblox.startsWith('Customer #')) {
    return roblox.trim();
  }

  // Prioritas 3: Nomor WhatsApp / Phone
  const phone = data.whatsapp || data.whatsappNumber || data.customer_phone || data.customerPhone || data.phone;
  if (phone && typeof phone === 'string' && phone.trim()) {
    const cleanNum = phone.replace(/[^0-9]/g, '');
    if (cleanNum.length >= 4) {
      return `Cust-${cleanNum.slice(-4)}`;
    }
  }

  return 'Pelanggan';
};
