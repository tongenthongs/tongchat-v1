import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useApp } from "../../context/AppContext";
import { isOrderPaymentPending } from "../../utils/orderFilters";
import { 
  CreditCard, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Eye, 
  User, 
  Phone, 
  Package, 
  Sparkles,
  AlertCircle,
  RefreshCw,
  X,
  ZoomIn,
  Image as ImageIcon
} from "lucide-react";

interface AdminPaymentPendingProps {
  onOpenChatWithOrder?: (orderId: string) => void;
}

export function AdminPaymentPending({ onOpenChatWithOrder }: AdminPaymentPendingProps) {
  const { currentUser } = useApp();
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. Ambil data realtime dari database Firestore
  useEffect(() => {
    setIsLoading(true);
    const ordersRef = collection(db, "orders");
    
    // Query realtime seluruh pesanan
    const q = query(ordersRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders: any[] = snapshot.docs.map(d => ({
        id: d.id,
        orderId: d.data().orderId || d.id,
        ...d.data()
      }));

      // Filter ketat hanya status pembayaran PENDING menggunakan helper terpusat
      const filteredPending = allOrders.filter(isOrderPaymentPending);

      setPendingOrders(filteredPending);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching pending payments:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter Search
  const displayOrders = useMemo(() => {
    if (!searchQuery.trim()) return pendingOrders;
    const q = searchQuery.toLowerCase();
    return pendingOrders.filter(o => 
      (o.orderId || o.id || '').toLowerCase().includes(q) ||
      (o.robloxUsername || o.roblox_username || '').toLowerCase().includes(q) ||
      (o.customerWhatsapp || o.whatsappNumber || o.phone || '').toLowerCase().includes(q) ||
      (o.customerName || o.customer_name || '').toLowerCase().includes(q) ||
      (o.packageName || o.package_name || o.itemGift || o.game_name || '').toLowerCase().includes(q)
    );
  }, [pendingOrders, searchQuery]);

  // Total Nominal Pending
  const totalNominalPending = useMemo(() => {
    return pendingOrders.reduce((sum, item) => sum + Number(item.totalAmount || item.totalPrice || item.price || 0), 0);
  }, [pendingOrders]);

  // 2. Aksi: Verifikasi Pembayaran (ACC / LUNAS)
  const handleApprovePayment = async (order: any) => {
    if (processingId) return;
    setProcessingId(order.id);

    try {
      const orderRef = doc(db, "orders", order.id);
      const categoryLower = (order.category || order.type || '').toLowerCase();
      const isGift = categoryLower === 'gift' || order.isGift === true || (order.itemGift && order.itemGift.length > 0);
      
      // Tentukan status lanjutan setelah pembayaran lunas
      const nextStatus = isGift ? "Booking" : "Antrean";
      const adminName = currentUser?.name || currentUser?.username || 'Admin';

      await updateDoc(orderRef, {
        paymentStatus: "PAID",
        isPaid: true,
        status: nextStatus,
        orderStatus: nextStatus,
        verifiedAt: serverTimestamp(),
        verifiedBy: adminName,
        updatedAt: serverTimestamp()
      });

      setSuccessToast(`Pembayaran #${order.orderId || order.id} berhasil di-ACC (Status: ${nextStatus})`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error("Gagal memverifikasi pembayaran:", err);
      alert("Gagal memverifikasi pembayaran. Cek koneksi internet.");
    } finally {
      setProcessingId(null);
    }
  };

  // 3. Aksi: Tolak Pembayaran (Batalkan)
  const handleRejectPayment = async (order: any) => {
    if (processingId) return;
    if (!window.confirm(`Yakin ingin menolak pembayaran order #${order.orderId || order.id}? Status akan diubah menjadi Dibatalkan.`)) return;

    setProcessingId(order.id);
    try {
      const orderRef = doc(db, "orders", order.id);
      const adminName = currentUser?.name || currentUser?.username || 'Admin';

      await updateDoc(orderRef, {
        paymentStatus: "FAILED",
        status: "Dibatalkan",
        orderStatus: "Dibatalkan",
        cancelledAt: serverTimestamp(),
        cancelledBy: adminName,
        updatedAt: serverTimestamp()
      });

      setSuccessToast(`Order #${order.orderId || order.id} telah ditolak & dibatalkan`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error("Gagal membatalkan pembayaran:", err);
      alert("Gagal membatalkan pembayaran. Silakan coba lagi.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#070b14] text-slate-200 p-4 md:p-6 space-y-6 overflow-y-auto">
      {/* TOAST ALERT */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 border border-emerald-400 animate-bounce">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-xs">{successToast}</span>
        </div>
      )}

      {/* MODAL POPUP PREVIEW BUKTI TRANSFER RESOLUSI PENUH */}
      {selectedProofUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => { setSelectedProofUrl(null); setIsZoomed(false); }}
        >
          <div 
            className={`bg-slate-900 border border-slate-700 rounded-2xl w-full p-4 relative shadow-2xl space-y-3 transition-all duration-200 ${
              isZoomed ? 'max-w-4xl' : 'max-w-lg'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                Bukti Transfer / Pembayaran
              </h3>
              <button 
                onClick={() => { setSelectedProofUrl(null); setIsZoomed(false); }}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Area Preview Gambar */}
            <div className={`overflow-auto rounded-xl bg-slate-950/90 flex items-center justify-center p-2 border border-slate-800 ${
              isZoomed ? 'max-h-[80vh]' : 'max-h-[65vh]'
            }`}>
              <img 
                src={selectedProofUrl} 
                alt="Bukti Transfer Penuh" 
                className={`w-full object-contain rounded-lg shadow transition-all duration-200 ${
                  isZoomed ? 'max-h-[78vh] scale-100 cursor-zoom-out' : 'max-h-[60vh] cursor-zoom-in'
                }`}
                onClick={() => setIsZoomed(!isZoomed)}
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Footer Modal dengan Tombol Zoom & Buka Tab Baru */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{isZoomed ? "Kecilkan" : "Perbesar Zoom"}</span>
              </button>

              <div className="flex items-center gap-2">
                <a 
                  href={selectedProofUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Tab Baru ↗
                </a>
                <button
                  onClick={() => { setSelectedProofUrl(null); setIsZoomed(false); }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white tracking-wide">
                Payment Pending
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingOrders.length} PERLU VERIFIKASI
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Daftar transaksi pelanggan yang menunggu konfirmasi dan verifikasi pembayaran.
            </p>
          </div>
        </div>

        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ID, username roblox, WA, paket..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* QUICK SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Total Menunggu ACC</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {pendingOrders.length} <span className="text-xs font-normal text-slate-400">Transaksi</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Total Nominal Pending</span>
            <CreditCard className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            Rp {totalNominalPending.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">Status Sistem</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xs font-bold text-cyan-300 mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Realtime Firestore Sync Aktif
          </div>
        </div>
      </div>

      {/* TABEL VERIFIKASI PEMBAYARAN */}
      <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">ID Transaksi</th>
                <th className="py-3.5 px-4">Customer & Akun</th>
                <th className="py-3.5 px-4">Detail Produk</th>
                <th className="py-3.5 px-4">Nominal Tagihan</th>
                <th className="py-3.5 px-4">Metode Bayar</th>
                <th className="py-3.5 px-4 text-center">Bukti Bayar</th>
                <th className="py-3.5 px-4 text-center">Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Memuat data verifikasi pembayaran...</span>
                    </div>
                  </td>
                </tr>
              ) : displayOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl">
                        🎉
                      </div>
                      <span className="text-slate-300 font-bold text-sm">Tidak ada pembayaran yang pending!</span>
                      <span className="text-xs text-slate-500 max-w-sm">
                        Semua transaksi masuk sudah diverifikasi atau belum ada pesanan baru yang menunggu pembayaran.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                displayOrders.map((order) => {
                  const proofUrl = order.paymentProofUrl || order.buktiTransfer || order.proofImage || order.proofOfPayment || order.payment_proof || order.paymentProof;
                  const displayOrderId = order.orderId || order.id;
                  const robloxUser = order.robloxUsername || order.roblox_username || "-";
                  const custName = order.customerName || order.customer_name || robloxUser;
                  const whatsapp = order.customerWhatsapp || order.whatsappNumber || order.phone || "";
                  const totalNominal = Number(order.totalAmount || order.totalPrice || order.price || 0);
                  const productName = order.packageName || order.package_name || order.itemGift || order.game_name || "Layanan Game";
                  const categoryName = (order.category || order.type || 'General').toUpperCase();

                  let formattedDate = 'Baru saja';
                  if (order.createdAt?.toDate) {
                    formattedDate = order.createdAt.toDate().toLocaleString('id-ID', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    });
                  } else if (order.createdAt) {
                    try {
                      formattedDate = new Date(order.createdAt).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      });
                    } catch {
                      formattedDate = 'Baru saja';
                    }
                  }

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* ID TRANSAKSI */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-amber-400 flex items-center gap-1.5">
                          <span>#{displayOrderId}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      {/* CUSTOMER & AKUN */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{custName}</span>
                        </div>
                        {robloxUser !== "-" && (
                          <div className="text-[11px] text-cyan-300 font-mono pl-5">
                            @{robloxUser}
                          </div>
                        )}
                        {whatsapp && (
                          <div className="text-[10px] text-slate-400 pl-5 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span>{whatsapp}</span>
                          </div>
                        )}
                      </td>

                      {/* DETAIL PRODUK */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{productName}</span>
                        </div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {categoryName}
                        </span>
                      </td>

                      {/* NOMINAL TAGIHAN */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-emerald-400 text-sm">
                          Rp {totalNominal.toLocaleString("id-ID")}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                          Menunggu Konfirmasi
                        </span>
                      </td>

                      {/* METODE BAYAR */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                          {order.paymentMethod || order.payment_method || "QRIS / Transfer"}
                        </span>
                      </td>

                      {/* BUKTI BAYAR INTERAKTIF */}
                      <td className="py-3.5 px-4 text-center">
                        {proofUrl && proofUrl !== 'TONGCOINS_INSTANT_PAYMENT' ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => { setSelectedProofUrl(proofUrl); setIsZoomed(false); }}
                              className="group relative w-12 h-12 rounded-xl border border-slate-700 overflow-hidden cursor-pointer hover:border-emerald-400 transition-all shadow bg-black/40"
                              title="Klik untuk melihat bukti foto resolusi penuh"
                            >
                              <img 
                                src={proofUrl} 
                                alt="Bukti Transfer" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white font-bold transition-opacity">
                                <Eye className="w-4 h-4 text-emerald-400" />
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedProofUrl(proofUrl); setIsZoomed(false); }}
                              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>Lihat Bukti Foto</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">
                            Tanpa Bukti Gambar
                          </span>
                        )}
                      </td>

                      {/* AKSI VERIFIKASI */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            disabled={processingId === order.id}
                            onClick={() => handleApprovePayment(order)}
                            title="Verifikasi Pembayaran & Lanjutkan Pesanan"
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{processingId === order.id ? "Memproses..." : "ACC / Lunas"}</span>
                          </button>
                          
                          <button
                            disabled={processingId === order.id}
                            onClick={() => handleRejectPayment(order)}
                            title="Tolak Pembayaran (Batalkan)"
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 border border-rose-500/30 font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>

                          {onOpenChatWithOrder && (
                            <button
                              onClick={() => onOpenChatWithOrder(order.id)}
                              title="Buka Chat Pesanan Ini"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs inline-flex items-center transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default AdminPaymentPending;
