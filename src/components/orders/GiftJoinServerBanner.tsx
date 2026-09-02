import React, { useState } from 'react';
import { Gift, ExternalLink, Copy, Check, MessageSquare, UserPlus, Server, ShieldCheck, Sparkles } from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isStrictGiftBookingOrder } from '../../utils/orderCategoryValidator';
import WorkerGiftCard from './WorkerGiftCard';

interface GiftJoinServerBannerProps {
  orderData: any;
  onOpenChat?: () => void;
}

export const GiftJoinServerBanner: React.FC<GiftJoinServerBannerProps> = ({
  orderData,
  onOpenChat
}) => {
  const [copiedWorker, setCopiedWorker] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  if (!orderData) return null;

  // Determine if this order is a Gift In-Game order
  const isGift = Boolean(
    isStrictGiftBookingOrder(orderData) ||
    orderData.category === 'gift' ||
    orderData.type === 'gift' ||
    orderData.isGift === true ||
    (orderData.packageName && orderData.packageName.toLowerCase().includes('pass')) ||
    (orderData.itemGift && orderData.itemGift.trim().length > 0)
  );

  // If not a gift order or already completed/cancelled, do not show
  const statusUpper = (orderData.status || orderData.orderStatus || 'PENDING').toUpperCase();
  const isCompleted = ['SELESAI', 'COMPLETED', 'SUCCESS'].includes(statusUpper);
  const isCanceled = ['BATAL', 'BATAL_TOLAK', 'CANCEL', 'REJECTED', 'HANGUS'].includes(statusUpper);

  if (!isGift || isCompleted || isCanceled) {
    return null;
  }

  // Worker Info fallback
  const workerUsername = orderData.workerUsername || orderData.worker_username || orderData.adminRobloxUsername || 'EntongWorkerGift';
  const privateServerLink = orderData.privateServerLink || orderData.serverLink || orderData.gameServerUrl || '';
  const customerRoblox = orderData.robloxUsername || orderData.roblox_username || orderData.game_username || orderData.targetUsername || 'Customer';
  const rawOrderId = orderData.orderId || orderData.id || '#ORDER';

  const workerAvatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userName=${encodeURIComponent(workerUsername)}&width=150&height=150&format=png`;

  const handleCopyWorker = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(workerUsername);
      } else {
        const el = document.createElement('textarea');
        el.value = workerUsername;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedWorker(true);
      setTimeout(() => setCopiedWorker(false), 2000);
    } catch (_) {}
  };

  // Dispatch "Minta Bantuan Worker" into customer chat room
  const handleRequestWorkerHelp = async () => {
    if (isDispatching) return;
    setIsDispatching(true);

    const rawUsername = 
      orderData?.robloxUsername || 
      orderData?.username || 
      orderData?.targetAccount || 
      orderData?.game_username ||
      "Akun";
    
    const formattedUsername = rawUsername.startsWith("@") ? rawUsername : `@${rawUsername}`;
    const autoTextMessage = `Min sudah add. tolong terima (${formattedUsername})`;

    try {
      const chatId = orderData.chatId || orderData.roomChatId || orderData.docUniqueId || orderData.id;
      
      if (chatId) {
        // 1. Send customer trigger bubble
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text: autoTextMessage,
          sender: 'customer',
          senderRole: 'PELANGGAN',
          orderId: rawOrderId,
          isWorkerHelpRequest: true,
          createdAt: serverTimestamp()
        });

        // 2. Mark last updated on order doc
        const docId = orderData.docUniqueId || orderData.firestoreId || orderData.id;
        if (docId) {
          await updateDoc(doc(db, 'orders', docId), {
            hasRequestedWorkerHelp: true,
            lastWorkerHelpRequestAt: serverTimestamp()
          });
        }
        
        // 3. Update chat last message
        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: autoTextMessage,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Open Chat if callback provided, else try finding the livechat button
      if (onOpenChat) {
        onOpenChat();
      } else {
        const livechatBtn = document.getElementById("customer-livechat-toggle");
        if (livechatBtn) livechatBtn.click();
      }
    } catch (err) {
      console.warn('Gagal kirim permintaan bantuan worker:', err);
      if (onOpenChat) {
        onOpenChat();
      }
    } finally {
      setIsDispatching(false);
    }
  };

  return <WorkerGiftCard onOpenHelp={handleRequestWorkerHelp} orderData={orderData} />;
};

export default GiftJoinServerBanner;
