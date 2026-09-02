/**
 * Menyensor nama pelanggan untuk privasi (kecuali sedang melihat akun sendiri).
 * Contoh: "Ghazy Gilang" -> "Gh****ng".
 */
export const maskCustomerName = (name: string, isOwn: boolean = false): string => {
  if (!name || typeof name !== 'string') return 'Pelanggan***';
  if (isOwn) return name;
  const trimmed = name.trim();
  if (trimmed.length <= 4) {
    return trimmed.substring(0, 1) + '***' + trimmed.substring(trimmed.length - 1);
  }
  const first = trimmed.substring(0, 2);
  const last = trimmed.substring(trimmed.length - 2);
  return first + '****' + last;
};
