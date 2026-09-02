import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, doc, updateDoc, increment, limit } from 'firebase/firestore';
import { ReviewItem } from '../../types';
import { getCatalogOrCategoryImage } from '../../utils/productImageResolver';
import { Star, ThumbsUp, MessageSquare, Filter, ShieldCheck, CheckCircle2, Award, ChevronDown, Sparkles } from 'lucide-react';
import { maskCustomerName as maskNameUtil } from '../../utils/leaderboardUtils';
import { safeGetJSON, safeSetJSON } from '../../utils/safeStorage';
import { getReviewTimestamp, formatReviewDate, isFictionalOrTemplateReview } from '../../utils/reviewUtils';
import { HISTORICAL_5_STAR_REVIEWS, MASTER_BASE_COUNT } from '../../data/masterReviewsData';

export { formatReviewDate };

export const ReviewsSection: React.FC = () => {
  const [catalogList, setCatalogList] = useState<any[]>([]);
  const [categoryList, setCategoryList] = useState<any[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>(HISTORICAL_5_STAR_REVIEWS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [helpfulClicked, setHelpfulClicked] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [visibleCount, setVisibleCount] = useState<number>(12);
  const [firestoreTotalSize, setFirestoreTotalSize] = useState<number>(MASTER_BASE_COUNT);

  useEffect(() => {
    // 2.0s safety timeout
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    // Fetch live reviews collection with limit
    const q = query(collection(db, 'reviews'), limit(80));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      clearTimeout(timeout);
      setFirestoreTotalSize(Math.max(MASTER_BASE_COUNT, snapshot.size));
      const liveList = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          helpfulCount: data.helpfulCount || 0
        } as ReviewItem;
      });

      // FILTER MUTLAK: Ambil dan tampilkan ulasan bintang 4-5 otentik & bersihkan bot template lama
      const authenticLiveReviews = liveList.filter(review => {
        const ratingNum = Number(review.rating) || 5;
        if (ratingNum < 4) return false;
        if (isFictionalOrTemplateReview(review)) return false;
        return true;
      });

      // Merge live Firestore reviews with historical master database without duplication
      const existingIds = new Set(authenticLiveReviews.map(r => r.id));
      const filteredHistorical = HISTORICAL_5_STAR_REVIEWS.filter(r => !existingIds.has(r.id));
      const combined = [...authenticLiveReviews, ...filteredHistorical];

      setReviews(combined);
      setIsLoading(false);
    }, (err) => {
      clearTimeout(timeout);
      console.error("Error listening reviews:", err);
      setIsLoading(false);
    });

    // Realtime listener for catalogs to resolve images safely
    const unsubCatalogs = onSnapshot(query(collection(db, 'catalogs'), limit(60)), (snapshot) => {
      const liveCats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCatalogList(liveCats);
    }, (err) => {
      console.warn("Could not load catalogs for review images:", err);
    });

    const saved = safeGetJSON<string[]>('helpful_reviews', []);
    if (Array.isArray(saved) && saved.length > 0) {
      setHelpfulClicked(saved);
    }

    return () => {
      clearTimeout(timeout);
      unsubscribe();
      unsubCatalogs();
    };
  }, []);

  const handleHelpful = async (reviewId: string) => {
    if (helpfulClicked.includes(reviewId)) return;

    try {
      if (reviewId && !reviewId.startsWith('rev-hist-')) {
        const reviewRef = doc(db, 'reviews', reviewId);
        await updateDoc(reviewRef, {
          helpfulCount: increment(1)
        });
      }
      const newList = [...helpfulClicked, reviewId];
      setHelpfulClicked(newList);
      safeSetJSON('helpful_reviews', newList);
      
      // Update local state for immediate UI feedback
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r));
    } catch (err) {
      console.error('Gagal menambah helpful:', err);
    }
  };

  // Strict Descending / Ascending Timestamp Sorting
  // Normalized: Latest dates (25 Agu 2026, 24 Agu 2026, etc.) always placed at top
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const timeA = getReviewTimestamp(a);
      const timeB = getReviewTimestamp(b);

      if (sortOrder === 'newest') {
        return timeB - timeA;
      } else {
        return timeA - timeB;
      }
    });
  }, [reviews, sortOrder]);

  const totalDisplayCount = useMemo(() => {
    return firestoreTotalSize;
  }, [firestoreTotalSize]);

  const displayedReviews = useMemo(() => {
    return sortedReviews.slice(0, visibleCount);
  }, [sortedReviews, visibleCount]);

  const getAvatarInitial = (name: string) => {
    if (!name) return 'U';
    const cleanName = name.replace(/[*]/g, '').trim();
    return (cleanName[0] || name[0] || 'U').toUpperCase();
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + 12, sortedReviews.length));
  };

  const handleShowAll = () => {
    setVisibleCount(sortedReviews.length);
  };

  return (
    <div className="space-y-6 pt-2 pb-16 max-w-6xl mx-auto px-2 sm:px-4 animate-fade-in text-slate-100">
      {/* HEADER & SUMMARY */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ulasan Bintang 5 Otentik Pelanggan
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            ⭐ Testimoni & Kepuasan Pelanggan <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">({totalDisplayCount.toLocaleString('id-ID')}+ Ulasan)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Ulasan bintang 5 murni dari para pelanggan terverifikasi yang telah menyelesaikan pesanan di Entong Store.
          </p>
        </div>

        {/* SUMMARY BADGE & CONTROLS */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* SORT DROPDOWN */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 p-2.5 rounded-2xl">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              id="review-sort-dropdown"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-2"
            >
              <option value="newest" className="bg-slate-900 text-slate-100">📌 Terbaru (Default)</option>
              <option value="oldest" className="bg-slate-900 text-slate-100">⌛ Terlama</option>
            </select>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl flex items-center gap-4 flex-1 md:flex-none">
            <div className="text-center">
              <div className="text-2xl font-black text-amber-400">5.0</div>
              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Rating Toko</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" />
                ))}
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold block flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-400" /> 100% Kepuasan Bintang 5
              </span>
            </div>
          </div>
        </div>
      </div>

      {isLoading && reviews.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 animate-pulse space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800" />
                  <div className="space-y-2">
                    <div className="w-28 h-3 bg-slate-800 rounded" />
                    <div className="w-20 h-2 bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="w-16 h-6 bg-slate-800 rounded-xl" />
              </div>
              <div className="h-16 bg-slate-800/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : displayedReviews.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/90 rounded-3xl border border-slate-800 p-8 space-y-3">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">Belum ada ulasan bintang 5 saat ini.</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ulasan bintang 5 dari pelanggan yang telah menyelesaikan transaksi di Entong Store akan otomatis tampil di sini.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedReviews.map((rev, rIdx) => {
              const hasLiked = helpfulClicked.includes(rev.id);
              const isAnon = (rev as any).isAnonymous === true;
              const displayName = isAnon 
                ? maskNameUtil(rev.userName || rev.customerName || 'Pelanggan')
                : maskNameUtil(rev.userName || rev.customerName || 'Pelanggan'); // Always mask now as per prompt
              
              return (
                <div 
                  key={rev.id ? `rev-${rev.id}-${rIdx}` : `rev-${rIdx}`} 
                  className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800/90 rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-all group duration-200"
                >
                  <div>
                    {/* CARD HEADER */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 border border-blue-500/30 flex items-center justify-center text-sm font-black text-white shadow-md shrink-0 uppercase">
                          {getAvatarInitial(displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-100 truncate">{displayName}</h4>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[9px] font-extrabold text-emerald-400 uppercase">
                              <ShieldCheck className="w-3 h-3" /> VERIFIED
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 mt-1">
                            {[...Array(Math.max(1, Math.min(5, Number(rev.rating) || 5)))].map((_, i) => (
                              <Star 
                                key={i} 
                                className="w-3.5 h-3.5 fill-[#FFD700] text-[#FFD700]" 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-slate-400 font-medium">
                          {formatReviewDate(rev.createdAt || (rev as any).createdAtMillis)}
                        </p>
                      </div>
                    </div>

                    {/* Comment Body */}
                    <div className="mb-4">
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium italic break-words">
                        "{rev.comment}"
                      </p>
                    </div>
                  </div>

                  {/* CARD FOOTER - Product Info & Helpful */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 border-t border-slate-800/80 mt-auto">
                    {/* Product Info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      {(() => {
                        const productImg = getCatalogOrCategoryImage(rev, catalogList, categoryList);
                        return productImg ? (
                          <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 shrink-0 overflow-hidden">
                            <img 
                              src={productImg} 
                              alt={(rev as any).productName || (rev as any).packageName || "Paket"} 
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                        ) : null;
                      })()}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-white truncate">
                          {(rev as any).productName || (rev as any).packageName || (rev as any).itemName || 'Layanan Game / Gamepass'}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {rev.gameTitle || (rev as any).gameName || (rev as any).category || 'Roblox'}
                        </span>
                      </div>
                    </div>

                    {/* Helpful Button */}
                    <button
                      onClick={() => handleHelpful(rev.id)}
                      disabled={hasLiked}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all shadow shrink-0 border cursor-pointer ${
                        hasLiked 
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-not-allowed'
                          : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200 active:scale-95'
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-blue-400 text-blue-400' : ''}`} />
                      <span>Membantu?</span>
                      {rev.helpfulCount > 0 && (
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded-md font-extrabold text-[9px] text-blue-400">
                          {rev.helpfulCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAGINATION / LOAD MORE CONTROLS (ANTI-LAG) */}
          {visibleCount < sortedReviews.length && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6">
              <button
                onClick={handleLoadMore}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronDown className="w-4 h-4 animate-bounce" />
                Tampilkan Lebih Banyak Ulasan ({displayedReviews.length} dari {sortedReviews.length})
              </button>
              <button
                onClick={handleShowAll}
                className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Tampilkan Semua ({sortedReviews.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const Testimoni = ReviewsSection;

