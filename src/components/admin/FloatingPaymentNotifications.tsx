import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bell, ChevronRight, ExternalLink, X } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isJunkBotOrder, isTopUpTcOrder } from '../../lib/orderRefund';
import { safeGetJSON, safeSetJSON } from '../../utils/safeStorage';

export interface FloatingPaymentNotificationsProps {
  orders: any[];
  onCheckOrder: (order: any) => void;
  onDismissOrder?: (orderId: string) => void;
}

// Helper to safely extract creation timestamp
const extractOrderTime = (ord: any): number => {
  if (!ord) return 0;
  if (ord.pureTime && typeof ord.pureTime === 'number') return ord.pureTime;
  if (ord.timestamp && typeof ord.timestamp === 'number') return ord.timestamp;
  if (ord.createdAt?.toMillis && typeof ord.createdAt.toMillis === 'function') {
    return ord.createdAt.toMillis();
  }
  if (ord.createdAt?.seconds) {
    return ord.createdAt.seconds * 1000;
  }
  const dateStr = ord.created || ord.createdAt || ord.created_at || ord.timestamp || ord.orderDate;
  if (dateStr) {
    const t = new Date(dateStr).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

export const FloatingPaymentNotifications: React.FC<FloatingPaymentNotificationsProps> = ({
  orders,
  onCheckOrder,
  onDismissOrder,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showAllInExpanded, setShowAllInExpanded] = useState<boolean>(false);
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set());

  // 🖱️ DRAG & DROP STATE (Draggable FAB with safe default position)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 80, y: 80 });

  const isDraggingRef = useRef(false);
  const startCoords = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 80, y: 80 });

  // Inisialisasi posisi aman di client-side (Desktop & Mobile friendly)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = safeGetJSON<{ x: number; y: number } | null>('admin_fab_bell_pos', null);
      const maxX = Math.max(20, (window.innerWidth || 1024) - 75);
      const maxY = Math.max(20, (window.innerHeight || 768) - 75);

      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number' && !isNaN(saved.x) && !isNaN(saved.y)) {
        const clamped = {
          x: Math.min(Math.max(10, saved.x), maxX),
          y: Math.min(Math.max(10, saved.y), maxY)
        };
        setPosition(clamped);
        currentPosRef.current = clamped;
      } else {
        const defaultPos = {
          x: Math.max(20, (window.innerWidth || 1024) - 85),
          y: 80
        };
        setPosition(defaultPos);
        currentPosRef.current = defaultPos;
      }
    } catch (err) {
      setPosition({ x: 80, y: 80 });
      currentPosRef.current = { x: 80, y: 80 };
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setPosition(prev => {
        const maxX = Math.max(20, (window.innerWidth || 1024) - 75);
        const maxY = Math.max(20, (window.innerHeight || 768) - 75);
        const clamped = {
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY),
        };
        currentPosRef.current = clamped;
        return clamped;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== undefined && e.button !== 0) return;

    isDraggingRef.current = false;
    const clientX = 'clientX' in e ? e.clientX : (e as any).touches?.[0]?.clientX || 0;
    const clientY = 'clientY' in e ? e.clientY : (e as any).touches?.[0]?.clientY || 0;

    startCoords.current = { x: clientX, y: clientY };
    startPos.current = { ...currentPosRef.current };

    const handlePointerMove = (moveEvent: PointerEvent | MouseEvent | TouchEvent) => {
      const currentX = 'clientX' in moveEvent ? (moveEvent as any).clientX : (moveEvent as any).touches?.[0]?.clientX;
      const currentY = 'clientY' in moveEvent ? (moveEvent as any).clientY : (moveEvent as any).touches?.[0]?.clientY;
      if (currentX === undefined || currentY === undefined) return;

      const deltaX = currentX - startCoords.current.x;
      const deltaY = currentY - startCoords.current.y;

      if (Math.hypot(deltaX, deltaY) > 6) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current && typeof window !== 'undefined') {
        const maxX = Math.max(20, (window.innerWidth || 1024) - 75);
        const maxY = Math.max(20, (window.innerHeight || 768) - 75);
        const newX = Math.min(Math.max(10, startPos.current.x + deltaX), maxX);
        const newY = Math.min(Math.max(10, startPos.current.y + deltaY), maxY);
        const nextPos = { x: newX, y: newY };
        currentPosRef.current = nextPos;
        setPosition(nextPos);
      }
    };

    const handlePointerUp = () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', handlePointerMove as any);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('touchmove', handlePointerMove as any);
        window.removeEventListener('touchend', handlePointerUp);
      }

      if (isDraggingRef.current) {
        safeSetJSON('admin_fab_bell_pos', currentPosRef.current);
      }
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', handlePointerMove as any);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove as any, { passive: true });
      window.addEventListener('touchend', handlePointerUp);
    }
  };

  const handleClick = () => {
    if (!isDraggingRef.current) {
      setIsExpanded(prev => !prev);
    }
  };

  // 2. Filter Ketat Status Pending Verifikasi (Disinkronkan dengan Database Pusat & Maksimal 48 Jam)
  const unverifiedOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    const now = Date.now();
    const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 Jam

    return orders.filter((ord: any) => {
      if (!ord) return false;
      const orderId = String(ord.id || ord.docUniqueId || ord.orderId || '');
      if (dismissedOrderIds.has(orderId)) return false;

      // Filter Status Pengecekan Database Pusat (Jika sudah disilang/dicek admin lain)
      if (ord.isDismissedByAdmin === true || ord.isChecked === true || ord.isPendingChecked === true) {
        return false;
      }

      // Filter Data Kedaluwarsa (Hanya orderan yang dibuat dalam 48 jam terakhir)
      const orderTime = extractOrderTime(ord);
      if (orderTime > 0 && (now - orderTime > MAX_AGE_MS)) {
        return false;
      }

      // Exclude bot/dummy orders & TopUp TC
      if (isJunkBotOrder(ord) || isTopUpTcOrder(ord)) return false;

      const price = Number(ord.price ?? ord.totalPrice ?? ord.amount ?? ord.total_price ?? 0);
      if (price <= 0) return false;

      const rawStatus = (ord.status || ord.orderStatus || '').toUpperCase();
      const rawPaymentStatus = (ord.payment_status || ord.paymentStatus || ord.status_pembayaran || '').toUpperCase();
      const proof = ord.payment_proof || ord.proofUrl || ord.proofOfPayment || ord.proof_url || '';

      if (
        rawStatus === 'SELESAI' || 
        rawStatus === 'BATAL' || 
        rawStatus === 'CANCEL' || 
        rawStatus === 'BATAL_TOLAK' ||
        ord.isRefunded === true ||
        rawPaymentStatus === 'PAID' ||
        rawPaymentStatus === 'LUNAS' ||
        rawPaymentStatus === 'SUCCESS'
      ) {
        return false;
      }

      const isBookingOrNew = rawStatus === 'BOOKING' || rawStatus === 'NEW' || rawStatus === 'ANTRIAN' || rawStatus === '' || rawStatus === 'MENUNGGU VERIFIKASI';
      const isPendingVerification = 
        rawPaymentStatus.includes('VERIFIKASI') || 
        rawPaymentStatus.includes('PENDING') || 
        rawStatus.includes('VERIFY') ||
        rawStatus.includes('MENUNGGU') ||
        Boolean(proof);

      return isBookingOrNew || isPendingVerification;
    });
  }, [orders, dismissedOrderIds]);

  const handleDismiss = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic local update
    setDismissedOrderIds(prev => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
    if (onDismissOrder) {
      onDismissOrder(orderId);
    }

    // 🌐 SINKRONISASI PUSAT FIRESTORE (Agar berkurang di seluruh perangkat admin lain secara realtime)
    try {
      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId), {
          isDismissedByAdmin: true,
          isChecked: true,
          isPendingChecked: true,
          dismissedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi dismiss notifikasi ke Firestore:', err);
    }
  };

  const handleCheck = async (ord: any) => {
    const orderId = String(ord.id || ord.docUniqueId || ord.orderId || '');
    // Optimistic local update
    setDismissedOrderIds(prev => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
    onCheckOrder(ord);

    // 🌐 SINKRONISASI PUSAT FIRESTORE (Tandai sudah dicek)
    try {
      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId), {
          isDismissedByAdmin: true,
          isChecked: true,
          isPendingChecked: true,
          checkedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi check notifikasi ke Firestore:', err);
    }
  };

  if (unverifiedOrders.length === 0) {
    return null;
  }

  const totalCount = unverifiedOrders.length;
  const visibleOrders = showAllInExpanded ? unverifiedOrders : unverifiedOrders.slice(0, 3);

  return (
    <div 
      id="floating-payment-notifications" 
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none'
      }}
      className="z-[9999] pointer-events-auto select-none font-sans"
    >
      {/* 🛎️ VIEW 1: DEFAULT COLLAPSED (DRAGGABLE FAB BELL ICON) */}
      {!isExpanded ? (
        <button
          type="button"
          id="btn-floating-bell-toggle"
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          title={`Ada ${totalCount} pembayaran/pesanan pending menunggu verifikasi. Geser atau klik!`}
          className="relative group p-3.5 bg-gradient-to-br from-[#121b22] via-[#1a2730] to-[#0d1419] hover:from-[#1a2730] hover:to-[#223340] border-2 border-[#00E676] rounded-2xl shadow-[0_8px_30px_rgb(0,230,118,0.35)] transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <Bell className="w-6 h-6 text-[#00E676] animate-bounce pointer-events-none" />
          
          {/* Realtime Pulsing Count Badge */}
          <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-rose-600 border-2 border-[#111b21] text-white text-[11px] font-black rounded-full shadow-lg flex items-center justify-center min-w-[22px] min-h-[22px] animate-pulse">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        </button>
      ) : (
        /* 📜 VIEW 2: EXPANDED CARD STACK */
        <div 
          id="floating-notification-stack"
          className="w-[calc(100vw-2.5rem)] sm:w-96 max-w-sm flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-300 bg-[#121b22]/95 backdrop-blur-md border border-[#00E676]/60 p-3 rounded-2xl shadow-2xl"
        >
          {/* HEADER CONTROLS */}
          <div 
            onPointerDown={handlePointerDown}
            className="flex items-center justify-between text-white border-b border-[#00E676]/20 pb-2 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2 min-w-0 pointer-events-none">
              <div className="relative p-1.5 bg-[#00E676]/15 text-[#00E676] rounded-xl shrink-0 border border-[#00E676]/30">
                <Bell className="w-4 h-4 text-[#00E676]" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black text-[#00E676] block truncate">
                  🔔 {totalCount} Pembayaran Pending
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  (Geser header atau klik tutup)
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-collapse-floating-bell"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Tutup kembali ke ikon lonceng"
              className="p-1.5 bg-[#00E676]/15 hover:bg-[#00E676]/30 text-[#00E676] rounded-xl border border-[#00E676]/30 transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            >
              <span>Tutup</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ACCORDION TOGGLE JIKA LEBIH DARI 3 ORDER */}
          {totalCount > 3 && (
            <div 
              onClick={() => setShowAllInExpanded(prev => !prev)}
              className="cursor-pointer bg-[#121b22]/90 hover:bg-[#1a2730] border border-slate-700 hover:border-[#00E676]/50 p-2 rounded-xl shadow-lg flex items-center justify-between text-white transition-all text-[11px]"
            >
              <span className="font-bold text-amber-300">
                {showAllInExpanded ? '▲ Ciutkan menjadi 3 orderan' : `▼ 🔔 ${totalCount} Orderan Belum Dicek`}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {showAllInExpanded ? 'Tutup' : 'Lihat Semua'}
              </span>
            </div>
          )}

          {/* COMPACT NOTIFICATION CARDS CONTAINER */}
          <div className={`space-y-2 transition-all ${showAllInExpanded ? 'max-h-80 sm:max-h-96 overflow-y-auto pr-1' : ''}`}>
            {visibleOrders.map((ord: any) => {
              const orderDocId = ord.docUniqueId || ord.id || ord.orderId || '';
              const displayOrderId = ord.orderId || `#ORD-${orderDocId.slice(-6).toUpperCase()}`;
              const custName = ord.customer_name || ord.customerName || ord.name || ord.robloxUsername || 'Customer';
              const price = Number(ord.price || ord.totalPrice || ord.amount || 0);
              const pkgName = ord.package_name || ord.packageName || ord.game_name || ord.gameName || 'Item';
              const hasProof = Boolean(ord.payment_proof || ord.proofUrl || ord.proofOfPayment);

              return (
                <div
                  key={orderDocId}
                  id={`notif-card-${orderDocId}`}
                  className="bg-[#111b21]/95 hover:bg-[#16222a] border border-[#00E676]/40 hover:border-[#00E676] p-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 transition-all text-white backdrop-blur-md"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-2 bg-[#00E676]/10 text-[#00E676] rounded-xl shrink-0 border border-[#00E676]/20">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[11px] font-black text-[#00E676] shrink-0">
                          {displayOrderId}
                        </span>
                        <span className="text-[11px] text-slate-500">•</span>
                        <span className="text-xs font-extrabold text-white truncate" title={custName}>
                          {custName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px]">
                        <span className="font-black text-emerald-400 shrink-0 font-mono">
                          Rp {price.toLocaleString('id-ID')}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300 truncate" title={pkgName}>
                          {pkgName}
                        </span>
                        {hasProof && (
                          <span className="shrink-0 px-1 py-0.2 bg-emerald-500/20 text-emerald-300 font-bold rounded text-[9px] border border-emerald-500/30">
                            📷 Bukti
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      id={`btn-cek-${orderDocId}`}
                      onClick={() => handleCheck(ord)}
                      className="px-3 py-1.5 bg-[#00E676] hover:bg-emerald-400 text-[#111b21] font-black rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Cek</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      id={`btn-dismiss-${orderDocId}`}
                      onClick={(e) => handleDismiss(orderDocId, e)}
                      title="Sembunyikan notifikasi ini"
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
