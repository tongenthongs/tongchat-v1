const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminPortal.tsx', 'utf8');

// 1. Update getConvStatus and renderWaStatusBadge
const oldStatusStart = `const getConvStatus = (convItem: { id: string; name?: string; phone?: string }) => {`;
const oldStatusEnd = `const handleDeleteChat = async (activeChatId: string) => {`;

const sIdx = content.indexOf(oldStatusStart);
const eIdx = content.indexOf(oldStatusEnd);

if (sIdx !== -1 && eIdx !== -1) {
  const newStatusSection = `const getConvStatus = (convItem: { id: string; name?: string; phone?: string }) => {
    const customerId = (convItem.id.startsWith('direct-') || convItem.id.startsWith('room_')) ? convItem.id.replace('direct-', '').replace('room_', '') : convItem.id;
    const matchedOrder = orders.find(o => 
      o.id === convItem.id || 
      o.customer_id === customerId || 
      (o.customer_name && convItem.name && o.customer_name.toLowerCase() === convItem.name.toLowerCase()) ||
      (convItem.phone && o.customer_phone === convItem.phone)
    );
    const chatDoc = chats.find(c => c.id === convItem.id || c.order_id === convItem.id || c.customer_id === customerId || c.id === \`room_\${convItem.id}\`);
    return matchedOrder?.status || chatDoc?.orderStatus || chatDoc?.status || 'NEW';
  };

  const getStatusBadgeConfig = (statusStr: string) => {
    const s = (statusStr || 'NEW').toUpperCase();
    if (s === 'NEW' || s === 'BELUM_ORDER' || s === 'BELUM ORDER') {
      return { label: 'NEW', colorClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    }
    if (s === 'BOOKING' || s === 'ANTRIAN_LOGIN' || s === 'ANTRIAN') {
      return { label: 'BOOKING', colorClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    }
    if (s === 'PROSES WORKER' || s === 'PROSES_WORKER' || s === 'PROSES PUSH' || s === 'PROSES_PUSH' || s === 'PROSES') {
      return { label: 'PROSES WORKER', colorClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    }
    if (s === 'SELESAI') {
      return { label: 'SELESAI', colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    }
    if (s === 'CANCEL' || s === 'BATAL') {
      return { label: 'CANCEL', colorClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
    }
    return { label: s, colorClass: 'bg-slate-700/50 text-slate-300 border-slate-600/50' };
  };

  const renderWaStatusBadge = (statusStr: string) => {
    const config = getStatusBadgeConfig(statusStr);
    return (
      <span className={\`px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-bold border \${config.colorClass} shadow-sm shrink-0 whitespace-nowrap\`}>
        {config.label}
      </span>
    );
  };

  `;
  content = content.substring(0, sIdx) + newStatusSection + content.substring(eIdx);
  console.log('Status helper section updated.');
} else {
  console.error('Failed to locate getConvStatus section.');
}

// 2. Update handleStatusChange
const oldHandleStart = `const handleStatusChange = async (chatOrOrderId: string, newStatus: string) => {`;
const oldHandleEnd = `const handleRequestReview = async () => {`;

const hStart = content.indexOf(oldHandleStart);
const hEnd = content.indexOf(oldHandleEnd);

if (hStart !== -1 && hEnd !== -1) {
  const newHandleSection = `const handleStatusChange = async (chatOrOrderId: string, newStatus: string) => {
    if (isStatusUpdatingRef.current) return;
    isStatusUpdatingRef.current = true;
    
    const normalizedOrderStatus = (newStatus === 'PROSES WORKER' || newStatus === 'PROSES PUSH') ? 'PROSES_WORKER' : (newStatus === 'CANCEL' ? 'BATAL' : newStatus);

    let orderIdToUpdate = chatOrOrderId;
    if (chatOrOrderId.startsWith('room_')) {
      orderIdToUpdate = chatOrOrderId.replace('room_', '');
    } else if (chatOrOrderId.startsWith('direct-')) {
      orderIdToUpdate = chatOrOrderId.replace('direct-', '');
    }
    
    // Instant local state re-render
    if (activeOrder && activeOrder.id) {
      updateOrderStatus(activeOrder.id, normalizedOrderStatus as any);
    }
    if (orderIdToUpdate && orderIdToUpdate !== activeOrder?.id) {
      updateOrderStatus(orderIdToUpdate, normalizedOrderStatus as any);
    }

    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      const targetChatId = selectedChatRoom?.firestoreDocId || selectedChatRoom?.id || chatOrOrderId;
      
      try {
        await updateDoc(doc(db, 'chats', targetChatId), { 
          orderStatus: newStatus, 
          status: newStatus, 
          updatedAt: serverTimestamp() 
        });
      } catch (err) {
        console.warn('Chat doc update failed', err);
      }

      try {
        await updateDoc(doc(db, 'orders', orderIdToUpdate), { 
          status: normalizedOrderStatus,
          orderStatus: newStatus,
          updated: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Order doc update failed', err);
      }

      const statusMsg = \`📌 [STATUS UPDATE] Status pesanan Anda telah diperbarui menjadi: \${newStatus}\`;
      await sendMessage(targetChatId, statusMsg, undefined, undefined, true);

      if (newStatus === 'SELESAI') {
        await sendMessage(targetChatId, 'Mohon tinggalkan ulasan untuk pelayanan kami!', undefined, undefined, true, 'review_prompt');
      }
    } catch (error: any) {
      console.error("Gagal mengupdate status:", error);
    } finally {
      setTimeout(() => { isStatusUpdatingRef.current = false; }, 500);
    }
  };

  `;
  content = content.substring(0, hStart) + newHandleSection + content.substring(hEnd);
  console.log('handleStatusChange updated.');
} else {
  console.error('Failed to locate handleStatusChange section.');
}

fs.writeFileSync('src/components/admin/AdminPortal.tsx', content, 'utf8');
