import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, query, orderBy, limit 
} from 'firebase/firestore';
import { GameCatalog, ReviewItem } from '../../types';
import { 
  Star, Sparkles, Zap, Bot, UserCheck, Check, AlertCircle, RefreshCw, 
  Trash2, Layers, Filter, Clock, MessageSquare, ShieldCheck, Tag, ThumbsUp,
  Calendar, ArrowRight, Eye, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { 
  buildSingleReviewPayload, generateHumanCustomerName, generateHumanReviewText, 
  getRandomTimestamp, maskCustomerName, GeneratorConfig, pickRandomProduct 
} from '../../utils/humanReviewGenerator';
import { getCatalogOrCategoryImage } from '../../utils/productImageResolver';
import { formatReviewDate } from '../../utils/reviewUtils';

const QUICK_KEYWORD_PILLS = [
  "satset", "kilat", "amanah", "admin ramah", "bonus", "worth it", 
  "join server cepat", "rekomen", "no tipu tipu", "mendarat mulus", 
  "fast respon", "mantap", "legit", "murah bgt"
];

export const AdminReviewGenerator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bot_generator' | 'manual_input' | 'manage_generated'>('bot_generator');
  const [catalogs, setCatalogs] = useState<GameCatalog[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);

  // Tab 1: Bot Generator Config
  const [bulkCount, setBulkCount] = useState<number>(100);
  const [customCountInput, setCustomCountInput] = useState<string>('100');
  const [targetCategory, setTargetCategory] = useState<string>('all');
  const [ratingMode, setRatingMode] = useState<'all5' | 'realistic'>('all5');
  const [keywords, setKeywords] = useState<string>("satset, kilat, amanah, admin ramah, bonus, worth it, join server cepat, rekomen");
  const [timeRange, setTimeRange] = useState<'1w' | '1m' | '3m'>('1m');

  // Generation Progress & State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number }>({ current: 0, total: 0, percent: 0 });
  const [previewItems, setPreviewItems] = useState<any[]>([]);

  // Tab 2: Manual Input State
  const [manualName, setManualName] = useState<string>('');
  const [manualMasked, setManualMasked] = useState<boolean>(true);
  const [manualRating, setManualRating] = useState<number>(5);
  const [manualCatalogId, setManualCatalogId] = useState<string>('');
  const [manualPackageName, setManualPackageName] = useState<string>('');
  const [manualComment, setManualComment] = useState<string>('');
  const [manualHelpful, setManualHelpful] = useState<number>(12);
  const [manualDateIso, setManualDateIso] = useState<string>(new Date().toISOString().slice(0, 16));
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Bulk Delete State
  const [isDeletingGenerated, setIsDeletingGenerated] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Realtime Catalogs & Reviews Listener
  useEffect(() => {
    const unsubCatalogs = onSnapshot(query(collection(db, 'catalogs'), limit(60)), (snapshot) => {
      const fetched: GameCatalog[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as GameCatalog));
      setCatalogs(fetched);
      setIsLoadingCatalogs(false);

      if (fetched.length > 0 && !manualCatalogId) {
        setManualCatalogId(fetched[0].id);
        const firstPkg = fetched[0].pricelists?.[0]?.name || fetched[0].title;
        setManualPackageName(firstPkg);
      }
    }, (err) => {
      console.error("Error loading catalogs:", err);
      setIsLoadingCatalogs(false);
    });

    const unsubReviews = onSnapshot(query(collection(db, 'reviews'), limit(100)), (snapshot) => {
      const fetched: ReviewItem[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ReviewItem));
      setReviews(fetched);
    }, (err) => {
      console.error("Error loading reviews:", err);
    });

    return () => {
      unsubCatalogs();
      unsubReviews();
    };
  }, []);

  // Update Preview Samples when generator settings change
  const currentConfig: GeneratorConfig = useMemo(() => ({
    targetCategory,
    ratingMode,
    keywords,
    timeRange
  }), [targetCategory, ratingMode, keywords, timeRange]);

  const refreshPreviewSamples = () => {
    const samples: any[] = [];
    for (let i = 0; i < 3; i++) {
      samples.push(buildSingleReviewPayload(currentConfig, catalogs, i));
    }
    setPreviewItems(samples);
  };

  useEffect(() => {
    refreshPreviewSamples();
  }, [currentConfig, catalogs]);

  // Statistics calculation
  const totalReviewsCount = reviews.length;
  const botGeneratedReviews = useMemo(() => {
    return reviews.filter(r => r.source === 'review_generator' || r.isManualOrBot === true);
  }, [reviews]);
  const botGeneratedCount = botGeneratedReviews.length;

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return '5.0';
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const star5Count = useMemo(() => {
    return reviews.filter(r => (Number(r.rating) || 5) === 5).length;
  }, [reviews]);

  // Handle Preset Count selection
  const handleSelectCountPreset = (count: number) => {
    setBulkCount(count);
    setCustomCountInput(count.toString());
  };

  const handleCustomCountChange = (val: string) => {
    setCustomCountInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setBulkCount(Math.min(5000, parsed));
    }
  };

  // Toggle Keyword Chip
  const handleToggleKeyword = (word: string) => {
    const currentList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (currentList.includes(word)) {
      const filtered = currentList.filter(k => k !== word);
      setKeywords(filtered.join(', '));
    } else {
      setKeywords([...currentList, word].join(', '));
    }
  };

  // ==========================================
  // TAB 1: EXECUTE BULK INJECTION (CHUNKED BATCH)
  // ==========================================
  const handleExecuteBulkGeneration = async () => {
    const targetCount = bulkCount;
    if (targetCount <= 0 || targetCount > 5000) {
      showToast("Jumlah review harus antara 1 sampai 5.000!", "error");
      return;
    }

    if (!confirm(`Generate ${targetCount.toLocaleString('id-ID')} ulasan otomatis ke Firestore sekarang?\nUlasan akan langsung aktif dan muncul di halaman Testimoni Pelanggan.`)) {
      return;
    }

    setIsGenerating(true);
    setProgress({ current: 0, total: targetCount, percent: 0 });

    try {
      const BATCH_SIZE = 450; // Aman di bawah batas 500 Firestore writeBatch
      const generatedItems: any[] = [];

      // 1. Bangun array payload ulasan lengkap
      for (let i = 0; i < targetCount; i++) {
        const item = buildSingleReviewPayload(currentConfig, catalogs, i);
        generatedItems.push(item);
      }

      // 2. Eksekusi per chunk batch
      for (let i = 0; i < generatedItems.length; i += BATCH_SIZE) {
        const chunk = generatedItems.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(reviewDoc => {
          const docRef = doc(db, 'reviews', reviewDoc.id);
          batch.set(docRef, reviewDoc);
        });

        await batch.commit();

        const currentProcessed = Math.min(i + BATCH_SIZE, targetCount);
        const percent = Math.round((currentProcessed / targetCount) * 100);
        setProgress({
          current: currentProcessed,
          total: targetCount,
          percent
        });
      }

      showToast(`Sukses membuat ${targetCount.toLocaleString('id-ID')} ulasan testimoni ke database!`, "success");
      refreshPreviewSamples();
    } catch (err: any) {
      console.error("Gagal generate bulk reviews:", err);
      showToast(`Gagal generate review: ${err.message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================
  // TAB 2: MANUAL REVIEW SUBMISSION
  // ==========================================
  const handleSaveManualReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualName.trim()) {
      showToast("Nama Customer wajib diisi!", "error");
      return;
    }
    if (!manualComment.trim()) {
      showToast("Isi Ulasan wajib diisi!", "error");
      return;
    }

    setIsSubmittingManual(true);

    try {
      const selectedCat = catalogs.find(c => c.id === manualCatalogId);
      const gameTitle = selectedCat?.title || 'Roblox';
      const category = selectedCat?.category || 'gift';
      const selectedPricelist = selectedCat?.pricelists?.find(p => p.name === manualPackageName);
      const imageUrl = selectedPricelist?.imageUrl || selectedCat?.imageUrl || null;
      const price = selectedPricelist?.price || 0;

      const dateObj = new Date(manualDateIso);
      const validMillis = !isNaN(dateObj.getTime()) ? dateObj.getTime() : Date.now();
      const validIso = new Date(validMillis).toISOString();

      const cName = manualName.trim();
      const finalMasked = manualMasked ? maskCustomerName(cName) : cName;

      const reviewId = `rev_man_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newReviewDoc = {
        id: reviewId,
        customerName: cName,
        userName: cName,
        maskedName: finalMasked,
        rating: Number(manualRating) || 5,
        comment: manualComment.trim(),
        review: manualComment.trim(),
        
        catalogId: manualCatalogId || '',
        packageId: selectedPricelist?.id || null,
        packageName: manualPackageName || 'Gamepass / Item Gift',
        productName: manualPackageName || 'Gamepass / Item Gift',
        gameTitle: gameTitle,
        gameName: gameTitle,
        category: category,
        imageUrl: imageUrl,
        price: price,

        helpfulCount: Number(manualHelpful) || 0,
        isVerified: true,
        isManualOrBot: true,
        isAnonymous: false,
        status: 'APPROVED',
        createdAt: validIso,
        createdAtMillis: validMillis,
        timestamp: validIso,
        source: 'manual_input'
      };

      const docRef = doc(db, 'reviews', reviewId);
      await setDoc(docRef, newReviewDoc);

      showToast("Ulasan manual berhasil disimpan dan dipublikasikan!", "success");

      // Reset form
      setManualName('');
      setManualComment('');
      setManualRating(5);
      setManualHelpful(Math.floor(Math.random() * 15) + 5);
      setManualDateIso(new Date().toISOString().slice(0, 16));
    } catch (err: any) {
      console.error("Gagal simpan manual review:", err);
      showToast(`Gagal simpan ulasan: ${err.message}`, "error");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Quick Preset Templates for Manual Review
  const applyManualTemplate = (tmpl: string) => {
    setManualComment(tmpl);
  };

  // ==========================================
  // TAB 3: CLEANUP / DELETE GENERATED REVIEWS
  // ==========================================
  const handleDeleteAllGenerated = async () => {
    if (botGeneratedCount === 0) {
      showToast("Tidak ada ulasan generator bot di database.", "info");
      return;
    }

    if (!confirm(`Hapus SEMUA ${botGeneratedCount.toLocaleString('id-ID')} ulasan hasil generator bot dari database?\nUlasan asli pembeli tidak akan terhapus. Tindakan ini permanen!`)) {
      return;
    }

    setIsDeletingGenerated(true);
    setDeleteProgress({ current: 0, total: botGeneratedCount });

    try {
      const BATCH_SIZE = 450;
      for (let i = 0; i < botGeneratedReviews.length; i += BATCH_SIZE) {
        const chunk = botGeneratedReviews.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(rev => {
          batch.delete(doc(db, 'reviews', rev.id));
        });

        await batch.commit();
        setDeleteProgress({
          current: Math.min(i + BATCH_SIZE, botGeneratedCount),
          total: botGeneratedCount
        });
      }

      showToast(`Berhasil menghapus ${botGeneratedCount} ulasan generator bot!`, "success");
    } catch (err: any) {
      console.error("Gagal hapus bulk generated reviews:", err);
      showToast(`Gagal menghapus: ${err.message}`, "error");
    } finally {
      setIsDeletingGenerated(false);
    }
  };

  const handleDeleteSingleReview = async (id: string) => {
    if (!confirm("Hapus ulasan ini dari database?")) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
      showToast("Ulasan berhasil dihapus.", "success");
    } catch (err: any) {
      showToast(`Gagal: ${err.message}`, "error");
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
          toast.type === 'success'
            ? 'bg-[#005C4B] text-[#00E676] border-[#00E676]/40'
            : toast.type === 'info'
            ? 'bg-blue-950 text-blue-300 border-blue-500/30'
            : 'bg-rose-950 text-rose-300 border-rose-500/40'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Modul */}
      <div className="bg-[#111b21] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> Social Proof Engine
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00E676]/10 border border-[#00E676]/30 rounded-lg text-[10px] font-bold text-[#00E676]">
                <CheckCircle2 className="w-3 h-3" /> Realtime Sync Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400 shrink-0" />
              Generator & Manajemen Testimoni
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Buat testimoni manual atau generate ulasan otomatis massal dengan gaya pengetikan alami (*Human-Typing Simulation*) untuk meningkatkan social proof toko.
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-3 bg-[#0b141a] border border-slate-800 p-3.5 rounded-2xl shrink-0">
            <div className="text-center px-2">
              <div className="text-xl font-black text-amber-400">{averageRating}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">Avg Rating</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-xl font-black text-white">{totalReviewsCount.toLocaleString('id-ID')}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">Total Ulasan</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-xl font-black text-[#00E676]">{botGeneratedCount.toLocaleString('id-ID')}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase">Bot/Generator</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-800/80">
          <button
            id="tab-bot-generator"
            onClick={() => setActiveTab('bot_generator')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bot_generator'
                ? 'bg-[#00E676] text-[#111b21] shadow-lg shadow-[#00E676]/20'
                : 'bg-[#0b141a] text-slate-300 hover:bg-[#202c33] border border-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>⚡ Auto Generate Massal (Bot)</span>
          </button>

          <button
            id="tab-manual-input"
            onClick={() => setActiveTab('manual_input')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'manual_input'
                ? 'bg-[#00E676] text-[#111b21] shadow-lg shadow-[#00E676]/20'
                : 'bg-[#0b141a] text-slate-300 hover:bg-[#202c33] border border-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>✍️ Input Testimoni Manual</span>
          </button>

          <button
            id="tab-manage-generated"
            onClick={() => setActiveTab('manage_generated')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ml-auto cursor-pointer ${
              activeTab === 'manage_generated'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-[#0b141a] text-slate-400 hover:bg-[#202c33] border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>📋 Riwayat Bot ({botGeneratedCount})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUTO GENERATE MASSAL (BOT HUMAN-TYPING ALGORITHM) */}
      {/* ========================================================================= */}
      {activeTab === 'bot_generator' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Generator Form Card */}
          <div className="bg-[#111b21] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#00E676]" />
                  Pengaturan Auto Generator Ulasan Alami
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Konfigurasikan volume ulasan, kategori produk, pola rating, dan acuan kata kunci.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshPreviewSamples}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b141a] hover:bg-[#202c33] border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                title="Regenerate Preview"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Acak Ulang Preview</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Kuantitas Bulk */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-200">
                  1. Pilihan Kuantitas Bulk (Jumlah Review)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 100, 1000, 5000].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleSelectCountPreset(cnt)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        bulkCount === cnt && customCountInput === cnt.toString()
                          ? 'bg-[#00E676] text-[#111b21] border-[#00E676]'
                          : 'bg-[#0b141a] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {cnt >= 1000 ? `${(cnt / 1000).toLocaleString('id-ID')}.000` : cnt} Rev
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-400 shrink-0">Atau Angka Kustom:</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={customCountInput}
                    onChange={(e) => handleCustomCountChange(e.target.value)}
                    placeholder="1 - 5000"
                    className="flex-1 bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-white px-3 py-2 rounded-xl text-xs font-bold outline-none"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">maks 5.000</span>
                </div>
              </div>

              {/* 2. Target Kategori & Item */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-200">
                  2. Target Kategori & Sumber Produk
                </label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="w-full bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="all">🌐 Semua Produk (Campuran Joki & Gift)</option>
                  <option value="gift">🎁 Khusus Gift In-Game (Semua Game)</option>
                  <option value="joko">⚡ Khusus Layanan Joko (Semua Game)</option>
                  {catalogs.length > 0 && (
                    <optgroup label="─── Kategori & Game Spesifik ───">
                      {catalogs.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          🎮 {cat.title} ({cat.category === 'gift' ? 'Gift' : 'Joki'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-[11px] text-slate-500">
                  Ulasan akan menautkan nama paket, game, dan thumbnail gambar secara otomatis sesuai target.
                </p>
              </div>

              {/* 3. Pilihan Rentang Rating */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-200">
                  3. Pola Rentang Rating Bintang
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRatingMode('all5')}
                    className={`p-3 rounded-xl text-xs font-bold text-left transition-all border flex flex-col justify-between cursor-pointer ${
                      ratingMode === 'all5'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                        : 'bg-[#0b141a] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-amber-400 font-black mb-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>100% Bintang 5</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Semua ulasan bintang 5 sempurna.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRatingMode('realistic')}
                    className={`p-3 rounded-xl text-xs font-bold text-left transition-all border flex flex-col justify-between cursor-pointer ${
                      ratingMode === 'realistic'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                        : 'bg-[#0b141a] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-amber-400 font-black mb-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>Campuran Realistis</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">90% Bintang 5, 10% Bintang 4.</span>
                  </button>
                </div>
              </div>

              {/* 4. Rentang Tanggal / Waktu Acak */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-200">
                  4. Rentang Waktu Timestamp Acak
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '1w', label: '1 Minggu Terakhir' },
                    { id: '1m', label: '1 Bulan Terakhir' },
                    { id: '3m', label: '3 Bulan Terakhir' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTimeRange(item.id as any)}
                      className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                        timeRange === item.id
                          ? 'bg-[#00E676]/10 border-[#00E676] text-[#00E676]'
                          : 'bg-[#0b141a] border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  Waktu review disebar acak proporsional dari semenit lalu hingga batas rentang.
                </p>
              </div>
            </div>

            {/* 5. Input Kata Kunci Acuan (Keywords Customizer) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <label className="block text-xs font-bold text-slate-200 flex items-center justify-between">
                <span>5. Kata Kunci Acuan (Keywords Customizer)</span>
                <span className="text-[10px] text-slate-400 font-normal">Pisahkan dengan koma</span>
              </label>
              <textarea
                rows={2}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="satset, kilat, amanah, admin ramah, bonus, worth it, join server cepat, rekomen"
                className="w-full bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-slate-200 p-3 rounded-2xl text-xs outline-none leading-relaxed"
              />

              {/* Quick Keyword Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Quick Add:
                </span>
                {QUICK_KEYWORD_PILLS.map(pill => {
                  const isActive = keywords.toLowerCase().includes(pill.toLowerCase());
                  return (
                    <button
                      key={pill}
                      type="button"
                      onClick={() => handleToggleKeyword(pill)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#00E676]/20 border-[#00E676]/40 text-[#00E676]'
                          : 'bg-[#0b141a] hover:bg-[#202c33] border-slate-800 text-slate-400'
                      }`}
                    >
                      {isActive ? `✓ ${pill}` : `+ ${pill}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Preview Samples Card */}
            <div className="bg-[#0b141a] border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-amber-400" />
                  Pratinjau Live Human-Typing (3 Contoh Acak):
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Simulasi Pola Nyata</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {previewItems.map((sample, idx) => (
                  <div key={idx} className="bg-[#111b21] border border-slate-800 p-3.5 rounded-xl space-y-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white truncate">{sample.customerName}</span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(sample.rating)].map((_, s) => (
                            <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 italic leading-snug">
                        "{sample.comment}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate max-w-[120px] font-semibold text-slate-300">{sample.packageName}</span>
                      <span className="shrink-0 text-slate-500">{formatReviewDate(sample.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Bar (Visible during generation) */}
            {isGenerating && (
              <div className="bg-slate-900 border border-[#00E676]/40 p-4 rounded-2xl space-y-2 animate-pulse">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#00E676]" />
                    Sedang Menginjeksi Ulasan ke Firestore (Batching Chunked 450/commit)...
                  </span>
                  <span className="text-[#00E676] font-mono font-black">
                    {progress.current} / {progress.total} ({progress.percent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-[#00E676] to-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Data langsung tersimpan di koleksi `reviews` dan seketika tampil realtime pada tab Testimoni pelanggan.
                </p>
              </div>
            )}

            {/* Generation CTA Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleExecuteBulkGeneration}
                className="w-full py-4 px-6 bg-gradient-to-r from-[#00E676] to-emerald-500 hover:from-emerald-400 hover:to-[#00E676] text-[#111b21] font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-xl shadow-[#00E676]/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Memproses Bulk Injeksi ({progress.current}/{progress.total})...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-[#111b21]" />
                    <span>Generate & Injeksi {bulkCount.toLocaleString('id-ID')} Ulasan Massal Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INPUT TESTIMONI MANUAL */}
      {/* ========================================================================= */}
      {activeTab === 'manual_input' && (
        <div className="bg-[#111b21] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 animate-fade-in">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#00E676]" />
              Input Testimoni Satuan Manual
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Buat ulasan khusus yang terkurasi secara manual untuk produk tertentu dengan detail kustom.
            </p>
          </div>

          <form onSubmit={handleSaveManualReview} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nama Customer */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Nama Customer / Gamer <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Contoh: Muhammad Arkan / Only_josei"
                    className="flex-1 bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setManualName(generateHumanCustomerName())}
                    className="px-3 py-2 bg-[#0b141a] hover:bg-[#202c33] border border-slate-800 text-xs font-bold text-amber-400 rounded-xl transition-all shrink-0 cursor-pointer"
                    title="Acak Nama"
                  >
                    🎲 Acak
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualMasked}
                      onChange={(e) => setManualMasked(e.target.checked)}
                      className="rounded accent-[#00E676] cursor-pointer"
                    />
                    <span>Otomatis sensor bintang untuk privasi (Contoh: {manualName ? maskCustomerName(manualName) : 'Mu****an'})</span>
                  </label>
                </div>
              </div>

              {/* Rating Bintang */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Rating Bintang (1 - 5)
                </label>
                <div className="flex items-center gap-2 bg-[#0b141a] border border-slate-800 p-2 rounded-xl">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setManualRating(star)}
                      className="p-1 hover:scale-110 transition-all cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= manualRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-black text-amber-400 ml-2">
                    {manualRating}.0 Bintang
                  </span>
                </div>
              </div>

              {/* Game Catalog & Item Package */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Pilih Game & Katalog Aktif
                </label>
                <select
                  value={manualCatalogId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setManualCatalogId(id);
                    const cat = catalogs.find(c => c.id === id);
                    if (cat) {
                      const firstPkg = cat.pricelists?.[0]?.name || cat.title;
                      setManualPackageName(firstPkg);
                    }
                  }}
                  className="w-full bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none cursor-pointer"
                >
                  {catalogs.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      🎮 {cat.title} ({cat.category.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Package Name / Custom Item Name */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Nama Paket / Item Produk
                </label>
                {(() => {
                  const selectedCat = catalogs.find(c => c.id === manualCatalogId);
                  const pricelists = selectedCat?.pricelists || [];

                  if (pricelists.length > 0) {
                    return (
                      <select
                        value={manualPackageName}
                        onChange={(e) => setManualPackageName(e.target.value)}
                        className="w-full bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none cursor-pointer"
                      >
                        {pricelists.map(p => (
                          <option key={p.id || p.name} value={p.name}>
                            📦 {p.name} - Rp {p.price?.toLocaleString('id-ID')}
                          </option>
                        ))}
                      </select>
                    );
                  }

                  return (
                    <input
                      type="text"
                      value={manualPackageName}
                      onChange={(e) => setManualPackageName(e.target.value)}
                      placeholder="Nama paket produk..."
                      className="w-full bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none"
                    />
                  );
                })()}
              </div>

              {/* Likes / Helpful Count */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Jumlah Membantu / Likes
                </label>
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-blue-400 shrink-0" />
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={manualHelpful}
                    onChange={(e) => setManualHelpful(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-white px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none"
                  />
                </div>
              </div>

              {/* Tanggal & Waktu Ulasan */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Tanggal & Waktu Ulasan
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={manualDateIso}
                    onChange={(e) => setManualDateIso(e.target.value)}
                    className="flex-1 bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setManualDateIso(new Date().toISOString().slice(0, 16))}
                    className="px-3 py-2 bg-[#0b141a] hover:bg-[#202c33] border border-slate-800 text-xs font-bold text-[#00E676] rounded-xl transition-all shrink-0 cursor-pointer"
                  >
                    ⚡ Sekarang
                  </button>
                </div>
              </div>
            </div>

            {/* Isi Ulasan Testimoni */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-200">
                  Isi Komentar Ulasan Testimoni <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500">{manualComment.length} karakter</span>
              </div>
              <textarea
                required
                rows={3}
                value={manualComment}
                onChange={(e) => setManualComment(e.target.value)}
                placeholder="Tulis ulasan customer yang natural dan meyakinkan..."
                className="w-full bg-[#0b141a] border border-slate-800 focus:border-[#00E676] text-slate-100 p-3.5 rounded-2xl text-xs outline-none leading-relaxed"
              />

              {/* Quick Template Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 mr-1">Template Cepat:</span>
                {[
                  "gokil satset bgt ga nyampe 5 menit udh masuk",
                  "fast respon parah, pesen lgsg di tf in game",
                  "amanah bgt, udh langganan dri dlu ga pernah gagal",
                  "Bintangg limaa sihh inii fasttt responnn bangettt 🤌✨",
                  "mantap kilat no ribet"
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyManualTemplate(tmpl)}
                    className="px-2.5 py-1 bg-[#0b141a] hover:bg-[#202c33] border border-slate-800 rounded-lg text-[10px] text-slate-300 transition-all cursor-pointer truncate max-w-xs"
                  >
                    "{tmpl.slice(0, 32)}..."
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmittingManual}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-[#00E676] hover:from-emerald-400 hover:to-[#00E676] text-[#111b21] font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#00E676]/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmittingManual ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Testimoni...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>Simpan & Publikasikan ke Web</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MANAGE / RIWAYAT BOT GENERATED REVIEWS */}
      {/* ========================================================================= */}
      {activeTab === 'manage_generated' && (
        <div className="bg-[#111b21] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Daftar Ulasan Hasil Bot & Generator ({botGeneratedCount.toLocaleString('id-ID')} Ulasan)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Kelola dan hapus ulasan hasil auto-generator bot kapan saja jika ingin me-reset ulasan.
              </p>
            </div>

            <button
              type="button"
              disabled={isDeletingGenerated || botGeneratedCount === 0}
              onClick={handleDeleteAllGenerated}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeletingGenerated ? `Menghapus (${deleteProgress.current}/${deleteProgress.total})...` : 'Hapus Semua Ulasan Bot'}</span>
            </button>
          </div>

          {botGeneratedCount === 0 ? (
            <div className="text-center py-12 space-y-3 bg-[#0b141a] rounded-2xl border border-slate-800">
              <Bot className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">Belum ada ulasan hasil generator bot.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Gunakan tab "Auto Generate Massal (Bot)" untuk membuat ratusan ulasan pelanggan secara instan.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {botGeneratedReviews.slice(0, 50).map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-[#0b141a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{rev.customerName || rev.userName}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-bold">
                              VERIFIED
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 mt-1">
                            {[...Array(Number(rev.rating) || 5)].map((_, s) => (
                              <Star key={s} className="w-3 h-3 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteSingleReview(rev.id)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                          title="Hapus Ulasan Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 mt-2 italic leading-relaxed">
                        "{rev.comment || rev.review}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate max-w-[150px] text-slate-300 font-semibold">
                        {rev.productName || rev.packageName || 'Layanan Game'}
                      </span>
                      <span>{formatReviewDate(rev.createdAt || rev.createdAtMillis)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {botGeneratedCount > 50 && (
                <p className="text-center text-[11px] text-slate-500 pt-2">
                  Menampilkan 50 ulasan generator terbaru dari total {botGeneratedCount.toLocaleString('id-ID')} ulasan.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
