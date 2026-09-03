import { getMessaging, isSupported } from 'firebase/messaging';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { 
  initializeFirestore, 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache
} from 'firebase/firestore';
import rawFirebaseConfig from '../../firebase-applet-config.json';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const rawConfig = (rawFirebaseConfig as any) || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || rawConfig.apiKey || "AIzaSyDmCGJvGPPh6SfpnW-S9xo-rkATNPpA1wY",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || "gen-lang-client-0399652335.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || "gen-lang-client-0399652335",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || "gen-lang-client-0399652335.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || "1090742753810",
  appId: env.VITE_FIREBASE_APP_ID || rawConfig.appId || "1:1090742753810:web:15f5933a6e6bb1d2a456cb",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || rawConfig.measurementId || ""
};

export const config = firebaseConfig;

// Safe Singleton App Initialization
let appInstance: any;
try {
  appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (e) {
  try {
    appInstance = getApp();
  } catch (err) {
    appInstance = initializeApp(firebaseConfig);
  }
}
const app = appInstance;

const dbId = rawConfig.firestoreDatabaseId || 'ai-studio-entongchat-013b89eb-39ec-4b7f-b986-33f58088ff28';
let dbInstance: any;

// Resolve safe local cache strategy for sandboxed/iframe environments
let cacheOption: any;
if (typeof window !== 'undefined') {
  try {
    cacheOption = persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: 50 * 1024 * 1024
    });
  } catch (e) {
    try {
      cacheOption = persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      });
    } catch (e2) {
      cacheOption = memoryLocalCache();
    }
  }
}

try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: cacheOption
  }, dbId);
} catch (e) {
  try {
    dbInstance = getFirestore(app, dbId);
  } catch (err) {
    try {
      dbInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache()
      });
    } catch (err2) {
      dbInstance = getFirestore(app);
    }
  }
}

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);

// Messaging safe initialization with SSR / unsupported protection
export let messaging: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      try {
        messaging = getMessaging(app);
      } catch (e) {
        console.warn('FCM Messaging init skipped:', e);
      }
    }
  }).catch((err) => {
    console.warn('FCM isSupported check notice:', err);
  });
}

if (typeof window !== 'undefined') {
  try {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Firebase setPersistence notice:', err?.message || err);
    });
  } catch (e) {
    console.warn('Firebase setPersistence exception:', e);
  }
}

export default app;

console.log("🔥 Universal Realtime Auto-Sync Engine Initialized (Entong Store)");

export { initializeAndSubscribeRoom, fetchRoomWithSafeFallback, ensureDirectRoomExists } from '../components/chat/roomManager';

// HELPER STRICT INITIAL CREATION TIMESTAMP PARSER (Entong Store Engine)
export const extractTimeMs = (docData: any): number => {
  if (!docData) return 0;
  if (typeof docData === 'number' && docData > 0) {
    return docData > 1000000000000 ? docData : docData * 1000;
  }
  if (typeof docData.toMillis === 'function') return docData.toMillis();
  if (typeof docData.toDate === 'function') return docData.toDate().getTime();

  const rawTime = docData.created_at || docData.createdAt || docData.timestamp || docData.updated_at || docData.updatedAt || docData.created || docData.updated || docData.orderTimestamp || docData.createdEpoch || docData.pureTime || docData.initialCreationTime || docData.createdTimestamp || docData.sortTime;
  
  if (!rawTime) {
    // Cek jika orderId mengandung timestamp numerik misal ORD-172365...
    if (typeof docData.orderId === 'string') {
      const match = docData.orderId.match(/\d{10,13}/);
      if (match) {
        const num = Number(match[0]);
        if (num > 1000000000000) return num;
        if (num > 1000000000) return num * 1000;
      }
    }
    if (typeof docData.id === 'string') {
      const match = docData.id.match(/\d{10,13}/);
      if (match) {
        const num = Number(match[0]);
        if (num > 1000000000000) return num;
        if (num > 1000000000) return num * 1000;
      }
    }
    return 0;
  }

  if (typeof rawTime.toMillis === 'function') return rawTime.toMillis();
  if (typeof rawTime.toDate === 'function') return rawTime.toDate().getTime();
  if (typeof rawTime === 'object' && typeof rawTime.seconds === 'number') return rawTime.seconds * 1000;
  if (typeof rawTime === 'number' && rawTime > 0) {
    return rawTime > 1000000000000 ? rawTime : rawTime * 1000;
  }
  const parsed = new Date(rawTime).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

export const getPureCreationTime = (data: any): number => {
  return extractTimeMs(data);
};

export const getInitialCreationTimestamp = (orderData: any): number => {
  return extractTimeMs(orderData);
};

// SEARCH ENGINE: Filter data berdasarkan multi-keyword
export const applySmartSearch = (orderList: any[], searchQuery: string) => {
  if (!searchQuery || !searchQuery.trim()) return orderList;

  // Pecah query pencarian menjadi array kata (lowercase)
  const searchKeywords = searchQuery.toLowerCase().trim().split(/\s+/);

  return orderList.filter((order) => {
    // Gabungkan seluruh data order menjadi satu string raksasa untuk dipindai
    const searchableText = `
      ${order.orderId || order.id || ''} 
      ${order.customerName || order.customer_name || ''} 
      ${order.robloxUsername || order.game_username || order.targetUsername || order.username || ''} 
      ${order.gamePaket || order.packageName || order.package_name || order.gameName || order.game_name || ''} 
      ${order.status || order.orderStatus || order.paymentStatus || ''}
      ${order.customer_phone || order.whatsapp || order.phone || ''}
      ${order.catatanWorker || order.note || ''}
    `.toLowerCase();

    // Pastikan SEMUA kata kunci pencarian ada di dalam searchableText (Murni per kalimat/kata)
    return searchKeywords.every(keyword => searchableText.includes(keyword));
  });
};

// HELPER SAFE TIMESTAMP PARSER UNTUK SORTING ORDERAN MUTLAK
export const getSafeTimestamp = (orderData: any): number => {
  return getInitialCreationTimestamp(orderData);
};

// AUTO-SYNC & AUTO-HEALING DOKUMEN USER FIRESTORE
export const syncUserToFirestore = async (authUser: any, customUsername?: string) => {
  if (!authUser?.uid) return null;

  try {
    const userRef = doc(db, 'users', authUser.uid);
    const userSnap = await getDoc(userRef);

    let userData = userSnap.exists() ? userSnap.data() : null;

    // Jika dokumen di Firestore belum ada (akun lama/Google login pertama kali), buatkan dokumennya
    if (!userSnap.exists()) {
      const generatedUsername = customUsername || authUser.displayName?.replace(/\s+/g, '').toLowerCase() || `user_${authUser.uid.substring(0, 6)}`;
      
      userData = {
        id: authUser.uid,
        uid: authUser.uid,
        name: authUser.displayName || generatedUsername,
        username: generatedUsername,
        usernameLower: generatedUsername.toLowerCase(),
        email: authUser.email || '',
        showPublicName: true,
        isBanned: false,
        mutedUntil: null,
        role: 'CUSTOMER',
        isStaff: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(userRef, userData, { merge: true });
    } else {
      const updates: any = { updatedAt: new Date().toISOString() };
      await updateDoc(userRef, updates);
      userData = { ...userData, ...updates };
    }

    return userData;
  } catch (err) {
    console.error("syncUserToFirestore error:", err);
    return null;
  }
};



