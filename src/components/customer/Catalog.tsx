import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { GameCatalog, PricelistItem } from "../../types";
import { useApp } from "../../context/AppContext";
import { getCachedCatalogs, setCachedCatalogs } from "../../utils/productCache";
import {
  Gamepad2,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  ChevronRight,
  ArrowRight,
  X,
  Clock,
  HelpCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  isGiftClosedTime,
  isProductGift,
  GIFT_OPERATIONAL_HOURS,
} from "../../lib/operatingHours";
import { getGiftOperatingStatus } from "../../utils/giftTimeHelper";

interface CatalogProps {
  onAddToCart: (item: any) => void;
  cart: { item: any; qty: number }[];
  onViewCart: () => void;
  onBuyNow?: (item: any) => void;
  selectedGameId?: string | null;
  onClearSelectedGame?: () => void;
  standaloneCategory?: string;
}

// Helper function to check product/service availability with full tolerance for different property names from admin
export const isProductAvailable = (product: any): boolean => {
  if (!product) return false;

  // Cek flag status aktif (toleransi berbagai variasi properti dari admin)
  const isActive =
    product.isActive !== false &&
    product.status !== "inactive" &&
    product.status !== "disabled" &&
    product.isAvailable !== false &&
    !product.is_closed &&
    !product.isClosed;

  // Cek stok jika ada (jika stok tidak didefinisikan, anggap selalu tersedia)
  const hasStock =
    product.stock === undefined ||
    product.stock === null ||
    Number(product.stock) > 0;

  return isActive && hasStock;
};

export const Catalog: React.FC<CatalogProps> = ({
  onAddToCart,
  cart,
  onViewCart,
  onBuyNow,
  selectedGameId,
  onClearSelectedGame,
  standaloneCategory,
}) => {
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenOrderWarning");
    if (!hasSeen) {
      setShowWarningModal(true);
    }
  }, []);

  const handleDismissWarning = () => {
    localStorage.setItem("hasSeenOrderWarning", "true");
    setShowWarningModal(false);
  };

  const [catalogs, setCatalogs] = useState<GameCatalog[]>(() =>
    getCachedCatalogs(),
  );
  const [loading, setLoading] = useState<boolean>(
    () => getCachedCatalogs().length === 0,
  );
  const [selectedCategory, setSelectedCategory] = useState<"gift" | "joko">(
    "gift",
  );
  const [selectedGame, setSelectedGame] = useState<GameCatalog | null>(null);

  // Off hours confirmation modal state for gift purchases
  const [showOffHoursModal, setShowOffHoursModal] = useState<boolean>(false);
  const [selectedGiftItem, setSelectedGiftItem] = useState<GameCatalog | null>(
    null,
  );

  const handleBuyClick = (game: GameCatalog) => {
    const giftStatus = getGiftOperatingStatus();
    const isGift =
      isProductGift(game) || (game.category || "").toLowerCase() === "gift";
    if (isGift && !giftStatus.isOperatingHours) {
      setSelectedGiftItem(game);
      setShowOffHoursModal(true);
    } else {
      setSelectedGame(game);
    }
  };

  // Auto-select game if selectedGameId passed from Home popular section
  useEffect(() => {
    if (selectedGameId && catalogs.length > 0) {
      const targetId = selectedGameId.toLowerCase();
      const found = catalogs.find(
        (c) =>
          c.id.toLowerCase() === targetId ||
          c.title.toLowerCase() === targetId ||
          c.title.toLowerCase().includes(targetId) ||
          targetId.includes(c.id.toLowerCase()),
      );
      if (found) {
        setSelectedGame(found);
        const catLower = (found.category || "").toLowerCase();
        if (catLower.includes("joko") || catLower.includes("joki")) {
          setSelectedCategory("joko");
        } else {
          setSelectedCategory("gift");
        }
      }
    }
  }, [selectedGameId, catalogs]);

  // Operational hours state for Gift products (11:00 - 22:00 WIB)
  const [showGiftTimeWarning, setShowGiftTimeWarning] =
    useState<boolean>(false);
  const [pendingGiftProduct, setPendingGiftProduct] = useState<{
    game: GameCatalog;
    pkg: PricelistItem;
    launchDirectly: boolean;
  } | null>(null);

  const isCurrentlyGiftClosed = isGiftClosedTime();
  const { orders } = useApp();

  const calculateTotalSold = (game: GameCatalog) => {
    const completedOrders = (orders || []).filter(
      (o) =>
        (o.catalogId === game.id || o.game_name === game.title) &&
        (o.status === "SELESAI" ||
          (o.status as string) === "SUCCESS" ||
          (o as any).paymentStatus === "PAID"),
    );
    return (game.totalSold || 0) + completedOrders.length;
  };

  // Realtime subscription to Firestore 'catalogs' collection with Stale-While-Revalidate & 300ms Timeout Guard
  useEffect(() => {
    // 300ms Safety Timeout fallback (cache sudah dirender seketika via getCachedCatalogs)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);

    const unsubscribe = onSnapshot(
      collection(db, "catalogs"),
      (snapshot) => {
        clearTimeout(timer);
        if (!snapshot.empty) {
          const fetched: GameCatalog[] = snapshot.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              }) as GameCatalog,
          );
          setCatalogs(fetched);
          setCachedCatalogs(fetched);
        }
        setLoading(false);
      },
      (err) => {
        clearTimeout(timer);
        console.warn("Firestore catalogs subscription fallback:", err);
        setLoading(false);
      },
    );

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Filter games based on selected category ('gift' | 'joko') with broad tolerance for variations in admin data
  const filteredGames = catalogs.filter((game: any) => {
    const categoryLower = (game.category || "").toLowerCase();
    const typeLower = (game.type || "").toLowerCase();
    const titleLower = (game.title || "").toLowerCase();

    if (selectedCategory === "joko") {
      return (
        categoryLower.includes("joko") ||
        categoryLower.includes("joki") ||
        typeLower.includes("joko") ||
        typeLower.includes("joki") ||
        titleLower.includes("joko") ||
        titleLower.includes("joki")
      );
    } else {
      return (
        categoryLower.includes("gift") ||
        (!categoryLower.includes("joko") && !categoryLower.includes("joki"))
      );
    }
  });

  const proceedToSelectProduct = (
    game: GameCatalog,
    pkg: PricelistItem,
    launchDirectly: boolean = false,
  ) => {
    const flatCompatibleItem = {
      id: `${game.id}__${pkg.id}`,
      game_name: game.title,
      package_name: pkg.name,
      category: game.category,
      price: pkg.price,
      description: pkg.description || "",
      estimated_time: pkg.estimatedTime || "Sesuai Deskripsi",
      imageUrl:
        pkg.imageUrl ||
        (pkg as any).image ||
        game.imageUrl ||
        (game as any).image ||
        (game as any).thumbnail ||
        null,
    };

    if (launchDirectly && onBuyNow) {
      setSelectedGame(null);
      onBuyNow(flatCompatibleItem);
    } else {
      onAddToCart(flatCompatibleItem);
      if (launchDirectly) {
        setSelectedGame(null);
        onViewCart();
      }
    }
  };

  // Map package selection to GameItem-compatible schema with Gift operational hours interceptor
  const handlePackageAddToCart = (
    game: GameCatalog,
    pkg: PricelistItem,
    launchDirectly: boolean = false,
  ) => {
    const isGift = isProductGift(game) || isProductGift(pkg);

    if (isGift && isGiftClosedTime()) {
      setPendingGiftProduct({ game, pkg, launchDirectly });
      setShowOffHoursModal(true);
      return;
    }

    proceedToSelectProduct(game, pkg, launchDirectly);
  };

  const getLowestPrice = (game: GameCatalog) => {
    if (!game.pricelists || game.pricelists.length === 0) return 0;
    return Math.min(...game.pricelists.map((p) => p.price));
  };

  const getCartQty = (gameId: string, pkgId: string) => {
    const cartEntry = cart.find((c) => c.item.id === `${gameId}__${pkgId}`);
    return cartEntry ? cartEntry.qty : 0;
  };

  return (
    <div className={`w-full max-w-[1400px] mx-auto px-4 sm:px-6 space-y-6 ${standaloneCategory ? "hidden" : ""}`}>
      {/* Peringatan Modal Interaktif */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111b21] border border-rose-500/50 p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-400 border border-rose-500/20 shadow-inner">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-blue-400 mb-2 uppercase tracking-wide">
              ⚠️ PERINGATAN PENTING
              <br />
              ENTONG STORE
            </h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Jika Anda sudah melakukan order,{" "}
              <strong className="text-blue-400">TIDAK PERLU</strong> membuat
              orderan baru lagi! Silakan langsung hubungi admin melalui fitur
              Chat. Tindakan iseng atau mempermainkan fitur order secara
              berulang akan mengakibatkan{" "}
              <strong>AKUN DIBLOKIR / BANNED PERMANEN</strong> dari Entong
              Store!
            </p>
            <button
              onClick={handleDismissWarning}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm transition-all shadow-lg shadow-blue-600/20 flex justify-center items-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5" />
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* MODAL PERINGATAN INSTAN KLIK GIFT (JAM OPERASIONAL 11.00 - 22.00 WIB) */}
      {showGiftTimeWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-500/30">
              <Clock className="w-7 h-7" />
            </div>

            <div>
              <div className="inline-block px-3 py-1 bg-rose-600/20 border border-rose-500/40 text-rose-400 text-[10px] font-black rounded-full uppercase tracking-wider mb-2">
                🔴 Layanan Gift Sedang Tutup
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Jam Operasional Gift In-Game
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              Jam buka Gift In-Game:{" "}
              <strong className="text-amber-400">
                {GIFT_OPERATIONAL_HOURS}
              </strong>
              .<br />
              <br />
              Diluar jam buka tersebut, pemesanan Gift In-Game ditutup otomatis
              dan akan diproses kembali saat toko buka jam{" "}
              <strong className="text-white">11.00 WIB</strong>.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowGiftTimeWarning(false);
                  setPendingGiftProduct(null);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl transition text-xs cursor-pointer"
              >
                Tutup Peringatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INFORMATIONAL OPERATIONAL BANNER FOR GIFT IN GAME */}
      {selectedCategory === "gift" &&
        (() => {
          const giftStatus = getGiftOperatingStatus();
          return (
            <div
              className={`p-3.5 rounded-2xl mb-4 text-xs font-semibold flex items-start gap-3 border transition-all ${
                giftStatus.isOperatingHours
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-950/40 border-amber-500/30 text-amber-200"
              }`}
            >
              <span className="text-base">
                {giftStatus.isOperatingHours ? "⚡" : "🕒"}
              </span>
              <div className="flex-1">
                <p className="font-bold text-white">
                  {giftStatus.isOperatingHours
                    ? "Proses Gift Sedang Aktif"
                    : "Pemberitahuan Jam Operasional Gift"}
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  {giftStatus.message}
                </p>
              </div>
            </div>
          );
        })()}

      {/* Category selector (Tabs) */}
      <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm">
        <button
          onClick={() => setSelectedCategory("gift")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black tracking-wide flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${selectedCategory === "gift" ? "bg-blue-600 text-white font-black shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"}`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Gift In Game</span>
          {isCurrentlyGiftClosed && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[8px] font-black rounded uppercase">
              DI LUAR JAM
            </span>
          )}
        </button>
        <button
          onClick={() => setSelectedCategory("joko")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black tracking-wide flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${selectedCategory === "joko" ? "bg-blue-600 text-white font-black shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"}`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Joko</span>
          <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[8px] font-black rounded uppercase">
            24 Jam
          </span>
        </button>
      </div>

      {/* Floating cart indicator */}
      {cart.length > 0 && (
        <div className="flex justify-end animate-fade-in">
          <button
            onClick={onViewCart}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 border border-blue-400 transition-all active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            Keranjang ({cart.reduce((total, c) => total + c.qty, 0)})
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div
              key={i}
              className="bg-slate-900 h-60 rounded-2xl border border-slate-800/80 p-4 space-y-4"
            >
              <div className="w-full h-32 bg-slate-800 rounded-xl" />
              <div className="h-4 bg-slate-800 rounded w-2/3" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-lg mx-auto">
          <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">
            Belum ada katalog item yang ditambahkan.
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Admin belum menambahkan item untuk kategori ini. Harap kembali dalam
            beberapa saat.
          </p>
        </div>
      ) : (
        /* Card Game Grid Layout */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {filteredGames.map((game, idx) => {
            const lowestPrice = getLowestPrice(game);
            const isGiftItem = isProductGift(game);
            const isClosedDueToGiftTime = isGiftItem && isCurrentlyGiftClosed;
            const available = isProductAvailable(game);

            return (
              <div
                key={game.id ? `game-${game.id}-${idx}` : `game-${idx}`}
                onClick={() => handleBuyClick(game)}
                className="group bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl overflow-hidden cursor-pointer shadow-lg transition-all hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between relative"
              >
                {/* Image & Popular Badge */}
                <div className="relative h-40 w-full overflow-hidden flex-none bg-slate-950/80 rounded-t-2xl">
                  {game.imageUrl ? (
                    <img
                      src={game.imageUrl}
                      alt={game.title}
                      className="w-full h-40 object-cover rounded-t-2xl group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-slate-950 text-blue-400">
                      <Sparkles className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80 pointer-events-none" />

                  {/* Closed overlay for store */}
                  {!available ? (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <span className="px-3 py-1.5 bg-rose-600 border border-rose-500 text-white font-black text-[10px] rounded-lg shadow-md uppercase tracking-wider">
                        🔴 TOKO DITUTUP
                      </span>
                    </div>
                  ) : null}

                  {/* Popular Indicator */}
                  {game.isPopular && available && (
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 bg-rose-600 text-white text-[9px] font-black tracking-wide rounded-md uppercase shadow-sm flex items-center gap-1 z-0">
                      👑 Populer
                    </span>
                  )}

                  {/* Discount tag */}
                  {game.discountTag && available && (
                    <span className="absolute top-3 right-3 px-2.5 py-0.5 bg-blue-600 text-white text-[9px] font-black tracking-wide rounded-md uppercase shadow-sm z-0">
                      {game.discountTag}
                    </span>
                  )}
                </div>

                {/* Card Info Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 leading-snug group-hover:text-blue-400 transition-colors line-clamp-1">
                      {game.title}
                    </h3>
                    {game.category === "gift" && (
                      <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase flex items-center gap-1">
                        <span>• Gift In Game Direct</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-semibold">
                        Mulai Rp
                      </span>
                      <span className="text-sm font-black text-blue-400">
                        {lowestPrice > 0
                          ? `Rp ${lowestPrice.toLocaleString("id-ID")}`
                          : "Rp 0"}
                      </span>
                    </div>

                    {calculateTotalSold(game) > 0 && (
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700/60 text-slate-400 text-[9px] font-bold rounded-lg uppercase">
                        🔥 {calculateTotalSold(game)}+ Terjual
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal/Drawer Detail Pricelist */}
      {selectedGame && (
        <div
          className={
            standaloneCategory
              ? "w-full h-full"
              : "fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in"
          }
        >
          <div
            className={`w-full ${standaloneCategory ? "bg-transparent min-h-screen" : "max-h-[90vh] sm:max-h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden mx-3"} relative flex flex-col`}
          >
            {/* Header Modal - Full Banner */}
            <div className="relative h-40 sm:h-48 w-full shrink-0 bg-slate-950/90 overflow-hidden rounded-t-2xl">
              {selectedGame.imageUrl ? (
                <img
                  src={selectedGame.imageUrl}
                  alt={selectedGame.title}
                  className="w-full h-40 sm:h-48 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-40 sm:h-48 flex items-center justify-center bg-slate-950 text-blue-400">
                  <Sparkles className="w-10 h-10" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none" />
              <button
                onClick={() => {
                  setSelectedGame(null);
                  onClearSelectedGame?.();
                }}
                className={`absolute top-3 right-3 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 text-slate-300 hover:text-white rounded-full transition-all cursor-pointer z-10 ${standaloneCategory ? "hidden" : ""}`}
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-4 right-4 z-10">
                <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[9px] font-black rounded-md uppercase tracking-wider">
                  {selectedGame.category === "gift"
                    ? "Gift Di Game"
                    : "Pricelist Joko"}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide mt-1 truncate">
                  {selectedGame.title}
                </h2>
              </div>
            </div>

            {/* Closed Alert Notice Inside Detail Modal */}
            {isProductGift(selectedGame) && isCurrentlyGiftClosed && (
              <div className="p-3 bg-amber-950/60 border-b border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200 shrink-0">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="leading-snug">
                  Layanan Gift In-Game <strong>TUTUP</strong>. Jam buka:{" "}
                  <strong>{GIFT_OPERATIONAL_HOURS}</strong>.
                </span>
              </div>
            )}

            {/* Grid Card Produk Customer */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-5 bg-slate-900 pb-24 min-h-0 pt-4">
              {!selectedGame.pricelists ||
              selectedGame.pricelists.length === 0 ? (
                <p className="text-center py-12 text-xs text-slate-500">
                  Belum ada rincian paket terdaftar.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-3.5 items-stretch pb-10">
                  {selectedGame.pricelists.map((pkg, pIdx) => {
                    const qtyInCart = getCartQty(selectedGame.id, pkg.id);
                    const isGiftItem =
                      isProductGift(selectedGame) || isProductGift(pkg);
                    const isClosedForGift = isGiftItem && isCurrentlyGiftClosed;

                    return (
                      <div
                        key={pkg.id ? `pkg-${pkg.id}-${pIdx}` : `pkg-${pIdx}`}
                        className="relative flex flex-col justify-between p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all group shadow-md min-w-0 h-full"
                      >
                        {/* Area Atas: Header Card + Gambar */}
                        <div className="flex items-start justify-between gap-2.5 min-w-0">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 bg-slate-950 text-slate-400 font-mono text-[9px] font-bold rounded border border-slate-800">
                                {pkg.code || "CODE"}
                              </span>
                              <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                {pkg.estimatedTime || "Cepat"}
                              </span>
                            </div>

                            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
                              {pkg.name}
                            </h4>

                            <div className="text-xs sm:text-sm font-bold text-red-500 pt-0.5">
                              {pkg.originalPrice !== undefined &&
                                pkg.originalPrice > pkg.price && (
                                  <span className="text-[10px] text-slate-500 line-through mr-1.5 font-normal">
                                    Rp{" "}
                                    {pkg.originalPrice.toLocaleString("id-ID")}
                                  </span>
                                )}
                              <span>
                                Rp {pkg.price.toLocaleString("id-ID")}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <span>⚡</span>
                              <span>
                                {pkg.sold !== undefined && pkg.sold > 0
                                  ? `${pkg.sold} Terjual`
                                  : "100+ Terjual"}
                              </span>
                            </div>
                          </div>

                          {/* Sisi Kanan: Icon/Thumbnail Paket */}
                          {Boolean(pkg.iconUrl || pkg.imageUrl) && (
                            <div className="shrink-0 flex items-center justify-center">
                              <img
                                src={pkg.iconUrl || pkg.imageUrl}
                                alt={pkg.name}
                                className="w-12 h-12 sm:w-14 sm:h-14 object-contain bg-transparent drop-shadow-md transition-transform group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                        </div>

                        {/* Aksi Pembelian / Keranjang (Selalu nempel di dasar card) */}
                        <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 shrink-0">
                          {!isProductAvailable(selectedGame) ? (
                            <span className="w-full py-1.5 bg-red-950/40 border border-red-800/40 text-red-400 rounded-lg text-[10px] font-black uppercase tracking-wider shadow flex items-center justify-center gap-1">
                              🔴 TUTUP
                            </span>
                          ) : !isProductAvailable(pkg) ? (
                            <span className="w-full py-1.5 bg-rose-950/50 border border-rose-800/40 text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-wider shadow flex items-center justify-center gap-1">
                              🚫 KOSONG
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handlePackageAddToCart(
                                    selectedGame,
                                    pkg,
                                    false,
                                  )
                                }
                                className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-blue-400 border border-blue-500/40 rounded-lg text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer shrink-0"
                                title="Tambah ke Keranjang"
                              >
                                <Plus className="w-3 h-3" />
                                <span>
                                  {qtyInCart > 0
                                    ? `(${qtyInCart})`
                                    : "Keranjang"}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handlePackageAddToCart(
                                    selectedGame,
                                    pkg,
                                    true,
                                  )
                                }
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md shadow-blue-500/20 cursor-pointer min-w-0"
                              >
                                <span>Beli</span>
                                <ArrowRight className="w-3 h-3 shrink-0" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-slate-500 leading-tight">
                Pencet **Beli** untuk langsung checkout pembayaran.
              </span>
              <button
                onClick={() => {
                  setSelectedGame(null);
                  onClearSelectedGame?.();
                }}
                className={`px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer ${standaloneCategory ? "hidden" : ""}`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROBLOX AVATAR CHECKER MODAL IS REMOVED ENTIRELY */}

      {/* OFF HOURS GIFT CONFIRMATION MODAL */}
      {showOffHoursModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            {/* Icon Jam */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 text-2xl">
              🕒
            </div>

            {/* Judul & Penjelasan */}
            <div className="space-y-2">
              <h3 className="text-base font-black text-white">
                ⏰ Pemberitahuan Jam Operasional Gift
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-left">
                Saat ini layanan Gift sedang berada di luar jam proses
                pengiriman. Kamu tetap bisa melakukan pemesanan dan pembayaran
                sekarang, dan pesananmu akan diproses otomatis saat jam
                operasional buka.
              </p>
            </div>

            {/* Tombol Aksi */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowOffHoursModal(false);
                  if (pendingGiftProduct) {
                    proceedToSelectProduct(
                      pendingGiftProduct.game,
                      pendingGiftProduct.pkg,
                      pendingGiftProduct.launchDirectly,
                    );
                    setPendingGiftProduct(null);
                  } else if (selectedGiftItem) {
                    setSelectedGame(selectedGiftItem);
                    setSelectedGiftItem(null);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition text-xs cursor-pointer shadow-md shadow-blue-500/20"
              >
                Lanjut Checkout / Saya Mengerti
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOffHoursModal(false);
                  setPendingGiftProduct(null);
                  setSelectedGiftItem(null);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl transition text-xs cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
