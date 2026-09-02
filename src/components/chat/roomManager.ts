import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface RoomData {
  id?: string;
  roomId?: string;
  customerName?: string;
  userUid?: string;
  createdAt?: string;
  updatedAt?: string;
  lastMessage?: string;
  status?: string;
  [key: string]: any;
}

/**
 * Ensures direct document exists in Firestore ('chats' or 'rooms' collection)
 * before subscribing to onSnapshot to avoid empty direct path warnings.
 */
export const ensureDirectRoomExists = async (roomId: string, customerData?: any): Promise<boolean> => {
  if (!roomId) return false;

  const collectionsToEnsure = ['chats', 'rooms'];
  let created = false;

  for (const col of collectionsToEnsure) {
    try {
      const roomRef = doc(db, col, roomId);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        await setDoc(
          roomRef,
          {
            roomId: roomId,
            id: roomId,
            customerId: customerData?.id || customerData?.uid || customerData?.userUid || customerData?.customer_id || 'GUEST',
            customer_id: customerData?.id || customerData?.uid || customerData?.userUid || customerData?.customer_id || 'GUEST',
            customerName: customerData?.name || customerData?.customerName || customerData?.customer_name || 'Pelanggan Entong Store',
            customer_name: customerData?.name || customerData?.customerName || customerData?.customer_name || 'Pelanggan Entong Store',
            userUid: customerData?.id || customerData?.uid || customerData?.userUid || customerData?.customer_id || 'GUEST',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: 'Ruangan obrolan dibuat',
            last_message: 'Ruangan obrolan dibuat',
            lastSender: 'customer',
            last_sender: 'customer',
            unreadAdminCount: 0,
            unreadCustomerCount: 0,
            unreadCount: 0,
            is_read_admin: true,
            is_read_customer: true,
            status: 'ACTIVE'
          },
          { merge: true }
        );
        created = true;
      }
    } catch (err) {
      console.error(`Error ensuring direct room doc in ${col}:`, err);
    }
  }

  return created;
};

/**
 * Initializes and subscribes to a chat room on its direct path safely.
 * Checks availability of direct document first, creates it if missing, then subscribes.
 */
export const initializeAndSubscribeRoom = async (
  roomId: string,
  customerData: any,
  onUpdate?: (data: RoomData) => void
) => {
  if (!roomId) return;

  try {
    // 1. Cek ketersediaan & buat dokumen Direct Path secara otomatis agar tidak trigger fallback
    await ensureDirectRoomExists(roomId, customerData);

    const roomRef = doc(db, 'rooms', roomId);

    // 2. Terapkan Listener Realtime pada Direct Path secara aman
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists() && onUpdate) {
        onUpdate({ id: snapshot.id, ...snapshot.data() });
      }
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error direct path room handler:", error);
  }
};

/**
 * Optimizes CollectionGroup fallback lookup.
 * Attempts direct path getDoc first; if empty, queries collection explicitly before attempting CollectionGroup fallback.
 */
export const fetchRoomWithSafeFallback = async (targetRoomId: string) => {
  if (!targetRoomId) return null;

  // 1. Direct path check in 'rooms' and 'chats'
  for (const col of ['rooms', 'chats']) {
    try {
      const directRoomRef = doc(db, col, targetRoomId);
      const directSnap = await getDoc(directRoomRef);

      if (directSnap.exists()) {
        return { id: directSnap.id, ...directSnap.data() };
      }
    } catch (err) {
      // Ignore transient error
    }
  }

  // 2. Jika Direct Path kosong, coba cari dengan query eksplisit sebelum kena CollectionGroup
  for (const col of ['rooms', 'chats']) {
    try {
      const colRef = collection(db, col);
      const q = query(colRef, where('roomId', '==', targetRoomId));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const foundDoc = querySnap.docs[0];
        return { id: foundDoc.id, ...foundDoc.data() };
      }
    } catch (err) {
      // Ignore query error
    }
  }

  return null;
};
