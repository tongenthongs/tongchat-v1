import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, doc, onSnapshot, setDoc, getDocs, query, where, limit 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, 
  Coffee, Download, ChevronLeft, ChevronRight, Search, 
  ShieldCheck, ShieldAlert, Sparkles, Filter, FileSpreadsheet, 
  RefreshCw, Plus, Edit2, Save, Trash2, UserCheck, Users, HelpCircle
} from 'lucide-react';
import { UserProfile } from '../../types';

export interface AttendanceRecord {
  staff_id: string;
  staff_name: string;
  staff_role?: string;
  status: 'HADIR' | 'TIDAK' | 'TELAT' | 'LIBUR' | 'IZIN';
  check_in_time?: string;
  check_out_time?: string;
  late_minutes?: number;
  late_reason?: string;
  notes?: string;
  updated_at?: string;
}

export interface AttendanceDayDoc {
  date: string; // YYYY-MM-DD
  records: Record<string, AttendanceRecord>;
  updated_at?: string;
}

interface AttendancePanelProps {
  currentUser?: UserProfile | null;
}

const DEFAULT_STAFF_FALLBACK = [
  { id: 'staff_owner_entong', name: 'Ceo Entong', username: 'ceo_entong', role: 'OWNER' },
  { id: 'staff_admin_entong', name: 'Admin Entong', username: 'admin_entong', role: 'ADMIN' },
  { id: 'staff_kamil', name: 'kamil', username: 'kamil', role: 'STAFF' }
];

export const AttendancePanel: React.FC<AttendancePanelProps> = ({ currentUser }) => {
  const isOwner = currentUser?.role?.toUpperCase() === 'OWNER';

  // State
  const [activeTab, setActiveTab] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().substring(0, 7); // YYYY-MM
  });

  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(true);
  const [dayAttendance, setDayAttendance] = useState<AttendanceDayDoc | null>(null);
  const [monthAttendanceDocs, setMonthAttendanceDocs] = useState<AttendanceDayDoc[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchStaff, setSearchStaff] = useState<string>('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  // Late Time Modal State
  const [lateModalStaff, setLateModalStaff] = useState<any | null>(null);
  const [lateMinutesInput, setLateMinutesInput] = useState<string>('15');
  const [lateTimeInput, setLateTimeInput] = useState<string>('08:30');
  const [lateReasonInput, setLateReasonInput] = useState<string>('');

  // Note Modal State
  const [noteModalStaff, setNoteModalStaff] = useState<any | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');

  // 1. Fetch Staff List from Firestore `users` & `staff` with limit
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'users'), limit(150)), (snap) => {
      const allUsers = snap.docs.map(d => ({ docUniqueId: d.id, id: d.id, ...d.data() }));
      const staffOnly = allUsers.filter((u: any) => {
        const r = (u.role || '').toString().toUpperCase();
        return r === 'STAFF' || r === 'ADMIN' || r === 'OWNER' || r === 'WORKER' || r === 'OPERATOR' || u.isStaff === true;
      });

      if (staffOnly.length > 0) {
        setStaffList(staffOnly);
      } else {
        setStaffList(DEFAULT_STAFF_FALLBACK);
      }
      setIsLoadingStaff(false);
    }, (err) => {
      console.warn("Notice loading users for attendance:", err);
      setStaffList(DEFAULT_STAFF_FALLBACK);
      setIsLoadingStaff(false);
    });

    return () => unsub();
  }, []);

  // 2. Realtime listener for the selected day attendance document
  useEffect(() => {
    if (!selectedDate) return;
    const unsub = onSnapshot(doc(db, 'attendance', selectedDate), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDayAttendance({
          date: selectedDate,
          records: data.records || {},
          updated_at: data.updated_at
        });
      } else {
        setDayAttendance({
          date: selectedDate,
          records: {}
        });
      }
    }, (err) => {
      console.warn("Attendance listener notice:", err);
    });

    return () => unsub();
  }, [selectedDate]);

  // 3. Fetch all attendance docs for the selected month
  const fetchMonthlyData = async (monthStr: string) => {
    setIsLoadingMonth(true);
    try {
      const snap = await getDocs(collection(db, 'attendance'));
      const monthlyDocs: AttendanceDayDoc[] = [];
      snap.docs.forEach(d => {
        if (d.id.startsWith(monthStr)) {
          monthlyDocs.push({
            date: d.id,
            records: d.data().records || {},
            updated_at: d.data().updated_at
          });
        }
      });
      // Sort by date ascending
      monthlyDocs.sort((a, b) => a.date.localeCompare(b.date));
      setMonthAttendanceDocs(monthlyDocs);
    } catch (e) {
      console.error("Failed to load monthly attendance:", e);
    } finally {
      setIsLoadingMonth(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'MONTHLY' && selectedMonth) {
      fetchMonthlyData(selectedMonth);
    }
  }, [activeTab, selectedMonth]);

  // Quick Date Navigation
  const changeDateBy = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const setDateToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Helper to update a single staff record for the current day
  const updateStaffStatus = async (
    staff: any, 
    status: 'HADIR' | 'TIDAK' | 'TELAT' | 'LIBUR' | 'IZIN', 
    extra: Partial<AttendanceRecord> = {}
  ) => {
    const staffId = staff.id || staff.uid || staff.docUniqueId;
    if (!staffId || !selectedDate) return;

    setIsSaving(true);
    try {
      const currentRecords = { ...(dayAttendance?.records || {}) };
      const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      const newRecord: AttendanceRecord = {
        staff_id: staffId,
        staff_name: staff.name || staff.username || 'Staf',
        staff_role: staff.role || 'STAFF',
        status: status,
        check_in_time: status === 'HADIR' ? (currentRecords[staffId]?.check_in_time || currentTimeStr) : (currentRecords[staffId]?.check_in_time || null),
        check_out_time: currentRecords[staffId]?.check_out_time || null,
        late_minutes: status === 'TELAT' ? (extra.late_minutes ?? currentRecords[staffId]?.late_minutes ?? 15) : (currentRecords[staffId]?.late_minutes || null),
        late_reason: status === 'TELAT' ? (extra.late_reason ?? currentRecords[staffId]?.late_reason ?? '') : (currentRecords[staffId]?.late_reason || null),
        notes: extra.notes !== undefined ? extra.notes : (currentRecords[staffId]?.notes || null),
        updated_at: new Date().toISOString(),
      };
      
      // Merge extra safely (exclude undefined)
      Object.keys(extra).forEach(key => {
        if (extra[key] !== undefined) {
          newRecord[key] = extra[key];
        }
      });
      
      // Clean up undefined from the object to prevent Firestore errors
      Object.keys(newRecord).forEach(key => {
        if (newRecord[key] === undefined) {
          newRecord[key] = null;
        }
      });


      currentRecords[staffId] = newRecord;

      const docRef = doc(db, 'attendance', selectedDate);
      await setDoc(docRef, {
        date: selectedDate,
        records: currentRecords,
        updated_at: new Date().toISOString()
      }, { merge: true });

      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2000);
    } catch (e: any) {
      console.error("Error saving attendance record:", e);
      alert(`Gagal menyimpan absensi: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Mass Actions
  const handleMarkAllPresent = async () => {
    if (!window.confirm(`Tandai SEMUA staf sebagai HADIR untuk tanggal ${selectedDate}?`)) return;
    setIsSaving(true);
    try {
      const currentRecords = { ...(dayAttendance?.records || {}) };
      const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      staffList.forEach(staff => {
        const staffId = staff.id || staff.uid || staff.docUniqueId;
        currentRecords[staffId] = {
          staff_id: staffId,
          staff_name: staff.name || staff.username || 'Staf',
          staff_role: staff.role || 'STAFF',
          status: 'HADIR',
          check_in_time: currentRecords[staffId]?.check_in_time || currentTimeStr,
          check_out_time: currentRecords[staffId]?.check_out_time || null,
          late_minutes: currentRecords[staffId]?.late_minutes || null,
          late_reason: currentRecords[staffId]?.late_reason || null,
          notes: currentRecords[staffId]?.notes || null,
          updated_at: new Date().toISOString()
        };
        Object.keys(currentRecords[staffId]).forEach(k => {
          if (currentRecords[staffId][k] === undefined) {
             currentRecords[staffId][k] = null;
          }
        });
      });

      const docRef = doc(db, 'attendance', selectedDate);
      await setDoc(docRef, {
        date: selectedDate,
        records: currentRecords,
        updated_at: new Date().toISOString()
      }, { merge: true });

      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2000);
    } catch (e: any) {
      alert(`Gagal menyimpan: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDay = async () => {
    if (!window.confirm(`Hapus seluruh catatan absensi untuk tanggal ${selectedDate}?`)) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'attendance', selectedDate);
      await setDoc(docRef, {
        date: selectedDate,
        records: {},
        updated_at: new Date().toISOString()
      });
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2000);
    } catch (e: any) {
      alert(`Gagal mereset: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save Late Modal
  const handleConfirmLate = async () => {
    if (!lateModalStaff) return;
    const minutes = parseInt(lateMinutesInput) || 0;
    await updateStaffStatus(lateModalStaff, 'TELAT', {
      late_minutes: minutes,
      late_reason: lateReasonInput.trim() || `Terlambat ${minutes} menit (Jam ${lateTimeInput})`,
      check_in_time: lateTimeInput
    });
    setLateModalStaff(null);
  };

  // Save Note Modal
  const handleConfirmNote = async () => {
    if (!noteModalStaff) return;
    const currentRec = dayAttendance?.records?.[noteModalStaff.id || noteModalStaff.uid] || { status: 'HADIR' };
    await updateStaffStatus(noteModalStaff, currentRec.status || 'HADIR', {
      notes: noteInput.trim()
    });
    setNoteModalStaff(null);
  };

  // Filtered staff for daily view
  const filteredStaffList = useMemo(() => {
    if (!searchStaff.trim()) return staffList;
    const q = searchStaff.toLowerCase();
    return staffList.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.username || '').toLowerCase().includes(q) || 
      (s.role || '').toLowerCase().includes(q)
    );
  }, [staffList, searchStaff]);

  // Calculations for Daily Tab
  const dailyStats = useMemo(() => {
    const records = dayAttendance?.records || {};
    let hadir = 0;
    let tidak = 0;
    let telat = 0;
    let libur = 0;
    let izin = 0;
    let belum = 0;

    staffList.forEach(s => {
      const sid = s.id || s.uid || s.docUniqueId;
      const rec = records[sid];
      if (!rec) {
        belum++;
      } else if (rec.status === 'HADIR') {
        hadir++;
      } else if (rec.status === 'TIDAK') {
        tidak++;
      } else if (rec.status === 'TELAT') {
        telat++;
      } else if (rec.status === 'LIBUR') {
        libur++;
      } else if (rec.status === 'IZIN') {
        izin++;
      }
    });

    return { hadir, tidak, telat, libur, izin, belum, total: staffList.length };
  }, [staffList, dayAttendance]);

  // Calculations for Monthly Tab
  const monthlySummary = useMemo(() => {
    const summaryMap: Record<string, {
      staff_id: string;
      staff_name: string;
      staff_role: string;
      totalHadir: number;
      totalTidak: number;
      totalTelat: number;
      totalLibur: number;
      totalIzin: number;
      totalLateMinutes: number;
      attendanceRate: number;
    }> = {};

    // Initialize all staff
    staffList.forEach(s => {
      const sid = s.id || s.uid || s.docUniqueId;
      summaryMap[sid] = {
        staff_id: sid,
        staff_name: s.name || s.username || 'Staf',
        staff_role: s.role || 'STAFF',
        totalHadir: 0,
        totalTidak: 0,
        totalTelat: 0,
        totalLibur: 0,
        totalIzin: 0,
        totalLateMinutes: 0,
        attendanceRate: 0
      };
    });

    // Aggregate docs
    monthAttendanceDocs.forEach(dayDoc => {
      const records = dayDoc.records || {};
      Object.entries(records).forEach(([sid, rec]) => {
        if (!summaryMap[sid]) {
          summaryMap[sid] = {
            staff_id: sid,
            staff_name: rec.staff_name || 'Staf',
            staff_role: rec.staff_role || 'STAFF',
            totalHadir: 0,
            totalTidak: 0,
            totalTelat: 0,
            totalLibur: 0,
            totalIzin: 0,
            totalLateMinutes: 0,
            attendanceRate: 0
          };
        }

        if (rec.status === 'HADIR') summaryMap[sid].totalHadir++;
        else if (rec.status === 'TIDAK') summaryMap[sid].totalTidak++;
        else if (rec.status === 'TELAT') {
          summaryMap[sid].totalTelat++;
          summaryMap[sid].totalLateMinutes += (rec.late_minutes || 0);
        }
        else if (rec.status === 'LIBUR') summaryMap[sid].totalLibur++;
        else if (rec.status === 'IZIN') summaryMap[sid].totalIzin++;
      });
    });

    // Calculate percentage
    Object.values(summaryMap).forEach(item => {
      const effectiveWorkDays = item.totalHadir + item.totalTelat + item.totalTidak + item.totalIzin;
      if (effectiveWorkDays > 0) {
        item.attendanceRate = Math.round(((item.totalHadir + item.totalTelat) / effectiveWorkDays) * 100);
      } else {
        item.attendanceRate = 100;
      }
    });

    return Object.values(summaryMap);
  }, [staffList, monthAttendanceDocs]);

  // Export to CSV
  const handleExportCSV = () => {
    if (monthlySummary.length === 0) {
      alert('Tidak ada data absensi untuk diekspor pada bulan ini.');
      return;
    }

    const [year, month] = selectedMonth.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthName = monthNames[parseInt(month, 10) - 1] || month;

    const headers = [
      'No',
      'Nama Staf / Pekerja',
      'Role',
      'Hadir (Hari)',
      'Telat (Hari)',
      'Total Menit Telat',
      'Tidak Hadir / Alpha (Hari)',
      'Izin / Sakit (Hari)',
      'Libur / Off (Hari)',
      'Persentase Kehadiran (%)'
    ];

    const rows = monthlySummary.map((item, idx) => [
      idx + 1,
      `"${item.staff_name}"`,
      `"${item.staff_role}"`,
      item.totalHadir,
      item.totalTelat,
      item.totalLateMinutes,
      item.totalTidak,
      item.totalIzin,
      item.totalLibur,
      `${item.attendanceRate}%`
    ]);

    const csvContent = '\uFEFF' + [
      `"REKAP ABSENSI KARYAWAN & STAF ENTONG STORE - BULAN ${monthName.toUpperCase()} ${year}"`,
      `"Waktu Ekspor: ${new Date().toLocaleString('id-ID')}"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Absensi_EntongStore_${monthName}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🛡️ OWNER ACCESS ROUTE GUARD
  if (!isOwner) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="bg-[#111b21] border border-rose-500/40 max-w-md w-full p-8 rounded-3xl text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-500/50 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-100">Akses Terbatas: Panel Absensi Owner</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Halaman rekap dan pengelolaan absensi seluruh staf hanya dapat diakses secara eksklusif oleh akun dengan peran <strong className="text-rose-400">OWNER (Ceo Entong)</strong>.
          </p>
          <div className="p-3 bg-[#202c33] rounded-2xl border border-slate-700/60 text-xs text-slate-400 flex items-center justify-between">
            <span>Akun Anda Saat Ini:</span>
            <span className="font-bold text-slate-200">{currentUser?.name || 'User'}</span>
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 font-extrabold rounded-lg uppercase text-[10px]">
              {currentUser?.role || 'GUEST'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 md:p-6 overflow-y-auto space-y-5">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-[#00E676] border border-[#00E676]/30 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-100 flex items-center gap-2">
                Absensi & Rekap Kehadiran Tim
                <span className="px-2 py-0.5 bg-emerald-500/20 text-[#00E676] border border-[#00E676]/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                  OWNER ONLY
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Kelola status kehadiran harian, keterlambatan, dan ekspor laporan bulanan karyawan Entong Store.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher (Harian vs Rekap Bulanan) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#111b21] rounded-2xl border border-slate-800 shadow-md">
          <button
            type="button"
            onClick={() => setActiveTab('DAILY')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'DAILY'
                ? 'bg-[#00E676] text-[#111b21] shadow-lg shadow-[#00E676]/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Absen Harian</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MONTHLY')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'MONTHLY'
                ? 'bg-[#00E676] text-[#111b21] shadow-lg shadow-[#00E676]/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Rekap Bulanan & CSV</span>
          </button>
        </div>
      </div>

      {/* Auto-Save Indicator Badge */}
      {saveSuccessNotice && (
        <div className="p-3 bg-emerald-950/80 border border-[#00E676]/60 rounded-2xl text-[#00E676] text-xs font-bold flex items-center gap-2 animate-bounce shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
          <span>Perubahan absensi berhasil disimpan secara realtime ke database Firestore!</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: ABSENSI HARIAN (DAILY VIEW)                         */}
      {/* ========================================================= */}
      {activeTab === 'DAILY' && (
        <div className="space-y-4">
          
          {/* Date Selector & Mass Action Bar */}
          <div className="bg-[#111b21] border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Date Navigator */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => changeDateBy(-1)}
                className="p-2 bg-[#202c33] hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex items-center bg-[#202c33] border border-slate-700 rounded-xl px-3 py-1.5 shadow-inner">
                <Calendar className="w-4 h-4 text-emerald-400 mr-2 shrink-0 pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-100 outline-none cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => changeDateBy(1)}
                className="p-2 bg-[#202c33] hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
                title="Hari Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={setDateToToday}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition border ${
                  selectedDate === new Date().toISOString().split('T')[0]
                    ? 'bg-emerald-500/20 text-[#00E676] border-[#00E676]/40'
                    : 'bg-[#202c33] text-slate-300 hover:text-white border-slate-700'
                }`}
              >
                Hari Ini
              </button>
            </div>

            {/* Mass Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari staf..."
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <button
                type="button"
                onClick={handleMarkAllPresent}
                disabled={isSaving}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tandai Semua Hadir</span>
              </button>

              <button
                type="button"
                onClick={handleResetDay}
                disabled={isSaving}
                className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center gap-1"
                title="Reset Absen Hari Ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Daily Quick Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-[#111b21] border border-emerald-500/30 p-3 rounded-2xl shadow-lg text-center">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">HADIR</span>
              <span className="text-xl font-black text-[#00E676] mt-0.5 block">{dailyStats.hadir}</span>
            </div>

            <div className="bg-[#111b21] border border-amber-500/30 p-3 rounded-2xl shadow-lg text-center">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">TELAT</span>
              <span className="text-xl font-black text-amber-400 mt-0.5 block">{dailyStats.telat}</span>
            </div>

            <div className="bg-[#111b21] border border-rose-500/30 p-3 rounded-2xl shadow-lg text-center">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">ALPHA / TIDAK</span>
              <span className="text-xl font-black text-rose-400 mt-0.5 block">{dailyStats.tidak}</span>
            </div>

            <div className="bg-[#111b21] border border-purple-500/30 p-3 rounded-2xl shadow-lg text-center">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">IZIN / SAKIT</span>
              <span className="text-xl font-black text-purple-400 mt-0.5 block">{dailyStats.izin}</span>
            </div>

            <div className="bg-[#111b21] border border-sky-500/30 p-3 rounded-2xl shadow-lg text-center">
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">LIBUR / OFF</span>
              <span className="text-xl font-black text-sky-400 mt-0.5 block">{dailyStats.libur}</span>
            </div>

            <div className="bg-[#111b21] border border-slate-700 p-3 rounded-2xl shadow-lg text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BELUM ABSEN</span>
              <span className="text-xl font-black text-slate-300 mt-0.5 block">{dailyStats.belum}</span>
            </div>
          </div>

          {/* Employee Attendance Table / Card List */}
          <div className="bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#202c33] text-slate-300 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-bold w-[25%]">Nama Staf & Role</th>
                    <th className="py-3 px-3 font-bold w-[18%]">Status Kehadiran</th>
                    <th className="py-3 px-3 font-bold w-[35%]">Aksi Cepat Status (1-Click)</th>
                    <th className="py-3 px-3 font-bold w-[12%]">Jam Masuk</th>
                    <th className="py-3 px-3 font-bold w-[10%] text-center">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredStaffList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic text-xs">
                        Tidak ada staf yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffList.map((staff, idx) => {
                      const staffId = staff.id || staff.uid || staff.docUniqueId;
                      const record = dayAttendance?.records?.[staffId];
                      const status = record?.status;

                      return (
                        <tr key={`staff-att-${staffId}-${idx}`} className="hover:bg-[#202c33]/40 transition-colors">
                          
                          {/* Nama & Role */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-[#202c33] border border-slate-700 flex items-center justify-center font-black text-xs text-[#00E676] shrink-0">
                                {(staff.name || staff.username || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <div className="font-extrabold text-slate-100 truncate">{staff.name || staff.username}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px] font-bold uppercase">
                                    {staff.role || 'STAFF'}
                                  </span>
                                  {staff.username && (
                                    <span className="text-[10px] text-slate-500 font-mono">@{staff.username}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-3">
                            {!status ? (
                              <span className="px-2.5 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-[10px] font-bold">
                                Belum Absen
                              </span>
                            ) : status === 'HADIR' ? (
                              <span className="px-2.5 py-1 bg-emerald-500/20 text-[#00E676] border border-emerald-500/40 rounded-lg text-[10px] font-black flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3 text-[#00E676]" /> HADIR
                              </span>
                            ) : status === 'TELAT' ? (
                              <div className="space-y-0.5">
                                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-[10px] font-black flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3 text-amber-400" /> TELAT ({record.late_minutes || 0}m)
                                </span>
                                {record.late_reason && (
                                  <div className="text-[10px] text-amber-300/80 italic truncate max-w-[150px]">
                                    {record.late_reason}
                                  </div>
                                )}
                              </div>
                            ) : status === 'TIDAK' ? (
                              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-lg text-[10px] font-black flex items-center gap-1 w-fit">
                                <XCircle className="w-3 h-3 text-rose-400" /> ALPHA / TIDAK
                              </span>
                            ) : status === 'IZIN' ? (
                              <span className="px-2.5 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-lg text-[10px] font-black flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3 text-purple-400" /> IZIN / SAKIT
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-sky-500/20 text-sky-400 border border-sky-500/40 rounded-lg text-[10px] font-black flex items-center gap-1 w-fit">
                                <Coffee className="w-3 h-3 text-sky-400" /> LIBUR / OFF
                              </span>
                            )}
                          </td>

                          {/* 1-Click Status Buttons */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Tombol Hadir */}
                              <button
                                type="button"
                                onClick={() => updateStaffStatus(staff, 'HADIR')}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                  status === 'HADIR'
                                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                                    : 'bg-[#202c33] text-emerald-400 hover:bg-emerald-950/60 border border-emerald-500/30'
                                }`}
                              >
                                Hadir
                              </button>

                              {/* Tombol Telat */}
                              <button
                                type="button"
                                onClick={() => {
                                  setLateModalStaff(staff);
                                  setLateMinutesInput(record?.late_minutes?.toString() || '15');
                                  setLateTimeInput(record?.check_in_time || '08:30');
                                  setLateReasonInput(record?.late_reason || '');
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                  status === 'TELAT'
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                                    : 'bg-[#202c33] text-amber-400 hover:bg-amber-950/60 border border-amber-500/30'
                                }`}
                              >
                                Telat...
                              </button>

                              {/* Tombol Tidak Hadir / Alpha */}
                              <button
                                type="button"
                                onClick={() => updateStaffStatus(staff, 'TIDAK')}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                  status === 'TIDAK'
                                    ? 'bg-rose-500 text-white font-black shadow-md'
                                    : 'bg-[#202c33] text-rose-400 hover:bg-rose-950/60 border border-rose-500/30'
                                }`}
                              >
                                Alpha
                              </button>

                              {/* Tombol Libur */}
                              <button
                                type="button"
                                onClick={() => updateStaffStatus(staff, 'LIBUR')}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                  status === 'LIBUR'
                                    ? 'bg-sky-500 text-slate-950 font-black shadow-md'
                                    : 'bg-[#202c33] text-sky-400 hover:bg-sky-950/60 border border-sky-500/30'
                                }`}
                              >
                                Libur
                              </button>

                              {/* Tombol Izin */}
                              <button
                                type="button"
                                onClick={() => updateStaffStatus(staff, 'IZIN')}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                  status === 'IZIN'
                                    ? 'bg-purple-500 text-white font-black shadow-md'
                                    : 'bg-[#202c33] text-purple-400 hover:bg-purple-950/60 border border-purple-500/30'
                                }`}
                              >
                                Izin
                              </button>
                            </div>
                          </td>

                          {/* Jam Masuk */}
                          <td className="py-3.5 px-3 text-slate-300 font-mono">
                            {record?.check_in_time ? (
                              <span className="text-emerald-400 font-bold">{record.check_in_time} WIB</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>

                          {/* Tombol Catatan */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setNoteModalStaff(staff);
                                setNoteInput(record?.notes || '');
                              }}
                              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                                record?.notes
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : 'bg-[#202c33] text-slate-400 hover:text-slate-200'
                              }`}
                              title={record?.notes ? `Catatan: ${record.notes}` : 'Tambah Catatan'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: REKAP BULANAN & EXPORT CSV                         */}
      {/* ========================================================= */}
      {activeTab === 'MONTHLY' && (
        <div className="space-y-4">
          
          {/* Controls Bar for Monthly View */}
          <div className="bg-[#111b21] border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Pilih Periode Bulan:
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-[#202c33] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 outline-none cursor-pointer focus:border-[#00E676]"
              />
              <button
                type="button"
                onClick={() => fetchMonthlyData(selectedMonth)}
                className="p-2 bg-[#202c33] hover:bg-slate-700 text-slate-300 rounded-xl transition"
                title="Refresh Rekap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMonth ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#111b21] font-black rounded-xl text-xs shadow-lg shadow-[#00E676]/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Laporan CSV Kehadiran</span>
            </button>
          </div>

          {/* Monthly Summary Table */}
          <div className="bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#202c33] text-slate-300 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-bold">Nama Staf</th>
                    <th className="py-3 px-3 font-bold">Role</th>
                    <th className="py-3 px-3 font-bold text-center text-emerald-400">Hadir</th>
                    <th className="py-3 px-3 font-bold text-center text-amber-400">Telat</th>
                    <th className="py-3 px-3 font-bold text-center text-amber-300">Total Menit Telat</th>
                    <th className="py-3 px-3 font-bold text-center text-rose-400">Alpha</th>
                    <th className="py-3 px-3 font-bold text-center text-purple-400">Izin</th>
                    <th className="py-3 px-3 font-bold text-center text-sky-400">Libur</th>
                    <th className="py-3 px-4 font-bold text-right">Persentase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {monthlySummary.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 italic text-xs">
                        Belum ada rekaman absensi untuk bulan {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    monthlySummary.map((item, idx) => (
                      <tr key={`mon-sum-${item.staff_id}-${idx}`} className="hover:bg-[#202c33]/40 transition-colors">
                        <td className="py-3.5 px-4 font-extrabold text-slate-100">{item.staff_name}</td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold uppercase">
                            {item.staff_role}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-black text-[#00E676]">{item.totalHadir} Hari</td>
                        <td className="py-3.5 px-3 text-center font-black text-amber-400">{item.totalTelat} Hari</td>
                        <td className="py-3.5 px-3 text-center font-mono text-amber-300">{item.totalLateMinutes} Menit</td>
                        <td className="py-3.5 px-3 text-center font-black text-rose-400">{item.totalTidak} Hari</td>
                        <td className="py-3.5 px-3 text-center font-black text-purple-400">{item.totalIzin} Hari</td>
                        <td className="py-3.5 px-3 text-center font-black text-sky-400">{item.totalLibur} Hari</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-[#202c33] h-2 rounded-full overflow-hidden border border-slate-700">
                              <div 
                                className={`h-full rounded-full ${
                                  item.attendanceRate >= 90 ? 'bg-emerald-500' : item.attendanceRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${item.attendanceRate}%` }}
                              />
                            </div>
                            <span className="font-black text-slate-100 text-xs w-10 text-right">
                              {item.attendanceRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL INPUT TELAT (LATE TIME & MINUTES)                    */}
      {/* ========================================================= */}
      {lateModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111b21] border border-amber-500/40 w-full max-w-sm rounded-2xl shadow-2xl p-5 text-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Catat Keterlambatan
              </h3>
              <button 
                type="button" 
                onClick={() => setLateModalStaff(null)} 
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Staf: <strong className="text-slate-100">{lateModalStaff.name || lateModalStaff.username}</strong>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Menit Terlambat</label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {['10', '15', '30', '60'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLateMinutesInput(m)}
                      className={`py-1.5 text-center rounded-lg font-bold ${lateMinutesInput === m ? 'bg-amber-500 text-slate-950' : 'bg-[#202c33] text-slate-300'}`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={lateMinutesInput}
                  onChange={e => setLateMinutesInput(e.target.value)}
                  placeholder="Jumlah menit telat"
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Jam Tiba / Masuk</label>
                <input
                  type="time"
                  value={lateTimeInput}
                  onChange={e => setLateTimeInput(e.target.value)}
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Alasan / Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={lateReasonInput}
                  onChange={e => setLateReasonInput(e.target.value)}
                  placeholder="Misal: Macet di jalan / Hujan lebat"
                  className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLateModalStaff(null)}
                className="flex-1 py-2.5 bg-[#202c33] text-slate-300 font-bold rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmLate}
                className="flex-1 py-2.5 bg-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-md"
              >
                Simpan Telat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL EDIT CATATAN                                         */}
      {/* ========================================================= */}
      {noteModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111b21] border border-blue-500/40 w-full max-w-sm rounded-2xl shadow-2xl p-5 text-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-blue-400 flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> Catatan Absensi
              </h3>
              <button 
                type="button" 
                onClick={() => setNoteModalStaff(null)} 
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Staf: <strong className="text-slate-100">{noteModalStaff.name || noteModalStaff.username}</strong> ({selectedDate})
            </div>

            <div>
              <textarea
                rows={3}
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Tulis catatan atau instruksi kerja khusus untuk staf ini..."
                className="w-full p-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-[#00E676]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNoteModalStaff(null)}
                className="flex-1 py-2.5 bg-[#202c33] text-slate-300 font-bold rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmNote}
                className="flex-1 py-2.5 bg-[#00E676] text-[#111b21] font-black rounded-xl text-xs shadow-md"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
