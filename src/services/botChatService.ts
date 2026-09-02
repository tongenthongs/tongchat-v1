import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';

export type InteractiveBotType = 
  | 'WELCOME'
  | 'NOT_YET_SERVICES'
  | 'CHOOSE_CATEGORY'
  | 'FILL_GIFT_FORM'
  | 'FILL_JOKI_FORM'
  | 'WAITING_FEEDBACK'
  | 'FINISHED'
  | 'NONE';

/**
 * Deteksi tipe interaksi bot berdasarkan metadata atau pola teks pesan
 */
export const detectInteractiveType = (msg: any): InteractiveBotType => {
  if (msg.interactiveType) return msg.interactiveType as InteractiveBotType;
  if (msg.botActionType) return msg.botActionType as InteractiveBotType;

  const text = (msg.text || msg.message || '').trim();

  if (text.includes('Selamat datang di Entong Store') || text.includes('Mau order atau sudah order') || text.includes('Klik aja bantuan atau tulis di kolom chat ya')) {
    return 'WELCOME';
  }
  if (text.includes('Sip, makasih ya udah pilih!') && text.includes('katalog produk')) {
    return 'NOT_YET_SERVICES';
  }
  if (text.includes('Pilih kategori pesanan yang mau dilaporkan') || text.includes('diisi form-nya ya')) {
    return 'CHOOSE_CATEGORY';
  }
  if (text.includes('Silakan isi form Gift In Game berikut') || (text.includes('Form Gamepass (wajib isi)') && msg.sender !== 'customer')) {
    return 'FILL_GIFT_FORM';
  }
  if (text.includes('Silakan isi form Joki berikut') || (text.includes('Form Joki') && msg.sender !== 'customer')) {
    return 'FILL_JOKI_FORM';
  }
  if (text.includes('Pesanan kamu sudah mimin catat') || text.includes('*Pesanan kamu sudah mimin catat.*')) {
    return 'WAITING_FEEDBACK';
  }

  return 'NONE';
};

/**
 * Kirim pesan bot resmi ke koleksi chats/{roomId}/messages
 */
export const sendBotBubble = async (
  roomId: string,
  text: string,
  interactiveType: InteractiveBotType = 'NONE',
  actionCard?: any
) => {
  if (!roomId || !text) return;

  try {
    const messagesRef = collection(db, 'chats', roomId, 'messages');
    const msgData: any = {
      text,
      message: text,
      sender: 'admin',
      senderRole: 'RESMI',
      sender_role: 'ADMIN',
      senderName: 'Bot Entong Store',
      sender_name: 'Bot Entong Store',
      isOfficialBot: true,
      is_official_bot: true,
      interactiveType,
      createdAt: serverTimestamp(),
      createdAtMillis: Date.now(),
      created: new Date().toISOString()
    };

    if (actionCard) {
      msgData.actionCard = actionCard;
    }

    await addDoc(messagesRef, msgData);

    const chatDocRef = doc(db, 'chats', roomId);
    await setDoc(chatDocRef, {
      lastMessage: text,
      last_message: text,
      lastSender: 'admin',
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Gagal mengirim pesan bot:', err);
  }
};

/**
 * Kirim pesan dari sisi customer ke chats/{roomId}/messages
 */
export const sendCustomerBubble = async (
  roomId: string,
  text: string,
  currentUser?: UserProfile | null
) => {
  if (!roomId || !text) return;

  const senderName = currentUser?.name || currentUser?.username || 'Customer';
  const senderId = currentUser?.id || currentUser?.phone || 'customer';

  try {
    const messagesRef = collection(db, 'chats', roomId, 'messages');
    await addDoc(messagesRef, {
      text,
      message: text,
      sender: 'customer',
      senderRole: 'PELANGGAN',
      sender_role: 'CUSTOMER',
      senderId: senderId,
      sender_id: senderId,
      senderName: senderName,
      sender_name: senderName,
      createdAt: serverTimestamp(),
      createdAtMillis: Date.now(),
      created: new Date().toISOString()
    });

    const chatDocRef = doc(db, 'chats', roomId);
    await setDoc(chatDocRef, {
      lastMessage: text,
      last_message: text,
      lastSender: 'customer',
      lastMessageAt: serverTimestamp(),
      unreadCount: 1,
      unreadAdminCount: 1,
      unreadByAdmin: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Gagal mengirim pesan customer:', err);
  }
};

/**
 * Inisialisasi Auto-Greeting jika belum ada pesan dalam ruangan
 */
export const triggerWelcomeGreeting = async (chatId: string, customerDisplayName: string) => {
  const displayName = customerDisplayName || "Kak";
  const welcomeText = `Hai ${displayName}! Selamat datang di Entong Store! 🎮 Mau order atau sudah order?. kalo bingung chat admin aja ya!`;

  await addDoc(collection(db, "chats", chatId, "messages"), {
    text: welcomeText,
    message: welcomeText,
    sender: "admin",
    senderRole: "RESMI",
    sender_role: "ADMIN",
    senderName: "Bot Entong Store",
    sender_name: "Bot Entong Store",
    isOfficialBot: true,
    isBotWelcome: true,
    interactiveType: "WELCOME",
    createdAt: serverTimestamp(),
    createdAtMillis: Date.now(),
    created: new Date().toISOString()
  });

  await setDoc(doc(db, "chats", chatId), {
    lastMessage: welcomeText,
    last_message: welcomeText,
    lastSender: "admin",
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    welcomeInitialized: true,
    welcomeInitializedAt: serverTimestamp()
  }, { merge: true });
};

// In-flight guard to prevent duplicate triggers across parallel calls or rapid re-renders
const inFlightGreetingRooms = new Set<string>();

export const ensureInitialWelcomeGreeting = async (
  roomId: string,
  currentUser?: UserProfile | null,
  currentMessages: any[] = []
) => {
  if (!roomId) return;
  if (inFlightGreetingRooms.has(roomId)) return;

  // 1. Cari pesan terakhir dari Entong Bot atau cek apakah sudah ada welcome greeting di messages
  const hasExistingBotWelcome = currentMessages.some(m => {
    return (
      m.isOfficialBot ||
      (m as any).is_official_bot ||
      (m as any).isBotWelcome ||
      m.senderName === 'Bot Entong Store' ||
      m.sender_name === 'Bot Entong Store' ||
      m.senderName === 'Entong Bot' ||
      m.sender_name === 'Entong Bot' ||
      (m.sender === 'admin' && m.isBotWelcome) ||
      detectInteractiveType(m) === 'WELCOME' ||
      (typeof m.text === 'string' && m.text.includes('Selamat datang di Entong Store')) ||
      (typeof m.message === 'string' && m.message.includes('Selamat datang di Entong Store'))
    );
  });

  if (hasExistingBotWelcome) {
    return;
  }

  // Jika messages sudah ada pesan apapun (misal riwayat lama), jangan spam greeting baru
  if (currentMessages.length > 0) {
    return;
  }

  inFlightGreetingRooms.add(roomId);

  try {
    const { getDoc, getDocs, query, limit, doc: getDocRef, writeBatch, collection, serverTimestamp } = await import('firebase/firestore');
    
    // 2. Cek flag di dokumen room chat utama dan gunakan lock dari getDocs
    const roomRef = getDocRef(db, 'chats', roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      const roomData = roomSnap.data();
      if (roomData?.welcomeInitialized === true) {
        return;
      }
    }

    // 3. Query Firestore secara langsung untuk memastikan belum ada pesan yang dibuat di server
    const msgCol = collection(db, 'chats', roomId, 'messages');
    const existingSnap = await getDocs(query(msgCol, limit(2)));
    if (!existingSnap.empty) {
      // Jika ada pesan tapi flag belum set, set manual agar tdk memicu query lagi
      await import('firebase/firestore').then(m => m.setDoc(roomRef, { welcomeInitialized: true }, { merge: true }));
      return;
    }

    // 4. Batch Write untuk Welcome Message dan Flag Room
    const custName = currentUser?.displayName || currentUser?.name || currentUser?.username || 'Kak';
    const welcomeText = `Hai ${custName}! Selamat datang di Entong Store! 🎮 Mau order atau sudah order?. kalo bingung chat admin aja ya!`;
    
    const batch = writeBatch(db);
    
    const newMsgRef = getDocRef(msgCol);
    batch.set(newMsgRef, {
      text: welcomeText,
      message: welcomeText,
      sender: "admin",
      senderRole: "RESMI",
      sender_role: "ADMIN",
      senderName: "Bot Entong Store",
      sender_name: "Bot Entong Store",
      isOfficialBot: true,
      isBotWelcome: true,
      interactiveType: "WELCOME",
      createdAt: serverTimestamp(),
      createdAtMillis: Date.now(),
      created: new Date().toISOString()
    });
    
    batch.set(roomRef, {
      lastMessage: welcomeText,
      last_message: welcomeText,
      lastSender: "admin",
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      welcomeInitialized: true,
      welcomeInitializedAt: serverTimestamp()
    }, { merge: true });
    
    await batch.commit();

  } catch (err) {
    console.warn('Gagal memproses ensureInitialWelcomeGreeting:', err);
  } finally {
    // Lepaskan lock setelah delay untuk menghindari race condition re-render
    setTimeout(() => {
      inFlightGreetingRooms.delete(roomId);
    }, 4000);
  }
};
