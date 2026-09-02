import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db, extractTimeMs } from '../lib/firebase';
import { isJunkBotOrder, isTopUpTcOrder } from '../lib/orderRefund';

export { isJunkBotOrder, isTopUpTcOrder };

export const useOrders = (initialLimit = 50) => {
  const [limitCount, setLimitCount] = useState<number>(initialLimit);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback((increment = 50) => {
    setLimitCount(prev => prev + increment);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const ordersCol = collection(db, 'orders'); 
    
    // Terapkan query limit untuk mencegah freeze / lag pada initial load
    const q = query(ordersCol, limit(limitCount));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => {
        const doc = docSnap.data() || {};
        const docId = docSnap.id;
        const pureTime = extractTimeMs(doc);
        const officialOrderId = doc.orderId || (docId.startsWith('ORD-') ? docId : `#ORD-${docId.slice(-6).toUpperCase()}`);

        // 1. STANDARISASI PEMBACAAN DATA FIRESTORE (NORMALISASI 100%)
        const customer_name = doc.customer_name || doc.customer_username || doc.name || doc.userName || doc.customerName || 'Customer';
        const roblox_username = doc.roblox_username || doc.game_user_id || doc.username_roblox || doc.username || doc.robloxUsername || doc.game_username || doc.targetUsername || '-';
        const package_name = doc.package_name || doc.item_name || doc.game_name || doc.product_name || doc.packageName || doc.gameName || 'Item Joko/Gift';
        const game_name = doc.game_name || doc.gameName || doc.product_name || doc.category || 'Gamepass / Joko';
        const price = Number(doc.price || doc.total_price || doc.amount || doc.totalPrice || 0);
        const status = doc.status || doc.orderStatus || 'Booking';
        const payment_proof = doc.payment_proof || doc.proof_url || doc.image_proof || doc.proofUrl || doc.proofOfPayment || null;
        const is_paid = doc.isPaid === true || doc.is_paid === true || doc.paid === true || (doc.paymentStatus || '').toLowerCase() === 'paid' || (doc.payment_status || '').toLowerCase() === 'paid' || (doc.paymentStatus || '').toLowerCase() === 'lunas';
        const payment_status = doc.payment_status || doc.status_pembayaran || doc.paymentStatus || (is_paid ? 'PAID' : (doc.status === 'Selesai' ? 'PAID' : 'Pending'));
        const customer_phone = doc.customer_phone || doc.customerPhone || doc.whatsapp || doc.phone || '';
        const note = doc.note || doc.catatanWorker || doc.workerNote || '';
        const cloud_number = doc.cloud_number || doc.assignedCloudName || '';

        return { 
          ...doc,
          docUniqueId: docId, 
          firestoreId: docId,
          id: docId,
          isPaid: is_paid,
          is_paid: is_paid,
          orderId: officialOrderId,
          customer_name,
          customerName: customer_name,
          roblox_username,
          robloxUsername: roblox_username,
          game_username: roblox_username,
          targetUsername: roblox_username,
          package_name,
          packageName: package_name,
          game_name,
          gameName: game_name,
          price,
          totalPrice: price,
          status,
          orderStatus: status,
          payment_proof,
          proofUrl: payment_proof,
          proofOfPayment: payment_proof,
          payment_status,
          paymentStatus: payment_status,
          customer_phone,
          customerPhone: customer_phone,
          whatsapp: customer_phone,
          note,
          catatanWorker: note,
          cloud_number,
          pureTime,
          initialCreationTime: pureTime,
          createdTimestamp: pureTime,
          sortTime: pureTime,
          created: doc.created || doc.createdAt || (pureTime > 0 ? new Date(pureTime).toISOString() : ''),
          createdAt: doc.createdAt || doc.created || (pureTime > 0 ? new Date(pureTime).toISOString() : '')
        };
      });

      // 🚨 SORTING KRONOLOGIS AKURAT: TERBARU KE TERLAMA (DESCENDING)
      docs.sort((a, b) => (extractTimeMs(b) || b.pureTime || 0) - (extractTimeMs(a) || a.pureTime || 0));
      
      setRawOrders(docs);
      setIsLoading(false);
      setHasMore(snapshot.docs.length >= limitCount);
    }, (err) => {
      console.error("Gagal load orders:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [limitCount]);

  const cleanOrders = useMemo(() => {
    return rawOrders.filter(ord => !isJunkBotOrder(ord) && !isTopUpTcOrder(ord));
  }, [rawOrders]);

  return { rawOrders, cleanOrders, isLoading, limitCount, loadMore, hasMore };
};
