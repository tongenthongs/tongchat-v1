import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, writeBatch, limit 
} from 'firebase/firestore';
import { GameCatalog, ReviewItem } from '../../types';
import { 
  Star, Trash2, Edit2, MessageSquare, Check, X, RefreshCw, Gamepad2, AlertCircle, 
  ShieldCheck, Search, Filter, Sparkles, CheckCircle2, Zap, List
} from 'lucide-react';
import { maskCustomerName as maskNameUtil } from '../../utils/leaderboardUtils';
import { 
  isFictionalOrTemplateReview, getReviewTimestamp, formatReviewDate, generateNaturalSlangReview 
} from '../../utils/reviewUtils';
import { AdminReviewGenerator } from './AdminReviewGenerator';

export { formatReviewDate };

export const AdminReviewsManager: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<'list' | 'generator'>('list');
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [catalogs, setCatalogs] = useState<GameCatalog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filter & Search states
  const [filterTab, setFilterTab] = useState<'all_real' | 'all' | 'star5' | 'star4' | 'low_stars' | 'fictional'>('all_real');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'rating_desc' | 'rating_asc'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states (For editing customer review)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [productName, setProductName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Realtime catalogs reader
  useEffect(() => {
    const unsubCatalogs = onSnapshot(query(collection(db, 'catalogs'), limit(60)), (snapshot) => {
      const fetched: GameCatalog[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as GameCatalog));
      setCatalogs(fetched);
    }, (err) => {
      console.error("Error loading catalogs:", err);
    });

    // Realtime reviews reader for all reviews in collection with limit
    const unsubReviews = onSnapshot(
      query(collection(db, 'reviews'), limit(100)),
      (snapshot) => {
        const fetched: ReviewItem[] = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as ReviewItem));
        setReviews(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading reviews:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubCatalogs();
      unsubReviews();
    };
  }, []);

  // Stats calculation
  const totalCount = reviews.length;
  const fictionalReviews = useMemo(() => reviews.filter(r => isFictionalOrTemplateReview(r)), [reviews]);
  const realReviews = useMemo(() => reviews.filter(r => !isFictionalOrTemplateReview(r)), [reviews]);
  
  const realCount = realReviews.length;
  const fictionalCount = fictionalReviews.length;
  const star5Count = realReviews.filter(r => (Number(r.rating) || 5) === 5).length;
  const star4Count = realReviews.filter(r => (Number(r.rating) || 5) === 4).length;
  const lowStarCount = realReviews.filter(r => (Number(r.rating) || 5) <= 3).length;

  const averageRating = realCount > 0
    ? (realReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / realCount).toFixed(1)
    : '5.0';

  // 1-Click Action: Hapus Semua Ulasan Fiktif / Non-Otentik
  const handleDeleteAllFictional = async () => {
    if (fictionalCount === 0) {
      showToast("Tidak ada ulasan fiktif untuk dibersihkan.", "success");
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus SEMUA ${fictionalCount} ulasan fiktif / template auto-seed? Tindakan ini permanen!`)) {
      return;
    }

    try {
      const chunkSize = 400;
      for (let i = 0; i < fictionalReviews.length; i += chunkSize) {
        const chunk = fictionalReviews.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          batch.delete(doc(db, 'reviews', item.id));
        });
        await batch.commit();
      }
      showToast(`Berhasil menghapus ${fictionalReviews.length} ulasan fiktif & template!`, 'success');
    } catch (err: any) {
      console.error("Gagal menghapus ulasan fiktif:", err);
      showToast(`Gagal menghapus ulasan: ${err.message}`, 'error');
    }
  };

  // 1-Click Action: Bersihkan Template Bot Kaku & Auto-seed Lama
  const handleCleanupAutoSeedReviews = async () => {
    if (!confirm("Apakah Anda yakin ingin membersihkan seluruh ulasan bot kaku/template lama dari database?")) return;

    try {
      const autoSeedDocs = reviews.filter(r => isFictionalOrTemplateReview(r));

      if (autoSeedDocs.length === 0) {
        showToast("Tidak ditemukan data ulasan bot kaku duplikat.", "success");
        return;
      }

      const chunkSize = 400;
      for (let i = 0; i < autoSeedDocs.length; i += chunkSize) {
        const chunk = autoSeedDocs.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          batch.delete(doc(db, 'reviews', item.id));
        });
        await batch.commit();
      }

      showToast(`Berhasil membersihkan ${autoSeedDocs.length} ulasan bot kaku template!`, "success");
    } catch (err: any) {
      console.error("Gagal membersihkan ulasan duplikat:", err);
      showToast(`Gagal membersihkan ulasan duplikat: ${err.message}`, "error");
    }
  };

  // 1-Click Action: Sinkronkan & Generate Ulasan Slang Gamer dengan Katalog Aktif Toko
  const handleGenerateSlangReviews = async (count: number = 8) => {
    try {
      const batch = writeBatch(db);
      for (let i = 0; i < count; i++) {
        const item = generateNaturalSlangReview();
        const newRef = doc(collection(db, 'reviews'));
        batch.set(newRef, {
          id: newRef.id,
          ...item,
          source: 'gamer_slang_sync'
        });
      }
      await batch.commit();
      showToast(`Berhasil sinkron & inject ${count} ulasan gamer slang dengan item katalog aktif!`, 'success');
    } catch (err: any) {
      console.error("Gagal generate slang reviews:", err);
      showToast(`Gagal generate ulasan: ${err.message}`, 'error');
    }
  };

  // Handle single delete
  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus ulasan ini dari database?")) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
      showToast("Ulasan berhasil dihapus dari database!", "success");
    } catch (err: any) {
      console.error("Gagal menghapus ulasan:", err);
      showToast(`Gagal menghapus ulasan: ${err.message}`, "error");
    }
  };

  // Open Create Form
  const handleOpenCreateForm = () => {
    setEditingReview(null);
    setSelectedCatalogId(catalogs[0]?.id || '');
    setProductName(catalogs[0]?.title || 'Roblox Item / Gamepass');
    setCustomerName('');
    setRating(5);
    setComment('');
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEditForm = (review: ReviewItem) => {
    setEditingReview(review);
    setSelectedCatalogId(review.catalogId || '');
    setProductName(review.productName || '');
    setCustomerName(review.userName || review.customerName || '');
    setRating(Number(review.rating) || 5);
    setComment(review.comment || '');
    setIsFormOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !comment.trim()) {
      showToast("Nama dan Komentar tidak boleh kosong!", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedGameObj = catalogs.find(c => c.id === selectedCatalogId);
      const gameTitle = selectedGameObj ? selectedGameObj.title : (editingReview?.gameTitle || 'Roblox');
      const nowIso = new Date().toISOString();

      if (editingReview) {
        // Edit existing review
        await setDoc(doc(db, 'reviews', editingReview.id), {
          userName: customerName.trim(),
          customerName: customerName.trim(),
          rating: Number(rating) || 5,
          comment: comment.trim(),
          gameTitle: gameTitle,
          gameName: gameTitle,
          productName: productName.trim() || editingReview.productName,
          catalogId: selectedCatalogId || editingReview.catalogId || ''
        }, { merge: true });

        showToast("Ulasan berhasil diperbarui!", "success");
      } else {
        // Create new 5-star review
        const newDocRef = doc(collection(db, 'reviews'));
        await setDoc(newDocRef, {
          id: newDocRef.id,
          userName: customerName.trim(),
          customerName: customerName.trim(),
          rating: Number(rating) || 5,
          comment: comment.trim(),
          gameTitle: gameTitle,
          gameName: gameTitle,
          productName: productName.trim() || 'Layanan Game',
          catalogId: selectedCatalogId || '',
          createdAt: nowIso,
          createdAtMillis: Date.now(),
          helpfulCount: 0,
          isAnonymous: false,
          source: 'admin_panel'
        });

        showToast("Ulasan baru berhasil ditambahkan!", "success");
      }

      setIsFormOpen(false);
    } catch (err: any) {
      console.error("Gagal menyimpan ulasan:", err);
      showToast(`Gagal simpan: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Strict Descending Sort
  const filteredAndSortedReviews = useMemo(() => {
    let result = reviews.filter(rev => {
      const isFictional = isFictionalOrTemplateReview(rev);
      const ratingNum = Number(rev.rating) || 5;

      // Tab Filtering
      if (filterTab === 'all_real') {
        if (isFictional) return false;
      } else if (filterTab === 'star5') {
        if (isFictional || ratingNum !== 5) return false;
      } else if (filterTab === 'star4') {
        if (isFictional || ratingNum !== 4) return false;
      } else if (filterTab === 'low_stars') {
        if (isFictional || ratingNum > 3) return false;
      } else if (filterTab === 'fictional') {
        if (!isFictional) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (rev.userName || rev.customerName || '').toLowerCase();
        const text = (rev.comment || '').toLowerCase();
        const prod = (rev.productName || '').toLowerCase();
        const game = (rev.gameTitle || '').toLowerCase();
        if (!name.includes(q) && !text.includes(q) && !prod.includes(q) && !game.includes(q)) {
          return false;
        }
      }

      return true;
    });

    // Sorting Engine
    return result.sort((a, b) => {
      const timeA = getReviewTimestamp(a);
      const timeB = getReviewTimestamp(b);
      const ratingA = Number(a.rating) || 5;
      const ratingB = Number(b.rating) || 5;

      if (sortOption === 'newest') {
        // Strict Descending Timestamp (Terbaru selalu paling atas)
        return timeB - timeA;
      } else if (sortOption === 'oldest') {
        // Ascending Timestamp (Terlama paling atas)
        return timeA - timeB;
      } else if (sortOption === 'rating_desc') {
        // Rating Tertinggi (5 -> 1), fallback ke waktu terbaru
        if (ratingB !== ratingA) return ratingB - ratingA;
        return timeB - timeA;
      } else if (sortOption === 'rating_asc') {
        // Rating Terendah (1 -> 5), fallback ke waktu terbaru
        if (ratingA !== ratingB) return ratingA - ratingB;
        return timeB - timeA;
      }
      return timeB - timeA;
    });
  }, [reviews, filterTab, sortOption, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 ${
          toast.type === 'success' 
            ? 'bg-[#005C4B] text-[#00E676] border-[#00E676]/30' 
            : 'bg-red-950 text-red-400 border-red-500/30'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Top Navigation Tabs */}
      <div className="flex items-center gap-2 bg-[#111b21] p-1.5 rounded-2xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveMainTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMainTab === 'list'
              ? 'bg-[#00E676] text-[#111b21] shadow-lg shadow-[#00E676]/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]'
          }`}
        >
          <List className="w-4 h-4" />
          <span>Daftar & Kelola Ulasan ({reviews.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('generator')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeMainTab === 'generator'
              ? 'bg-[#00E676] text-[#111b21] shadow-lg shadow-[#00E676]/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#202c33]'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>⚡ Review & Testimonial Generator</span>
        </button>
      </div>

      {activeMainTab === 'generator' ? (
        <AdminReviewGenerator />
      ) : (
        <>
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider">
                  Ulasan Otentik Customer
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                ⭐ Kelola Ulasan & Testimoni Pelanggan
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pantau review otentik dari customer dan kelola kepuasan pelanggan secara realtime.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={() => setActiveMainTab('generator')}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                title="Buka generator testimoni bot dan manual"
              >
                <Zap className="w-4 h-4" /> ⚡ Bulk Bot Generator
              </button>
              <button
                onClick={handleOpenCreateForm}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                title="Tambah ulasan bintang 5 baru secara manual"
              >
                + Tambah Ulasan Baru
              </button>
              <button
                onClick={handleCleanupAutoSeedReviews}
                className="px-4 py-2.5 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                title="Bersihkan ulasan bot kaku dan template lama dari database"
              >
                🧹 Bersihkan Bot Kaku
              </button>
              {fictionalCount > 0 && (
                <button
                  onClick={handleDeleteAllFictional}
                  className="px-4 py-2.5 bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Hapus Fiktif ({fictionalCount})
                </button>
              )}
            </div>
          </div>

      {/* 📜 STATS DASHBOARD BAR */}
      <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Ringkasan Ulasan Otentik
          </h3>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Firestore Sync
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Ulasan Asli Customer</p>
            <p className="text-lg font-black text-[#00E676] mt-0.5">{realCount}</p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Rata-rata Rating</p>
            <p className="text-lg font-black text-amber-400 mt-0.5 flex items-center justify-center gap-1">
              ⭐ {averageRating}
            </p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Bintang 5 & 4</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{star5Count + star4Count}</p>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Auto-Seed / Fiktif</p>
            <p className={`text-lg font-black mt-0.5 ${fictionalCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`}>
              {fictionalCount}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS & SEARCH */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
        {/* Sub-Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterTab('all_real')}
            className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 ${
              filterTab === 'all_real'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            ✅ Ulasan Asli ({realCount})
          </button>
          <button
            onClick={() => setFilterTab('star5')}
            className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 ${
              filterTab === 'star5'
                ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            ⭐⭐⭐⭐⭐ ({star5Count})
          </button>
          <button
            onClick={() => setFilterTab('star4')}
            className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 ${
              filterTab === 'star4'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            ⭐⭐⭐⭐ ({star4Count})
          </button>
          {lowStarCount > 0 && (
            <button
              onClick={() => setFilterTab('low_stars')}
              className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 ${
                filterTab === 'low_stars'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              ⭐ 1-3 ({lowStarCount})
            </button>
          )}
          {fictionalCount > 0 && (
            <button
              onClick={() => setFilterTab('fictional')}
              className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 ${
                filterTab === 'fictional'
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              🚨 Terdeteksi Fiktif ({fictionalCount})
            </button>
          )}
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all flex items-center gap-1 ${
              filterTab === 'all'
                ? 'bg-slate-700/60 border border-slate-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            📑 Semua Termasuk Fiktif ({totalCount})
          </button>
        </div>

        {/* Search & Sort Dropdown */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ulasan / nama..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="newest" className="bg-slate-900 text-slate-100">📌 Terbaru (Default)</option>
              <option value="oldest" className="bg-slate-900 text-slate-100">⌛ Terlama</option>
              <option value="rating_desc" className="bg-slate-900 text-slate-100">⭐ Rating Tertinggi</option>
              <option value="rating_asc" className="bg-slate-900 text-slate-100">⭐ Rating Terendah</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add / Edit Review Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111b21] border border-slate-700/80 p-6 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <button 
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 bg-slate-800/60 rounded-xl hover:bg-slate-700/80 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-lg uppercase tracking-wider inline-block mb-2">
                {editingReview ? '✍️ Edit Ulasan Pelanggan' : '✨ Tambah Ulasan Bintang 5'}
              </span>
              <h3 className="text-base font-black text-slate-100">
                {editingReview ? 'Koreksi Data Ulasan' : 'Input Ulasan Bintang 5 Baru'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {editingReview ? 'Perbarui komentar atau rating ulasan pelanggan.' : 'Tambahkan ulasan bintang 5 baru untuk ditampilkan di etalase toko.'}
              </p>
            </div>

            <form onSubmit={handleSaveReview} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Nama Customer
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Rating Bintang
                  </label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 Bintang)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 Bintang)</option>
                    <option value={3}>⭐⭐⭐ (3 Bintang)</option>
                    <option value={2}>⭐⭐ (2 Bintang)</option>
                    <option value={1}>⭐ (1 Bintang)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Nama Produk / Layanan
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Isi Komentar Ulasan *
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  rows={3}
                  maxLength={300}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid List view of reviews */}
      {loading ? (
        <div className="text-center py-12 bg-[#111b21] rounded-2xl border border-slate-800 p-8">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Memuat data ulasan secara realtime...</p>
        </div>
      ) : filteredAndSortedReviews.length === 0 ? (
        <div className="text-center py-12 bg-[#111b21] rounded-2xl border border-slate-800 p-8 space-y-2">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">Tidak ada ulasan yang sesuai kriteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Semua ulasan asli customer yang telah menyelesaikan transaksi akan ditampilkan di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedReviews.map((rev, idx) => {
            const isFic = isFictionalOrTemplateReview(rev);
            const isAnon = (rev as any).isAnonymous === true;
            const displayName = isAnon
              ? maskNameUtil(rev.userName || (rev as any).customerName || '') || 'Pelanggan Anonim'
              : (rev.userName || (rev as any).customerName || 'Pelanggan');

            const currentRating = Number(rev.rating) || 5;

            const getAvatarInitial = (name: string) => {
              if (!name) return 'U';
              const cleanName = name.replace(/[*]/g, '').trim();
              return (cleanName[0] || name[0] || 'U').toUpperCase();
            };

            return (
              <div 
                key={rev.id ? `rev-${rev.id}-${idx}` : `rev-${idx}`}
                className="bg-[#111b21] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-emerald-400 uppercase shrink-0">
                        {getAvatarInitial(displayName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{displayName}</h4>
                          {isFic ? (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[8px] font-extrabold text-amber-400 uppercase shrink-0">
                              ⚠️ TEMPLATE / AUTO
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-extrabold text-emerald-400 uppercase shrink-0 flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" /> ASLI CUSTOMER
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                          {formatReviewDate(rev.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-3 h-3 ${i < currentRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} 
                        />
                      ))}
                      <span className="text-[10px] font-black text-amber-400 ml-1">{currentRating}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/40 mb-3">
                    <p className="text-xs text-slate-200 italic break-words">
                      "{rev.comment}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800/60">
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-[9px] font-bold rounded-lg truncate uppercase max-w-full">
                      <Gamepad2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      {rev.productName || 'Layanan Game'} <span className="text-slate-600 font-normal">({rev.gameTitle || 'Entong Store'})</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenEditForm(rev)}
                      title="Edit Ulasan"
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg hover:text-emerald-400 transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(rev.id)}
                      title="Hapus Ulasan dari Database"
                      className="p-1.5 bg-red-950/20 hover:bg-red-950/60 border border-red-900/30 hover:border-red-500/40 text-red-400 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};
