import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Phone, User, ShoppingBag, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, MessageSquare, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { collection, doc, setDoc, getDocs, query, where, limit, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { normalizePhone, formatPhoneDisplay, syncOrdersOnAuth } from '../../utils/phoneUtils';
import { GameOrder, GameItem } from '../../types';

// Helper membersihkan object dari nilai `undefined` yang merusak Firestore
const sanitizePayload = (obj: Record<string, any>) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  );
};

interface CatalogOption {
  id: string;
  gameName: string;
  name: string;
  category: string;
  type?: string;
  isGift?: boolean;
  isJoko?: boolean;
  price: number;
  imageUrl?: string | null;
  label: string;
}

interface ManualWAOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: GameOrder) => void;
  catalogs?: any[];
}

export const ManualWAOrderModal: React.FC<ManualWAOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  catalogs = []
}) => {
  // 3 ULTRA-FAST MAIN FIELDS
  const [phoneInput, setPhoneInput] = useState('');
  const [robloxUsername, setRobloxUsername] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id: string; option: CatalogOption; qty: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setPhoneInput('');
      setRobloxUsername('');
      setSelectedItems([]);
      setSearchQuery('');
      setErrorMessage('');
      setSuccessMessage('');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Internal catalog options & fetching
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);

  // Auto-bound user info detection (if registered)
  const [boundUser, setBoundUser] = useState<any | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  // Submission & validation state with ref lock to prevent double-submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const cleanPhone = normalizePhone(phoneInput);

  // 1. Synchronize or Fetch Catalogs from Firestore / Props
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingCatalogs(true);

    const parseOptions = (rawList: any[]): CatalogOption[] => {
      const results: CatalogOption[] = [];
      rawList.forEach((cat: any) => {
        // If it's a catalog with pricelists
        if (cat.pricelists && Array.isArray(cat.pricelists)) {
          cat.pricelists.forEach((pkg: any) => {
            if (!pkg.is_closed) {
              const gameName = cat.title || cat.game_name || cat.name || 'Roblox';
              const pkgName = pkg.name || pkg.package_name || 'Paket';
              const price = Number(pkg.price || 0);
              const rawCat = (pkg.category || cat.category || '').toLowerCase();
              const imageUrl = pkg.imageUrl || pkg.image || cat.imageUrl || cat.image || null;
          const isGift = rawCat === 'gift' || rawCat === 'gamepass' || rawCat === 'item' || rawCat.includes('gift') || rawCat.includes('gamepass') || rawCat.includes('item') || rawCat.includes('robux') || pkgName.toLowerCase().includes('gift') || pkgName.toLowerCase().includes('gamepass') || pkgName.toLowerCase().includes('pass');
              const finalCat = isGift ? 'gift' : 'joko';
              results.push({
                id: pkg.id || `${cat.id}-${pkgName}`,
                gameName,
                name: pkgName,
                category: finalCat,
                price,
                imageUrl,
                label: `[${finalCat.toUpperCase()}] [${gameName}] ${pkgName} - Rp ${price.toLocaleString('id-ID')}`
              });
            }
          });
        } 
        // If it's a flat GameItem
        else if (cat.game_name || cat.package_name || cat.name) {
          const gameName = cat.game_name || cat.gameName || 'Roblox';
          const pkgName = cat.package_name || cat.packageName || cat.name || 'Paket';
          const price = Number(cat.price || 0);
          const rawCat = (cat.category || cat.service_type || '').toLowerCase();
          const imageUrl = (cat as any).imageUrl || (cat as any).image || (cat as any).thumbnail || null;
          const isGift = rawCat === 'gift' || rawCat === 'gamepass' || rawCat === 'item' || rawCat.includes('gift') || rawCat.includes('gamepass') || rawCat.includes('item') || rawCat.includes('robux') || pkgName.toLowerCase().includes('gift') || pkgName.toLowerCase().includes('gamepass') || pkgName.toLowerCase().includes('pass');
          const finalCat = isGift ? 'gift' : 'joko';
          results.push({
            id: cat.id || `${gameName}-${pkgName}`,
            gameName,
            name: pkgName,
            category: finalCat,
            price,
            imageUrl,
            label: `[${finalCat.toUpperCase()}] [${gameName}] ${pkgName} - Rp ${price.toLocaleString('id-ID')}`
          });
        }
      });

      // Sort alphabetically by Game Name then Price
      return results.sort((a, b) => {
        if (a.gameName !== b.gameName) {
          return a.gameName.localeCompare(b.gameName);
        }
        return a.price - b.price;
      });
    };

    // If props catalogs is available
    if (catalogs && catalogs.length > 0) {
      const parsed = parseOptions(catalogs);
      if (parsed.length > 0) {
        setCatalogOptions(parsed);
        
        setIsLoadingCatalogs(false);
      }
    }

    // Always ensure fresh catalogs from Firestore 'catalogs' collection
    const unsub = onSnapshot(collection(db, 'catalogs'), (snap) => {
      if (!isMounted) return;
      if (!snap.empty) {
        const rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const parsed = parseOptions(rawDocs);
        if (parsed.length > 0) {
          setCatalogOptions(parsed);
          
        }
      }
      setIsLoadingCatalogs(false);
    }, (err) => {
      console.warn("Manual WA modal catalogs query notice:", err);
      setIsLoadingCatalogs(false);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [isOpen, catalogs]);

  // Selected items calculations
  const totalQty = selectedItems.reduce((acc, item) => acc + item.qty, 0);
  const totalAccumulatedPrice = selectedItems.reduce((acc, item) => acc + (item.option.price * item.qty), 0);
  
  const autoDetectedCategory = useMemo(() => {
    if (selectedItems.length === 0) return 'GIFT';

    // Helper deteksi kategori order ketat
    const isAllJoki = selectedItems.every(item => {
      const opt = item.option;
      const t = (opt.type || '').toLowerCase();
      const c = (opt.category || '').toLowerCase();
      const n = (opt.name || '').toLowerCase();
      return (
        t === 'joko' || 
        c === 'joko' || 
        t === 'joki' || 
        c === 'joki' ||
        n.includes('joki') ||
        n.includes('joko')
      );
    });

    const isAllGift = selectedItems.every(item => {
      const opt = item.option;
      const t = (opt.type || '').toLowerCase();
      const c = (opt.category || '').toLowerCase();
      const n = (opt.name || '').toLowerCase();
      return (
        t === 'gift' || 
        c === 'gift' || 
        (opt as any).isGift === true ||
        n.includes('gift') ||
        n.includes('cash') ||
        n.includes('pass')
      );
    });

    const hasAnyJoki = selectedItems.some(item => {
      const opt = item.option;
      const t = (opt.type || '').toLowerCase();
      const c = (opt.category || '').toLowerCase();
      const n = (opt.name || '').toLowerCase();
      return (
        t === 'joko' || 
        c === 'joko' || 
        t === 'joki' || 
        c === 'joki' ||
        n.includes('joki') ||
        n.includes('joko')
      );
    });

    return (isAllJoki || hasAnyJoki) ? 'JOKO' : 'GIFT';
  }, [selectedItems]);

  const filteredCatalogs = useMemo(() => {
    if (!searchQuery.trim()) return catalogOptions;
    const lowerQ = searchQuery.toLowerCase();
    return catalogOptions.filter(c => 
      c.gameName.toLowerCase().includes(lowerQ) || 
      c.name.toLowerCase().includes(lowerQ) ||
      c.category.toLowerCase().includes(lowerQ) ||
      c.price.toString().includes(lowerQ)
    );
  }, [catalogOptions, searchQuery]);

  // 2. Auto-detect if customer already has a registered user account with this WA
  useEffect(() => {
    if (!cleanPhone || cleanPhone.length < 8) {
      setBoundUser(null);
      return;
    }

    const checkExistingUser = async () => {
      setIsSearchingUser(true);
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(usersRef);
        let found: any = null;

        for (const d of snap.docs) {
          const u = d.data();
          const uPhone = normalizePhone(u.phone || u.whatsapp || u.whatsappNumber || (u as any).customer_phone || '');
          if (uPhone && uPhone === cleanPhone) {
            found = { id: d.id, ...u };
            break;
          }
        }

        if (found) {
          setBoundUser(found);
          // If username not yet filled and user has robloxUsername, suggest it
          if (!robloxUsername && (found.robloxUsername || found.roblox_username)) {
            setRobloxUsername(found.robloxUsername || found.roblox_username);
          }
        } else {
          setBoundUser(null);
        }
      } catch (err) {
        console.warn('Error checking existing user by WA:', err);
      } finally {
        setIsSearchingUser(false);
      }
    };

    const debounceTimer = setTimeout(checkExistingUser, 350);
    return () => clearTimeout(debounceTimer);
  }, [cleanPhone]);

  if (!isOpen) return null;

  // 3. Handle Submit with Duplicate Active Check & Firestore Write
      const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    let manualCleanPhone = phoneInput.replace(/\D/g, '');
    let standardPhone = manualCleanPhone;
    if (standardPhone.startsWith('0')) standardPhone = '62' + standardPhone.slice(1);
    if (standardPhone.startsWith('8')) standardPhone = '62' + standardPhone;

    if (!standardPhone || standardPhone.length < 8) {
      setErrorMessage('Nomor WhatsApp Customer wajib diisi dengan benar (min. 8 digit).');
      return;
    }

    const trimmedRobloxUser = robloxUsername.trim();
    if (!trimmedRobloxUser) {
      setErrorMessage('Username Roblox target wajib diisi.');
      return;
    }

    if (selectedItems.length === 0) {
      setErrorMessage('Silakan pilih minimal satu paket layanan dari katalog.');
      return;
    }

    // Set synchronous lock immediately before any async call
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // 0. AUTO-LOOKUP & BINDING KE AKUN USER
      const phoneVariations = [
        manualCleanPhone,
        standardPhone,
        manualCleanPhone.startsWith('62') ? '0' + manualCleanPhone.slice(2) : manualCleanPhone,
        manualCleanPhone.startsWith('0') ? '62' + manualCleanPhone.slice(1) : '62' + manualCleanPhone,
        '+' + standardPhone
      ];
      const uniquePhones = [...new Set(phoneVariations)].slice(0, 10);

      const usersRef = collection(db, "users");
      let existingUser = null;
      
      const qUsers = query(usersRef, where("whatsapp", "in", uniquePhones));
      const userSnap = await getDocs(qUsers);
      
      if (!userSnap.empty) {
        const docData = userSnap.docs[0].data();
        existingUser = { 
          uid: userSnap.docs[0].id, 
          name: docData.displayName || docData.fullName || docData.name || docData.username || 'Customer',
          ...docData 
        };
      } else {
        const qPhone = query(usersRef, where("phone", "in", uniquePhones));
        const phoneSnap = await getDocs(qPhone);
        if (!phoneSnap.empty) {
          const docData = phoneSnap.docs[0].data();
          existingUser = {
            uid: phoneSnap.docs[0].id,
            name: docData.displayName || docData.fullName || docData.name || docData.username || 'Customer',
            ...docData
          };
        } else {
           // Fallback scan all users if still not found
           const allUsersSnap = await getDocs(usersRef);
           for (const doc of allUsersSnap.docs) {
             const u = doc.data();
             const uPhone = (u.phone || u.whatsapp || u.whatsappNumber || '').replace(/\D/g, '');
             let cleanUPhone = uPhone;
             if (cleanUPhone.startsWith('0')) cleanUPhone = '62' + cleanUPhone.slice(1);
             if (cleanUPhone.startsWith('8')) cleanUPhone = '62' + cleanUPhone;
             if (cleanUPhone === standardPhone) {
                existingUser = { 
                  uid: doc.id, 
                  name: u.displayName || u.fullName || u.name || u.username || 'Customer',
                  ...u 
                };
                break;
             }
           }
        }
      }

      // Tentukan target user info
      let targetUserId = null;
      let finalCustomerName = `CUST-${standardPhone.slice(-5)} - ${trimmedRobloxUser}`;
      let isRegisteredUser = false;

      if (existingUser && existingUser.name !== 'Customer') {
         targetUserId = existingUser.uid;
         finalCustomerName = existingUser.name;
         isRegisteredUser = true;
      } else if (existingUser) {
         targetUserId = existingUser.uid;
         finalCustomerName = existingUser.name;
         isRegisteredUser = true;
      }
      
      manualCleanPhone = standardPhone;

      // Ringkasan pesanan
      const summaryString = selectedItems.length === 1 
        ? `${selectedItems[0].option.name} (x${selectedItems[0].qty})` 
        : `Grup Paket (${totalQty} Item: ${selectedItems.map(i => `${i.option.name} x${i.qty}`).join(', ')})`;

      const summaryStringWithPrice = selectedItems.length === 1
        ? `${selectedItems[0].option.gameName || 'Roblox'} - ${selectedItems[0].option.name} (Rp ${Number(selectedItems[0].option.price).toLocaleString('id-ID')})`
        : `Grup Paket (${totalQty} Item) - Rp ${totalAccumulatedPrice.toLocaleString('id-ID')}`;

      // 🛡️ 1. VALIDASI AKUN ROBLOX SEDANG DIKERJAKAN (Targeted Query with 3s Timeout to avoid hang)
      try {
        const checkQ = query(
          collection(db, 'orders'),
          where('robloxUsername', '==', trimmedRobloxUser),
          limit(10)
        );
        const timeoutCheck = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout check")), 3000)
        );
        const checkSnap = await Promise.race([getDocs(checkQ), timeoutCheck]).catch(() => null);

        if (checkSnap && !checkSnap.empty) {
          const activeStatuses = ['booking', 'menunggu verifikasi', 'diorder', 'proses', 'ready', 'logul', 'pending_verification'];
          const duplicateActive = checkSnap.docs.find((d: any) => {
            const ord = d.data();
            const ordPackage = (ord.package_name || ord.packageName || ord.item_name || '').toLowerCase().trim();
            const ordStatus = (ord.status || ord.orderStatus || '').trim().toLowerCase();
            const isSameProduct = ordPackage === summaryString.toLowerCase().trim();
            const isActive = activeStatuses.includes(ordStatus);
            return isSameProduct && isActive;
          });

          if (duplicateActive) {
            throw new Error("Akun Roblox ini sedang memiliki pesanan aktif yang belum selesai untuk item tersebut!");
          }
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes("sedang memiliki pesanan aktif")) {
          throw checkErr;
        }
        console.warn("Validation query check warning:", checkErr);
      }

      // 💾 2. SIMPAN DOKUMEN KE FIRESTORE DENGAN SANITIZE & TIMEOUT GUARD
      const uniqueIdNum = Math.floor(100000 + Math.random() * 900000).toString();
      const orderCustomId = `ORD-${uniqueIdNum}`;
      const displayId = `#${uniqueIdNum}`;
      
      const isJokoService = autoDetectedCategory === 'JOKO';
      const targetCustomerId = targetUserId || `wa_${manualCleanPhone}`;

      const rawOrderPayload: any = {
        id: orderCustomId,
        orderId: orderCustomId,
        orderNumber: orderCustomId,
        displayOrderId: displayId,
        idFormatted: displayId,
        
        // Identifiers Customer Lengkap (Standarisasi Semua Field WhatsApp & Phone)
        whatsapp: standardPhone,
        phone: standardPhone,
        customer_phone: standardPhone,
        customerPhone: standardPhone,
        customerWhatsapp: standardPhone,
        whatsappNumber: standardPhone,
        userPhone: standardPhone,
        robloxUsername: trimmedRobloxUser,
        roblox_username: trimmedRobloxUser,
        game_username: trimmedRobloxUser,
        username: trimmedRobloxUser,
        targetAccount: trimmedRobloxUser,
        customerName: finalCustomerName,
        customer_name: finalCustomerName,
        displayName: finalCustomerName,
        
        // Wajib diisi agar masuk ke profil customer
        userId: targetUserId || null,
        userUid: targetUserId || null,
        customerId: targetUserId || null,
        customer_id: targetUserId || null,
        isRegistered: isRegisteredUser,
        isCustomerRegistered: isRegisteredUser,
        isClaimed: isRegisteredUser,
        isManualWA: true,
        source: "manual_wa",
        
        category: isJokoService ? "joko" : "gift",
        type: isJokoService ? "joko" : "gift",
        orderType: isJokoService ? "joko" : "gift",
        service_type: isJokoService ? "joko" : "gift",
        isGift: !isJokoService,
        isJoko: isJokoService,
        gameName: selectedItems[0]?.option.gameName || "Roblox",
        packageName: summaryString,
        serviceName: `${selectedItems[0]?.option.gameName || 'Roblox'} - ${summaryString}`,
        imageUrl: selectedItems[0]?.option.imageUrl || null,
        productImage: selectedItems[0]?.option.imageUrl || null,
        
        itemGift: !isJokoService ? summaryStringWithPrice : null,
        giftItemName: !isJokoService ? summaryString : null,
        items: selectedItems.map(i => ({
          catalogId: i.option.id,
          gameName: i.option.gameName,
          name: i.option.name,
          packageName: i.option.name,
          title: i.option.name,
          category: i.option.category,
          price: Number(i.option.price) || 0,
          totalPrice: (Number(i.option.price) || 0) * i.qty,
          qty: i.qty,
          quantity: i.qty,
          imageUrl: i.option.imageUrl || null
        })),
        
        totalPrice: totalAccumulatedPrice,
        price: totalAccumulatedPrice,
        amount: totalAccumulatedPrice,
        
        status: "BOOKING",
        orderStatus: "BOOKING",
        paymentStatus: "LUNAS",
        paymentMethod: "MANUAL_WA",
        
        isDeleted: false,
        deleted: false,
        isGuest: !isRegisteredUser,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        orderDate: serverTimestamp(),
        displayTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
      };

      const newOrderPayload = sanitizePayload(rawOrderPayload);

      // Eksekusi penyimpanan dengan timeout guard 6 detik
      const saveOrderPromise = setDoc(doc(db, 'orders', orderCustomId), newOrderPayload);
      const saveTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout koneksi Firestore saat menyimpan orderan")), 6000)
      );

      await Promise.race([saveOrderPromise, saveTimeoutPromise]);

      // Auto-claim in background if user already registered
      if (targetUserId) {
        syncOrdersOnAuth(targetUserId, standardPhone).catch(e => console.warn('Sync orders notice:', e));
      }

      // 💬 3. INISIALISASI ATAU SINKRONKAN ROOM CHAT (NON-BLOCKING)
      let roomId = `chat_${standardPhone}`;
      try {
        const chatsRef = collection(db, 'chats');
        let existingChatId = null;
        
        if (targetUserId) {
          const qChatId = query(chatsRef, where("customer_id", "==", targetUserId), limit(1));
          const chatSnap = await Promise.race([
            getDocs(qChatId),
            new Promise<any>((_, rej) => setTimeout(() => rej("timeout"), 2500))
          ]).catch(() => null);
          if (chatSnap && !chatSnap.empty) existingChatId = chatSnap.docs[0].id;
          else {
             const qChatUid = query(chatsRef, where("customerId", "==", targetUserId), limit(1));
             const chatSnap2 = await Promise.race([
               getDocs(qChatUid),
               new Promise<any>((_, rej) => setTimeout(() => rej("timeout"), 2500))
             ]).catch(() => null);
             if (chatSnap2 && !chatSnap2.empty) existingChatId = chatSnap2.docs[0].id;
          }
        }
        
        if (!existingChatId) {
          const qChatWa = query(chatsRef, where("whatsapp", "in", uniquePhones.slice(0, 10)), limit(1));
          const chatWaSnap = await Promise.race([
            getDocs(qChatWa),
            new Promise<any>((_, rej) => setTimeout(() => rej("timeout"), 2500))
          ]).catch(() => null);
          if (chatWaSnap && !chatWaSnap.empty) existingChatId = chatWaSnap.docs[0].id;
        }

        if (existingChatId) {
           roomId = existingChatId;
        }

        const chatRoomRef = doc(db, 'chats', roomId);
        const chatPayload = sanitizePayload({
          userId: targetUserId || null,
          userUid: targetUserId || null,
          isRegistered: isRegisteredUser,
          isCustomerRegistered: isRegisteredUser,
          id: roomId,
          order_id: roomId,
          activeOrderDocId: orderCustomId,
          latestOrder: newOrderPayload,
          orderId: orderCustomId,
          packageName: summaryString,
          customerId: targetCustomerId,
          customer_id: targetCustomerId,
          customerName: finalCustomerName,
          customer_name: finalCustomerName,
          whatsapp: standardPhone,
          customerPhone: standardPhone,
          robloxUsername: trimmedRobloxUser,
          lastMessage: `🛒 Pesanan Manual WA #${orderCustomId} (${summaryString} - Rp ${totalAccumulatedPrice.toLocaleString('id-ID')})`,
          last_message: `🛒 Pesanan Manual WA #${orderCustomId} (${summaryString} - Rp ${totalAccumulatedPrice.toLocaleString('id-ID')})`,
          lastMessageTime: serverTimestamp(),
          lastSender: 'admin',
          last_sender: 'admin',
          status: 'BOOKING',
          orderStatus: 'BOOKING',
          paymentStatus: 'LUNAS',
          is_read_admin: true,
          is_read_customer: false,
          updatedAt: serverTimestamp()
        });

        await setDoc(chatRoomRef, chatPayload, { merge: true });

        const msgDocRef = doc(collection(db, 'chats', roomId, 'messages'));
        const nowIso = new Date().toISOString();
        await setDoc(msgDocRef, sanitizePayload({
          id: msgDocRef.id,
          order_id: roomId,
          sender_id: 'admin_wa',
          sender_name: 'Admin WhatsApp POS',
          sender_role: 'admin',
          message: `[PESANAN MANUAL WA]\nNo. Order: #${orderCustomId}\nPaket: ${summaryString}\nHarga: Rp ${totalAccumulatedPrice.toLocaleString('id-ID')}\nStatus: BOOKING (LUNAS)\nWA: +${standardPhone}\nRoblox: ${trimmedRobloxUser}`,
          text: `[PESANAN MANUAL WA]\nNo. Order: #${orderCustomId}\nPaket: ${summaryString}\nHarga: Rp ${totalAccumulatedPrice.toLocaleString('id-ID')}\nStatus: BOOKING (LUNAS)\nWA: +${standardPhone}\nRoblox: ${trimmedRobloxUser}`,
          created: nowIso,
          createdAt: serverTimestamp(),
          localTimestamp: Date.now()
        }));
      } catch (chatErr) {
        console.warn('Gagal update room chat otomatis (non-blocking):', chatErr);
      }

      setSuccessMessage(`Orderan WA berhasil ditambahkan ke antrian Booking!`);
      if (onOrderCreated) {
        onOrderCreated({ ...newOrderPayload, pureTime: Date.now() } as unknown as GameOrder);
      }

      setTimeout(() => {
        setPhoneInput('');
        setRobloxUsername('');
        setSuccessMessage('');
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        onClose();
      }, 800);

    } catch (err: any) {
      console.error('Error saat menyimpan order manual WA:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan pesanan manual WA.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[999999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-[#111b21] border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 my-8 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[#00E676] font-bold shadow-inner">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Input Order WA (Quick Input)</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-[#00E676] text-[10px] font-extrabold rounded-full border border-emerald-500/30">
                  3-Field
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Input ringkas & auto-claim saat customer mendaftar / masuk dengan WhatsApp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00E676]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 3-FIELD ULTRA-FAST FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* FIELD 1: NOMOR WHATSAPP CUSTOMER */}
          <div className="bg-[#0b141a] p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#00E676]" />
                <span>1. Nomor WhatsApp Customer</span>
                <span className="text-rose-500">*</span>
              </label>
              {cleanPhone && (
                <span className="text-[10px] font-mono text-[#00E676] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  +{cleanPhone}
                </span>
              )}
            </div>
            
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Contoh: 08123456789 / 628..."
              required
              autoFocus
              className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-mono"
            />

            {/* Auto-Bind User Status Notification */}
            {isSearchingUser ? (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                <RefreshCw className="w-3 h-3 text-[#00E676] animate-spin" />
                <span>Mengecek database customer...</span>
              </div>
            ) : boundUser ? (
              <div className="mt-1 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#00E676] shrink-0" />
                  <span className="text-slate-300">
                    Akun: <strong className="text-white">{boundUser.name || boundUser.username}</strong>
                  </span>
                </div>
                <span className="text-[10px] text-[#00E676] font-bold">Auto-Bound</span>
              </div>
            ) : cleanPhone.length >= 8 ? (
              <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-0.5">
                <ShieldCheck className="w-3 h-3 text-blue-400 shrink-0" />
                <span>Nomor baru. Pesanan otomatis terikat saat customer registrasi nomor ini.</span>
              </p>
            ) : null}
          </div>

          {/* FIELD 2: USERNAME ROBLOX */}
          <div className="bg-[#0b141a] p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>2. Username Roblox</span>
              <span className="text-rose-500">*</span>
            </label>
            
            <input
              type="text"
              value={robloxUsername}
              onChange={(e) => setRobloxUsername(e.target.value)}
              placeholder="Username target Roblox..."
              required
              className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">
              Sistem akan memvalidasi agar tidak ada orderan aktif ganda pada akun Roblox ini.
            </p>
          </div>

          {/* FIELD 3: PILIH PAKET DARI KATALOG AKTIF */}
          <div className="bg-[#0b141a] p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Pilih Paket dari Katalog Aktif</span>
                <span className="text-rose-500">*</span>
              </label>
              {selectedItems.length > 0 && (
                <span className="text-xs font-black text-[#00E676] font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Total: Rp {totalAccumulatedPrice.toLocaleString('id-ID')}
                </span>
              )}
            </div>

            {isLoadingCatalogs ? (
              <div className="p-3 bg-[#111b21] rounded-xl border border-slate-700 text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00E676]" />
                <span>Memuat daftar katalog produk aktif...</span>
              </div>
            ) : catalogOptions.length === 0 ? (
              <div className="p-3 bg-[#111b21] rounded-xl border border-slate-700 text-xs text-slate-400">
                Tidak ada paket aktif di katalog. Tambahkan paket pada menu Produk / Katalog terlebih dahulu.
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama game atau paket (misal: Boombox)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full bg-[#111b21] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-amber-500 focus:outline-none"
                />
                
                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-[#1a2329] border border-slate-700 rounded-xl shadow-xl">
                    {filteredCatalogs.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">Tidak ada paket yang cocok</div>
                    ) : (
                      filteredCatalogs.map(opt => (
                        <div
                          key={opt.id}
                          className={`p-3 text-xs sm:text-sm cursor-pointer hover:bg-slate-700 transition-colors border-b border-slate-800/50 last:border-0 ${selectedItems.some(i => i.id === opt.id) ? 'bg-emerald-900/40 border-l-2 border-l-emerald-500' : ''}`}
                          onClick={() => {
    setSelectedItems(prev => {
      const existing = prev.find(p => p.id === opt.id);
      if (existing) {
        return prev.map(p => p.id === opt.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { id: opt.id, option: opt, qty: 1 }];
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
  }}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-start">
                              <span className="font-semibold text-white">{opt.name}</span>
                              <span className="text-[#00E676] font-mono whitespace-nowrap">Rp {opt.price.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{opt.gameName}</span>
                              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                              <span className="uppercase text-amber-300">{opt.category}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MINI CART TABLE */}
            {selectedItems.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead className="bg-slate-800/80 text-slate-400">
                    <tr>
                      <th className="py-2 px-3 font-semibold w-1/2">Item</th>
                      <th className="py-2 px-3 font-semibold text-center w-1/4">Qty</th>
                      <th className="py-2 px-3 font-semibold text-right">Subtotal</th>
                      <th className="py-2 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-slate-200">
                    {selectedItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-100 line-clamp-1">{item.option.name}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{item.option.gameName}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-2 bg-slate-900 rounded-lg py-1 px-1.5 border border-slate-700/50">
                            <button 
                              type="button" 
                              className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-600 rounded text-slate-300 font-bold transition-colors"
                              onClick={() => {
                                setSelectedItems(prev => prev.map(p => p.id === item.id ? { ...p, qty: p.qty - 1 } : p).filter(p => p.qty > 0));
                              }}
                            >-</button>
                            <span className="w-4 text-center font-bold text-white text-[11px]">x{item.qty}</span>
                            <button 
                              type="button" 
                              className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-600 rounded text-slate-300 font-bold transition-colors"
                              onClick={() => {
                                setSelectedItems(prev => prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
                              }}
                            >+</button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[#00E676] font-bold">
                          Rp {(item.option.price * item.qty).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button 
                            type="button"
                            className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                            onClick={() => {
                              setSelectedItems(prev => prev.filter(p => p.id !== item.id));
                            }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 p-4 text-center text-[11px] text-slate-500 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl">
                Belum ada item dipilih. Cari dan klik paket katalog di atas.
              </div>
            )}
            
          </div>

          {/* Quick Summary Pill & Actions */}
          {/* Field 4: Ringkasan & Submit */}
          {selectedItems.length > 0 && (
            <div className="bg-[#0b141a] p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Total Akumulasi ({totalQty} Item):</span>
                <span className="text-base font-black text-[#00E676] font-mono">Rp {totalAccumulatedPrice.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="text-xs text-slate-400">Deteksi Kategori:</span>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${autoDetectedCategory === 'JOKO' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                  {autoDetectedCategory === 'JOKO' ? 'JOKO & LEVELING' : 'GIFT IN-GAME'}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !cleanPhone || !robloxUsername.trim() || selectedItems.length === 0}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/60 disabled:text-slate-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Orderan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan & Masukkan Antrian ({totalQty} Item)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
