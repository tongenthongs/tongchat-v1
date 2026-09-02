import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Bell, CheckCheck, Trash2, X, ShoppingBag, MessageSquare, 
  Coins, Sparkles, ExternalLink, CheckCircle2, Clock, AlertTriangle, ChevronRight
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AppNotification, UserProfile } from '../../types';

interface CustomerNotificationsProps {
  currentUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'home' | 'catalog' | 'tracking' | 'testimoni' | 'leaderboard' | 'tongcoins' | 'profile' | 'settings') => void;
  onOpenChat: () => void;
  onSelectOrder?: (orderId: string) => void;
  orders?: any[];
}

export const CustomerNotifications: React.FC<CustomerNotificationsProps> = ({
  currentUser,
  isOpen,
  onClose,
  onNavigateTab,
  onOpenChat,
  onSelectOrder,
  orders = []
}) => {
  const [firestoreNotifs, setFirestoreNotifs] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const popoverRef = useRef<HTMLDivElement>(null);

  // 1. Realtime Firestore Notification Listener
  useEffect(() => {
    if (!currentUser?.id) {
      setFirestoreNotifs([]);
      return;
    }

    const notifCol = collection(db, 'notifications');
    
    // Listen for user-specific notifications
    const qUser = query(
      notifCol,
      where('userId', '==', currentUser.id),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(qUser, (snapshot) => {
      if (!snapshot.empty) {
        const list: AppNotification[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId || currentUser.id,
            userPhone: data.userPhone || currentUser.phone || '',
            title: data.title || 'Notifikasi Entong Store',
            message: data.message || data.body || '',
            type: data.type || 'system',
            orderId: data.orderId || '',
            chatId: data.chatId || '',
            link: data.link || '',
            isRead: data.isRead === true || data.read === true,
            createdAt: data.createdAt || new Date().toISOString()
          };
        });
        setFirestoreNotifs(list);
      } else {
        // Fallback: Check for notifications by user phone if available
        if (currentUser.phone) {
          const cleanPhone = currentUser.phone.replace(/[^0-9]/g, '');
          const qPhone = query(
            notifCol,
            where('userPhone', '==', cleanPhone),
            limit(30)
          );
          onSnapshot(qPhone, (phoneSnap) => {
            if (!phoneSnap.empty) {
              const pList: AppNotification[] = phoneSnap.docs.map(d => {
                const data = d.data();
                return {
                  id: d.id,
                  userId: data.userId || currentUser.id,
                  userPhone: data.userPhone || cleanPhone,
                  title: data.title || 'Notifikasi Pesanan',
                  message: data.message || data.body || '',
                  type: data.type || 'order',
                  orderId: data.orderId || '',
                  chatId: data.chatId || '',
                  link: data.link || '',
                  isRead: data.isRead === true,
                  createdAt: data.createdAt || new Date().toISOString()
                };
              });
              setFirestoreNotifs(pList);
            } else {
              setFirestoreNotifs([]);
            }
          }, () => {
            setFirestoreNotifs([]);
          });
        } else {
          setFirestoreNotifs([]);
        }
      }
    }, (err) => {
      console.warn("Notifications listener notice:", err);
      // Fallback query without orderBy
      const qFallback = query(notifCol, where('userId', '==', currentUser.id), limit(30));
      onSnapshot(qFallback, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
        setFirestoreNotifs(list);
      }, () => {});
    });

    return () => unsub();
  }, [currentUser]);

  // 2. Synthesize Contextual Notifications from active user orders if firestore notifications are few
  const allNotifications = useMemo(() => {
    const items: AppNotification[] = [...firestoreNotifs];
    const existingOrderIds = new Set(items.map(n => n.orderId).filter(Boolean));

    // If user has orders in session, generate informative status notifications
    if (orders && orders.length > 0) {
      orders.slice(0, 8).forEach((ord: any) => {
        const orderId = ord.orderId || ord.id;
        if (!existingOrderIds.has(orderId)) {
          const rawStatus = (ord.status || ord.orderStatus || 'NEW').toUpperCase();
          const pkg = ord.package_name || ord.packageName || ord.game_name || 'Item';
          
          let title = `📦 Status Pesanan #${orderId.slice(-6).toUpperCase()}`;
          let message = `Pesanan ${pkg} sedang diproses.`;
          let type = 'order';

          if (rawStatus === 'SELESAI' || rawStatus === 'COMPLETED') {
            title = `✅ Pesanan Selesai! #${orderId.slice(-6).toUpperCase()}`;
            message = `Selamat! Pengerjaan ${pkg} telah sukses diselesaikan. Silakan cek akun Anda.`;
          } else if (rawStatus === 'PROSES_WORKER' || rawStatus === 'PROSES') {
            title = `⚡ Pesanan Sedang Dikerjakan`;
            message = `Worker Entong Store sedang aktif mengerjakan ${pkg}.`;
          } else if (rawStatus === 'ANTRIAN_LOGIN' || rawStatus === 'ANTRIAN') {
            title = `🕒 Antrian Login Roblox`;
            message = `Pesanan ${pkg} masuk ke antrian pengerjaan kami. Mohon tidak login ke game saat proses.`;
          } else if (rawStatus === 'BOOKING') {
            title = `⏳ Booking Diterima`;
            message = `Pesanan ${pkg} berhasil dibooking dan menunggu jadwal pengerjaan.`;
          } else if (rawStatus === 'BATAL' || rawStatus === 'CANCEL') {
            title = `❌ Pesanan Dibatalkan`;
            message = `Pesanan ${pkg} telah dibatalkan atau ditolak.`;
          }

          items.push({
            id: `order-notif-${ord.id || orderId}`,
            userId: currentUser?.id,
            title,
            message,
            type,
            orderId: orderId,
            isRead: false,
            createdAt: ord.created || ord.createdAt || new Date().toISOString()
          });
        }
      });
    }

    // Sort notifications chronologically descending
    items.sort((a, b) => {
      const getT = (ts: any) => {
        if (!ts) return 0;
        if (ts.seconds) return ts.seconds * 1000;
        const d = new Date(ts).getTime();
        return isNaN(d) ? 0 : d;
      };
      return getT(b.createdAt) - getT(a.createdAt);
    });

    return items;
  }, [firestoreNotifs, orders, currentUser]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return allNotifications.filter(n => !n.isRead);
    }
    return allNotifications;
  }, [allNotifications, filter]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.isRead).length;
  }, [allNotifications]);

  // Click outside to close (Desktop popover)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 🚀 ACTION HANDLER SAAT NOTIFIKASI DIKLIK / DISENTUH (TOUCH & CLICK HANDLING)
  const handleNotificationAction = async (notif: AppNotification) => {
    try {
      // 1. Tandai status isRead: true di Firestore jika dokumen tersimpan di firestore
      if (notif.id && !notif.id.startsWith('order-notif-')) {
        const notifRef = doc(db, 'notifications', notif.id);
        await updateDoc(notifRef, {
          isRead: true,
          read: true,
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("Gagal update isRead:", err);
    }

    // 2. Tutup modal/popover/drawer notifikasi
    onClose();

    // 3. Arahkan rute secara instan
    const notifType = (notif.type || '').toLowerCase();
    if (notifType === 'chat' || notif.chatId) {
      onOpenChat();
    } else if (notifType === 'tongcoins') {
      onNavigateTab('tongcoins');
    } else if (notif.orderId || notifType === 'order' || notifType === 'order_status') {
      onNavigateTab('tracking');
      if (notif.orderId && onSelectOrder) {
        onSelectOrder(notif.orderId);
      }
    } else if (notif.link) {
      if (notif.link.startsWith('http')) {
        window.open(notif.link, '_blank');
      } else if (notif.link.includes('pesanan') || notif.link.includes('tracking')) {
        onNavigateTab('tracking');
      } else if (notif.link.includes('katalog') || notif.link.includes('catalog')) {
        onNavigateTab('catalog');
      } else if (notif.link.includes('tongcoins')) {
        onNavigateTab('tongcoins');
      } else {
        onNavigateTab('home');
      }
    } else {
      // Default: Buka tab pesanan jika ada info order atau beranda
      onNavigateTab('tracking');
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      const unreadFirestore = firestoreNotifs.filter(n => !n.isRead);
      if (unreadFirestore.length > 0) {
        const batch = writeBatch(db);
        unreadFirestore.forEach(n => {
          batch.update(doc(db, 'notifications', n.id), { isRead: true, read: true });
        });
        await batch.commit();
      }
      // Update local state fallback
      setFirestoreNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Gagal tandai semua dibaca:", err);
    }
  };

  // Delete all notifications
  const handleClearAll = async () => {
    if (!window.confirm("Hapus semua riwayat notifikasi?")) return;
    try {
      const batch = writeBatch(db);
      firestoreNotifs.forEach(n => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      setFirestoreNotifs([]);
    } catch (err) {
      console.error("Gagal hapus notifikasi:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* MOBILE FULLSCREEN / BOTTOM SHEET DRAWER (fixed inset-0 z-[999]) */}
      <div className="md:hidden fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
        <div 
          ref={popoverRef}
          className="bg-[#0B0F19] border-t border-slate-800 rounded-t-3xl max-h-[85vh] h-auto flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200"
        >
          {/* Mobile Sheet Drag Handle & Header */}
          <div className="p-4 border-b border-slate-800 flex flex-col gap-3 shrink-0 bg-slate-900/50">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Notifikasi</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-extrabold rounded-full">
                        {unreadCount} baru
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400">Pemberitahuan status pesanan & aktivitas akun</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Actions & Filters */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Semua ({allNotifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${filter === 'unread' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Belum Dibaca ({unreadCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Tandai Semua Dibaca</span>
                </button>
              )}
            </div>
          </div>

          {/* List Content Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-transparent">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-500">
                  <Bell className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-300 mb-1">Tidak ada notifikasi</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {filter === 'unread' ? 'Semua notifikasi sudah dibaca.' : 'Pemberitahuan status pesanan dan pesan akan muncul di sini.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const notifType = (notif.type || '').toLowerCase();
                const isOrder = notifType === 'order' || notifType === 'order_status' || !!notif.orderId;
                const isChat = notifType === 'chat' || !!notif.chatId;
                const isTC = notifType === 'tongcoins';

                let iconNode = <Bell className="w-4 h-4 text-blue-400" />;
                let badgeColor = 'bg-blue-600/20 text-blue-400 border-blue-500/30';
                if (isOrder) {
                  iconNode = <ShoppingBag className="w-4 h-4 text-emerald-400" />;
                  badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                } else if (isChat) {
                  iconNode = <MessageSquare className="w-4 h-4 text-sky-400" />;
                  badgeColor = 'bg-sky-500/20 text-sky-400 border-sky-500/30';
                } else if (isTC) {
                  iconNode = <Coins className="w-4 h-4 text-amber-400" />;
                  badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                }

                return (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNotificationAction(notif)}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleNotificationAction(notif);
                    }}
                    className={`cursor-pointer select-none p-3.5 rounded-2xl transition-all duration-150 active:scale-[0.98] ${
                      notif.isRead 
                        ? 'bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700' 
                        : 'bg-slate-900 border border-blue-500/40 hover:border-emerald-500/50 shadow-md shadow-blue-900/10'
                    } flex items-start gap-3 relative mb-2`}
                  >
                    <div className={`w-9 h-9 rounded-xl ${badgeColor} border flex items-center justify-center shrink-0 mt-0.5`}>
                      {iconNode}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4 className={`text-xs font-black truncate ${notif.isRead ? 'text-slate-300' : 'text-white'}`}>
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                        <span>
                          {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Baru saja'}
                        </span>
                        <span className="text-blue-400 font-bold flex items-center gap-0.5">
                          Buka <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP POPOVER DROPDOWN (z-[999] anchored at navbar) */}
      <div 
        ref={popoverRef}
        className="hidden md:flex flex-col absolute right-4 top-16 w-96 bg-[#0B0F19] border border-slate-800 rounded-2xl shadow-2xl z-[999] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header Desktop Popover */}
        <div className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-2">
                <span>Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-black rounded-full">
                    {unreadCount} Baru
                  </span>
                )}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                title="Tandai Semua Dibaca"
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 transition cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Baca Semua</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tab Sub-bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#0E1322] border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Semua ({allNotifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] transition-all ${filter === 'unread' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {firestoreNotifs.length > 0 && (
            <button
              onClick={handleClearAll}
              title="Bersihkan Semua Notifikasi"
              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Bersihkan</span>
            </button>
          )}
        </div>

        {/* List Content */}
        <div className="max-h-[380px] overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-2 text-slate-500">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-300 mb-0.5">Tidak ada notifikasi</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                {filter === 'unread' ? 'Semua notifikasi sudah Anda baca.' : 'Notifikasi status pesanan akan muncul di sini secara otomatis.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const notifType = (notif.type || '').toLowerCase();
              const isOrder = notifType === 'order' || notifType === 'order_status' || !!notif.orderId;
              const isChat = notifType === 'chat' || !!notif.chatId;
              const isTC = notifType === 'tongcoins';

              let iconNode = <Bell className="w-3.5 h-3.5 text-blue-400" />;
              let badgeColor = 'bg-blue-600/20 text-blue-400 border-blue-500/30';
              if (isOrder) {
                iconNode = <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />;
                badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
              } else if (isChat) {
                iconNode = <MessageSquare className="w-3.5 h-3.5 text-sky-400" />;
                badgeColor = 'bg-sky-500/20 text-sky-400 border-sky-500/30';
              } else if (isTC) {
                iconNode = <Coins className="w-3.5 h-3.5 text-amber-400" />;
                badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
              }

              return (
                <div
                  key={notif.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationAction(notif)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleNotificationAction(notif);
                  }}
                  className={`cursor-pointer select-none p-3 rounded-xl transition-all duration-150 active:scale-[0.98] ${
                    notif.isRead 
                      ? 'bg-slate-900/40 border border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700' 
                      : 'bg-slate-900 border border-blue-500/40 hover:border-emerald-500/40 shadow-sm'
                  } flex items-start gap-2.5 mb-1.5`}
                >
                  <div className={`w-8 h-8 rounded-xl ${badgeColor} border flex items-center justify-center shrink-0 mt-0.5`}>
                    {iconNode}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`text-xs font-black truncate ${notif.isRead ? 'text-slate-300' : 'text-white'}`}>
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-800/60 text-[9px] text-slate-500">
                      <span>
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Baru saja'}
                      </span>
                      <span className="text-blue-400 font-bold flex items-center gap-0.5 hover:underline">
                        Lihat <ChevronRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
