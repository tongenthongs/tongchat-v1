import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { CloudInstance, GameOrder, OrderStatus } from '../../types';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Server, 
  Plus, 
  Search, 
  Clock, 
  Trash2, 
  Edit3, 
  User, 
  Gamepad2, 
  Unlink, 
  RefreshCw, 
  Calendar, 
  Layers, 
  Cpu, 
  X,
  Sparkles,
  ArrowRight,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown
} from 'lucide-react';

// Helper to convert Date to datetime-local string (YYYY-MM-DDTHH:mm)
const toDateTimeLocalString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper to resolve exact expiration milliseconds from any Cloud object
export const getCloudExpirationMs = (cloud: any): number => {
  if (!cloud) return 0;
  if (typeof cloud === 'number') return cloud;
  if (typeof cloud === 'string') {
    const d = new Date(cloud).getTime();
    return isNaN(d) ? 0 : d;
  }
  if (cloud.expiresAt) {
    if (typeof cloud.expiresAt.toMillis === 'function') return cloud.expiresAt.toMillis();
    if (cloud.expiresAt.seconds) return cloud.expiresAt.seconds * 1000;
    if (typeof cloud.expiresAt === 'number') return cloud.expiresAt;
    const d = new Date(cloud.expiresAt).getTime();
    if (!isNaN(d)) return d;
  }
  if (cloud.rentEndDate) {
    const endStr = cloud.rentEndDate;
    const targetDate = new Date(endStr.includes('T') ? endStr : `${endStr}T23:59:59`);
    const d = targetDate.getTime();
    if (!isNaN(d)) return d;
  }
  if (cloud.rentStartDate && cloud.durationDays) {
    const start = new Date(cloud.rentStartDate);
    start.setDate(start.getDate() + Number(cloud.durationDays));
    return start.getTime();
  }
  return 0;
};

// ─── CloudCountdown sub-component ─────────────────────────────────────────────
// Isolated agar timer setiap detik TIDAK menyebabkan CloudMonitor re-render
const CloudCountdown: React.FC<{ cloud: any; className?: string }> = memo(({ cloud, className }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const targetMs = getCloudExpirationMs(cloud);
  if (!targetMs) return <span className={className}>7 Hari</span>;
  const diffMs = targetMs - now;
  if (diffMs <= 0) return <span className={`${className} text-red-400`}>Masa Sewa Habis</span>;
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const text = days > 0
    ? `${days}h ${hours}j ${minutes}m ${seconds}d`
    : `${hours}j ${minutes}m ${seconds}d`;
  return <span className={className}>{text}</span>;
});

export const CloudMonitor: React.FC = () => {
  const { clouds, orders, saveCloud, deleteCloud, assignOrderToCloud, releaseOrderFromCloud, updateOrderStatus, updateOrder } = useApp();

  // Memoize ordersMap untuk O(1) lookup — mengganti orders.find() di dalam map()
  const ordersMap = useMemo(() => {
    const map = new Map<string, GameOrder>();
    orders.forEach(o => {
      if (o.id) map.set(o.id, o);
      if (o.orderId && o.orderId !== o.id) map.set(o.orderId, o);
    });
    return map;
  }, [orders]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'IN_USE' | 'EXPIRED'>('ALL');
  
  // Modals state & editing notes / counters
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCloudForAction, setSelectedCloudForAction] = useState<CloudInstance | null>(null);
  const [cloudToRelease, setCloudToRelease] = useState<CloudInstance | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [editingNoteOrderId, setEditingNoteOrderId] = useState<string | null>(null);
  const [noteInputText, setNoteInputText] = useState<string>('');

  const [editingLastMoneyCloudId, setEditingLastMoneyCloudId] = useState<string | null>(null);
  const [lastMoneyInputText, setLastMoneyInputText] = useState<string>('');

  // Inline Edit Uang Awal (Initial Money)
  const [editingInitialMoneyCloudId, setEditingInitialMoneyCloudId] = useState<string | null>(null);
  const [initialMoneyInputText, setInitialMoneyInputText] = useState<string>('');

  // 💡 SMART SHORTCUT PARSER UTILS
  const parseShortcutAmount = (input: string): string => {
    if (!input) return '';
    const clean = input.toString().toLowerCase().trim().replace(/,/g, '.');

    try {
      if (/^([\d.]+)\s*t(riliun)?$/.test(clean)) {
        const match = clean.match(/^([\d.]+)/);
        if (match) {
          const num = parseFloat(match[1]);
          return (num * 1_000_000_000_000).toLocaleString('id-ID');
        }
      }
      if (/^([\d.]+)\s*(m|b|miliar)$/.test(clean)) {
        const match = clean.match(/^([\d.]+)/);
        if (match) {
          const num = parseFloat(match[1]);
          return (num * 1_000_000_000).toLocaleString('id-ID');
        }
      }
      if (/^([\d.]+)\s*(jt|juta)$/.test(clean)) {
        const match = clean.match(/^([\d.]+)/);
        if (match) {
          const num = parseFloat(match[1]);
          return (num * 1_000_000).toLocaleString('id-ID');
        }
      }
      if (/^([\d.]+)\s*(k|rb|ribu)$/.test(clean)) {
        const match = clean.match(/^([\d.]+)/);
        if (match) {
          const num = parseFloat(match[1]);
          return (num * 1_000).toLocaleString('id-ID');
        }
      }
    } catch {
      return input;
    }
    return input;
  };

  // Toggle status cloud: AVAILABLE ↔ EXPIRED
  const handleToggleCloudStatus = async (cloud: CloudInstance) => {
    const newStatus = cloud.status === 'EXPIRED' ? 'AVAILABLE' : 'EXPIRED';
    try {
      await saveCloud({ ...cloud, status: newStatus as any, updatedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error('Gagal toggle status cloud:', err);
    }
  };

  const handleSaveLastMoney = async (cloud: CloudInstance, targetOrder?: GameOrder) => {
    const rawVal = lastMoneyInputText.trim();
    const parsedVal = parseShortcutAmount(rawVal) || rawVal;
    try {
      await setDoc(doc(db, "cloud_instances", cloud.id), {
        lastMoney: parsedVal || null,
        uangTerakhir: parsedVal || null,
        lastMoneyUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
      await saveCloud({ ...cloud, lastMoney: parsedVal || null, updatedAt: new Date().toISOString() } as any);
      if (targetOrder) {
        await updateOrder({ ...targetOrder, uangTerakhir: parsedVal, lastMoney: parsedVal, uangSetelahJoko: parsedVal, lastMoneyUpdatedAt: new Date().toISOString(), updated: new Date().toISOString() } as any);
      }
      setEditingLastMoneyCloudId(null);
      showNotification('Uang Joki Terakhir berhasil disimpan!', 'success');
    } catch (err: any) {
      showNotification(`Gagal menyimpan: ${err.message || 'error'}`, 'error');
    }
  };

  const handleSaveInitialMoney = async (cloud: CloudInstance, targetOrder?: GameOrder) => {
    const rawVal = initialMoneyInputText.trim();
    const parsedVal = parseShortcutAmount(rawVal) || rawVal;
    try {
      const updatedCloud: CloudInstance = { ...cloud, initialMoney: parsedVal || null, updatedAt: new Date().toISOString() };
      await saveCloud(updatedCloud);
      await setDoc(doc(db, "cloud_instances", cloud.id), {
        initialMoney: parsedVal || null,
        uangAwal: parsedVal || null,
        initialCash: parsedVal || null,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
      if (targetOrder) {
        await updateOrder({ ...targetOrder, uangSebelumJoko: parsedVal, initialGameMoney: parsedVal, initial_money: parsedVal, initialMoney: parsedVal, uangAwal: parsedVal, initialCash: parsedVal, updated: new Date().toISOString() } as any);
      }
      setEditingInitialMoneyCloudId(null);
      showNotification('Uang Awal berhasil disimpan!', 'success');
    } catch (err: any) {
      showNotification(`Gagal menyimpan Uang Awal: ${err.message || 'Terjadi kesalahan'}`, 'error');
    }
  };

  const handleUpdateCrashCount = async (orderId: string, currentCount: number, delta: number) => {
    const nextCount = Math.max(0, currentCount + delta);
    const targetOrder = orders.find(o => o.id === orderId || o.orderId === orderId);
    if (!targetOrder) {
      showNotification('Data order tidak ditemukan untuk update tabrakan.', 'error');
      return;
    }
    try {
      const updated = {
        ...targetOrder,
        crashCount: nextCount,
        updated: new Date().toISOString()
      };
      await updateOrder(updated);
      showNotification(`Counter tabrakan diperbarui menjadi ${nextCount}x`, 'success');
    } catch (err: any) {
      showNotification(`Gagal update tabrakan: ${err.message}`, 'error');
    }
  };

  const handleSaveOrderNote = async (orderId: string, cloud?: CloudInstance) => {
    const targetOrder = orders.find(o => o.id === orderId || o.orderId === orderId);
    try {
      if (targetOrder) {
        await updateOrder({ ...targetOrder, note: noteInputText, notes: noteInputText, updated: new Date().toISOString() });
      }
      if (cloud) {
        await setDoc(doc(db, "cloud_instances", cloud.id), { notes: noteInputText, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
        await saveCloud({ ...cloud, notes: noteInputText, updatedAt: new Date().toISOString() });
      }
      setEditingNoteOrderId(null);
      showNotification('Catatan berhasil disimpan', 'success');
    } catch (err: any) {
      showNotification(`Gagal menyimpan catatan: ${err.message}`, 'error');
    }
  };

  // Form State (Default 7 Hari & Presisi Jam/Menit)
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    provider: '',
    ipAddress: '',
    status: 'AVAILABLE' as 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'EXPIRED',
    notes: '',
    rentStartDate: new Date().toISOString().split('T')[0],
    rentEndDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    })(),
    expiresAt: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return toDateTimeLocalString(d);
    })(),
    durationDays: 7,
    totalCost: 35000
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // TIDAK ada nowTimestamp di sini — countdown dipindahkan ke CloudCountdown sub-component
  // agar timer setiap detik TIDAK menyebabkan seluruh CloudMonitor re-render

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleCopyOrderId = (orderId: string) => {
    const cleanId = orderId.startsWith('#') ? orderId : `#${orderId}`;
    navigator.clipboard.writeText(cleanId);
    setCopiedOrderId(orderId);
    showNotification(`Nomor Order ${cleanId} disalin ke clipboard!`, 'success');
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Helper to calculate exact countdown string — pakai Date.now() langsung (bukan state)
  const formatCountdown = (cloud?: CloudInstance | { rentEndDate?: string; rentStartDate?: string; durationDays?: number; expiresAt?: any } | string): { text: string; isExpired: boolean; isWarning: boolean; daysLeft: number; totalHoursLeft: number } => {
    if (!cloud) return { text: '7 Hari', isExpired: false, isWarning: false, daysLeft: 7, totalHoursLeft: 168 };
    const targetMs = getCloudExpirationMs(cloud);
    if (!targetMs) return { text: '7 Hari', isExpired: false, isWarning: false, daysLeft: 7, totalHoursLeft: 168 };
    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) return { text: 'Masa Sewa Habis', isExpired: true, isWarning: false, daysLeft: 0, totalHoursLeft: 0 };
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalHoursLeft = Math.floor(totalSeconds / 3600);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const isWarning = days < 2;
    if (days > 0) return { text: `${days}h ${hours}j ${minutes}m ${seconds}d`, isExpired: false, isWarning, daysLeft: days, totalHoursLeft };
    return { text: `${hours}j ${minutes}m ${seconds}d`, isExpired: false, isWarning: true, daysLeft: 0, totalHoursLeft };
  };
  // Quick Adjustment for Expiration Time (Hours and Days)
  const adjustExpirationTime = (hoursDelta: number, daysDelta: number = 0) => {
    const currentBase = formData.expiresAt ? new Date(formData.expiresAt) : new Date();
    const targetDate = isNaN(currentBase.getTime()) ? new Date() : new Date(currentBase);

    targetDate.setHours(targetDate.getHours() + hoursDelta);
    targetDate.setDate(targetDate.getDate() + daysDelta);

    const newDateTimeLocal = toDateTimeLocalString(targetDate);
    const newDateOnly = newDateTimeLocal.split('T')[0];

    const startDate = new Date(formData.rentStartDate || new Date());
    const diffDays = Math.max(1, Math.round((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    setFormData(prev => ({
      ...prev,
      expiresAt: newDateTimeLocal,
      rentEndDate: newDateOnly,
      durationDays: diffDays,
      totalCost: diffDays * 5000
    }));
  };

  // Handle direct DateTime Local Picker Change
  const handleDateTimeLocalChange = (val: string) => {
    if (!val) return;
    const targetDate = new Date(val);
    const newDateOnly = val.split('T')[0];
    const startDate = new Date(formData.rentStartDate || new Date());
    const diffDays = Math.max(1, Math.round((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    setFormData(prev => ({
      ...prev,
      expiresAt: val,
      rentEndDate: newDateOnly,
      durationDays: diffDays,
      totalCost: diffDays * 5000
    }));
  };

  // Handle live order status change directly from the cloud card
  const handleLiveOrderStatusChange = async (cloud: CloudInstance, newStatus: string) => {
    const orderId = cloud.assignedOrderId;
    if (!orderId) return;

    setUpdatingOrderId(orderId);
    try {
      if (['SELESAI', 'BATAL', 'BATAL_TOLAK', 'CANCEL', 'HANGUS'].includes(newStatus)) {
        // Update order status and automatically release cloud
        await updateOrderStatus(orderId, newStatus as OrderStatus);
        await releaseOrderFromCloud(cloud.id);
        showNotification(`Pesanan #${orderId} diset ${newStatus}. Server ${cloud.name} otomatis kembali KOSONG.`, 'success');
      } else {
        // Update order status in order & cloud
        await updateOrderStatus(orderId, newStatus as OrderStatus);
        const updatedCloudData = {
          ...cloud,
          assignedOrderStatus: newStatus
        };
        await saveCloud(updatedCloudData);
        showNotification(`Status pesanan #${orderId} berhasil diubah ke ${newStatus}.`, 'success');
      }
    } catch (err: any) {
      showNotification(`Gagal mengubah status pesanan: ${err.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Calculate rental end date based on duration days
  const handleDurationChange = (days: number) => {
    const start = new Date(formData.rentStartDate || new Date());
    const targetDate = new Date(start);
    targetDate.setDate(targetDate.getDate() + days);
    
    const newDateTimeLocal = toDateTimeLocalString(targetDate);
    const endStr = newDateTimeLocal.split('T')[0];
    const cost = days * 5000;

    setFormData(prev => ({
      ...prev,
      expiresAt: newDateTimeLocal,
      durationDays: days,
      rentEndDate: endStr,
      totalCost: cost
    }));
  };

  const handleStartDateChange = (startDateStr: string) => {
    const start = new Date(startDateStr);
    const targetDate = new Date(start);
    targetDate.setDate(targetDate.getDate() + formData.durationDays);
    const newDateTimeLocal = toDateTimeLocalString(targetDate);
    const endStr = newDateTimeLocal.split('T')[0];

    setFormData(prev => ({
      ...prev,
      rentStartDate: startDateStr,
      expiresAt: newDateTimeLocal,
      rentEndDate: endStr
    }));
  };

  // Open Add Modal with fresh default 7-day state
  const handleOpenAdd = () => {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 7);

    // Auto-generate Cloud Number
    const nextNumber = clouds.length + 1;
    const paddedNum = nextNumber < 10 ? `0${nextNumber}` : `${nextNumber}`;

    setFormData({
      id: '',
      name: `Cloud ${paddedNum}`,
      provider: 'Contabo Singapore',
      ipAddress: '',
      status: 'AVAILABLE',
      notes: '',
      rentStartDate: today.toISOString().split('T')[0],
      rentEndDate: end.toISOString().split('T')[0],
      expiresAt: toDateTimeLocalString(end),
      durationDays: 7,
      totalCost: 35000
    });
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (cloud: CloudInstance) => {
    setSelectedCloudForAction(cloud);
    
    let expiryDate: Date;
    if (cloud.expiresAt) {
      if (typeof (cloud.expiresAt as any).toMillis === 'function') {
        expiryDate = new Date((cloud.expiresAt as any).toMillis());
      } else if ((cloud.expiresAt as any).seconds) {
        expiryDate = new Date((cloud.expiresAt as any).seconds * 1000);
      } else {
        expiryDate = new Date(cloud.expiresAt);
      }
    } else if (cloud.rentEndDate) {
      expiryDate = new Date(cloud.rentEndDate.includes('T') ? cloud.rentEndDate : `${cloud.rentEndDate}T23:59:59`);
    } else {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (cloud.durationDays || 7));
    }

    if (isNaN(expiryDate.getTime())) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);
    }

    setFormData({
      id: cloud.id,
      name: cloud.name || '',
      provider: cloud.provider || '',
      ipAddress: cloud.ipAddress || '',
      status: cloud.status || 'AVAILABLE',
      notes: cloud.notes || '',
      rentStartDate: cloud.rentStartDate || new Date().toISOString().split('T')[0],
      rentEndDate: cloud.rentEndDate || expiryDate.toISOString().split('T')[0],
      expiresAt: toDateTimeLocalString(expiryDate),
      durationDays: cloud.durationDays || 7,
      totalCost: cloud.totalCost || 35000
    });
    setShowEditModal(true);
  };

  // Submit Add / Edit Cloud
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('Nama Cloud wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = Boolean(formData.id);
      const targetExpiryDate = new Date(formData.expiresAt);
      const isoExpiresAt = isNaN(targetExpiryDate.getTime()) ? new Date().toISOString() : targetExpiryDate.toISOString();

      const newCloud: CloudInstance = {
        id: formData.id || `cloud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: formData.name.trim(),
        provider: formData.provider.trim() || 'VPS Server',
        ipAddress: formData.ipAddress.trim() || undefined,
        status: formData.status,
        notes: formData.notes.trim() || undefined,
        rentStartDate: formData.rentStartDate,
        rentEndDate: formData.rentEndDate,
        expiresAt: isoExpiresAt,
        durationDays: Number(formData.durationDays) || 7,
        totalCost: Number(formData.totalCost) || 0,
        createdAt: isEdit && selectedCloudForAction?.createdAt ? selectedCloudForAction.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedOrderId: isEdit ? selectedCloudForAction?.assignedOrderId : null,
        currentOrderId: isEdit ? selectedCloudForAction?.currentOrderId : null,
        assignedCustomerName: isEdit ? selectedCloudForAction?.assignedCustomerName : null,
        assignedGameName: isEdit ? selectedCloudForAction?.assignedGameName : null,
        assignedPackageName: isEdit ? selectedCloudForAction?.assignedPackageName : null,
        assignedGameUsername: isEdit ? selectedCloudForAction?.assignedGameUsername : null,
        assignedOrderStatus: isEdit ? selectedCloudForAction?.assignedOrderStatus : null
      };

      await saveCloud(newCloud);
      showNotification(isEdit ? 'Data Cloud & Masa Sewa berhasil diperbarui!' : 'Cloud baru berhasil ditambahkan!', 'success');
      setShowAddModal(false);
      setShowEditModal(false);
    } catch (err: any) {
      showNotification(`Gagal menyimpan: ${err.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Cloud Handler
  const handleDeleteCloud = async (cloud: CloudInstance) => {
    if (cloud.assignedOrderId) {
      alert(`Cloud "${cloud.name}" sedang digunakan oleh Pesanan #${cloud.assignedOrderId}. Silakan lepas joki terlebih dahulu sebelum menghapus cloud.`);
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus "${cloud.name}"? Data yang dihapus tidak dapat dipulihkan.`)) {
      return;
    }

    try {
      await deleteCloud(cloud.id);
      showNotification(`"${cloud.name}" berhasil dihapus.`, 'success');
    } catch (err: any) {
      showNotification(`Gagal menghapus: ${err.message}`, 'error');
    }
  };

  // Open Assign Modal for Specific Cloud
  const handleOpenAssign = (cloud: CloudInstance) => {
    if (cloud.assignedOrderId) {
      showNotification('Cloud ini sudah memiliki pesanan aktif. Lepas terlebih dahulu jika ingin mengganti.', 'error');
      return;
    }
    setSelectedCloudForAction(cloud);
    setOrderSearchQuery('');
    setShowAssignModal(true);
  };

  // Confirm Assign Order to Cloud
  const handleConfirmAssign = async (order: GameOrder) => {
    if (!selectedCloudForAction) return;
    setIsSubmitting(true);
    try {
      await assignOrderToCloud(selectedCloudForAction.id, order.id);
      showNotification(`Pesanan #${order.id} berhasil dipasang ke ${selectedCloudForAction.name}!`, 'success');
      setShowAssignModal(false);
      setSelectedCloudForAction(null);
    } catch (err: any) {
      showNotification(`Gagal menugaskan: ${err.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Lepas Joki Modal
  const handleTriggerRelease = (cloud: CloudInstance) => {
    setCloudToRelease(cloud);
  };

  // Confirm Release Order (Lepas Joki)
  const confirmReleaseOrder = async () => {
    if (!cloudToRelease) return;
    setIsSubmitting(true);
    try {
      await releaseOrderFromCloud(cloudToRelease.id);
      showNotification(`Pesanan berhasil dilepas dari ${cloudToRelease.name}. Cloud kembali KOSONG.`, 'success');
      setCloudToRelease(null);
    } catch (err: any) {
      showNotification(`Gagal melepas pesanan: ${err.message || 'Terjadi kesalahan'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // STRICT JOKI FILTER (MODAL PASANG ORDERAN)
  // Hanya tampilkan pesanan dengan kategori/layanan "JOKI" atau "JOKO" yang berstatus aktif/proses dan belum punya cloud
  // =========================================================================
  const availableJokiOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Cek apakah sudah terpasang di cloud
      if (o.assignedCloudId || o.cloud_number) return false;

      // 2. Cek status aktif (bukan selesai / batal)
      const st = (o.status || '').toUpperCase();
      if (['SELESAI', 'BATAL', 'BATAL_TOLAK', 'CANCEL', 'REJECTED', 'HANGUS', 'EXPIRED'].includes(st)) return false;

      // 3. Filter ketat kategori / kata kunci JOKI / JOKO
      const gameLower = (o.game_name || '').toLowerCase();
      const pkgLower = (o.package_name || '').toLowerCase();
      const loginMethodLower = (o.login_method || '').toLowerCase();
      const isJokiService = 
        gameLower.includes('joki') || 
        gameLower.includes('joko') || 
        pkgLower.includes('joki') || 
        pkgLower.includes('joko') ||
        loginMethodLower.includes('password') ||
        loginMethodLower.includes('cookie') ||
        loginMethodLower.includes('qr') ||
        Boolean(o.game_username) ||
        Boolean(o.game_password) ||
        Boolean(o.jokoPassword);

      if (!isJokiService) return false;

      // 4. Search Filter
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase();
        const idMatch = (o.id || '').toLowerCase().includes(q) || (o.orderId || '').toLowerCase().includes(q);
        const nameMatch = (o.customer_name || '').toLowerCase().includes(q);
        const userMatch = (o.game_username || '').toLowerCase().includes(q);
        const pkgMatch = (o.package_name || '').toLowerCase().includes(q);
        const gameMatch = (o.game_name || '').toLowerCase().includes(q);
        return idMatch || nameMatch || userMatch || pkgMatch || gameMatch;
      }

      return true;
    });
  }, [orders, orderSearchQuery]);

  // Filtered Clouds List
  const filteredClouds = useMemo(() => {
    return clouds.filter((c) => {
      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const providerMatch = (c.provider || '').toLowerCase().includes(q);
        const ipMatch = (c.ipAddress || '').toLowerCase().includes(q);
        const orderMatch = (c.assignedOrderId || '').toLowerCase().includes(q);
        const custMatch = (c.assignedCustomerName || '').toLowerCase().includes(q);
        const userMatch = (c.assignedGameUsername || '').toLowerCase().includes(q);
        if (!nameMatch && !providerMatch && !ipMatch && !orderMatch && !custMatch && !userMatch) {
          return false;
        }
      }

      // Status Filter
      if (filterStatus === 'AVAILABLE') {
        return !c.assignedOrderId && c.status !== 'EXPIRED';
      }
      if (filterStatus === 'IN_USE') {
        return Boolean(c.assignedOrderId);
      }
      if (filterStatus === 'EXPIRED') {
        return c.status === 'EXPIRED';
      }

      return true;
    });
  }, [clouds, searchQuery, filterStatus]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = clouds.length;
    let occupied = 0;
    let available = 0;
    let expired = 0;

    clouds.forEach((c) => {
      if (c.status === 'EXPIRED') {
        expired++;
      } else if (c.assignedOrderId || c.status === 'IN_USE') {
        occupied++;
      } else {
        available++;
      }
    });

    return { total, occupied, available, expired };
  }, [clouds]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto text-slate-100 font-sans">
      
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold transition-all transform animate-in slide-in-from-top duration-200 ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-600 text-white border border-emerald-400/40 shadow-emerald-600/30' 
            : 'bg-red-600 text-white border border-red-400/40 shadow-red-600/30'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111b21] p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Cloud Monitor
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  SLOT MANAGEMENT
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Kelola ketersediaan server cloud, masa sewa, dan penugasan joko aktif secara real-time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Cloud</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Slot Cloud</span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{stats.total} <span className="text-xs text-slate-400 font-normal">Server</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Kapasitas infrastruktur aktif</div>
        </div>

        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Slot Terisi (Joko)</span>
            <Gamepad2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 mt-1.5">{stats.occupied} <span className="text-xs text-slate-400 font-normal">Server</span></div>
          <div className="text-[10px] text-blue-300 mt-1">1 Cloud = 1 Orderan Aktif</div>
        </div>

        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Slot Kosong (Ready)</span>
            <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="text-2xl font-black text-[#00E676] mt-1.5">{stats.available} <span className="text-xs text-slate-400 font-normal">Server</span></div>
          <div className="text-[10px] text-emerald-400/80 mt-1">Siap dipasangi orderan joko</div>
        </div>

        <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Masa Sewa Habis</span>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-400 mt-1.5">{stats.expired} <span className="text-xs text-slate-400 font-normal">Server</span></div>
          <div className="text-[10px] text-red-300 mt-1">Perlu perpanjangan masa aktif</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111b21] p-3.5 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama cloud, IP, provider, customer..."
            className="w-full pl-9.5 pr-4 py-2 bg-[#202c33] border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Semua ({clouds.length})
          </button>
          <button
            onClick={() => setFilterStatus('AVAILABLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterStatus === 'AVAILABLE'
                ? 'bg-[#00E676] text-[#111b21] shadow-md shadow-emerald-500/20'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Kosong ({stats.available})
          </button>
          <button
            onClick={() => setFilterStatus('IN_USE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterStatus === 'IN_USE'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Terisi ({stats.occupied})
          </button>
          <button
            onClick={() => setFilterStatus('EXPIRED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterStatus === 'EXPIRED'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-[#202c33] text-slate-300 hover:bg-[#2a3942]'
            }`}
          >
            Expired ({stats.expired})
          </button>
        </div>
      </div>

      {/* Cloud Instances Grid */}
      {filteredClouds.length === 0 ? (
        <div className="bg-[#111b21] rounded-2xl border border-slate-800 p-12 text-center space-y-3">
          <Server className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">Tidak ada Cloud ditemukan</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery 
              ? `Tidak ada data server cloud yang sesuai dengan kata kunci "${searchQuery}".` 
              : 'Belum ada data instance cloud terdaftar. Klik "Tambah Cloud" untuk menambahkan server baru.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenAdd}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Cloud Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClouds.map((cloud, idx) => {
            const isOccupied = Boolean(cloud.assignedOrderId);
            const countdown = formatCountdown(cloud);
            const isExpired = cloud.status === 'EXPIRED';
            const isWarning = countdown.isWarning;
            const currentStatus = (cloud.assignedOrderStatus || 'DIPROSES').toUpperCase();
            const rawAssignedId = String(cloud.assignedOrderId || '');
            const displayOrderId = rawAssignedId.startsWith('#')
              ? rawAssignedId
              : rawAssignedId.startsWith('ORD-') || rawAssignedId.startsWith('ORD_')
              ? `#${rawAssignedId.replace(/_/g, '-')}`
              : `#ORD-${rawAssignedId}`;

            const matchingOrder = orders.find(o => o.id === cloud.assignedOrderId || o.orderId === cloud.assignedOrderId || o.id === cloud.currentOrderId);
            const crashCount = Number((matchingOrder as any)?.crashCount || 0);
            const orderNote = matchingOrder?.note || (matchingOrder as any)?.adminNote || '';

            return (
              <div
                key={cloud.id ? `cloud-card-${cloud.id}-${idx}` : `cloud-card-${idx}`}
                id={`cloud-card-${cloud.id}`}
                className={`bg-[#111b21] border rounded-2xl p-5 flex flex-col justify-between h-auto min-h-full transition-all duration-200 hover:shadow-2xl ${
                  isOccupied
                    ? 'border-blue-500/40 bg-gradient-to-b from-[#111b21] to-[#0c1822]'
                    : isExpired
                    ? 'border-red-500/40 bg-gradient-to-b from-[#111b21] to-[#1f1013]'
                    : 'border-slate-800 hover:border-[#00E676]/50'
                }`}
              >
                {/* Card Header */}
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner shrink-0 ${
                        isOccupied 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                          : 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20'
                      }`}>
                        <Server className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-white leading-tight whitespace-normal break-words">{cloud.name}</h3>
                          {/* Toggle Ready/Expired */}
                          <button
                            type="button"
                            onClick={() => handleToggleCloudStatus(cloud)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border transition-all cursor-pointer active:scale-95 ${
                              isExpired
                                ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
                                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                            }`}
                            title="Klik untuk toggle status Ready/Expired"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : 'bg-emerald-400'}`} />
                            {isExpired ? 'Expired' : 'Ready'}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 whitespace-normal break-words">
                          {cloud.provider || 'VPS Server'} {cloud.ipAddress ? `• ${cloud.ipAddress}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isOccupied ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                          TERISI
                        </span>
                      ) : isExpired ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5 whitespace-nowrap">
                          EXPIRED
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]"></span>
                          KOSONG
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ORDER INFORMATION (JIKA TERISI) */}
                  {isOccupied ? (
                    <div className="mt-3.5 bg-[#0e171f] border border-blue-500/30 rounded-xl p-3.5 space-y-3 shadow-inner">
                      {/* Top Bar: Order ID (Left) & Live Status Dropdown (Right) */}
                      <div className="flex items-center justify-between gap-2 border-b border-blue-500/20 pb-2.5">
                        {/* Order ID with Copy Button */}
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => cloud.assignedOrderId && handleCopyOrderId(cloud.assignedOrderId)}
                            className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-lg border border-blue-500/30 transition-all cursor-pointer group max-w-[140px] sm:max-w-[160px]"
                            title={`Klik untuk salin Nomor Order: #${rawAssignedId}`}
                          >
                            <span className="truncate">{displayOrderId}</span>
                            {copiedOrderId === cloud.assignedOrderId ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 text-blue-400/70 group-hover:text-blue-300 shrink-0" />
                            )}
                          </button>
                        </div>

                        {/* Interactive Live Status Dropdown */}
                        <div className="relative flex items-center shrink-0">
                          <select
                            disabled={updatingOrderId === cloud.assignedOrderId}
                            value={
                              currentStatus === 'READY' ? 'READY' :
                              currentStatus === 'LOGUL' ? 'LOGUL' :
                              ['PENDING', 'ANTRIAN_LOGIN', 'PENDING_VERIFICATION'].includes(currentStatus) 
                                ? 'PENDING' 
                                : ['SELESAI', 'COMPLETED'].includes(currentStatus) 
                                ? 'SELESAI' 
                                : currentStatus === 'HANGUS' || currentStatus === 'EXPIRED'
                                ? 'HANGUS'
                                : currentStatus === 'CANCEL'
                                ? 'CANCEL'
                                : ['BATAL', 'BATAL_TOLAK', 'REJECTED'].includes(currentStatus) 
                                ? 'BATAL' 
                                : 'DIPROSES'
                            }
                            onChange={(e) => handleLiveOrderStatusChange(cloud, e.target.value)}
                            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer transition-all appearance-none pr-6 ${
                              currentStatus === 'SELESAI'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : currentStatus === 'HANGUS' || currentStatus === 'EXPIRED'
                                ? 'bg-rose-900/30 text-rose-300 border-rose-600/40'
                                : currentStatus === 'CANCEL'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : currentStatus === 'BATAL'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : currentStatus === 'READY'
                                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                                : currentStatus === 'LOGUL'
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : currentStatus === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            <option value="DIPROSES" className="bg-[#151B2B] text-blue-400">⚡ DIPROSES</option>
                            <option value="READY" className="bg-[#151B2B] text-orange-400">🔥 READY</option>
                            <option value="LOGUL" className="bg-[#151B2B] text-purple-300">🔄 LOGUL</option>
                            <option value="PENDING" className="bg-[#151B2B] text-amber-400">⏳ PENDING</option>
                            <option value="SELESAI" className="bg-[#151B2B] text-emerald-400">✅ SELESAI</option>
                            <option value="CANCEL" className="bg-[#151B2B] text-red-400">❌ CANCEL (Refund TC)</option>
                            <option value="HANGUS" className="bg-[#151B2B] text-rose-300">⚠️ HANGUS</option>
                            <option value="BATAL" className="bg-[#151B2B] text-red-400">🚫 BATAL</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
                        </div>
                      </div>

                      {/* Order Details Body */}
                      <div className="space-y-2 text-xs">
                        {/* Customer Row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 text-[11px] shrink-0">Customer:</span>
                          <span className="font-bold text-white max-w-[150px] sm:max-w-[180px] truncate text-right flex items-center justify-end gap-1" title={cloud.assignedCustomerName || 'Pelanggan'}>
                            <User className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="truncate">{cloud.assignedCustomerName || 'Pelanggan'}</span>
                          </span>
                        </div>

                        {/* Username Game Row */}
                        {cloud.assignedGameUsername && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                            <span className="text-slate-400 text-[11px] shrink-0">Username Game:</span>
                            <span className="font-mono text-emerald-300 font-semibold max-w-[150px] sm:max-w-[180px] truncate text-right" title={`@${cloud.assignedGameUsername}`}>
                              @{cloud.assignedGameUsername}
                            </span>
                          </div>
                        )}

                        {/* Tgl Login Otomatis saat Assign (Single Clean Calendar Icon, No duplicate emoji) */}
                        {(() => {
                          const displayLoginAt = cloud.loginAt || (matchingOrder as any)?.loginAt || (cloud.assignedAt ? (() => {
                            try {
                              const d = new Date(cloud.assignedAt);
                              const day = String(d.getDate()).padStart(2, '0');
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const year = d.getFullYear();
                              const hours = String(d.getHours()).padStart(2, '0');
                              const minutes = String(d.getMinutes()).padStart(2, '0');
                              return `${day}/${month}/${year} · ${hours}:${minutes} WIB`;
                            } catch {
                              return null;
                            }
                          })() : null);

                          if (!displayLoginAt) return null;

                          return (
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] shrink-0">
                                <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span>Tgl Login:</span>
                              </div>
                              <span className="font-mono text-cyan-300 font-medium text-[11px] whitespace-nowrap">
                                {displayLoginAt.replace(' - ', ' · ')}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Uang Awal (Initial Balance) - Sinkron & Editable */}
                        {(() => {
                          const displayInitialMoney = 
                            cloud.initialMoney || 
                            (cloud as any).uangAwal || 
                            (cloud as any).initialCash || 
                            (matchingOrder as any)?.uangSebelumJoko || 
                            matchingOrder?.initialGameMoney || 
                            (matchingOrder as any)?.initial_money || 
                            matchingOrder?.initialMoney || 
                            '-';

                          const isEditingThis = editingInitialMoneyCloudId === cloud.id;

                          return (
                            <div className="pt-1 border-t border-slate-800/80">
                              {isEditingThis ? (
                                <div className="space-y-1.5 bg-black/40 border border-dashed border-emerald-500/40 rounded-xl p-2 mt-1">
                                  <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                                    <span>Edit Uang Awal:</span>
                                    <button 
                                      type="button"
                                      onClick={() => setEditingInitialMoneyCloudId(null)}
                                      className="text-slate-400 hover:text-white text-xs cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={initialMoneyInputText}
                                    onChange={(e) => setInitialMoneyInputText(e.target.value)}
                                    placeholder="Contoh: 1.500.000 / $50K"
                                    className="w-full px-2 py-1 bg-[#151B2B] border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-200 outline-none focus:border-emerald-400"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInitialMoney(cloud, matchingOrder)}
                                    className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Simpan Uang Awal</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-400 text-[11px] shrink-0">
                                    💰 Uang Awal:
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px]">
                                      {displayInitialMoney}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingInitialMoneyCloudId(cloud.id);
                                        setInitialMoneyInputText(displayInitialMoney === '-' ? '' : String(displayInitialMoney));
                                      }}
                                      className="w-5 h-5 bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-400 rounded flex items-center justify-center transition-colors cursor-pointer"
                                      title="Edit Uang Awal"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Counter Tabrak Akun (Crash Counter) */}
                        {matchingOrder && (
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                            <span className="text-slate-400 text-[11px] shrink-0">Tabrakan Akun:</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border flex items-center gap-1 ${
                                crashCount > 0 
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-black animate-pulse' 
                                  : 'bg-slate-800/60 text-slate-400 border-slate-700'
                              }`}>
                                <span>⚠️ Tabrakan: {crashCount}x</span>
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCrashCount(matchingOrder.id, crashCount, -1)}
                                  className="w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                                  title="Kurangi Counter"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCrashCount(matchingOrder.id, crashCount, 1)}
                                  className="w-5 h-5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                                  title="Tambah Counter Tabrakan"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Uang Joki Terakhir */}
                        {(() => {
                          const displayLastMoney =
                            (cloud as any).lastMoney ||
                            (cloud as any).uangTerakhir ||
                            (matchingOrder as any)?.uangTerakhir ||
                            (matchingOrder as any)?.lastMoney ||
                            (matchingOrder as any)?.uangSetelahJoko ||
                            null;
                          const isEditingThis = editingLastMoneyCloudId === cloud.id;
                          return (
                            <div className="pt-1 border-t border-slate-800/80">
                              {isEditingThis ? (
                                <div className="space-y-1.5 bg-black/40 border border-dashed border-violet-500/40 rounded-xl p-2 mt-1">
                                  <div className="flex items-center justify-between text-[11px] text-violet-300 font-bold">
                                    <span>Uang Joki Terakhir:</span>
                                    <button type="button" onClick={() => setEditingLastMoneyCloudId(null)}
                                      className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
                                  </div>
                                  <input
                                    type="text"
                                    value={lastMoneyInputText}
                                    onChange={e => setLastMoneyInputText(e.target.value)}
                                    placeholder="Contoh: 2.500.000 / 2.5jt"
                                    className="w-full bg-slate-900 border border-violet-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-400"
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveLastMoney(cloud, matchingOrder || undefined); if (e.key === 'Escape') setEditingLastMoneyCloudId(null); }}
                                    autoFocus
                                  />
                                  <div className="flex gap-1.5">
                                    <button type="button" onClick={() => handleSaveLastMoney(cloud, matchingOrder || undefined)}
                                      className="flex-1 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Simpan</span>
                                    </button>
                                    <button type="button" onClick={() => setEditingLastMoneyCloudId(null)}
                                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg cursor-pointer">
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-slate-400 text-[11px] shrink-0">💰 Uang Terakhir</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingLastMoneyCloudId(cloud.id);
                                        setLastMoneyInputText(displayLastMoney || '');
                                      }}
                                      className="w-5 h-5 bg-violet-500/20 hover:bg-violet-500/40 border border-violet-500/30 text-violet-400 rounded flex items-center justify-center transition-colors cursor-pointer"
                                      title="Edit Uang Joki Terakhir"
                                    >
                                      <Edit3 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                  {displayLastMoney ? (
                                    <div className="px-3 py-2 bg-violet-500/10 border border-violet-500/25 rounded-xl text-center">
                                      <span className="text-lg font-black text-violet-300 font-mono tracking-tight">
                                        {displayLastMoney}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="px-3 py-2 bg-slate-800/40 border border-slate-700/30 rounded-xl text-center">
                                      <span className="text-xs text-slate-600">Belum diisi</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Layanan Row */}
                        <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 text-[11px] shrink-0">Layanan:</span>
                          <span className="font-bold text-slate-200 text-[11px] text-right max-w-[190px] break-words line-clamp-2" title={cloud.assignedPackageName || 'Paket Joko'}>
                            {cloud.assignedGameName ? `${cloud.assignedGameName} - ` : ''}
                            {cloud.assignedPackageName || 'Paket Joko'}
                          </span>
                        </div>

                        {/* Catatan Order (Order Notes) */}
                        <div className="pt-1 border-t border-slate-800/80">
                          {editingNoteOrderId === matchingOrder?.id ? (
                            <div className="space-y-1.5 bg-black/40 border border-dashed border-blue-500/40 rounded-xl p-2.5 mt-1">
                              <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
                                <span>Edit Catatan Order:</span>
                                <button 
                                  type="button"
                                  onClick={() => setEditingNoteOrderId(null)}
                                  className="text-slate-400 hover:text-white cursor-pointer text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                value={noteInputText}
                                onChange={(e) => setNoteInputText(e.target.value)}
                                placeholder="Tulis catatan order khusus di sini..."
                                className="w-full p-2 bg-[#151B2B] border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-blue-500 resize-none"
                              />
                              <button
                                type="button"
                                onClick={() => matchingOrder && handleSaveOrderNote(matchingOrder.id, cloud)}
                                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Simpan Catatan</span>
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (matchingOrder) {
                                  setEditingNoteOrderId(matchingOrder.id);
                                  setNoteInputText(orderNote);
                                }
                              }}
                              className="bg-black/25 hover:bg-black/40 border border-dashed border-slate-700/80 hover:border-slate-500 rounded-xl p-2.5 cursor-pointer transition-all group mt-1"
                              title="Klik untuk ubah catatan"
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                <span className="font-bold flex items-center gap-1">
                                  📝 Catatan Order:
                                </span>
                                <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                                  Ubah ✏️
                                </span>
                              </div>
                              <p className={`text-xs ${orderNote ? 'text-slate-200 whitespace-normal break-words font-medium' : 'text-slate-500 italic'}`}>
                                {orderNote || 'Tidak ada catatan. Klik untuk tambah...'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tombol Merah "Lepas Joki" (w-full py-2.5) */}
                      <button
                        type="button"
                        onClick={() => handleTriggerRelease(cloud)}
                        className="w-full mt-2 py-2.5 px-3 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                        title="Lepas orderan dari cloud tanpa menghapus data pesanan"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>🔄 Lepas Akun Joki</span>
                      </button>
                    </div>
                  ) : (
                    /* PLACEHOLDER KOSONG */
                    <div className="mt-3.5 bg-[#202c33]/40 border border-dashed border-slate-700/80 rounded-xl p-4 text-center space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
                        <span>Cloud Kosong / Siap Digunakan</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Belum ada orderan joki yang dipasangkan ke server ini.
                      </p>
                      
                      {/* Tombol Hijau "Pasang Orderan" */}
                      <button
                        type="button"
                        onClick={() => handleOpenAssign(cloud)}
                        className="w-full py-2 px-3 bg-[#00E676] hover:bg-[#00c865] text-[#111b21] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Pasang Orderan</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Durasi {cloud.durationDays || 7} Hari</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cloud)}
                      className="p-2 text-slate-400 hover:text-white bg-[#202c33] hover:bg-[#2a3942] rounded-lg transition-all"
                      title="Edit Data Cloud"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCloud(cloud)}
                      className="p-2 text-slate-400 hover:text-red-400 bg-[#202c33] hover:bg-red-500/10 rounded-lg transition-all"
                      title="Hapus Cloud"
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

      {/* ========================================================================= */}
      {/* 1. MODAL TAMBAH / EDIT CLOUD INSTANCE (DEFAULT 7 HARI)                    */}
      {/* ========================================================================= */}
      {(showAddModal || showEditModal) && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#17212b] border border-[#242f3d] rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Server className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-white">
                  {showAddModal ? 'Tambah Cloud Instance Baru' : 'Edit Data Cloud Instance'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#202c33]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nama Cloud <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cloud 01, Cloud 02, VPS Fast Singapore"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#202c33] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Provider / Lokasi</label>
                  <input
                    type="text"
                    placeholder="Contoh: Contabo Singapore"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#202c33] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">IP Address (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 103.145.22.88"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#202c33] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* DURASI & BATAS WAKTU SEWA (FLEKSIBEL JAM & HARI) */}
              <div className="bg-[#202c33]/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    Masa Sewa Server (Jam & Hari)
                  </span>
                  {/* Realtime Countdown Preview Badge */}
                  {(() => {
                    const preview = formatCountdown({ expiresAt: formData.expiresAt });
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                        preview.isExpired
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : preview.isWarning
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                        {preview.text}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-400 block text-[11px] mb-1">Mulai Sewa:</label>
                    <input
                      type="date"
                      value={formData.rentStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#111b21] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[11px] mb-1">Batas Berakhir (Jam & Tgl):</label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => handleDateTimeLocalChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#111b21] border border-blue-500/50 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-400 shadow-inner"
                    />
                  </div>
                </div>

                {/* Quick Preset Days */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Preset Durasi Cepat:</span>
                    <span className="text-slate-500 font-mono text-[10px]">({formData.durationDays} Hari)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 7, 14, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleDurationChange(d)}
                        className={`py-1 rounded-lg text-xs font-bold border transition-all ${
                          formData.durationDays === d
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                            : 'bg-[#111b21] text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        {d} Hari
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adjustment Buttons: Tambah / Kurang Jam & Hari */}
                <div className="pt-2 border-t border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300">Ubah Waktu Secara Fleksibel:</span>
                  </div>

                  {/* Jam Buttons */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 w-10 shrink-0 font-bold">Jam:</span>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(-1, 0)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-rose-950/40 text-rose-400 border border-slate-700 hover:border-rose-500/50 rounded text-[11px] font-bold transition-all"
                      title="Kurangi 1 Jam"
                    >
                      -1 Jam
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(1, 0)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-emerald-950/40 text-emerald-400 border border-slate-700 hover:border-emerald-500/50 rounded text-[11px] font-bold transition-all"
                      title="Tambah 1 Jam"
                    >
                      +1 Jam
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(6, 0)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-blue-950/40 text-blue-400 border border-slate-700 hover:border-blue-500/50 rounded text-[11px] font-bold transition-all"
                      title="Tambah 6 Jam"
                    >
                      +6 Jam
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(12, 0)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-blue-950/40 text-blue-400 border border-slate-700 hover:border-blue-500/50 rounded text-[11px] font-bold transition-all"
                      title="Tambah 12 Jam"
                    >
                      +12 Jam
                    </button>
                  </div>

                  {/* Hari Buttons */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 w-10 shrink-0 font-bold">Hari:</span>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(0, -1)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-rose-950/40 text-rose-400 border border-slate-700 hover:border-rose-500/50 rounded text-[11px] font-bold transition-all"
                      title="Kurangi 1 Hari"
                    >
                      -1 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(0, 1)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-emerald-950/40 text-emerald-400 border border-slate-700 hover:border-emerald-500/50 rounded text-[11px] font-bold transition-all"
                      title="Tambah 1 Hari"
                    >
                      +1 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(0, 7)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-blue-950/40 text-blue-400 border border-slate-700 hover:border-blue-500/50 rounded text-[11px] font-bold transition-all"
                      title="Tambah 7 Hari"
                    >
                      +7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustExpirationTime(0, 30)}
                      className="flex-1 py-1 px-1 bg-[#111b21] hover:bg-blue-950/40 text-blue-400 border border-slate-700 hover:border-blue-500/50 rounded text-[11px] font-bold transition-all"
                      title="Tambah 30 Hari"
                    >
                      +30 Hari
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-700/60 text-slate-400">
                  <span>Berakhir pada: <strong className="text-white font-mono">{formData.expiresAt.replace('T', ' ')}</strong></span>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan server, spesifikasi, atau akun login VPS..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#202c33] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                  className="px-4 py-2 rounded-xl bg-[#202c33] text-slate-300 text-xs font-semibold hover:bg-[#2a3942] transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{showAddModal ? 'Simpan Cloud' : 'Perbarui Cloud'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL PASANG ORDERAN KE CLOUD (FILTER KHUSUS JOKI & 1 CLOUD = 1 ORDER)  */}
      {/* ========================================================================= */}
      {showAssignModal && selectedCloudForAction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#17212b] border border-[#242f3d] rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00E676]/20 border border-[#00E676]/30 flex items-center justify-center text-[#00E676]">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Pasang Orderan ke {selectedCloudForAction.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pilih pesanan joko aktif yang belum ditugaskan ke server cloud manapun.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowAssignModal(false); setSelectedCloudForAction(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#202c33]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative shrink-0 my-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Cari ID pesanan, nama customer, username Roblox, paket joko..."
                className="w-full pl-9.5 pr-4 py-2.5 bg-[#202c33] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* List Joki Orders */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs max-h-[50vh]">
              {availableJokiOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Gamepad2 className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="font-semibold text-slate-400">Tidak ada pesanan joki aktif yang siap dipasang.</p>
                  <p className="text-[11px]">
                    Pastikan ada pesanan berkategori Joki yang belum selesai dan belum memiliki cloud.
                  </p>
                </div>
              ) : (
                availableJokiOrders.map((ord, idx) => (
                  <div
                    key={ord.id ? `joki-avail-${ord.id}-${idx}` : `joki-avail-${idx}`}
                    className="p-3.5 bg-[#202c33]/70 hover:bg-[#202c33] border border-slate-800 hover:border-blue-500/50 rounded-xl flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          #{ord.id}
                        </span>
                        <span className="font-extrabold text-white truncate text-xs">
                          {ord.customer_name || 'Customer'}
                        </span>
                        {ord.game_username && (
                          <span className="text-[11px] text-emerald-400 font-mono">
                            (@{ord.game_username})
                          </span>
                        )}
                      </div>

                      <div className="text-slate-300 font-medium text-[11px] flex items-center gap-1.5 truncate">
                        <span className="text-blue-300 font-semibold">{ord.game_name}</span>
                        <span>•</span>
                        <span className="text-slate-400">{ord.package_name}</span>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>Status: <strong className="text-amber-400">{ord.status}</strong></span>
                        <span>•</span>
                        <span>Rp {(ord.price || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleConfirmAssign(ord)}
                      className="px-4 py-2 bg-[#00E676] hover:bg-[#00c865] text-[#111b21] font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <span>Pasang</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400 shrink-0">
              <span>Menampilkan {availableJokiOrders.length} pesanan joki siap pasang</span>
              <button
                type="button"
                onClick={() => { setShowAssignModal(false); setSelectedCloudForAction(null); }}
                className="px-4 py-1.5 bg-[#202c33] text-slate-300 font-semibold rounded-lg hover:bg-[#2a3942]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL KONFIRMASI LEPAS JOKI (ATOMIK & NON-BLOCKING)                    */}
      {/* ========================================================================= */}
      {cloudToRelease && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0e172b] border border-red-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 my-auto">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 shrink-0">
                <Unlink className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Lepas Pesanan dari Cloud?</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Lepaskan pesanan #{cloudToRelease.assignedOrderId} ({cloudToRelease.assignedCustomerName || 'Customer'}) dari <strong className="text-white">{cloudToRelease.name}</strong>.
                </p>
                <p className="text-[11px] text-slate-400">
                  Status instance cloud ini akan langsung kembali menjadi <span className="text-[#00E676] font-bold">KOSONG</span> dan siap menerima orderan baru.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCloudToRelease(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#202c33] text-slate-300 text-xs font-semibold hover:bg-[#2a3942] transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmReleaseOrder}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                <span>Konfirmasi Lepas</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
