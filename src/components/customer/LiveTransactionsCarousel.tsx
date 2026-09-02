import React, { useRef, useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { maskCustomerName } from '../../utils/leaderboardUtils';
import { formatRelativeTime } from '../../utils/timeUtils';
import { getCatalogOrCategoryImage } from '../../utils/productImageResolver';

// Helper alias for getProductOrCategoryImage
export const getProductOrCategoryImage = (
  item: any,
  catalogList: any[] = [],
  categoryList: any[] = []
): string | null => {
  if (item?.imageUrl || item?.image) return item.imageUrl || item.image;
  return getCatalogOrCategoryImage(item, catalogList, categoryList);
};

export interface LiveTransactionsCarouselProps {
  transactions?: any[];
  catalogList?: any[];
  categoryList?: any[];
  showHeader?: boolean;
}

export const LiveTransactionsCarousel: React.FC<LiveTransactionsCarouselProps> = ({
  transactions: propTransactions,
  catalogList: propCatalogList,
  categoryList: propCategoryList,
  showHeader = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [catalogList, setCatalogList] = useState<any[]>(propCatalogList || []);
  const [categoryList, setCategoryList] = useState<any[]>(propCategoryList || []);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // 1. RESTRUKTURISASI QUERY LISTENER FIRESTORE (INCLUSIVE & INDEX-SAFE)
  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let isMounted = true;

    try {
      // Tarik 30 dokumen order terbaru tanpa where majemuk agar tidak terkena error Composite Index
      const ordersRef = collection(db, 'orders');
      const qOrders = query(ordersRef, orderBy('createdAt', 'desc'), limit(30));

      const unsubOrders = onSnapshot(
        qOrders,
        (snapshot) => {
          if (!isMounted) return;

          if (!snapshot.empty) {
            const rawDocs = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data()
            }));

            // Filter fleksibel di sisi client (Ambil semua pesanan kecuali yang batal/reject murni)
            const validOrders = rawDocs.filter((order: any) => {
              const status = (order.status || order.orderStatus || '').toLowerCase();
              const paymentStatus = (order.paymentStatus || order.payment_status || '').toLowerCase();
              const isPaid = order.isPaid === true;

              // Kecualikan hanya yang benar-benar dibatalkan tanpa dana
              if (status === 'cancel' || status === 'batal' || paymentStatus === 'ditolak' || status === 'rejected') {
                return false;
              }

              // Masukkan semua order aktif, lunas, booking, proses, ready, selesai, logul, diorder, tc, qris, manual_wa
              return (
                isPaid ||
                ['lunas', 'paid', 'success', 'qris', 'manual_wa', 'tc', 'settlement', 'verified'].includes(paymentStatus) ||
                ['booking', 'proses', 'ready', 'selesai', 'diorder', 'logul', 'completed', 'success'].includes(status)
              );
            });

            // Deduplikasi dokumen unik
            const uniqueOrders = Array.from(
              new Map(
                validOrders.map((item: any) => [
                  item.id || item.orderId || item.docUniqueId || item.id_order,
                  item
                ])
              ).values()
            );

            setLiveOrders(uniqueOrders);
          } else {
            setLiveOrders([]);
          }
        },
        (error) => {
          console.warn("Fallback query orderBy createdAt di LiveTransactionsCarousel:", error);
          if (isMounted) {
            // Fallback query tanpa orderBy jika index sedang dibuat/terkendala
            const qFallback = query(ordersRef, limit(30));
            const unsubFallback = onSnapshot(qFallback, (fbSnap) => {
              if (!isMounted) return;
              const rawDocs = fbSnap.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data()
              }));

              const validOrders = rawDocs.filter((order: any) => {
                const status = (order.status || order.orderStatus || '').toLowerCase();
                const paymentStatus = (order.paymentStatus || order.payment_status || '').toLowerCase();
                const isPaid = order.isPaid === true;

                if (status === 'cancel' || status === 'batal' || paymentStatus === 'ditolak' || status === 'rejected') {
                  return false;
                }

                return (
                  isPaid ||
                  ['lunas', 'paid', 'success', 'qris', 'manual_wa', 'tc', 'settlement', 'verified'].includes(paymentStatus) ||
                  ['booking', 'proses', 'ready', 'selesai', 'diorder', 'logul', 'completed', 'success'].includes(status)
                );
              });

              // Client-side sort by newest date
              validOrders.sort((a: any, b: any) => {
                const dateA = new Date(a.createdAt || a.createdAtMillis || a.timestamp || 0).getTime();
                const dateB = new Date(b.createdAt || b.createdAtMillis || b.timestamp || 0).getTime();
                return dateB - dateA;
              });

              const uniqueOrders = Array.from(
                new Map(
                  validOrders.map((item: any) => [
                    item.id || item.orderId || item.docUniqueId || item.id_order,
                    item
                  ])
                ).values()
              );

              setLiveOrders(uniqueOrders);
            });
            unsubs.push(unsubFallback);
          }
        }
      );

      unsubs.push(unsubOrders);
    } catch (err) {
      console.error("Gagal listen transaksi realtime:", err);
    }

    return () => {
      isMounted = false;
      unsubs.forEach((u) => u());
    };
  }, []);

  // Sync catalogList if not passed via props
  useEffect(() => {
    if (propCatalogList && propCatalogList.length > 0) {
      setCatalogList(propCatalogList);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'catalogs'),
      (snapshot) => {
        const liveCats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCatalogList(liveCats);
      },
      (err) => {
        console.warn("Could not load catalogs for live carousel:", err);
      }
    );
    return () => unsub();
  }, [propCatalogList]);

  // Sync categoryList if not passed via props
  useEffect(() => {
    if (propCategoryList && propCategoryList.length > 0) {
      setCategoryList(propCategoryList);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        const liveCategories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCategoryList(liveCategories);
      },
      (err) => {
        console.warn("Could not load categories for live carousel:", err);
      }
    );
    return () => unsub();
  }, [propCategoryList]);

  // 2. ENGINE PENJAMIN MINIMAL ITEM CAROUSEL (HYBRID FALLBACK)
  const displayTransactions = useMemo(() => {
    const sourceList = (propTransactions && propTransactions.length > 0)
      ? propTransactions
      : liveOrders;

    // Deduplikasi dasar
    const map = new Map<string, any>();
    sourceList.forEach((tx: any) => {
      if (!tx) return;
      const key = tx.id || tx.orderId || tx.docUniqueId || tx.id_order || tx.order_id;
      if (key && !map.has(key)) {
        map.set(key, tx);
      }
    });

    const uniqueList = Array.from(map.values());

    // Jika transaksi riil valid >= 6, gunakan data riil murni
    if (uniqueList.length >= 6) {
      return uniqueList;
    }

    // Jika data transaksi riil masih sedikit (< 6), kombinasikan dengan fallback dinamis berbasis katalog
    const dummyNames = ["Al****an", "Mu****an", "Re****as", "Za****za", "Sy****gi", "Fa****ri", "Ad****tya", "Ki****an"];
    const dummyTimes = [180, 420, 900, 1800, 3600, 7200, 10800, 14400]; // Waktu dalam detik yang lalu

    const supplemented = [...uniqueList];
    let seedIndex = 0;

    const effectiveCatalogs = catalogList.length > 0 ? catalogList : [
      { name: "Drag Drive Simulator - Cash 500 Juta", price: 35000, gameName: "Drag Drive Simulator" },
      { name: "Blox Fruits - Joki Level Max", price: 45000, gameName: "Blox Fruits" },
      { name: "Fish It! - Rod Mythical Bundle", price: 25000, gameName: "Fish It!" },
      { name: "Robux Fast Delivery 1000 R$", price: 110000, gameName: "Roblox" },
      { name: "Drag Drive Simulator - Advance Paint", price: 11000, gameName: "Drag Drive Simulator" },
      { name: "Blox Fruits - Perm Buddha Fruit", price: 150000, gameName: "Blox Fruits" },
      { name: "Drag Drive Simulator - Unlock VIP Track", price: 25000, gameName: "Drag Drive Simulator" },
      { name: "Robux Fast Delivery 500 R$", price: 55000, gameName: "Roblox" },
    ];

    while (supplemented.length < 8 && effectiveCatalogs.length > 0) {
      const cat = effectiveCatalogs[seedIndex % effectiveCatalogs.length];
      const simulatedDate = new Date(Date.now() - (dummyTimes[seedIndex % dummyTimes.length] * 1000));

      supplemented.push({
        id: `sim_${seedIndex}_${cat.id || Date.now()}`,
        packageName: cat.name || cat.packageName || cat.title || "Paket Game",
        gameName: cat.gameName || cat.category || "Roblox",
        customerName: dummyNames[seedIndex % dummyNames.length],
        price: cat.price || 15000,
        totalAmount: cat.price || 15000,
        createdAt: simulatedDate,
        imageUrl: cat.imageUrl || cat.image || null,
        isSimulated: true
      });
      seedIndex++;
    }

    return supplemented;
  }, [propTransactions, liveOrders, catalogList]);

  // Gandakan array 2x untuk loop marquee seamless jika item >= 4
  const marqueeList = useMemo(() => {
    if (displayTransactions.length === 0) return [];
    if (displayTransactions.length >= 4) {
      return [...displayTransactions, ...displayTransactions];
    }
    return displayTransactions;
  }, [displayTransactions]);

  // Smooth Marquee Animation Loop
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!containerRef.current || isHovered || isDragging || marqueeList.length === 0) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    const speed = 35; // pixels per second

    const animate = (time: number) => {
      if (!containerRef.current) return;
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (containerRef.current.scrollWidth > 0) {
        containerRef.current.scrollLeft += speed * delta;

        // Loop seamlessly halfway
        if (
          displayTransactions.length >= 4 &&
          containerRef.current.scrollLeft >= containerRef.current.scrollWidth / 2
        ) {
          containerRef.current.scrollLeft = 0;
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isHovered, isDragging, marqueeList.length, displayTransactions.length]);

  // Drag / Swipe Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsHovered(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  if (displayTransactions.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden py-3 select-none">
      {showHeader && (
        <div className="flex items-center justify-between mb-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">⚡</span>
            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
              Transaksi Sukses Terbaru
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Realtime Update
          </span>
        </div>
      )}

      {/* Container Marquee / Scrollable Flex */}
      <div
        ref={containerRef}
        className="flex overflow-x-auto hide-scrollbar gap-3 px-4 pb-2 scroll-smooth cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {marqueeList.map((tx, idx) => {
          const imgUrl = getProductOrCategoryImage(tx, catalogList, categoryList);
          const title =
            tx.packageName ||
            tx.package_name ||
            tx.itemGift ||
            tx.productName ||
            (Array.isArray(tx.items) && tx.items[0]?.name) ||
            (Array.isArray(tx.items) && tx.items[0]?.packageName) ||
            tx.title ||
            "Paket Item";
          const rawName =
            tx.customerName ||
            tx.customer_name ||
            tx.robloxUsername ||
            tx.userName ||
            tx.username ||
            "Customer";
          const name = maskCustomerName(rawName);
          const price = Number(
            tx.totalAmount || tx.price || tx.totalPrice || tx.grandTotal || tx.amount || 0
          );
          const timestamp =
            tx.createdAt || tx.createdAtMillis || tx.timestamp || tx.date || Date.now();

          return (
            <div
              key={`${tx.id || 'tx'}-${idx}`}
              className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shrink-0 min-w-[260px] max-w-[320px] shadow-sm hover:border-slate-700 transition-all cursor-default pointer-events-none"
            >
              {imgUrl ? (
                <div className="relative w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 shrink-0 overflow-hidden">
                  <img
                    src={imgUrl}
                    alt={title}
                    className="w-full h-full object-cover pointer-events-none"
                    onError={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.style.display = 'none';
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 border border-slate-950 flex items-center justify-center text-[9px] font-bold text-white uppercase">
                    {rawName.charAt(0)}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-white truncate" title={title}>
                  {title}
                </span>
                <span className="text-[11px] text-slate-400 truncate">
                  {name} · {formatRelativeTime(timestamp)}
                </span>
                <span className="text-xs font-extrabold text-emerald-400">
                  Rp {price.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveTransactionsCarousel;



