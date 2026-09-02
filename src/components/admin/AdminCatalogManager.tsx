import React, { useState, useEffect } from 'react';
import { db, storage } from '../../lib/firebase';
import { 
  collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, limit 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GameCatalog, PricelistItem } from '../../types';
import { 
  Plus, Edit2, Trash2, Check, X, Gamepad2, Sparkles, 
  Eye, EyeOff, Tag, TrendingUp, Clock, AlertCircle, ShoppingBag, Loader2, UploadCloud, Upload
} from 'lucide-react';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export const AdminCatalogManager: React.FC = () => {
  const [catalogs, setCatalogs] = useState<GameCatalog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedGame, setSelectedGame] = useState<GameCatalog | null>(null);

  // Forms states
  const [isGameFormOpen, setIsGameFormOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<GameCatalog | null>(null);
  const [gameTitle, setGameTitle] = useState('');
  const [gameCategory, setGameCategory] = useState<'gift' | 'joki' | 'joko'>('gift');
  const [gameImageUrl, setGameImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [gameIsPopular, setGameIsPopular] = useState(false);
  const [gameDiscountTag, setGameDiscountTag] = useState('');
  const [gameTotalSold, setGameTotalSold] = useState<number>(0);

  // Pricelist Form states
  const [isPkgFormOpen, setIsPkgFormOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PricelistItem | null>(null);
  const [pkgCode, setPkgCode] = useState('');
  const [pkgName, setPkgName] = useState('');
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgPrice, setPkgPrice] = useState<number>(0);
  const [pkgOriginalPrice, setPkgOriginalPrice] = useState<number>(0);
  const [pkgEstimatedTime, setPkgEstimatedTime] = useState('');
  const [pkgIconUrl, setPkgIconUrl] = useState('');
  const [pkgSold, setPkgSold] = useState<number>(0);
  const [isUploadingPkgIcon, setIsUploadingPkgIcon] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Realtime catalogs reader
  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'catalogs'), limit(60)), (snapshot) => {
      const fetched: GameCatalog[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as GameCatalog));
      setCatalogs(fetched);
      setLoading(false);

      // Keep active game selection updated in realtime
      if (selectedGame) {
        const updatedSelected = fetched.find(g => g.id === selectedGame.id);
        if (updatedSelected) {
          setSelectedGame(updatedSelected);
        }
      }
    }, (err) => {
      console.error("Firestore read error in AdminCatalogManager:", err);
      showToast("Gagal memuat katalog dari Firestore secara realtime.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedGame]);

  // Open Game Creator / Editor
  const handleOpenGameForm = (game: GameCatalog | null = null) => {
    if (game) {
      setEditingGame(game);
      setGameTitle(game.title);
      setGameCategory(game.category);
      setGameImageUrl(game.imageUrl || '');
      setGameIsPopular(game.isPopular || false);
      setGameDiscountTag(game.discountTag || '');
      setGameTotalSold(game.totalSold || 0);
    } else {
      setEditingGame(null);
      setGameTitle('');
      setGameCategory('gift');
      setGameImageUrl('');
      setGameIsPopular(false);
      setGameDiscountTag('');
      setGameTotalSold(0);
    }
    setIsGameFormOpen(true);
  };

  const cleanPayload = (obj: any): any => {
    if (obj === null || obj === undefined) return '';
    if (Array.isArray(obj)) {
      return obj.map(item => cleanPayload(item));
    }
    if (typeof obj === 'object') {
      const newObj: any = {};
      Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (val === undefined) {
          newObj[key] = ''; // Fallback aman dari undefined
        } else if (typeof val === 'object') {
          newObj[key] = cleanPayload(val);
        } else {
          newObj[key] = val;
        }
      });
      return newObj;
    }
    return obj;
  };

  const handleUploadProductImage = async (file: File) => {
    if (!file) return;
    if (!['image/png', 'image/webp', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      showToast("Format gambar harus PNG atau WebP (transparan direkomendasikan).", "error");
      return;
    }
    setIsUploadingImage(true);
    try {
      let downloadUrl = '';
      try {
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef = ref(storage, `products/${Date.now()}_${cleanFileName}`);
        await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Firebase Storage upload failed, falling back to Base64:", storageErr);
        downloadUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      setGameImageUrl(downloadUrl);
      showToast("Ikon produk PNG berhasil diunggah!", "success");
    } catch (err: any) {
      console.error("Upload product image error:", err);
      showToast(`Gagal mengunggah gambar: ${err.message || 'Terjadi kesalahan'}`, "error");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save Game Document
  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameTitle.trim()) {
      showToast("Judul Game wajib diisi!", "error");
      return;
    }

    const gameId = editingGame ? editingGame.id : 'cat-' + Date.now();
    const existingPricelists = editingGame ? editingGame.pricelists || [] : [];

    const updatedGame: GameCatalog = {
      id: gameId,
      title: gameTitle.trim(),
      category: gameCategory,
      imageUrl: gameImageUrl.trim() || '',
      isPopular: gameIsPopular,
      discountTag: gameDiscountTag.trim() || undefined,
      totalSold: Number(gameTotalSold) || 0,
      pricelists: existingPricelists
    };

    try {
      await setDoc(doc(db, 'catalogs', gameId), cleanPayload(updatedGame), { merge: true });
      showToast(`Game "${gameTitle}" berhasil ${editingGame ? 'di-update' : 'ditambahkan'}!`, "success");
      setIsGameFormOpen(false);
      setEditingGame(null);
    } catch (err: any) {
      console.error("Save Game error:", err);
      showToast(`Gagal menyimpan game: ${err.message || 'Terjadi kesalahan'}`, "error");
    }
  };

  // Delete Game Document
  const handleDeleteGame = async (gameId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus game ini beserta seluruh pricelist di dalamnya secara permanen?")) return;

    try {
      await deleteDoc(doc(db, 'catalogs', gameId));
      showToast("Game berhasil dihapus secara permanen dari Firestore.", "success");
      if (selectedGame?.id === gameId) {
        setSelectedGame(null);
      }
    } catch (err: any) {
      console.error("Delete Game error:", err);
      showToast(`Gagal menghapus game: ${err.message || 'Terjadi kesalahan'}`, "error");
    }
  };

  // Upload PNG/WebP Product Icon directly to Firebase Storage folder products_icons/
  const handleUploadPkgIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/webp', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      showToast("Format ikon produk wajib PNG atau WebP (transparan direkomendasikan)!", "error");
      return;
    }

    try {
      setIsUploadingPkgIcon(true);
      let downloadUrl = '';
      try {
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef = ref(storage, `products_icons/${Date.now()}_${cleanFileName}`);
        await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Firebase Storage icon upload failed, falling back to Base64:", storageErr);
        downloadUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      setPkgIconUrl(downloadUrl);
      showToast("Ikon produk berhasil diunggah!", "success");
    } catch (err: any) {
      console.error("Upload product icon error:", err);
      showToast(`Gagal mengunggah ikon produk: ${err.message || 'Terjadi kesalahan'}`, "error");
    } finally {
      setIsUploadingPkgIcon(false);
      e.target.value = '';
    }
  };

  // Open Pricelist Creator / Editor
  const handleOpenPkgForm = (pkg: PricelistItem | null = null) => {
    if (pkg) {
      setEditingPkg(pkg);
      setPkgCode(pkg.code);
      setPkgName(pkg.name);
      setPkgDescription(pkg.description || '');
      setPkgPrice(pkg.price);
      setPkgOriginalPrice(pkg.originalPrice || 0);
      setPkgEstimatedTime(pkg.estimatedTime);
      setPkgIconUrl(pkg.iconUrl || '');
      setPkgSold(pkg.sold || 0);
    } else {
      setEditingPkg(null);
      setPkgCode('ML-' + Math.floor(10 + Math.random() * 90));
      setPkgName('');
      setPkgDescription('');
      setPkgPrice(0);
      setPkgOriginalPrice(0);
      setPkgEstimatedTime('10 Menit');
      setPkgIconUrl('');
      setPkgSold(0);
    }
    setIsPkgFormOpen(true);
  };

  // Save Pricelist Item nested in selectedGame
  const handleSavePkg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGame) return;
    if (!pkgCode.trim() || !pkgName.trim() || pkgPrice <= 0) {
      showToast("Kode, Nama Paket, dan Harga wajib diisi dengan benar!", "error");
      return;
    }

    const updatedPricelists = [...(selectedGame.pricelists || [])];

    const newPkg: PricelistItem = {
      id: editingPkg ? editingPkg.id : 'pkg-' + Date.now(),
      code: pkgCode.trim().toUpperCase(),
      name: pkgName.trim(),
      description: pkgDescription.trim(),
      price: Number(pkgPrice),
      originalPrice: pkgOriginalPrice ? Number(pkgOriginalPrice) : undefined,
      estimatedTime: pkgEstimatedTime.trim() || 'Fast Selesai',
      iconUrl: pkgIconUrl.trim() || undefined,
      imageUrl: pkgIconUrl.trim() || undefined,
      sold: Number(pkgSold) > 0 ? Number(pkgSold) : undefined
    };

    if (editingPkg) {
      const idx = updatedPricelists.findIndex(p => p.id === editingPkg.id);
      if (idx !== -1) updatedPricelists[idx] = newPkg;
    } else {
      updatedPricelists.push(newPkg);
    }

    try {
      await updateDoc(doc(db, 'catalogs', selectedGame.id), {
        pricelists: cleanPayload(updatedPricelists)
      });
      showToast(`Paket "${pkgName}" berhasil ${editingPkg ? 'di-update' : 'ditambahkan'}!`, "success");
      setIsPkgFormOpen(false);
      setEditingPkg(null);
    } catch (err: any) {
      console.error("Save Pricelist error:", err);
      showToast(`Gagal menyimpan paket: ${err.message || 'Terjadi kesalahan'}`, "error");
    }
  };

  // Delete Pricelist Item nested in selectedGame
  const handleDeletePkg = async (pkgId: string, name: string) => {
    if (!selectedGame) return;
    if (!window.confirm(`Hapus paket "${name}" dari game ini?`)) return;

    const updatedPricelists = (selectedGame.pricelists || []).filter(p => p.id !== pkgId);

    try {
      await updateDoc(doc(db, 'catalogs', selectedGame.id), {
        pricelists: updatedPricelists
      });
      showToast(`Paket "${name}" berhasil dihapus.`, "success");
    } catch (err: any) {
      console.error("Delete Pricelist error:", err);
      showToast(`Gagal menghapus paket: ${err.message || 'Terjadi kesalahan'}`, "error");
    }
  };

  // Toggle availability state (is_closed) of a package nested in selectedGame
  const handleTogglePkgAvailability = async (pkgId: string, currentIsClosed: boolean) => {
    if (!selectedGame) return;
    
    const updatedPricelists = (selectedGame.pricelists || []).map(p => {
      if (p.id === pkgId) {
        return { ...p, is_closed: !currentIsClosed };
      }
      return p;
    });

    try {
      await updateDoc(doc(db, 'catalogs', selectedGame.id), {
        pricelists: cleanPayload(updatedPricelists)
      });
      showToast(`Status ketersediaan paket berhasil diubah!`, "success");
    } catch (err: any) {
      console.error("Toggle Pricelist Availability error:", err);
      showToast(`Gagal mengubah status ketersediaan: ${err.message || 'Terjadi kesalahan'}`, "error");
    }
  };

  // Toggle availability state (is_closed) of a main game catalog
  const handleToggleGameAvailability = async (gameId: string, currentIsClosed: boolean) => {
    try {
      await updateDoc(doc(db, 'catalogs', gameId), {
        is_closed: !currentIsClosed
      });
      showToast(`Status ketersediaan game berhasil diubah!`, "success");
    } catch (err: any) {
      console.error("Toggle Game Availability error:", err);
      showToast(`Gagal mengubah status ketersediaan game: ${err.message || 'Terjadi kesalahan'}`, "error");
    }
  };

  return (
    <div className="space-y-6 relative min-h-[500px]">
      
      {/* Realtime Status Bar & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111b21] border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-base font-black text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse"></span>
            Katalog 2 Tingkat & Pricelist Manager
          </h1>
          <p className="text-[11px] text-slate-400 mt-1">
            Seluruh data katalog ini tersinkronisasi secara real-time ke HP pelanggan di Firestore.
          </p>
        </div>
        <button
          onClick={() => handleOpenGameForm()}
          className="px-4 py-2 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5 self-start sm:self-center"
        >
          <Plus className="w-4 h-4" /> Tambah Game Baru
        </button>
      </div>

      {/* Grid Layout: Left column is Games list, Right column is selected game packages */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Registered Games List (span 5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Daftar Game Terdaftar ({catalogs.length})</span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">Realtime</span>
            </h3>

            {loading ? (
              <div className="space-y-3 py-6 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-slate-800 rounded-xl w-full" />
                ))}
              </div>
            ) : catalogs.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-500">Belum ada game terdaftar. Klik "+ Tambah Game Baru".</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {catalogs.map((game, idx) => (
                  <div 
                    key={game.id ? `cat-${game.id}-${idx}` : `cat-${idx}`}
                    onClick={() => setSelectedGame(game)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedGame?.id === game.id ? 'bg-[#005C4B]/20 border-[#00E676]' : 'bg-[#182229] border-slate-850 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img 
                        src={game.imageUrl} 
                        alt={game.title} 
                        className="w-10 h-10 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-100 truncate flex items-center gap-1.5">
                          {game.title}
                          {game.isPopular && <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 rounded">👑</span>}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400 font-semibold uppercase">
                          <span>{game.category === 'gift' ? '🎁 Gift' : '🎮 Joko'}</span>
                          <span>•</span>
                          <span className="text-[#00E676]">{game.pricelists?.length || 0} Paket</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions on card */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleGameAvailability(game.id, !!game.is_closed)}
                        className={`px-2 py-1 text-[8px] font-black rounded border transition-all ${
                          game.is_closed 
                            ? 'bg-red-950/40 border-red-800 text-red-400 hover:bg-red-950/60' 
                            : 'bg-emerald-950/40 border-emerald-800 text-emerald-400 hover:bg-emerald-950/60'
                        }`}
                        title={game.is_closed ? "Buka Game (Klik untuk Aktifkan)" : "Tutup Game (Klik untuk Nonaktifkan)"}
                      >
                        {game.is_closed ? '🔴 DITUTUP' : '🟢 TERSEDIA'}
                      </button>

                      <button
                        onClick={() => handleOpenGameForm(game)}
                        className="p-1.5 bg-slate-850 hover:bg-slate-750 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-[#00E676] rounded-lg transition-all"
                        title="Edit Info Game"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game.id)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 rounded-lg transition-all"
                        title="Hapus Game"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Game Details & Pricelist Configuration (span 7) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedGame ? (
            <div className="bg-[#111b21] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              
              {/* Active Game Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3.5">
                  <img 
                    src={selectedGame.imageUrl} 
                    alt={selectedGame.title} 
                    className="w-14 h-14 rounded-xl object-contain bg-slate-900 border border-slate-800" 
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-850 text-slate-400 text-[9px] font-bold rounded uppercase">
                        {selectedGame.category === 'gift' ? 'Gift Di Game' : 'Pricelist Joko'}
                      </span>
                      <button
                        onClick={() => handleToggleGameAvailability(selectedGame.id, !!selectedGame.is_closed)}
                        className={`px-2 py-0.5 text-[8px] font-black rounded border transition-all ${
                          selectedGame.is_closed 
                            ? 'bg-red-950/40 border-red-800 text-red-400' 
                            : 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                        }`}
                        title={selectedGame.is_closed ? "Buka Game (Klik untuk Aktifkan)" : "Tutup Game (Klik untuk Nonaktifkan)"}
                      >
                        {selectedGame.is_closed ? '🔴 TOKO DITUTUP' : '🟢 TOKO BUKA'}
                      </button>
                    </div>
                    <h2 className="text-base font-black text-slate-100 tracking-wide mt-1">
                      {selectedGame.title}
                    </h2>
                    {selectedGame.discountTag && (
                      <span className="inline-block mt-1 text-[10px] text-[#00E676] bg-[#00E676]/10 px-1.5 py-0.5 rounded border border-[#00E676]/20 font-bold uppercase">
                        🏷️ {selectedGame.discountTag}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenPkgForm()}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-[11px] shadow transition-all active:scale-95 flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Paket
                </button>
              </div>

              {/* Nested Pricelist Item List */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Kelola Varian Paket & Harga ({selectedGame.pricelists?.length || 0})
                </h3>

                {(!selectedGame.pricelists || selectedGame.pricelists.length === 0) ? (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 p-6">
                    <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Belum ada varian paket terdaftar untuk game ini.</p>
                    <button
                      onClick={() => handleOpenPkgForm()}
                      className="mt-3 text-xs font-black text-[#00E676] hover:underline"
                    >
                      + Buat Paket Pertama
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {selectedGame.pricelists.map((pkg, idx) => (
                      <div 
                        key={pkg.id ? `pkg-${pkg.id}-${idx}` : `pkg-${idx}`}
                        className="bg-[#182229] border border-slate-850 hover:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {pkg.iconUrl && (
                            <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-700/60 p-1 flex items-center justify-center shrink-0">
                              <img src={pkg.iconUrl} alt={pkg.name} className="w-full h-full object-contain bg-transparent" />
                            </div>
                          )}
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 bg-slate-950 font-mono text-[9px] font-bold text-slate-500 rounded border border-slate-800">
                                {pkg.code}
                              </span>
                              <h4 className="text-xs font-black text-slate-100 truncate">
                                {pkg.name}
                              </h4>
                              {pkg.sold !== undefined && pkg.sold > 0 && (
                                <span className="px-1.5 py-0.2 bg-blue-950/60 text-blue-400 border border-blue-800/60 rounded text-[9px] font-bold">
                                  🔥 {pkg.sold} Terjual
                                </span>
                              )}
                            </div>
                            {pkg.description && (
                              <p className="text-[10px] text-slate-400 line-clamp-1">
                                {pkg.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-[9px] text-slate-500">
                              <Clock className="w-3 h-3 text-slate-600" />
                              <span>Estimasi: {pkg.estimatedTime || 'Selesai Cepat'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Price Display & Actions */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            {pkg.originalPrice !== undefined && pkg.originalPrice > pkg.price && (
                              <span className="text-[9px] text-slate-500 line-through block">
                                Rp {pkg.originalPrice.toLocaleString('id-ID')}
                              </span>
                            )}
                            <span className="text-xs font-black text-[#00E676]">
                              Rp {pkg.price.toLocaleString('id-ID')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Toggle Switch Tersedia / Tutup */}
                            <button
                              type="button"
                              onClick={() => handleTogglePkgAvailability(pkg.id, !!pkg.is_closed)}
                              className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all flex items-center gap-1 border ${
                                pkg.is_closed 
                                  ? 'bg-red-950/40 border-red-800 text-red-400 hover:bg-red-950/60' 
                                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-400 hover:bg-emerald-950/60'
                              }`}
                              title={pkg.is_closed ? "Paket Tutup (Klik untuk Buka)" : "Paket Buka (Klik untuk Tutup)"}
                            >
                              {pkg.is_closed ? '🔴 TUTUP' : '🟢 TERSEDIA'}
                            </button>

                            <button
                              onClick={() => handleOpenPkgForm(pkg)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePkg(pkg.id, pkg.name)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-[#111b21] border border-dashed border-slate-800 rounded-2xl p-10 text-center shadow-xl py-24">
              <Gamepad2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-400">Pilih Game Terdaftar</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Silakan pilih salah satu game dari daftar kiri untuk meload dan mengedit pricelist varian paketnya secara real-time.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL GAME FORM (Add / Edit Game) */}
      {isGameFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-[#182229] border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                {editingGame ? <Edit2 className="w-4 h-4 text-[#00E676]" /> : <Plus className="w-4 h-4 text-[#00E676]" />}
                {editingGame ? 'Edit Detail Game' : 'Tambah Game Baru'}
              </h3>
              <button onClick={() => setIsGameFormOpen(false)} className="text-slate-400 hover:text-white font-bold p-1">✕</button>
            </div>

            <form onSubmit={handleSaveGame} className="p-4 space-y-3.5 flex-1 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Game / Kategori</label>
                <input 
                  type="text" 
                  value={gameTitle} 
                  onChange={e => setGameTitle(e.target.value)}
                  placeholder="Contoh: Mobile Legends Bang Bang"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Jenis Katalog</label>
                <select 
                  value={gameCategory} 
                  onChange={e => setGameCategory(e.target.value as 'gift' | 'joki' | 'joko')}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#00E676]"
                >
                  <option value="gift">Gift In Game</option>
                  <option value="joko">Joko</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Ikon Produk PNG / Cover Game (Upload Firebase Storage)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer ${
                      isUploadingImage 
                        ? 'bg-slate-900 border-slate-700 text-slate-500 pointer-events-none' 
                        : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-700 hover:border-[#00E676] text-slate-300 hover:text-[#00E676]'
                    }`}>
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#00E676]" />
                          <span>Mengunggah ke Firebase Storage...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4 text-[#00E676]" />
                          <span>Pilih File PNG / WebP (Transparan)</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/png,image/webp" 
                        disabled={isUploadingImage}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUploadProductImage(file);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                      />
                    </label>

                    {gameImageUrl && (
                      <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl shrink-0">
                        <img 
                          src={gameImageUrl} 
                          alt="Preview" 
                          className="w-8 h-8 rounded-lg object-contain bg-transparent border border-slate-800/50" 
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setGameImageUrl('')}
                          className="p-1 text-slate-400 hover:text-red-400 text-xs transition-colors"
                          title="Hapus Gambar"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <input 
                    type="url" 
                    value={gameImageUrl} 
                    onChange={e => setGameImageUrl(e.target.value)}
                    placeholder="Atau tempel URL gambar langsung (Opsional)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
                  />
                  <p className="text-[10px] text-slate-500">
                    Disarankan file PNG/WebP berlatar belakang transparan agar menyatu rapi dengan tema kartu katalog.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Badge Diskon / Promo</label>
                  <input 
                    type="text" 
                    value={gameDiscountTag} 
                    onChange={e => setGameDiscountTag(e.target.value)}
                    placeholder="Contoh: Diskon 20%"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Terjual (Fiktif/Asli)</label>
                  <input 
                    type="number" 
                    value={gameTotalSold} 
                    onChange={e => setGameTotalSold(Number(e.target.value))}
                    placeholder="Contoh: 1200"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="chkIsPopular" 
                  checked={gameIsPopular} 
                  onChange={e => setGameIsPopular(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-[#00E676] focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="chkIsPopular" className="text-xs font-bold text-slate-300 cursor-pointer select-none">
                  Tampilkan Badge "👑 Populer" di Katalog
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsGameFormOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl text-xs transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Simpan Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRICELIST FORM (Add / Edit Paket) */}
      {isPkgFormOpen && selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-[#182229] border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                {editingPkg ? <Edit2 className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4 text-emerald-400" />}
                {editingPkg ? 'Edit Varian Paket' : 'Tambah Paket Baru'}
              </h3>
              <p className="text-[10px] text-emerald-400 font-bold max-w-[150px] truncate">
                {selectedGame.title}
              </p>
            </div>

            <form onSubmit={handleSavePkg} className="p-4 space-y-3.5 flex-1 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kode Badge</label>
                  <input 
                    type="text" 
                    value={pkgCode} 
                    onChange={e => setPkgCode(e.target.value)}
                    placeholder="ML-G1"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-105 uppercase text-slate-300 font-mono focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Paket Varian</label>
                  <input 
                    type="text" 
                    value={pkgName} 
                    onChange={e => setPkgName(e.target.value)}
                    placeholder="Contoh: Skin Normal Gift (269💎)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Deskripsi Paket</label>
                <textarea 
                  value={pkgDescription} 
                  onChange={e => setPkgDescription(e.target.value)}
                  placeholder="Rincian deskripsi mengenai paket dan proses pengiriman..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Harga Utama (Rp)</label>
                  <input 
                    type="number" 
                    value={pkgPrice || ''} 
                    onChange={e => setPkgPrice(Number(e.target.value))}
                    placeholder="Contoh: 59000"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-emerald-400 font-bold focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Harga Coret (Rp - Opsional)</label>
                  <input 
                    type="number" 
                    value={pkgOriginalPrice || ''} 
                    onChange={e => setPkgOriginalPrice(Number(e.target.value))}
                    placeholder="Contoh: 65000"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-500 line-through focus:outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimasi Waktu Kirim</label>
                  <input 
                    type="text" 
                    value={pkgEstimatedTime} 
                    onChange={e => setPkgEstimatedTime(e.target.value)}
                    placeholder="Contoh: 1-3 Jam atau 10 Menit"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Terjual (Opsional)</label>
                  <input 
                    type="number" 
                    value={pkgSold || ''} 
                    onChange={e => setPkgSold(Number(e.target.value))}
                    placeholder="Contoh: 120"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              {/* PNG / WebP Product Icon Upload (Firebase Storage: products_icons/) */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Ikon Produk PNG / WebP (Transparan)
                </label>
                <p className="text-[10px] text-slate-400">
                  Unggah ikon item transparan PNG / WebP. Ikon disimpan ke folder <code className="text-emerald-400 font-mono">products_icons/</code> di Firebase Storage.
                </p>

                <div className="flex items-center gap-3">
                  {pkgIconUrl ? (
                    <div className="relative w-14 h-14 rounded-xl bg-slate-900 border border-slate-750 p-1 flex items-center justify-center shrink-0">
                      <img src={pkgIconUrl} alt="Product Icon" className="w-full h-full object-contain bg-transparent" />
                      <button
                        type="button"
                        onClick={() => setPkgIconUrl('')}
                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow"
                        title="Hapus Ikon"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-900 border border-dashed border-slate-800 flex items-center justify-center text-slate-600 shrink-0 text-[10px] font-bold text-center p-1">
                      Tanpa Ikon
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer">
                      {isUploadingPkgIcon ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Pilih File PNG / WebP</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/webp"
                        disabled={isUploadingPkgIcon}
                        className="hidden"
                        onChange={handleUploadPkgIcon}
                      />
                    </label>
                    <p className="text-[9px] text-slate-500 italic">
                      Dilarang menggunakan dummy/AI image. Jika tidak ada gambar, biarkan kosong.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsPkgFormOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Simpan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sleek Toast Notification UI */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-2.5 animate-bounce bg-[#111b21] border-[#00E676]/50 text-slate-100 max-w-sm">
          {toast.type === 'success' ? (
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse"></span>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
          )}
          <span className="text-xs font-bold leading-tight">{toast.message}</span>
        </div>
      )}

    </div>
  );
};
