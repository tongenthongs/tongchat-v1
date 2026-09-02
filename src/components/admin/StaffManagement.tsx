import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ShieldCheck, Plus, Trash2, UserPlus, RefreshCw, CheckCircle2 } from 'lucide-react';

const DEFAULT_STAFF_LIST = [
  {
    id: 'staff_owner_entong',
    uid: 'staff_owner_entong',
    name: 'Ceo Entong',
    username: 'ceo_entong',
    usernameLower: 'ceo_entong',
    email: 'ceo@entong.store',
    password: 'admin123',
    pin: 'admin123',
    pass: 'admin123',
    staffPin: 'admin123',
    role: 'OWNER',
    isStaff: true,
    isBanned: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'staff_admin_entong',
    uid: 'staff_admin_entong',
    name: 'Admin Entong',
    username: 'admin_entong',
    usernameLower: 'admin_entong',
    email: 'admin@entong.store',
    password: 'admin123',
    pin: 'admin123',
    pass: 'admin123',
    staffPin: 'admin123',
    role: 'ADMIN',
    isStaff: true,
    isBanned: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'staff_kamil',
    uid: 'staff_kamil',
    name: 'kamil',
    username: 'kamil',
    usernameLower: 'kamil',
    email: 'kamil@entong.store',
    password: 'mafiatanah',
    pin: 'mafiatanah',
    pass: 'mafiatanah',
    staffPin: 'mafiatanah',
    role: 'STAFF',
    isStaff: true,
    isBanned: false,
    createdAt: new Date().toISOString()
  }
];

export const StaffManagement: React.FC = () => {
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('STAFF');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FUNGSI INJEKSI PAKSA KE DUA KOLEKSI FIRESTORE (users & staff)
  const forceInjectStaffData = async () => {
    try {
      for (const account of DEFAULT_STAFF_LIST) {
        // Tulis ke koleksi 'users'
        await setDoc(doc(db, 'users', account.id), account, { merge: true });
        // Tulis juga ke koleksi 'staff' sebagai cadangan
        await setDoc(doc(db, 'staff', account.id), account, { merge: true });
      }
      alert("⚡ Berhasil memulihkan akun Staf & Admin utama ke Firestore!");
    } catch (e: any) {
      console.error("Gagal inject staf:", e);
      alert(`Gagal memulihkan: ${e.message}`);
    }
  };

  useEffect(() => {
    // 1. Baca koleksi 'users' dengan limit
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(150)), (snapUsers) => {
      const usersData = snapUsers.docs.map(d => ({ docUniqueId: d.id, ...d.data() }));
      
      const filteredStaff = usersData.filter((u: any) => {
        const r = (u.role || '').toString().toUpperCase();
        return r === 'STAFF' || r === 'ADMIN' || r === 'OWNER' || r === 'WORKER' || r === 'OPERATOR' || u.isStaff === true;
      });

      if (filteredStaff.length > 0) {
        setStaffMembers(filteredStaff);
        setLoading(false);
      } else {
        // Jika di 'users' kosong, coba panggil auto-inject
        forceInjectStaffData();
      }
    }, (err) => {
      console.error("Error syncing users in StaffManagement:", err);
      setLoading(false);
    });

    return () => unsubUsers();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffUsername.trim() || !newStaffPassword.trim()) {
      alert("Mohon lengkapi Nama, Username, dan Password staf!");
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanUsername = String(newStaffUsername).trim().toLowerCase();
      const cleanPassword = String(newStaffPassword).trim();
      const cleanName = String(newStaffName).trim();
      const customStaffUid = `staff_${cleanUsername}`;
      const staffDocRef = doc(db, 'users', customStaffUid);

      const staffPayload = {
        id: customStaffUid,
        uid: customStaffUid,
        name: cleanName,
        username: cleanUsername,
        usernameLower: cleanUsername,
        email: `${cleanUsername}@entong.store`,
        password: cleanPassword, // 🔒 Simpan password string murni
        pin: cleanPassword,
        pass: cleanPassword,
        staffPin: cleanPassword,
        role: selectedRole || 'STAFF', // 'STAFF' | 'ADMIN' | 'WORKER' | 'OWNER'
        isStaff: true,
        isBanned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // MERGE SIMPAN SECARA AMAN DI FIRESTORE
      await setDoc(staffDocRef, staffPayload, { merge: true });
      await setDoc(doc(db, 'staff', customStaffUid), staffPayload, { merge: true });

      alert(`✅ Akun Staf/Admin (${newStaffName.trim()}) berhasil dibuat! Staf sekarang bisa langsung login menggunakan username "${cleanUsername}" dan password yang ditentukan.`);
      
      setShowAddModal(false);
      setNewStaffName('');
      setNewStaffUsername('');
      setNewStaffPassword('');

    } catch (err: any) {
      console.error("Gagal menambah akun staf:", err);
      alert(`Gagal membuat akun staf: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (docUniqueId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus akun staf ini?")) return;
    try {
      await deleteDoc(doc(db, 'users', docUniqueId));
      await deleteDoc(doc(db, 'staff', docUniqueId));
      alert("✅ Akun staf berhasil dihapus.");
    } catch (err: any) {
      console.error("Gagal menghapus staf:", err);
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  return (
    <div className="p-6 bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-2">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Kelola Staf & Worker Entong Store
          </h2>
          <p className="text-xs text-slate-400">Tambah staf baru, edit role, atau hapus staf internal.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* TOMBOL RECOVERY DARURAT */}
          <button
            onClick={forceInjectStaffData}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5"
          >
            <span>⚡ Pulihkan Data Staf Default</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Staf Baru</span>
          </button>
        </div>
      </div>

      {/* TABEL LISTING STAF */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-900/80">
              <th className="px-4 py-3">Nama Staf</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                  Memuat data staf...
                </td>
              </tr>
            ) : staffMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500 font-semibold">
                  Belum ada data staff internal yang terdaftar. Klik "⚡ Pulihkan Data Staf Default" di atas.
                </td>
              </tr>
            ) : (
              staffMembers.map((staff: any, idx: number) => (
                <tr key={staff.docUniqueId || staff.id || idx} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-bold text-white text-xs">{staff.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-300 font-mono">@{staff.username || '-'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                      staff.role === 'OWNER' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      staff.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {staff.role || 'STAFF'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(staff.docUniqueId)} className="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-rose-500/10 rounded-lg transition" title="Hapus Staf">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL TAMBAH STAF BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111b21] border border-slate-700 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-emerald-400">
              <UserPlus className="w-5 h-5" />
              <span>Tambah Staf / Admin Baru Entong Store</span>
            </h3>
            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Nama Staf</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Joko"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Username Login</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: budijoko"
                  value={newStaffUsername}
                  onChange={e => setNewStaffUsername(e.target.value)}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Password (Opsional)</label>
                <input
                  type="text"
                  placeholder="Kosongkan jika tidak ada"
                  value={newStaffPassword}
                  onChange={e => setNewStaffPassword(e.target.value)}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Role / Hak Akses</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-bold focus:outline-none focus:border-emerald-400"
                >
                  <option value="STAFF">STAFF (Pengelola Toko Joko)</option>
                  <option value="WORKER">WORKER (Pekerja Joko)</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OWNER">OWNER</option>
                  <option value="OPERATOR">OPERATOR</option>
                </select>
              </div>
              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-[#202c33] text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-[#111b21] font-extrabold rounded-xl shadow-lg transition-colors">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Staf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
