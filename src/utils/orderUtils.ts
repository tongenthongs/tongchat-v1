import { db } from '../lib/firebase';
import { doc, getDoc, getDocs, collection, query, where, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { getDynamicQuickReply } from '../services/autoMessageService';
import { triggerDiorderHighPriorityNotification } from '../services/orderNotificationDispatcher';

export const normalizeOrderStatus = (status: string): { label: string, colorClass: string, raw: string } => {
  if (!status) return { label: '⏳ BOOKING', colorClass: 'text-amber-500 bg-amber-500/10', raw: 'BOOKING' };
  
  const s = status.toUpperCase().trim();
  if (s === 'HANGUS' || s === 'EXPIRED' || s.includes('HANGUS')) return { label: '⚠️ HANGUS', colorClass: 'text-rose-400 bg-rose-950/60 border-rose-600/40', raw: 'HANGUS' };
  if (s === 'BOOKING') return { label: '⏳ BOOKING', colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20', raw: 'BOOKING' };
  if (s === 'PROSES' || s === 'DIORDER' || s === 'PROSES_WORKER') return { label: '⚡ PROSES', colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20', raw: 'PROSES' };
  if (s === 'READY') return { label: '✨ READY', colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', raw: 'READY' };
  if (s === 'LOGUL' || s === 'ANTRIAN_LOGIN' || s === 'BUTUH_LOGIN_ULANG') return { label: '🔒 LOGUL', colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', raw: 'LOGUL' };
  if (s === 'SELESAI' || s === 'SUCCESS' || s === 'COMPLETED') return { label: '✅ SELESAI', colorClass: 'text-green-500 bg-green-500/10 border-green-500/20', raw: 'SELESAI' };
  if (s === 'CANCEL' || s === 'DIBATALKAN' || s === 'BATAL' || s === 'BATAL_TOLAK' || s === 'REJECTED' || s.includes('CANCEL')) return { label: '❌ CANCEL', colorClass: 'text-red-500 bg-red-500/10 border-red-500/20', raw: 'CANCEL' };
  
  return { label: s, colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20', raw: s };
};

export const updateOrderStatusGlobal = async (orderId: string, newStatus: string, orderWhatsapp?: string, orderUserId?: string) => {
  if (!orderId || !newStatus) return false;
  const statusNormalized = newStatus.toUpperCase().trim();
  const isHangus = statusNormalized === 'HANGUS' || statusNormalized === 'EXPIRED' || statusNormalized.includes('HANGUS');
  const isDiorder = statusNormalized === 'DIORDER';
  const isSelesai = statusNormalized === 'SELESAI' || statusNormalized === 'SUCCESS' || statusNormalized === 'COMPLETED';

  try {
    let finalOrderId = orderId;
    let displayOrderId = orderId;
    let orderData: any = null;

    if (finalOrderId.startsWith('#ORD-') || finalOrderId.startsWith('ORD-') || finalOrderId.startsWith('room_') || finalOrderId.startsWith('direct-')) {
      const cleanId = finalOrderId.replace(/^#/, '').replace(/^room_/, '').replace(/^direct-/, '');
      const snap = await getDocs(query(collection(db, 'orders'), where('orderId', 'in', [finalOrderId, cleanId, `#${cleanId}`])));
      if (!snap.empty) {
        finalOrderId = snap.docs[0].id;
        orderData = snap.docs[0].data();
        displayOrderId = orderData?.orderId || orderData?.id_order || cleanId;
      } else {
        const snap2 = await getDocs(query(collection(db, 'orders'), where('id', 'in', [finalOrderId, cleanId, `#${cleanId}`])));
        if (!snap2.empty) {
          finalOrderId = snap2.docs[0].id;
          orderData = snap2.docs[0].data();
          displayOrderId = orderData?.orderId || orderData?.id_order || cleanId;
        }
      }
    }

    if (!orderData) {
      const orderDoc = await getDoc(doc(db, 'orders', finalOrderId));
      if (orderDoc.exists()) {
        orderData = orderDoc.data();
        displayOrderId = orderData?.orderId || orderData?.id_order || displayOrderId;
      }
    }

    const rawCat = (orderData?.category || orderData?.service_type || orderData?.type || orderData?.productType || '').toLowerCase().trim();
    const isGiftExplicit = orderData?.isGift === true || rawCat === 'gift' || rawCat.includes('gift') || Boolean(orderData?.itemGift) || Boolean(orderData?.giftItemName);
    const isJokiExplicit = orderData?.isJoko === true || orderData?.isJoki === true || rawCat === 'joko' || rawCat === 'joki' || rawCat.includes('joki');
    const isGift = isGiftExplicit && !isJokiExplicit;

    const batch = writeBatch(db);

    // 1. Update Order
    const orderRef = doc(db, 'orders', finalOrderId);
    if (isHangus) {
      batch.update(orderRef, {
        status: "Hangus",
        orderStatus: "Hangus",
        statusCode: "HANGUS",
        isActive: false,
        completedAt: serverTimestamp(),
        hangusAt: serverTimestamp(),
        adminNote: "Pesanan telah hangus / expired (Tanpa Refund)",
        hangusReason: "Pesanan telah hangus / expired (Tanpa Refund)",
        isRefunded: false,
        refundAmount: 0,
        updatedAt: serverTimestamp()
      });
    } else if (isSelesai) {
      batch.update(orderRef, {
        status: "Selesai",
        orderStatus: "Selesai",
        statusCode: "SELESAI",
        isCompleted: true,
        isActive: false,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      batch.update(orderRef, {
        status: newStatus,
        orderStatus: newStatus,
        statusCode: statusNormalized,
        updatedAt: serverTimestamp()
      });
    }

    // 2. Find associated Chat Room
    const chatsRef = collection(db, 'chats');
    let chatSnap = await getDocs(query(chatsRef, where('order_id', '==', finalOrderId)));
    
    if (chatSnap.empty && orderId) {
      chatSnap = await getDocs(query(chatsRef, where('activeOrderDocId', '==', finalOrderId)));
    }
    if (chatSnap.empty && orderId) {
       chatSnap = await getDocs(query(chatsRef, where('orderId', '==', finalOrderId)));
    }
    
    const targetUserId = orderUserId || orderData?.userId || orderData?.userUid || orderData?.customerId;
    if (chatSnap.empty && targetUserId) {
      chatSnap = await getDocs(query(chatsRef, where('customer_id', '==', targetUserId)));
    }

    const targetPhone = orderWhatsapp || orderData?.customerWhatsapp || orderData?.customer_phone || orderData?.whatsapp;
    if (chatSnap.empty && targetPhone) {
      chatSnap = await getDocs(query(chatsRef, where('whatsapp', '==', targetPhone)));
    }

    const robloxUser = (orderData?.robloxUsername || orderData?.roblox_username || orderData?.game_user_id || '').toLowerCase().trim().replace(/^@/, '');
    if (chatSnap.empty && robloxUser) {
      chatSnap = await getDocs(query(chatsRef, where('robloxUsername', '==', robloxUser)));
    }

    // Prepare Dynamic Messages
    let dynamicLinkGpMessage = "";
    if (isGift && isDiorder) {
      dynamicLinkGpMessage = await getDynamicQuickReply("/linkgp");
      if (!dynamicLinkGpMessage) {
        dynamicLinkGpMessage = `Join ke private server *Drag Drive Simulator* mimin kaak 😊 🔗 Silakan cek menu chat untuk link server aktif.`;
      }
    }

    const completionMessage = `✅ *Pesanan Selesai*

Terimakasih sudah order di Entong Store. 
Mimin tunggu orderan berikutnya yaaa..

Follow juga Saluran WA Entong biar dapet info terbaru seputar Update, Promo, Bahkan GP Gratis!
https://whatsapp.com/channel/0029VbDg513Lo4hZCxMAgP3r`;

    if (!chatSnap.empty) {
      chatSnap.docs.forEach(docSnap => {
        if (isHangus) {
          batch.update(docSnap.ref, {
            status: "",
            orderStatus: "",
            activeOrderId: null,
            isOrderActive: false,
            lastStatusUpdate: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: "⚠️ PESANAN HANGUS (EXPIRED)",
            lastMessageTime: serverTimestamp()
          });
          
          // Add Hangus official notice message
          const msgRef = doc(collection(docSnap.ref, 'messages'));
          batch.set(msgRef, {
            text: `⚠️ **STATUS PESANAN: HANGUS (EXPIRED)**\n\nPesanan **#${displayOrderId || finalOrderId}** telah dinyatakan **HANGUS** sesuai kebijakan layanan Entong Store karena telah melewati batas waktu antrean / tidak ada konfirmasi lebih lanjut.\n\n📌 **Ketentuan:** Pesanan ditutup secara permanen (Tanpa Refund / Zero Refund).`,
            senderId: 'system',
            senderName: 'Sistem Entong',
            isSystemMessage: true,
            createdAt: serverTimestamp(),
            isRead: false
          });
        } else if (isSelesai) {
          batch.update(docSnap.ref, {
            status: "SELESAI",
            orderStatus: "Selesai",
            activeOrderId: null,
            isOrderActive: false,
            orderBadge: "SELESAI",
            lastStatusUpdate: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: completionMessage,
            lastMessageTime: serverTimestamp()
          });
          
          // Add auto completion message
          const msgRef = doc(collection(docSnap.ref, 'messages'));
          batch.set(msgRef, {
            text: completionMessage,
            sender: "admin",
            senderRole: "RESMI",
            senderId: 'admin_bot',
            isOfficialBot: true,
            createdAt: serverTimestamp(),
            isRead: false
          });
        } else if (isGift && isDiorder && dynamicLinkGpMessage) {
          batch.update(docSnap.ref, {
            status: "DIORDER",
            orderStatus: "Diorder",
            orderBadge: "DIORDER",
            lastStatusUpdate: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: dynamicLinkGpMessage,
            lastMessageTime: serverTimestamp()
          });

          const msgRef = doc(collection(docSnap.ref, 'messages'));
          batch.set(msgRef, {
            text: dynamicLinkGpMessage,
            sender: "admin",
            senderRole: "RESMI",
            senderId: 'admin_bot',
            isOfficialBot: true,
            createdAt: serverTimestamp(),
            isRead: false
          });
        } else {
          batch.update(docSnap.ref, {
            status: statusNormalized,
            orderStatus: newStatus,
            orderBadge: statusNormalized,
            lastStatusUpdate: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      });
    } else if (robloxUser || targetPhone) {
      // Fallback: If room doc not found yet, create or post to chat_${robloxUser}
      const fallbackRoomId = robloxUser ? `chat_${robloxUser}` : `chat_${targetPhone}`;
      const fallbackChatRef = doc(db, 'chats', fallbackRoomId);

      if (isGift && isDiorder && dynamicLinkGpMessage) {
        batch.set(fallbackChatRef, {
          customerName: orderData?.customerName || orderData?.customer_name || robloxUser,
          robloxUsername: robloxUser,
          customerWhatsapp: targetPhone || "-",
          lastMessage: dynamicLinkGpMessage,
          lastMessageAt: serverTimestamp(),
          orderBadge: "DIORDER",
          roleBadge: "RESMI",
          unreadCount: 0,
          updatedAt: serverTimestamp()
        }, { merge: true });

        const msgRef = doc(collection(fallbackChatRef, 'messages'));
        batch.set(msgRef, {
          text: dynamicLinkGpMessage,
          sender: "admin",
          senderRole: "RESMI",
          senderId: "admin_bot",
          isOfficialBot: true,
          createdAt: serverTimestamp()
        });
      } else if (isSelesai) {
        batch.set(fallbackChatRef, {
          customerName: orderData?.customerName || orderData?.customer_name || robloxUser,
          robloxUsername: robloxUser,
          customerWhatsapp: targetPhone || "-",
          lastMessage: completionMessage,
          lastMessageAt: serverTimestamp(),
          orderBadge: "SELESAI",
          roleBadge: "RESMI",
          unreadCount: 0,
          updatedAt: serverTimestamp()
        }, { merge: true });

        const msgRef = doc(collection(fallbackChatRef, 'messages'));
        batch.set(msgRef, {
          text: completionMessage,
          sender: "admin",
          senderRole: "RESMI",
          senderId: "admin_bot",
          isOfficialBot: true,
          createdAt: serverTimestamp()
        });
      }
    }

    // 3. Clear Cloud Monitor Assignment if SELESAI or HANGUS
    if (isSelesai || isHangus) {
      const cloudsRef = collection(db, 'clouds');
      let cloudSnap = await getDocs(query(cloudsRef, where('assignedOrderId', '==', finalOrderId)));
      if (cloudSnap.empty) {
        cloudSnap = await getDocs(query(cloudsRef, where('currentOrderId', '==', finalOrderId)));
      }
      
      if (!cloudSnap.empty) {
        cloudSnap.docs.forEach(docSnap => {
          batch.update(docSnap.ref, {
            status: 'AVAILABLE',
            statusLabel: 'KOSONG',
            assignedOrderId: null,
            currentOrderId: null,
            orderData: null,
            assignedCustomerName: null,
            assignedGameName: null,
            updatedAt: serverTimestamp()
          });
        });
      }
    }

    await batch.commit();

    if (isDiorder) {
      triggerDiorderHighPriorityNotification(finalOrderId).catch((err) => {
        console.warn("Error triggering diorder notification:", err);
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to update order status globally:', error);
    return false;
  }
};

/**
 * Dedicated function to mark an order as Hangus (Forfeited / Expired) with Zero Refund
 */
export const markOrderAsHangus = async (orderOrId: any, customReason?: string) => {
  const orderId = typeof orderOrId === 'string' ? orderOrId : (orderOrId?.firestore_id || orderOrId?.docUniqueId || orderOrId?.firestoreId || orderOrId?.id || orderOrId?.orderId || orderOrId?.order_id);
  const phone = typeof orderOrId === 'object' ? (orderOrId?.customer_phone || orderOrId?.whatsapp || orderOrId?.phone || '') : '';
  const userId = typeof orderOrId === 'object' ? (orderOrId?.userId || orderOrId?.userUid || orderOrId?.customer_id || orderOrId?.customerId || '') : '';
  
  return await updateOrderStatusGlobal(orderId, 'Hangus', phone, userId);
};

export { handleUpdateOrderStatusWithAutoBot, getDynamicQuickReply, dispatchAutoChatMessage } from '../services/autoMessageService';
