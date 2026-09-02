/**
 * SHARED ORDER FILTERS FOR ENTONG STORE
 * Memastikan logika penentuan status pesanan (termasuk Payment Pending)
 * 100% konsisten antara sidebar counter, dashboard badge, dan tabel data.
 */

export const isOrderPaymentPending = (order: any): boolean => {
  if (!order) return false;

  const pStatus = (order.paymentStatus || order.payment_status || order.status_pembayaran || '').toLowerCase().trim();
  const mainStatus = (order.status || order.orderStatus || '').toLowerCase().trim();
  const isPaid = order.isPaid === true || order.is_paid === true || order.paid === true;

  // 1. Abaikan jika sudah dibayar lunas
  if (isPaid || pStatus === 'paid' || pStatus === 'lunas') return false;

  // 2. Abaikan pesanan yang sudah selesai, dibatalkan, hangus, refund, atau ditolak
  if (
    mainStatus === 'batal' || 
    mainStatus === 'dibatalkan' || 
    mainStatus === 'hangus' || 
    mainStatus === 'selesai' || 
    mainStatus === 'completed' ||
    mainStatus === 'done' ||
    mainStatus === 'refund' ||
    mainStatus === 'ditolak'
  ) return false;

  // 3. Status valid yang menunggu verifikasi pembayaran
  const isPending = 
    pStatus === 'pending' || 
    pStatus === 'unpaid' || 
    pStatus === 'menunggu verifikasi' ||
    pStatus === 'menunggu konfirmasi' ||
    pStatus === 'pending_verification' ||
    mainStatus === 'menunggu pembayaran' || 
    mainStatus === 'menunggu verifikasi' ||
    mainStatus === 'menunggu konfirmasi' ||
    mainStatus === 'pending';

  return isPending;
};

export default isOrderPaymentPending;
