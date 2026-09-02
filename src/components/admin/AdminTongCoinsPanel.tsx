import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  getDoc, 
  serverTimestamp, 
  increment, 
  addDoc, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Coins, 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  X, 
  Search, 
  Plus, 
  Minus, 
  History, 
  User, 
  Phone, 
  Mail, 
  ExternalLink, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  Eye, 
  RefreshCw, 
  SlidersHorizontal, 
  Filter, 
  MessageSquare, 
  Copy, 
  Sparkles, 
  ChevronRight,
  Send,
  AlertCircle
} from 'lucide-react';
import { SafeImage } from '../common/SafeImage';
import { AdminKelolaTongCoins } from './AdminKelolaTongCoins';
import { mutateTongCoins } from '../../services/tongCoinService';

interface AdminTongCoinsPanelProps {
  currentUser?: any;
  onOpenChatWithUser?: (userId: string, userName?: string) => void;
}

export function AdminTongCoinsPanel({ currentUser, onOpenChatWithUser }: AdminTongCoinsPanelProps) {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'customers' | 'topups' | 'logs'>('customers');
  const [isManualMutateModalOpen, setIsManualMutateModalOpen] = useState(false);

  // Realtime Data States
  const [users, setUsers] = useState<any[]>([]);
  const [topupRequests, setTopupRequests] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTopups, setLoadingTopups] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Tab 1: Customer Management States
  const [searchUser, setSearchUser] = useState('');
  const [userBalanceFilter, setUserBalanceFilter] = useState<'ALL' | 'HAS_BALANCE' | 'ZERO_BALANCE'>('ALL');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'deduct' | 'set'>('add');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // User History Popup Modal
  const [userHistoryModalUser, setUserHistoryModalUser] = useState<any>(null);

  // Tab 2: Topup Requests States
  const [searchTopup, setSearchTopup] = useState('');
  const [topupStatusFilter, setTopupStatusFilter] = useState<'ALL' | 'PENDING' | 'SUCCESS' | 'REJECTED'>('ALL');
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);
  const [rejectModalTopup, setRejectModalTopup] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingTopup, setIsProcessingTopup] = useState(false);

  // Tab 3: Logs States
  const [searchLog, setSearchLog] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('ALL');
  const [logDateFilter, setLogDateFilter] = useState<string>('');

  // Audit Tool States
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isScanningAudit, setIsScanningAudit] = useState(false);
  const [isFixingAudit, setIsFixingAudit] = useState(false);
  const [auditAnomalies, setAuditAnomalies] = useState<any[]>([]);
  const [auditScanFinished, setAuditScanFinished] = useState(false);
  const [auditSuccessResult, setAuditSuccessResult] = useState<{ totalFixed: number; totalAmount: number } | null>(null);

  // Copy helper
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  // 1. Realtime Listeners: Users Collection
  useEffect(() => {
    setLoadingUsers(true);
    const qUsers = query(collection(db, 'users'));
    const unsub = onSnapshot(qUsers, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setUsers(list);
      setLoadingUsers(false);
    }, (err) => {
      console.warn("Users listener error:", err);
      setLoadingUsers(false);
    });

    return () => unsub();
  }, []);

  // 2. Realtime Listeners: Topup Requests (tc_topups collection)
  useEffect(() => {
    setLoadingTopups(true);
    const qTopups = query(collection(db, 'tc_topups'));
    const unsub = onSnapshot(qTopups, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Sort descending
      list.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || new Date(a.created || a.createdAt || 0).getTime() || 0;
        const timeB = b.createdAt?.toMillis?.() || new Date(b.created || b.createdAt || 0).getTime() || 0;
        return timeB - timeA;
      });

      setTopupRequests(list);
      setLoadingTopups(false);
    }, (err) => {
      console.warn("Topups listener error:", err);
      setLoadingTopups(false);
    });

    return () => unsub();
  }, []);

  // 3. Realtime Listeners: Global Coin Transactions Ledger (coin_transactions)
  useEffect(() => {
    setLoadingLogs(true);
    const qLogs = query(collection(db, 'coin_transactions'));
    const unsub = onSnapshot(qLogs, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Sort descending
      list.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime() || 0;
        const timeB = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime() || 0;
        return timeB - timeA;
      });

      setTransactions(list);
      setLoadingLogs(false);
    }, (err) => {
      console.warn("Coin transactions listener error:", err);
      setLoadingLogs(false);
    });

    return () => unsub();
  }, []);

  // Global Circulation Metric Calculation
  const totalCirculating = useMemo(() => {
    return (users || []).reduce((acc, u) => {
      const bal = Number(u.tongCoins ?? u.tc_balance ?? u.tongcoins ?? u.balance ?? 0);
      return acc + (isNaN(bal) || bal < 0 ? 0 : bal);
    }, 0);
  }, [users]);

  // Pending Topup Count
  const pendingTopupCount = useMemo(() => {
    return topupRequests.filter(req => {
      const st = (req.statusRaw || req.status || '').toUpperCase();
      return st === 'PENDING' || st === 'MENUNGGU VERIFIKASI' || st === 'WAITING';
    }).length;
  }, [topupRequests]);

  // -------------------------------------------------------------
  // TAB 1: Filtered Users
  // -------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      const s = searchUser.toLowerCase().trim();
      const name = (u.name || u.username || '').toLowerCase();
      const phone = (u.phone || u.whatsappNumber || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const uid = (u.id || '').toLowerCase();

      const matchesSearch = !s || name.includes(s) || phone.includes(s) || email.includes(s) || uid.includes(s);
      if (!matchesSearch) return false;

      const bal = Number(u.tongCoins ?? u.tc_balance ?? u.tongcoins ?? u.balance ?? 0);
      if (userBalanceFilter === 'HAS_BALANCE' && bal <= 0) return false;
      if (userBalanceFilter === 'ZERO_BALANCE' && bal > 0) return false;

      return true;
    }).sort((a, b) => {
      const balA = Number(a.tongCoins ?? a.tc_balance ?? a.tongcoins ?? a.balance ?? 0);
      const balB = Number(b.tongCoins ?? b.tc_balance ?? b.tongcoins ?? b.balance ?? 0);
      return balB - balA; // Highest balance first
    });
  }, [users, searchUser, userBalanceFilter]);

  // -------------------------------------------------------------
  // TAB 2: Filtered Topups
  // -------------------------------------------------------------
  const filteredTopups = useMemo(() => {
    return topupRequests.filter(req => {
      const s = searchTopup.toLowerCase().trim();
      const id = (req.topupId || req.id || '').toLowerCase();
      const name = (req.userName || '').toLowerCase();
      const phone = (req.userPhone || '').toLowerCase();
      const email = (req.userEmail || '').toLowerCase();

      const matchesSearch = !s || id.includes(s) || name.includes(s) || phone.includes(s) || email.includes(s);
      if (!matchesSearch) return false;

      const st = (req.statusRaw || req.status || '').toUpperCase();
      if (topupStatusFilter === 'PENDING') {
        return st === 'PENDING' || st === 'MENUNGGU VERIFIKASI' || st === 'WAITING';
      }
      if (topupStatusFilter === 'SUCCESS') {
        return st === 'SUCCESS' || st === 'LUNAS' || st === 'BERHASIL' || st === 'DISETUJUI';
      }
      if (topupStatusFilter === 'REJECTED') {
        return st === 'REJECTED' || st === 'DITOLAK' || st === 'BATAL';
      }

      return true;
    });
  }, [topupRequests, searchTopup, topupStatusFilter]);

  // -------------------------------------------------------------
  // TAB 3: Filtered Logs
  // -------------------------------------------------------------
  const filteredLogs = useMemo(() => {
    return transactions.filter(tx => {
      const s = searchLog.toLowerCase().trim();
      const id = (tx.id || tx.orderId || '').toLowerCase();
      const name = (tx.userName || '').toLowerCase();
      const email = (tx.userEmail || '').toLowerCase();
      const phone = (tx.userPhone || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();

      const matchesSearch = !s || id.includes(s) || name.includes(s) || email.includes(s) || phone.includes(s) || desc.includes(s);
      if (!matchesSearch) return false;

      const typeUpper = (tx.type || '').toUpperCase();
      if (logTypeFilter === 'TOPUP') {
        if (!typeUpper.includes('TOPUP')) return false;
      } else if (logTypeFilter === 'PAYMENT') {
        if (typeUpper !== 'PAYMENT' && !typeUpper.includes('ORDER')) return false;
      } else if (logTypeFilter === 'MANUAL') {
        if (!typeUpper.includes('MANUAL') && !typeUpper.includes('ADJUST')) return false;
      } else if (logTypeFilter === 'REFUND') {
        if (!typeUpper.includes('REFUND')) return false;
      }

      if (logDateFilter) {
        let txDateStr = '';
        if (tx.createdAt?.toDate) {
          txDateStr = tx.createdAt.toDate().toISOString().split('T')[0];
        } else if (tx.createdAt) {
          txDateStr = new Date(tx.createdAt).toISOString().split('T')[0];
        }
        if (txDateStr !== logDateFilter) return false;
      }

      return true;
    });
  }, [transactions, searchLog, logTypeFilter, logDateFilter]);

  // -------------------------------------------------------------
  // ACTIONS: Customer Balance Adjustment (Add / Deduct / Set)
  // -------------------------------------------------------------
  const handleOpenAdjustModal = (user: any, mode: 'add' | 'deduct' | 'set') => {
    setSelectedUser(user);
    setAdjustMode(mode);
    setAdjustAmount(mode === 'set' ? Number(user.tc_balance ?? user.tongcoins ?? 0) : 0);
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleExecuteAdjustment = async () => {
    if (!selectedUser) return;
    if (adjustAmount < 0) {
      alert("Nominal TC tidak boleh negatif!");
      return;
    }
    if (adjustMode !== 'set' && adjustAmount <= 0) {
      alert("Silakan masukkan nominal TC yang valid!");
      return;
    }

    try {
      setIsSubmittingAdjust(true);
      const userRef = doc(db, 'users', selectedUser.id);
      const currentBal = Number(selectedUser.tongCoins ?? selectedUser.tc_balance ?? selectedUser.tongcoins ?? selectedUser.balance ?? 0);
      let newBal = currentBal;
      let diffAmount = 0;
      let txType: 'MANUAL_ADD' | 'MANUAL_SUB' = 'MANUAL_ADD';

      if (adjustMode === 'add') {
        newBal = currentBal + adjustAmount;
        diffAmount = adjustAmount;
        txType = 'MANUAL_ADD';
      } else if (adjustMode === 'deduct') {
        newBal = Math.max(0, currentBal - adjustAmount);
        diffAmount = -adjustAmount;
        txType = 'MANUAL_SUB';
      } else if (adjustMode === 'set') {
        newBal = Math.max(0, adjustAmount);
        diffAmount = newBal - currentBal;
        txType = diffAmount >= 0 ? 'MANUAL_ADD' : 'MANUAL_SUB';
      }

      const nowIso = new Date().toISOString();
      const adminEmail = currentUser?.email || 'Admin';

      // 1. Update user balance across all compatibility fields
      await updateDoc(userRef, {
        tongCoins: newBal,
        tc_balance: newBal,
        tongcoins: newBal,
        balance: newBal,
        updatedAt: nowIso
      });

      const mutationRecord = {
        userId: selectedUser.id,
        userDocId: selectedUser.id,
        userName: selectedUser.name || selectedUser.username || 'Customer',
        userEmail: selectedUser.email || '',
        userPhone: selectedUser.phone || selectedUser.whatsappNumber || selectedUser.whatsapp || '',
        robloxUsername: selectedUser.robloxUsername || selectedUser.roblox_username || '',
        type: txType,
        amount: Math.abs(diffAmount),
        delta: diffAmount,
        previousBalance: currentBal,
        currentBalance: newBal,
        orderId: 'MANUAL_ADJUST',
        description: adjustReason || `Penyesuaian Saldo oleh Admin (${adjustMode === 'add' ? 'Tambah' : adjustMode === 'deduct' ? 'Potong' : 'Set Saldo'})`,
        status: 'SUCCESS',
        adminNote: `Diubah oleh ${adminEmail}. Saldo sebelumnya: ${currentBal.toLocaleString('id-ID')} TC -> Menjadi: ${newBal.toLocaleString('id-ID')} TC`,
        createdAt: nowIso,
        updatedAt: nowIso,
        timestamp: Date.now()
      };

      // 2. Record mutation in tongcoin_transactions & coin_transactions
      try {
        const txDocRef = doc(collection(db, 'coin_transactions'));
        await setDoc(txDocRef, { id: txDocRef.id, ...mutationRecord });
      } catch (e) {
        console.warn('coin_transactions record error:', e);
      }

      try {
        const txDocRef2 = doc(collection(db, 'tongcoin_transactions'));
        await setDoc(txDocRef2, { id: txDocRef2.id, ...mutationRecord });
      } catch (e) {
        console.warn('tongcoin_transactions record error:', e);
      }

      // 3. Optional: Send in-app chat message / notification to customer
      try {
        const roomId = `room_${selectedUser.id}`;
        const chatMsgRef = doc(collection(db, 'chats', roomId, 'messages'));
        const actionLabel = adjustMode === 'add' ? 'Penambahan' : adjustMode === 'deduct' ? 'Pengurangan' : 'Penyesuaian';
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          text: `🪙 [PENYESUAIAN SALDO TONGCOINS]\n\nAdmin telah melakukan ${actionLabel} saldo TongCoins sebesar ${Math.abs(diffAmount).toLocaleString('id-ID')} TC.\nSaldo Anda saat ini: ${newBal.toLocaleString('id-ID')} TC.\nKeterangan: ${adjustReason || 'Penyesuaian operasional admin.'}`,
          sender: 'admin',
          senderName: 'Admin Entong Store',
          isAdmin: true,
          type: 'system',
          createdAt: serverTimestamp(),
          created: nowIso
        });
      } catch (chatErr) {
        console.warn("Could not notify user chat room:", chatErr);
      }

      alert(`✅ Berhasil menyesuaikan saldo untuk ${selectedUser.name || selectedUser.id}!\nSaldo sekarang: ${newBal.toLocaleString('id-ID')} TC.`);
      setIsAdjustModalOpen(false);
    } catch (err) {
      console.error("Adjustment error:", err);
      alert("❌ Gagal menyesuaikan saldo: " + err);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: Topup Approval (ACC)
  // -------------------------------------------------------------
  const handleApproveTopup = async (req: any) => {
    const rawNominal = Number(req.coinAmount || req.amount || req.price || 0);
    if (rawNominal <= 0) {
      alert("Nominal topup tidak valid.");
      return;
    }

    const confirmMsg = `Setujui pengajuan Top Up #${req.topupId || req.id}?\n\nCustomer: ${req.userName || req.userId}\nNominal Transfer: Rp ${(req.amount || req.price || 0).toLocaleString('id-ID')}\nTotal TC Didapat: ${rawNominal.toLocaleString('id-ID')} TC\n\nSaldo customer akan bertambah secara otomatis.`;
    if (!confirm(confirmMsg)) return;

    try {
      setIsProcessingTopup(true);
      const topupId = req.topupId || req.id;
      const userId = req.userId;
      const nowIso = new Date().toISOString();
      const adminEmail = currentUser?.email || 'Admin';

      // 1. Update status in tc_topups
      const topupDocRef = doc(db, 'tc_topups', topupId);
      await updateDoc(topupDocRef, {
        status: 'Lunas',
        statusRaw: 'SUCCESS',
        approvedBy: adminEmail,
        approvedAt: serverTimestamp(),
        updatedAt: nowIso
      });

      // 2. Increment user balance in users collection across all compatibility fields
      let curBal = 0;
      let newBal = rawNominal;
      if (userId) {
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          curBal = Number(uData.tongCoins ?? uData.tc_balance ?? uData.tongcoins ?? uData.balance ?? 0);
          newBal = curBal + rawNominal;
          await updateDoc(userDocRef, {
            tongCoins: newBal,
            tc_balance: newBal,
            tongcoins: newBal,
            balance: newBal,
            updatedAt: nowIso
          });
        }
      }

      const topupMutation = {
        id: topupId,
        userId: userId,
        userDocId: userId,
        userName: req.userName || 'Customer',
        userEmail: req.userEmail || '',
        userPhone: req.userPhone || '',
        type: 'TOPUP',
        amount: rawNominal,
        delta: rawNominal,
        previousBalance: curBal,
        currentBalance: newBal,
        orderId: topupId,
        description: `Top Up Saldo ${rawNominal.toLocaleString('id-ID')} TC (${req.paymentMethod || 'QRIS'}) Disetujui Admin`,
        status: 'SUCCESS',
        paymentMethod: req.paymentMethod || 'QRIS',
        proofUrl: req.paymentProof || req.proofUrl || '',
        adminNote: `Disetujui oleh ${adminEmail} pada ${new Date().toLocaleString('id-ID')}`,
        createdAt: req.created || req.createdAt || nowIso,
        updatedAt: nowIso,
        timestamp: Date.now()
      };

      // 3. Update or create record in coin_transactions & tongcoin_transactions
      try {
        const txDocRef = doc(db, 'coin_transactions', topupId);
        await setDoc(txDocRef, topupMutation, { merge: true });
      } catch (e) {
        console.warn('coin_transactions topup record error:', e);
      }

      try {
        const txDocRef2 = doc(db, 'tongcoin_transactions', topupId);
        await setDoc(txDocRef2, topupMutation, { merge: true });
      } catch (e) {
        console.warn('tongcoin_transactions topup record error:', e);
      }

      // 4. Send automated chat room confirmation
      try {
        const roomId = `room_${userId}`;
        const chatMsgRef = doc(collection(db, 'chats', roomId, 'messages'));
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          text: `🪙 [TOP UP TC BERHASIL DISETUJUI]\n\nPermintaan Top Up #${topupId} sebesar Rp ${(req.amount || req.price || 0).toLocaleString('id-ID')} (${rawNominal.toLocaleString('id-ID')} TC) telah diverifikasi dan disetujui oleh admin.\nSaldo TongCoins Anda telah bertambah. Terima kasih telah top up di Entong Store! 🎉`,
          sender: 'admin',
          senderName: 'Admin Entong Store',
          isAdmin: true,
          type: 'system',
          createdAt: serverTimestamp(),
          created: nowIso
        });
      } catch (chatErr) {
        console.warn("Could not notify customer chat room:", chatErr);
      }

      alert(`✅ Pengajuan Top Up #${topupId} berhasil disetujui dan saldo ${rawNominal.toLocaleString('id-ID')} TC telah ditambahkan ke akun customer!`);
    } catch (err) {
      console.error("Topup approve error:", err);
      alert("❌ Gagal menyetujui topup: " + err);
    } finally {
      setIsProcessingTopup(false);
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: Topup Rejection
  // -------------------------------------------------------------
  const handleOpenRejectModal = (req: any) => {
    setRejectModalTopup(req);
    setRejectionReason('Bukti transfer tidak valid atau dana belum masuk rekening.');
  };

  const handleExecuteReject = async () => {
    if (!rejectModalTopup) return;
    try {
      setIsProcessingTopup(true);
      const topupId = rejectModalTopup.topupId || rejectModalTopup.id;
      const userId = rejectModalTopup.userId;
      const nowIso = new Date().toISOString();
      const adminEmail = currentUser?.email || 'Admin';

      // 1. Update status in tc_topups
      const topupDocRef = doc(db, 'tc_topups', topupId);
      await updateDoc(topupDocRef, {
        status: 'Ditolak',
        statusRaw: 'REJECTED',
        rejectionReason: rejectionReason,
        rejectedBy: adminEmail,
        rejectedAt: serverTimestamp(),
        updatedAt: nowIso
      });

      // 2. Update status in coin_transactions
      const txDocRef = doc(db, 'coin_transactions', topupId);
      await setDoc(txDocRef, {
        status: 'REJECTED',
        rejectionReason: rejectionReason,
        adminNote: `Ditolak oleh ${adminEmail}: ${rejectionReason}`,
        updatedAt: nowIso
      }, { merge: true });

      // 3. Send automated rejection note to chat room
      try {
        const roomId = `room_${userId}`;
        const chatMsgRef = doc(collection(db, 'chats', roomId, 'messages'));
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          text: `❌ [PENGAJUAN TOP UP TC DITOLAK]\n\nPermintaan Top Up #${topupId} sebesar Rp ${(rejectModalTopup.amount || rejectModalTopup.price || 0).toLocaleString('id-ID')} ditolak oleh admin.\nAlasan: ${rejectionReason}\n\nSilakan periksa kembali mutasi/struk pembayaran Anda atau hubungi admin via chat ini jika ada kendala.`,
          sender: 'admin',
          senderName: 'Admin Entong Store',
          isAdmin: true,
          type: 'system',
          createdAt: serverTimestamp(),
          created: nowIso
        });
      } catch (chatErr) {
        console.warn("Could not notify customer chat room:", chatErr);
      }

      alert(`✅ Pengajuan Top Up #${topupId} telah ditolak.`);
      setRejectModalTopup(null);
    } catch (err) {
      console.error("Topup reject error:", err);
      alert("❌ Gagal menolak topup: " + err);
    } finally {
      setIsProcessingTopup(false);
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: Audit & Fix Refund Liar
  // -------------------------------------------------------------
  const handleOpenAuditModal = async () => {
    setIsAuditModalOpen(true);
    setIsScanningAudit(true);
    setAuditScanFinished(false);
    setAuditAnomalies([]);
    setAuditSuccessResult(null);

    try {
      const qOrders = query(collection(db, 'orders'));
      const snap = await getDocs(qOrders);
      const anomalies: any[] = [];

      for (const d of snap.docs) {
        const o = d.data();
        const pStatus = (o.paymentStatus || o.payment_status || '').toUpperCase();
        const ordStatus = (o.status || '').toUpperCase();
        const isRefundFlag = o.isRefunded === true || o.refunded === true;

        // Condition: Payment was rejected or never paid, but was marked refunded
        const isPaymentRejected = pStatus === 'DITOLAK' || pStatus === 'REJECTED' || pStatus === 'UNPAID' || pStatus === 'FAILED';
        const isCanceledOrder = ordStatus === 'BATAL' || ordStatus === 'BATAL_TOLAK' || ordStatus === 'CANCEL' || ordStatus === 'REJECTED';

        if ((isPaymentRejected && isRefundFlag) || (isCanceledOrder && isRefundFlag && isPaymentRejected)) {
          const refundAmt = Number(o.refundAmount || o.price || 0);
          anomalies.push({
            orderId: d.id,
            displayId: o.orderId || o.id || d.id,
            customerId: o.customer_id || o.userId || o.customerPhone,
            customerName: o.customer_name || o.userName || o.customerName || 'Customer',
            customerPhone: o.customer_phone || o.userPhone || '',
            paymentStatus: pStatus,
            orderStatus: ordStatus,
            refundAmount: refundAmt,
            createdAt: o.created || o.createdAt
          });
        }
      }

      setAuditAnomalies(anomalies);
      setAuditScanFinished(true);
    } catch (err) {
      console.error("Scan audit error:", err);
      alert("❌ Gagal memindai data transaksi: " + err);
    } finally {
      setIsScanningAudit(false);
    }
  };

  const handleExecuteAuditFix = async () => {
    if (auditAnomalies.length === 0) return;
    if (!confirm(`Konfirmasi eksekusi normalisasi ${auditAnomalies.length} transaksi refund anomali?\nSaldo pengguna terkait akan dikoreksi dan status refund dinormalkan.`)) return;

    try {
      setIsFixingAudit(true);
      let countFixed = 0;
      let totalAmountFixed = 0;
      const nowIso = new Date().toISOString();

      for (const anomaly of auditAnomalies) {
        const custId = anomaly.customerId;
        const refundAmt = anomaly.refundAmount;

        if (custId && refundAmt > 0) {
          const userRef = doc(db, 'users', custId);
          const uSnap = await getDoc(userRef);
          if (uSnap.exists()) {
            const curBal = Number(uSnap.data().tc_balance ?? uSnap.data().tongcoins ?? 0);
            const newBal = Math.max(0, curBal - refundAmt);

            // Revert balance
            await updateDoc(userRef, {
              tc_balance: newBal,
              tongcoins: newBal,
              updatedAt: nowIso
            });

            // Log audit transaction
            const txDocRef = doc(collection(db, 'coin_transactions'));
            await setDoc(txDocRef, {
              id: txDocRef.id,
              userId: custId,
              userName: anomaly.customerName,
              userPhone: anomaly.customerPhone,
              type: 'MANUAL_SUB',
              amount: refundAmt,
              orderId: anomaly.displayId,
              description: `🛡️ Audit & Normalisasi Saldo Refund Liar Order #${anomaly.displayId}`,
              status: 'SUCCESS',
              adminNote: `Koreksi audit refund liar status ${anomaly.paymentStatus}. Saldo ${curBal.toLocaleString('id-ID')} TC -> ${newBal.toLocaleString('id-ID')} TC`,
              createdAt: nowIso,
              updatedAt: nowIso
            });

            totalAmountFixed += refundAmt;
          }
        }

        // Unmark refund flag on order
        const orderRef = doc(db, 'orders', anomaly.orderId);
        await updateDoc(orderRef, {
          isRefunded: false,
          refundAmount: null,
          refundedAt: null,
          auditNormalizedAt: serverTimestamp()
        });

        countFixed++;
      }

      setAuditSuccessResult({
        totalFixed: countFixed,
        totalAmount: totalAmountFixed
      });
      setAuditAnomalies([]);
    } catch (err) {
      console.error("Audit fix error:", err);
      alert("❌ Gagal menormalkan saldo: " + err);
    } finally {
      setIsFixingAudit(false);
    }
  };

  // Helper date formatter
  const formatDateTime = (val: any) => {
    if (!val) return '-';
    let d: Date;
    if (val?.toDate) d = val.toDate();
    else d = new Date(val);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\./g, ':') + ' WIB';
  };

  return (
    <div className="p-4 md:p-6 w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* 1. HEADER & TOP STATS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00E676] text-2xl shadow-inner shrink-0">
            🪙
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Kelola TongCoins</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Pantau dan kelola saldo TongCoins (TC) seluruh customer.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Atomic Manual Mutate Button */}
          <button
            onClick={() => setIsManualMutateModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 border border-emerald-400/30 shrink-0 transition active:scale-95 cursor-pointer"
          >
            <Coins className="w-4 h-4" />
            <span>⚡ Tambah / Refund TC (Atomic)</span>
          </button>

          {/* Audit Tool Button */}
          <button
            onClick={handleOpenAuditModal}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 border border-orange-400/30 shrink-0 transition active:scale-95 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>🛡️ Audit & Fix Refund Liar</span>
          </button>
        </div>
      </div>

      {/* 2. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Total TC Beredar */}
        <div className="bg-[#1a232b] border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E676]/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10 group-hover:bg-[#00E676]/10 transition"></div>
          <span className="text-slate-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2">
            Total TC Beredar Global
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[#00E676] tracking-tight">
              {totalCirculating.toLocaleString('id-ID')}
            </span>
            <span className="text-base sm:text-lg font-bold text-emerald-400/80">TC</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">
            Dari total {users.length} akun customer terdaftar
          </span>
        </div>

        {/* Card 2: Estimasi Nilai Konversi */}
        <div className="bg-[#1a232b] border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10 group-hover:bg-blue-500/10 transition"></div>
          <span className="text-slate-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2">
            Estimasi Nilai Konversi (Rp)
          </span>
          <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Rp {totalCirculating.toLocaleString('id-ID')}
          </span>
          <span className="text-[11px] text-slate-500 mt-1">
            Kurs resmi platform: 1 TC = Rp 1
          </span>
        </div>
      </div>

      {/* 3. THREE-TAB NAVIGATION SYSTEM */}
      <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex flex-wrap sm:flex-nowrap gap-1.5 shadow-lg">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'customers'
              ? 'bg-[#00E676] text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <User className="w-4 h-4" />
          <span>👥 Kelola Saldo Customer</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'customers' ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-slate-400'
          }`}>
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('topups')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition relative cursor-pointer ${
            activeTab === 'topups'
              ? 'bg-[#00E676] text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>📥 Permintaan Topup TC</span>
          {pendingTopupCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
              {pendingTopupCount} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-[#00E676] text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>📜 Log & Riwayat Mutasi TC</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'logs' ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-slate-400'
          }`}>
            {transactions.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DAFTAR & KELOLA SALDO CUSTOMER */}
      {/* ========================================================= */}
      {activeTab === 'customers' && (
        <div className="bg-[#111b21] border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800 bg-[#1a232b] flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">Daftar Customer</h3>
              <span className="text-xs text-slate-400">({filteredUsers.length} user)</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto items-center">
              {/* Balance Filter Dropdown */}
              <select
                value={userBalanceFilter}
                onChange={(e: any) => setUserBalanceFilter(e.target.value)}
                className="w-full sm:w-auto bg-[#0b141a] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs focus:border-[#00E676] outline-none cursor-pointer"
              >
                <option value="ALL">Semua Saldo</option>
                <option value="HAS_BALANCE">Memiliki Saldo (&gt; 0 TC)</option>
                <option value="ZERO_BALANCE">Saldo Kosong (0 TC)</option>
              </select>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama / WA / email / UID..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-[#0b141a] border border-slate-700 text-white pl-9 pr-8 py-2 rounded-xl focus:border-[#00E676] outline-none text-xs transition"
                />
                {searchUser && (
                  <button
                    onClick={() => setSearchUser('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[350px]">
            {loadingUsers ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-[#00E676] mb-2" />
                <p className="text-xs">Memuat data customer...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <User className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Tidak ada data customer yang sesuai.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a232b]/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <th className="p-3.5 font-bold">Customer</th>
                    <th className="p-3.5 font-bold">Kontak</th>
                    <th className="p-3.5 font-bold text-right">Saldo TC</th>
                    <th className="p-3.5 font-bold text-center">Aksi (Kelola)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredUsers.map(user => {
                    const userBal = Number(user.tc_balance ?? user.tongcoins ?? 0);
                    const rawPhone = user.phone || user.whatsappNumber || '';
                    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

                    return (
                      <tr key={user.id} className="hover:bg-[#1a232b]/50 transition-colors">
                        {/* CUSTOMER */}
                        <td className="p-3.5">
                          <div className="font-black text-white text-sm">
                            {user.name || user.username || 'Tanpa Nama'}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[180px]">
                              {user.id}
                            </span>
                            <button
                              onClick={() => handleCopy(user.id, `user-${user.id}`)}
                              className="text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                              title="Salin UID"
                            >
                              {copiedId === `user-${user.id}` ? (
                                <Check className="w-3 h-3 text-[#00E676]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* KONTAK */}
                        <td className="p-3.5">
                          <div className="text-slate-200 flex items-center gap-1.5 font-medium">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            {cleanPhone ? (
                              <a
                                href={`https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline text-emerald-400"
                              >
                                {rawPhone}
                              </a>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </div>
                          <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{user.email || '-'}</span>
                          </div>
                        </td>

                        {/* SALDO TC */}
                        <td className="p-3.5 text-right">
                          <div className="font-mono font-black text-[#00E676] text-base sm:text-lg">
                            {userBal.toLocaleString('id-ID')}
                          </div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">
                            TongCoins
                          </span>
                        </td>

                        {/* AKSI KELOLA */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tombol + TC */}
                            <button
                              onClick={() => handleOpenAdjustModal(user, 'add')}
                              className="px-2.5 py-1.5 bg-[#00E676]/15 hover:bg-[#00E676] text-[#00E676] hover:text-slate-950 border border-[#00E676]/30 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1"
                              title="Tambah Saldo TC"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>TC</span>
                            </button>

                            {/* Tombol - TC */}
                            <button
                              onClick={() => handleOpenAdjustModal(user, 'deduct')}
                              className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1"
                              title="Kurangi Saldo TC"
                            >
                              <Minus className="w-3.5 h-3.5" />
                              <span>TC</span>
                            </button>

                            {/* Tombol Riwayat Khusus User */}
                            <button
                              onClick={() => setUserHistoryModalUser(user)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition cursor-pointer"
                              title="Lihat Log Riwayat User"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* Tombol Chat */}
                            {onOpenChatWithUser && (
                              <button
                                onClick={() => onOpenChatWithUser(user.id, user.name || user.username)}
                                className="p-2 bg-blue-500/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded-xl transition cursor-pointer"
                                title="Buka Chat Room"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PERSETUJUAN PERMINTAAN TOPUP TC */}
      {/* ========================================================= */}
      {activeTab === 'topups' && (
        <div className="bg-[#111b21] border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800 bg-[#1a232b] flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#00E676]" />
              <h3 className="font-bold text-white text-sm sm:text-base">Permintaan Top Up TC</h3>
              <span className="text-xs text-slate-400">({filteredTopups.length} data)</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto items-center">
              {/* Status Filter */}
              <select
                value={topupStatusFilter}
                onChange={(e: any) => setTopupStatusFilter(e.target.value)}
                className="w-full sm:w-auto bg-[#0b141a] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs focus:border-[#00E676] outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu Verifikasi (Pending)</option>
                <option value="SUCCESS">Disetujui / Lunas</option>
                <option value="REJECTED">Ditolak</option>
              </select>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari ID / customer / nominal..."
                  value={searchTopup}
                  onChange={(e) => setSearchTopup(e.target.value)}
                  className="w-full bg-[#0b141a] border border-slate-700 text-white pl-9 pr-8 py-2 rounded-xl focus:border-[#00E676] outline-none text-xs transition"
                />
                {searchTopup && (
                  <button
                    onClick={() => setSearchTopup('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[350px]">
            {loadingTopups ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-[#00E676] mb-2" />
                <p className="text-xs">Memuat data permintaan top up...</p>
              </div>
            ) : filteredTopups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <Coins className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Tidak ada permintaan topup yang sesuai.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a232b]/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <th className="p-3.5 font-bold">ID / Waktu</th>
                    <th className="p-3.5 font-bold">Customer</th>
                    <th className="p-3.5 font-bold">Nominal Topup</th>
                    <th className="p-3.5 font-bold">Metode & Bukti</th>
                    <th className="p-3.5 font-bold text-center">Status</th>
                    <th className="p-3.5 font-bold text-center">Aksi Verifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredTopups.map(req => {
                    const statusRaw = (req.statusRaw || req.status || 'PENDING').toUpperCase();
                    const isPending = statusRaw === 'PENDING' || statusRaw === 'MENUNGGU VERIFIKASI' || statusRaw === 'WAITING';
                    const isSuccess = statusRaw === 'SUCCESS' || statusRaw === 'LUNAS' || statusRaw === 'BERHASIL' || statusRaw === 'DISETUJUI';
                    const isRejected = statusRaw === 'REJECTED' || statusRaw === 'DITOLAK' || statusRaw === 'BATAL';

                    const proofUrl = req.paymentProof || req.proofUrl;
                    const coinAmount = Number(req.coinAmount || req.amount || req.price || 0);
                    const priceAmount = Number(req.amount || req.price || 0);
                    const bonusAmt = Number(req.bonusCoins || 0);

                    return (
                      <tr key={req.id} className="hover:bg-[#1a232b]/50 transition-colors">
                        {/* ID / WAKTU */}
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-white">
                            #{req.topupId || req.id}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDateTime(req.createdAt || req.created)}
                          </div>
                        </td>

                        {/* CUSTOMER */}
                        <td className="p-3.5">
                          <div className="font-bold text-white">
                            {req.userName || 'Customer'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {req.userPhone || req.userEmail || req.userId}
                          </div>
                        </td>

                        {/* NOMINAL TOPUP */}
                        <td className="p-3.5">
                          <div className="font-mono font-black text-[#00E676] text-sm sm:text-base">
                            +{coinAmount.toLocaleString('id-ID')} TC
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Rp {priceAmount.toLocaleString('id-ID')}
                            {bonusAmt > 0 && (
                              <span className="text-amber-400 ml-1 font-semibold">
                                (+{bonusAmt.toLocaleString('id-ID')} bonus)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* METODE & BUKTI */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold text-[10px] uppercase border border-slate-700">
                              {req.paymentMethod || req.payment_method || 'QRIS'}
                            </span>
                            {proofUrl ? (
                              <button
                                onClick={() => setViewingProofUrl(proofUrl)}
                                className="px-2 py-1 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-[10px] font-bold border border-blue-500/30 flex items-center gap-1 transition cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Lihat Struk</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Tanpa Struk</span>
                            )}
                          </div>
                        </td>

                        {/* STATUS */}
                        <td className="p-3.5 text-center">
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3" /> Menunggu Verifikasi
                            </span>
                          )}
                          {isSuccess && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-[#00E676] border border-emerald-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Disetujui
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Ditolak
                            </span>
                          )}
                        </td>

                        {/* AKSI VERIFIKASI */}
                        <td className="p-3.5 text-center">
                          {isPending ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleApproveTopup(req)}
                                disabled={isProcessingTopup}
                                className="px-3 py-1.5 bg-[#00E676] hover:bg-[#00c853] text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 transition shadow-md shadow-[#00E676]/20 cursor-pointer disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>ACC</span>
                              </button>

                              <button
                                onClick={() => handleOpenRejectModal(req)}
                                disabled={isProcessingTopup}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-md shadow-rose-950/40 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 font-medium">
                              {isSuccess ? (
                                <span>Oleh: {req.approvedBy || 'Admin'}</span>
                              ) : (
                                <span className="text-rose-400/80">{req.rejectionReason || 'Ditolak'}</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LOG & RIWAYAT MUTASI LENGKAP TC */}
      {/* ========================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-[#111b21] border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800 bg-[#1a232b] flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">Audit Trail Mutasi TC Global</h3>
              <span className="text-xs text-slate-400">({filteredLogs.length} mutasi)</span>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2.5 w-full lg:w-auto items-center">
              {/* Type Filter */}
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="bg-[#0b141a] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs focus:border-[#00E676] outline-none cursor-pointer"
              >
                <option value="ALL">Semua Tipe Transaksi</option>
                <option value="TOPUP">Top Up Saldo</option>
                <option value="PAYMENT">Pembayaran Order (Keluar)</option>
                <option value="MANUAL">Penyesuaian Manual Admin</option>
                <option value="REFUND">Refund Resmi</option>
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={logDateFilter}
                onChange={(e) => setLogDateFilter(e.target.value)}
                className="bg-[#0b141a] border border-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs focus:border-[#00E676] outline-none cursor-pointer [color-scheme:dark]"
              />
              {logDateFilter && (
                <button
                  onClick={() => setLogDateFilter('')}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                  title="Reset Filter Tanggal"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari user / order / ket..."
                  value={searchLog}
                  onChange={(e) => setSearchLog(e.target.value)}
                  className="w-full bg-[#0b141a] border border-slate-700 text-white pl-9 pr-8 py-2 rounded-xl focus:border-[#00E676] outline-none text-xs transition"
                />
                {searchLog && (
                  <button
                    onClick={() => setSearchLog('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[350px]">
            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-[#00E676] mb-2" />
                <p className="text-xs">Memuat riwayat mutasi...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <FileText className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Tidak ada mutasi yang tercatat.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a232b]/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <th className="p-3.5 font-bold">Waktu</th>
                    <th className="p-3.5 font-bold">Customer</th>
                    <th className="p-3.5 font-bold">Tipe Mutasi</th>
                    <th className="p-3.5 font-bold text-right">Nominal</th>
                    <th className="p-3.5 font-bold">Keterangan / Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredLogs.map((tx: any) => {
                    const typeUpper = (tx.type || '').toUpperCase();
                    const isIncome = typeUpper.includes('TOPUP') || typeUpper === 'MANUAL_ADD' || typeUpper.includes('REFUND');
                    const amountNum = Number(tx.amount || 0);

                    return (
                      <tr key={tx.id} className="hover:bg-[#1a232b]/50 transition-colors">
                        {/* WAKTU */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-medium text-slate-200">
                            {formatDateTime(tx.createdAt)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            ID: {tx.id?.substring(0, 10)}...
                          </div>
                        </td>

                        {/* CUSTOMER */}
                        <td className="p-3.5">
                          <div className="font-bold text-white">
                            {tx.userName || 'Customer'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {tx.userPhone || tx.userEmail || tx.userId}
                          </div>
                        </td>

                        {/* TIPE MUTASI */}
                        <td className="p-3.5">
                          {typeUpper.includes('TOPUP') && (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-[#00E676] border border-emerald-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3" /> Top Up
                            </span>
                          )}
                          {(typeUpper === 'PAYMENT' || typeUpper.includes('ORDER')) && (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3" /> Order Payment
                            </span>
                          )}
                          {(typeUpper === 'MANUAL_ADD' || typeUpper === 'MANUAL_SUB' || typeUpper.includes('MANUAL')) && (
                            <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                              <SlidersHorizontal className="w-3 h-3" /> Penyesuaian
                            </span>
                          )}
                          {typeUpper.includes('REFUND') && (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase inline-flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" /> Refund Resmi
                            </span>
                          )}
                        </td>

                        {/* NOMINAL */}
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <span className={`font-mono font-black text-sm sm:text-base ${
                            isIncome ? 'text-[#00E676]' : 'text-rose-400'
                          }`}>
                            {isIncome ? '+' : '-'}{amountNum.toLocaleString('id-ID')} TC
                          </span>
                        </td>

                        {/* KETERANGAN */}
                        <td className="p-3.5">
                          <div className="text-slate-200 font-medium">
                            {tx.description || '-'}
                          </div>
                          {tx.adminNote && (
                            <div className="text-[11px] text-slate-400 mt-0.5 italic">
                              Note: {tx.adminNote}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: TAMBAH / KURANGI SALDO CUSTOMER */}
      {/* ========================================================= */}
      {isAdjustModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 animate-scale-up">
            {/* Header Modal */}
            <div className={`p-5 border-b border-slate-800 ${
              adjustMode === 'add' ? 'bg-[#00E676]/10' : adjustMode === 'deduct' ? 'bg-rose-500/10' : 'bg-blue-500/10'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-black text-base flex items-center gap-2 ${
                  adjustMode === 'add' ? 'text-[#00E676]' : adjustMode === 'deduct' ? 'text-rose-400' : 'text-blue-400'
                }`}>
                  {adjustMode === 'add' && <Plus className="w-5 h-5" />}
                  {adjustMode === 'deduct' && <Minus className="w-5 h-5" />}
                  {adjustMode === 'set' && <SlidersHorizontal className="w-5 h-5" />}
                  <span>
                    {adjustMode === 'add' ? 'Tambah Saldo TongCoins' : adjustMode === 'deduct' ? 'Kurangi Saldo TongCoins' : 'Set Saldo TongCoins'}
                  </span>
                </h3>
                <button
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="px-6 pt-2">
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('add');
                    setAdjustAmount(0);
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    adjustMode === 'add' ? 'bg-[#00E676] text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  + Tambah
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('deduct');
                    setAdjustAmount(0);
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    adjustMode === 'deduct' ? 'bg-rose-500 text-white font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  - Kurangi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustMode('set');
                    setAdjustAmount(Number(selectedUser.tc_balance ?? selectedUser.tongcoins ?? 0));
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    adjustMode === 'set' ? 'bg-blue-500 text-white font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  = Set Saldo
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 pt-0 space-y-4">
              {/* User Profile Card */}
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Customer</span>
                <div className="font-bold text-white text-sm mt-0.5">{selectedUser.name || selectedUser.username || selectedUser.id}</div>
                <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
                  <span>Saldo Saat Ini:</span>
                  <span className="font-mono font-black text-[#00E676]">
                    {Number(selectedUser.tc_balance ?? selectedUser.tongcoins ?? 0).toLocaleString('id-ID')} TC
                  </span>
                </div>
              </div>

              {/* Nominal Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {adjustMode === 'set' ? 'Saldo Baru yang Diinginkan (TC)' : 'Nominal TC'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={adjustAmount || ''}
                    onChange={(e) => setAdjustAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-[#1a232b] border border-slate-700 text-white px-4 py-3 rounded-xl focus:border-[#00E676] outline-none font-mono text-lg font-bold"
                    placeholder="Contoh: 25000"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    TC
                  </span>
                </div>

                {/* Quick Preset Buttons for Add */}
                {adjustMode === 'add' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[5000, 10000, 25000, 50000, 100000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAdjustAmount(amt)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-[#00E676]/20 text-[#00E676] border border-slate-700 hover:border-[#00E676]/40 rounded-lg text-[10px] font-bold transition"
                      >
                        +{amt.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Keterangan / Alasan
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-[#1a232b] border border-slate-700 text-white px-3.5 py-2.5 rounded-xl focus:border-[#00E676] outline-none text-xs"
                  placeholder="Misal: Kompensasi event, koreksi kas, dll."
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  disabled={isSubmittingAdjust}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs border border-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAdjustment}
                  disabled={isSubmittingAdjust || (adjustMode !== 'set' && adjustAmount <= 0)}
                  className={`flex-1 py-3 font-black rounded-xl text-xs transition shadow-lg cursor-pointer disabled:opacity-50 ${
                    adjustMode === 'add'
                      ? 'bg-[#00E676] hover:bg-[#00c853] text-slate-950 shadow-[#00E676]/25'
                      : adjustMode === 'deduct'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/50'
                  }`}
                >
                  {isSubmittingAdjust ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: USER SPECIFIC LEDGER HISTORY */}
      {/* ========================================================= */}
      {userHistoryModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-[#1a232b] flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#00E676]" />
                  <span>Riwayat Mutasi Saldo: {userHistoryModalUser.name || userHistoryModalUser.username || userHistoryModalUser.id}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono mt-0.5 block">
                  UID: {userHistoryModalUser.id} • Saldo: {Number(userHistoryModalUser.tc_balance ?? userHistoryModalUser.tongcoins ?? 0).toLocaleString('id-ID')} TC
                </span>
              </div>
              <button
                onClick={() => setUserHistoryModalUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {(() => {
                const userTxs = transactions.filter(t => t.userId === userHistoryModalUser.id);
                if (userTxs.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Belum ada riwayat mutasi untuk pengguna ini.
                    </div>
                  );
                }

                return userTxs.map(tx => {
                  const typeUpper = (tx.type || '').toUpperCase();
                  const isIncome = typeUpper.includes('TOPUP') || typeUpper === 'MANUAL_ADD' || typeUpper.includes('REFUND');

                  return (
                    <div key={tx.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{tx.description || tx.type}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
                            {tx.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {formatDateTime(tx.createdAt)}
                          {tx.adminNote && <span className="text-slate-500 ml-2 italic">({tx.adminNote})</span>}
                        </div>
                      </div>
                      <div className={`font-mono font-black text-sm shrink-0 ${
                        isIncome ? 'text-[#00E676]' : 'text-rose-400'
                      }`}>
                        {isIncome ? '+' : '-'}{Number(tx.amount || 0).toLocaleString('id-ID')} TC
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#1a232b] flex justify-end">
              <button
                onClick={() => setUserHistoryModalUser(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: REJECT TOPUP REASON MODAL */}
      {/* ========================================================= */}
      {rejectModalTopup && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Tolak Pengajuan Top Up</h3>
                <span className="text-xs text-slate-400 font-mono">#{rejectModalTopup.topupId || rejectModalTopup.id}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Alasan Penolakan
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-[#1a232b] border border-slate-700 text-white p-3 rounded-xl focus:border-rose-500 outline-none text-xs"
                placeholder="Masukkan alasan penolakan..."
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  'Bukti transfer palsu / tidak valid',
                  'Dana belum masuk rekening',
                  'Nominal transfer tidak sesuai'
                ].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectionReason(r)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-[10px] transition"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setRejectModalTopup(null)}
                disabled={isProcessingTopup}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs border border-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReject}
                disabled={isProcessingTopup || !rejectionReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-rose-950/50"
              >
                {isProcessingTopup ? 'Memproses...' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: IMAGE LIGHTBOX ZOOM (BUKTI TRANSFER) */}
      {/* ========================================================= */}
      {viewingProofUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setViewingProofUrl(null)}
        >
          <div 
            className="max-w-xl w-full bg-slate-950 border border-slate-800 rounded-3xl p-4 shadow-2xl relative space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#00E676]" /> Bukti Transfer Top Up
              </span>
              <button
                onClick={() => setViewingProofUrl(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-black rounded-2xl overflow-hidden max-h-[70vh]">
              <SafeImage
                src={viewingProofUrl}
                alt="Bukti Transfer Top Up"
                className="max-h-[70vh] w-auto object-contain rounded-2xl"
              />
            </div>

            <div className="flex justify-between items-center pt-2 text-xs">
              <a
                href={viewingProofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Buka Ukuran Penuh
              </a>
              <button
                onClick={() => setViewingProofUrl(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: AUDIT & FIX REFUND LIAR */}
      {/* ========================================================= */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-orange-500/30 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-orange-950/60 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 text-xl">
                  🛡️
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    Audit & Rekonsiliasi Saldo Refund Liar
                  </h3>
                  <p className="text-xs text-orange-300/80 mt-0.5">
                    Pindai & bersihkan transaksi pembatalan yang sempat salah menambah saldo TC.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isScanningAudit ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                  <p className="text-sm font-bold text-white">Memindai seluruh data orderan di Firestore...</p>
                  <p className="text-xs text-slate-500 max-w-xs text-center">
                    Mengecek status pembayaran ditolak dan anomali flag refund liar.
                  </p>
                </div>
              ) : auditSuccessResult ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-[#00E676] flex items-center justify-center text-2xl mx-auto border border-emerald-500/40">
                    <Check className="w-7 h-7" />
                  </div>
                  <h4 className="text-lg font-black text-white">Normalisasi Saldo Berhasil!</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Berhasil menormalkan <strong>{auditSuccessResult.totalFixed}</strong> transaksi anomali dengan total koreksi <strong>{auditSuccessResult.totalAmount.toLocaleString('id-ID')} TC</strong>. Seluruh saldo customer kini telah kembali akurat.
                  </p>
                </div>
              ) : auditScanFinished && auditAnomalies.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-[#00E676] flex items-center justify-center text-2xl mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-white">Database Bersih & Akurat!</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Tidak ditemukan satupun order anomali pembayaran ditolak yang terkena refund otomatis.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold block">Ditemukan {auditAnomalies.length} Transaksi Refund Liar</span>
                      <span className="text-[11px] text-amber-200/80">
                        Total nominal yang perlu dinormalkan: {auditAnomalies.reduce((acc, a) => acc + (a.refundAmount || 0), 0).toLocaleString('id-ID')} TC.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {auditAnomalies.map((item, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white">
                            #{item.displayId} — {item.customerName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Status Bayar: <span className="text-rose-400 font-bold">{item.paymentStatus}</span> • {formatDateTime(item.createdAt)}
                          </div>
                        </div>
                        <div className="font-mono font-black text-amber-400 text-sm">
                          -{item.refundAmount.toLocaleString('id-ID')} TC
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#1a232b] flex items-center justify-between gap-3">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Tutup
              </button>

              {auditAnomalies.length > 0 && !isScanningAudit && (
                <button
                  onClick={handleExecuteAuditFix}
                  disabled={isFixingAudit}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-orange-950/50 transition cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isFixingAudit ? 'Menormalkan Saldo...' : 'Koreksi & Normalkan Saldo Sekarang'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. ATOMIC TONGCOIN MUTATION / REFUND MODAL */}
      {isManualMutateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#131b22] border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setIsManualMutateModalOpen(false)}
              className="absolute top-4 right-4 z-10 w-9 h-9 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-2 sm:p-4">
              <AdminKelolaTongCoins
                currentUser={currentUser}
                onSuccess={() => {
                  // Keep modal open or let admin close
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
