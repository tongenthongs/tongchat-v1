import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface StoreScheduleConfig {
  isOpenManual: boolean;      // Override manual (Buka Paksa / Tutup Paksa)
  isAutoSchedule: boolean;    // Ikuti jam otomatis
  openTime: string;           // Contoh: "11:00" (Take order WA)
  activeChatTime: string;     // Contoh: "15:00" (Mulai balas web)
  closeTime: string;          // Contoh: "23:00" (Toko tutup)
  customClosedNotice?: string;// Pesan kustom jika ada
}

export const DEFAULT_SCHEDULE: StoreScheduleConfig = {
  isOpenManual: true,
  isAutoSchedule: true,
  openTime: "11:00",
  activeChatTime: "15:00",
  closeTime: "23:00",
  customClosedNotice: ""
};

// 1. Ambil Waktu Saat Ini dalam Zona Waktu WIB (Asia/Jakarta)
export const getWIBCurrentTime = (): { currentHour: number; currentMinute: number; currentMinutesTotal: number } => {
  const now = new Date();
  const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const wibDate = new Date(wibString);

  const currentHour = wibDate.getHours();
  const currentMinute = wibDate.getMinutes();
  const currentMinutesTotal = currentHour * 60 + currentMinute;

  return { currentHour, currentMinute, currentMinutesTotal };
};

// 2. Evaluasi Status Operasional Toko
export const evaluateStoreStatus = (config: StoreScheduleConfig) => {
  if (!config.isAutoSchedule) {
    return {
      isOpen: config.isOpenManual,
      statusLabel: config.isOpenManual ? "TOKO BUKA" : "TOKO TUTUP",
      phase: config.isOpenManual ? "OPEN" : "MANUAL_CLOSED",
      message: config.isOpenManual
        ? `Toko aktif melayani! (Manual Open)`
        : (config.customClosedNotice || `Toko sedang tutup sementara.`)
    };
  }

  const { currentMinutesTotal } = getWIBCurrentTime();

  const [openH, openM] = config.openTime.split(":").map(Number);
  const [chatH, chatM] = config.activeChatTime.split(":").map(Number);
  const [closeH, closeM] = config.closeTime.split(":").map(Number);

  const openMinutes = openH * 60 + (openM || 0);
  const chatMinutes = chatH * 60 + (chatM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);

  // Skenario 1: Sebelum jam 11:00 WIB (Toko Tutup)
  if (currentMinutesTotal < openMinutes || currentMinutesTotal >= closeMinutes) {
    return {
      isOpen: false,
      statusLabel: "TOKO TUTUP",
      phase: "CLOSED",
      message: `Toko sedang tutup. Buka kembali pukul ${config.openTime} - ${config.closeTime} WIB`
    };
  }

  // Skenario 2: Antara jam 11:00 - 15:00 WIB (Take Order Aktif, Proses Web Mulai 15:00)
  if (currentMinutesTotal >= openMinutes && currentMinutesTotal < chatMinutes) {
    return {
      isOpen: true,
      statusLabel: "TAKE ORDER",
      phase: "TAKE_ORDER_ONLY",
      message: `Pesanan diterima! Admin mulai login server & proses gift mulai pukul ${config.activeChatTime} WIB.`
    };
  }

  // Skenario 3: Jam 15:00 - 23:00 WIB (Aktif Melayani & Proses Pesanan)
  return {
    isOpen: true,
    statusLabel: "TOKO BUKA",
    phase: "FULLY_ACTIVE",
    message: `Toko aktif melayani! Jam operasional s/d ${config.closeTime} WIB.`
  };
};

// 3. Listener Realtime Dokumen Jadwal
export const subscribeStoreSchedule = (onUpdate: (config: StoreScheduleConfig) => void) => {
  const scheduleDocRef = doc(db, "settings", "store_schedule");
  return onSnapshot(scheduleDocRef, (snap) => {
    if (snap.exists()) {
      onUpdate({ ...DEFAULT_SCHEDULE, ...snap.data() } as StoreScheduleConfig);
    } else {
      // Inisialisasi awal jika dokumen belum ada
      setDoc(scheduleDocRef, DEFAULT_SCHEDULE, { merge: true }).catch((err) => {
        console.warn("Initial schedule set notice:", err);
      });
      onUpdate(DEFAULT_SCHEDULE);
    }
  }, (error) => {
    console.warn("store_schedule snapshot listener notice:", error);
  });
};
