import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Trophy, Crown, ShoppingBag, Search, Sparkles } from 'lucide-react';
import { maskCustomerName } from '../../utils/leaderboardUtils';
import { optimizeGoogleAvatarUrl } from '../../utils/avatarUtils';
import { useApp } from '../../context/AppContext';

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar?: string;
  totalSpent: number;
  orderCount: number;
  email?: string;
  showPublicName?: boolean;
}

export const LeaderboardSection: React.FC = () => {
  const { currentUser } = useApp();
  const [timeFilter, setTimeFilter] = useState<'Bulan Ini' | 'Semua Waktu'>('Bulan Ini');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let usersMap: Record<string, { name?: string; photoURL?: string; avatar?: string; showPublicName?: boolean; email?: string }> = {};

    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(150)), (usersSnap) => {
      const map: Record<string, any> = {};
      usersSnap.docs.forEach((uDoc) => {
        const uData = uDoc.data();
        map[uDoc.id] = {
          name: uData.name || uData.username,
          photoURL: uData.photoURL || uData.avatar,
          avatar: uData.avatar || uData.photoURL,
          showPublicName: uData.showPublicName !== false,
          email: uData.email,
        };
        if (uData.email) {
          map[uData.email.toLowerCase()] = map[uDoc.id];
        }
      });
      usersMap = map;
    });

    const ordersRef = query(collection(db, 'orders'), limit(200));
    const unsubOrders = onSnapshot(ordersRef, (snapshot) => {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const startOfMonth = new Date(currentYear, currentMonth, 1);

        const completedDocs = snapshot.docs.filter((docSnap) => {
          const data = docSnap.data();
          const st = (data.status || data.orderStatus || '').toUpperCase();
          const paySt = (data.paymentStatus || '').toUpperCase();
          const isCompleted =
            st === 'SELESAI' ||
            st === 'COMPLETED' ||
            st === 'SUCCESS' ||
            paySt === 'SUCCESS' ||
            paySt === 'VERIFIED' ||
            paySt === 'LUNAS';

          if (!isCompleted) return false;

          if (timeFilter === 'Bulan Ini') {
            const orderDateStr = data.createdAt || data.date || data.timestamp || data.created;
            const orderDate = orderDateStr ? new Date(orderDateStr) : new Date();
            if (orderDate < startOfMonth) return false;
          }

          return true;
        });

        const aggregatedMap = completedDocs.reduce<Record<string, LeaderboardEntry>>((acc, docSnap) => {
          const data = docSnap.data();
          const customerId = data.customerId || data.userId || data.customerEmail || data.email || data.customerName || 'anon';
          const email = (data.customerEmail || data.email || '').toLowerCase();
          const name = data.customerName || data.customer_name || data.robloxUsername || data.username || 'Pelanggan Entong';
          const price = Number(data.totalPrice || data.price || data.amount || 0);

          const joinedUser = (data.userId && usersMap[data.userId]) || 
                             (data.customerId && usersMap[data.customerId]) || 
                             (email && usersMap[email]);

          const effectiveAvatar = joinedUser?.photoURL || joinedUser?.avatar || data.customerAvatar || data.avatar;
          const effectiveName = joinedUser?.name || name;
          const showPublicName = joinedUser ? joinedUser.showPublicName : true;

          const groupKey = (joinedUser && data.userId) ? data.userId : (email || customerId);

          if (!acc[groupKey]) {
            acc[groupKey] = {
              id: groupKey,
              name: effectiveName,
              avatar: effectiveAvatar,
              totalSpent: 0,
              orderCount: 0,
              email: email || data.customerEmail,
              showPublicName,
            };
          }

          acc[groupKey].totalSpent += price;
          acc[groupKey].orderCount += 1;
          if (effectiveAvatar && !acc[groupKey].avatar) {
            acc[groupKey].avatar = effectiveAvatar;
          }
          if (joinedUser?.showPublicName !== undefined) {
            acc[groupKey].showPublicName = joinedUser.showPublicName;
          }

          return acc;
        }, {});

        const sortedList = Object.values(aggregatedMap).sort((a, b) => b.totalSpent - a.totalSpent);
        setLeaderboardData(sortedList);
        setLoading(false);
      } catch (err) {
        console.error('Error aggregating leaderboard:', err);
        setLoading(false);
      }
    }, (err) => {
      console.error('Error listening orders for leaderboard:', err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubOrders();
    };
  }, [timeFilter]);

  const filteredList = leaderboardData.filter((entry) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return entry.name.toLowerCase().includes(q) || (entry.email && entry.email.toLowerCase().includes(q));
  });

  const top3 = filteredList.slice(0, 3);
  const restList = filteredList.slice(3, 20);

  const myRankIndex = currentUser ? leaderboardData.findIndex(e => e.id === currentUser.id || (currentUser.email && e.email === currentUser.email.toLowerCase())) : -1;
  const myRankData = myRankIndex !== -1 ? leaderboardData[myRankIndex] : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-2 sm:px-4 animate-fade-in text-slate-100">
      {/* HEADER & FILTER */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Peringkat Belanja Pelanggan</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            🏆 Leaderboard Belanja - Entong Store
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Apresiasi bagi para pelanggan setia dengan akumulasi transaksi belanja tertinggi.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800/80 shrink-0 self-start md:self-auto">
          {(['Bulan Ini', 'Semua Waktu'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeFilter === filter
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* MY RANK BANNER (IF LOGGED IN) */}
      {currentUser && (
        <div className="bg-slate-900/90 border border-blue-500/30 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-lg shrink-0">
              {myRankIndex !== -1 ? `#${myRankIndex + 1}` : '-'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Akun Anda
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {currentUser.name || currentUser.username}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                {myRankIndex !== -1
                  ? `Peringkat #${myRankIndex + 1} dari ${leaderboardData.length} Pembeli Aktif`
                  : 'Belum masuk peringkat pada periode ini. Selesaikan transaksi untuk naik peringkat!'}
              </p>
            </div>
          </div>

          {myRankData && (
            <div className="flex items-center gap-4 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">Total Belanja</span>
                <span className="text-sm sm:text-base font-black text-blue-400">
                  Rp {myRankData.totalSpent.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">Pesanan</span>
                <span className="text-sm sm:text-base font-black text-white">
                  {myRankData.orderCount} Selesai
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pembeli di leaderboard..."
          className="w-full bg-slate-900/90 border border-slate-800 focus:border-blue-500 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition shadow-lg"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm font-medium">
          Memuat data leaderboard transaksi...
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-3 shadow-xl">
          <Trophy className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">Belum Ada Transaksi Selesai</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Belum ada data belanja yang memenuhi syarat pada periode "{timeFilter}". Transaksi selesai akan otomatis tercatat di sini.
          </p>
        </div>
      ) : (
        <>
          {/* TOP 3 PODIUM */}
          {top3.length > 0 && !searchQuery && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-4">
              {/* RANK 2 (Silver - Left) */}
              {top3[1] && (() => {
                const entry = top3[1];
                const isOwn = currentUser?.id === entry.id || (currentUser?.email && entry.email === currentUser.email.toLowerCase());
                const displayName = entry.showPublicName === false
                  ? maskCustomerName(entry.name, isOwn)
                  : entry.name;

                return (
                  <div className="order-2 sm:order-1 bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 text-center shadow-xl relative flex flex-col items-center sm:-translate-y-2">
                    <div className="absolute -top-3.5 w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow-md border-2 border-slate-900">
                      #2
                    </div>
                    <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-slate-400 to-slate-200 shadow-lg mb-3 mt-1">
                      {entry.avatar ? (
                        <img
                          src={optimizeGoogleAvatarUrl(entry.avatar)}
                          alt={entry.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-black text-xl">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                      🥈 TOP 2 RUNNER UP
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1 truncate max-w-full">
                      {displayName}
                    </h3>
                    <div className="mt-3 py-2 px-4 bg-slate-950/80 rounded-2xl border border-slate-800 w-full">
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Belanja</span>
                      <span className="text-sm font-black text-slate-200">
                        Rp {entry.totalSpent.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-500" /> {entry.orderCount} Pesanan Selesai
                    </span>
                  </div>
                );
              })()}

              {/* RANK 1 (Gold Crown - Center) */}
              {top3[0] && (() => {
                const entry = top3[0];
                const isOwn = currentUser?.id === entry.id || (currentUser?.email && entry.email === currentUser.email.toLowerCase());
                const displayName = entry.showPublicName === false
                  ? maskCustomerName(entry.name, isOwn)
                  : entry.name;

                return (
                  <div className="order-1 sm:order-2 bg-gradient-to-b from-amber-950/30 via-slate-900 to-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-7 text-center shadow-2xl relative flex flex-col items-center sm:-translate-y-5 z-10">
                    <div className="absolute -top-6 text-amber-400 animate-bounce">
                      <Crown className="w-8 h-8 fill-amber-400" />
                    </div>
                    <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md">
                      #1
                    </div>
                    <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 shadow-2xl shadow-amber-500/20 mb-3 mt-2">
                      {entry.avatar ? (
                        <img
                          src={optimizeGoogleAvatarUrl(entry.avatar)}
                          alt={entry.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-black text-2xl">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] uppercase font-black text-amber-400 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> TOP 1 SULTAN
                    </span>
                    <h3 className="text-base font-black text-white mt-1 truncate max-w-full">
                      {displayName}
                    </h3>
                    <div className="mt-3 py-2 px-4 bg-amber-950/40 rounded-2xl border border-amber-500/40 w-full shadow-inner">
                      <span className="text-[10px] text-amber-300/80 block uppercase font-bold">Total Belanja</span>
                      <span className="text-base sm:text-lg font-black text-amber-400">
                        Rp {entry.totalSpent.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-200/80 mt-2.5 flex items-center gap-1.5 font-bold">
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-400" /> {entry.orderCount} Pesanan Selesai
                    </span>
                  </div>
                );
              })()}

              {/* RANK 3 (Bronze - Right) */}
              {top3[2] && (() => {
                const entry = top3[2];
                const isOwn = currentUser?.id === entry.id || (currentUser?.email && entry.email === currentUser.email.toLowerCase());
                const displayName = entry.showPublicName === false
                  ? maskCustomerName(entry.name, isOwn)
                  : entry.name;

                return (
                  <div className="order-3 sm:order-3 bg-slate-900/90 border border-amber-900/40 rounded-3xl p-6 text-center shadow-xl relative flex flex-col items-center">
                    <div className="absolute -top-3.5 w-8 h-8 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow-md border-2 border-slate-900">
                      #3
                    </div>
                    <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-tr from-amber-700 to-amber-500 shadow-lg mb-3 mt-1">
                      {entry.avatar ? (
                        <img
                          src={optimizeGoogleAvatarUrl(entry.avatar)}
                          alt={entry.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-800 text-amber-600 flex items-center justify-center font-black text-xl">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-black text-amber-600 tracking-wider">
                      🥉 TOP 3
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1 truncate max-w-full">
                      {displayName}
                    </h3>
                    <div className="mt-3 py-2 px-4 bg-slate-950/80 rounded-2xl border border-slate-800 w-full">
                      <span className="text-[10px] text-slate-400 block font-semibold">Total Belanja</span>
                      <span className="text-sm font-black text-slate-200">
                        Rp {entry.totalSpent.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-500" /> {entry.orderCount} Pesanan Selesai
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* RANKS 4 - 20 (VERTICAL LIST) */}
          {restList.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-3 mt-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">
                Peringkat 4 - 20
              </h3>

              <div className="space-y-2.5">
                {restList.map((entry, index) => {
                  const rank = index + 4;
                  const isOwnAccount = currentUser?.id === entry.id || (currentUser?.email && entry.email === currentUser.email.toLowerCase());
                  const displayName = entry.showPublicName === false
                    ? maskCustomerName(entry.name, isOwnAccount)
                    : entry.name;

                  return (
                    <div
                      key={entry.id || index}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all group ${
                        isOwnAccount
                          ? 'bg-blue-950/30 border-blue-500/40 hover:bg-blue-950/40'
                          : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                          {rank}
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                          {entry.avatar ? (
                            <img
                              src={optimizeGoogleAvatarUrl(entry.avatar)}
                              alt={entry.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                              {entry.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                              {displayName}
                            </h4>
                            {isOwnAccount && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Anda
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <ShoppingBag className="w-3.5 h-3.5 text-slate-500" /> {entry.orderCount} Pesanan
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-3 ml-auto">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block sm:inline mr-1.5">
                          Total
                        </span>
                        <span className="text-xs sm:text-sm font-black text-blue-400">
                          Rp {entry.totalSpent.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
