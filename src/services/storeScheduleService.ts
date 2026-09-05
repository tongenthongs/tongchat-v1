import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface BannerConfig {
  enabled: boolean;
  followStoreHours: boolean;
  openText: string;
  closedText: string;
  takeOrderText: string;
  openColor: string;   // 'green' | 'blue' | 'cyan' | 'emerald'
  closedColor: string; // 'red' | 'amber' | 'orange' | 'rose'
  emoji: string;
  scrolling: boolean;
}

export interface StoreScheduleConfig {
  isOpenManual: boolean;
  isAutoSchedule: boolean;
  openTime: string;
  activeChatTime: string;
  closeTime: string;
  customClosedNotice?: string;
  banner?: BannerConfig;
}

export const DEFAULT_BANNER: BannerConfig = {
  enabled: true,
  followStoreHours: true,
  openText: 'Toko sedang BUKA! Admin siap melayani pesanan kamu.',
  closedText: 'Toko sedang TUTUP. Buka kembali sesuai jam operasional.',
  takeOrderText: 'Take Order sudah dibuka! Silakan order via WhatsApp.',
  openColor: 'green',
  closedColor: 'amber',
  emoji: '🏪',
  scrolling: false,
};

export const DEFAULT_SCHEDULE: StoreScheduleConfig = {
  isOpenManual: true,
  isAutoSchedule: true,
  openTime: "11:00",
  activeChatTime: "15:00",
  closeTime: "23:00",
  customClosedNotice: "",
  banner: DEFAULT_BANNER,
};

export const getWIBCurrentTime = (): { currentHour: number; currentMinute: number; currentMinutesTotal: number } => {
  const now = new Date();
  const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const wibDate = new Date(wibString);
  const currentHour = wibDate.getHours();
  const currentMinute = wibDate.getMinutes();
  const currentMinutesTotal = currentHour * 60 + currentMinute;
  return { currentHour, currentMinute, currentMinutesTotal };
};

export const evaluateStoreStatus = (config: StoreScheduleConfig) => {
  const banner = { ...DEFAULT_BANNER, ...(config.banner || {}) };

  // Mode manual banner: followStoreHours OFF → banner selalu tampil pakai teks custom
  if (banner.followStoreHours === false) {
    return {
      isOpen: false,
      statusLabel: "PENGUMUMAN",
      phase: "MANUAL_BANNER",
      message: banner.closedText
    };
  }

  if (!config.isAutoSchedule) {
    return {
      isOpen: config.isOpenManual,
      statusLabel: config.isOpenManual ? "TOKO BUKA" : "TOKO TUTUP",
      phase: config.isOpenManual ? "OPEN" : "MANUAL_CLOSED",
      message: config.isOpenManual
        ? banner.openText
        : (config.customClosedNotice || banner.closedText)
    };
  }

  const { currentMinutesTotal } = getWIBCurrentTime();
  const [openH, openM] = config.openTime.split(":").map(Number);
  const [chatH, chatM] = config.activeChatTime.split(":").map(Number);
  const [closeH, closeM] = config.closeTime.split(":").map(Number);
  const openMinutes = openH * 60 + (openM || 0);
  const chatMinutes = chatH * 60 + (chatM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);

  if (currentMinutesTotal < openMinutes || currentMinutesTotal >= closeMinutes) {
    return {
      isOpen: false,
      statusLabel: "TOKO TUTUP",
      phase: "CLOSED",
      message: config.customClosedNotice || banner.closedText || `Toko sedang tutup. Buka pukul ${config.openTime} WIB.`
    };
  }

  if (currentMinutesTotal >= openMinutes && currentMinutesTotal < chatMinutes) {
    return {
      isOpen: true,
      statusLabel: "TAKE ORDER",
      phase: "TAKE_ORDER_ONLY",
      message: banner.takeOrderText || `Pesanan diterima! Admin mulai proses mulai ${config.activeChatTime} WIB.`
    };
  }

  return {
    isOpen: true,
    statusLabel: "TOKO BUKA",
    phase: "FULLY_ACTIVE",
    message: banner.openText || `Toko aktif melayani! Jam operasional s/d ${config.closeTime} WIB.`
  };
};

export const subscribeStoreSchedule = (onUpdate: (config: StoreScheduleConfig) => void) => {
  const scheduleDocRef = doc(db, "settings", "store_schedule");
  return onSnapshot(scheduleDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      onUpdate({
        ...DEFAULT_SCHEDULE,
        ...data,
        banner: { ...DEFAULT_BANNER, ...(data.banner || {}) },
      } as StoreScheduleConfig);
    } else {
      setDoc(scheduleDocRef, DEFAULT_SCHEDULE, { merge: true }).catch(console.warn);
      onUpdate(DEFAULT_SCHEDULE);
    }
  }, console.warn);
};

export const saveBannerConfig = async (banner: BannerConfig) => {
  await setDoc(doc(db, "settings", "store_schedule"), { banner }, { merge: true });
};

export const saveScheduleConfig = async (config: Partial<StoreScheduleConfig>) => {
  await setDoc(doc(db, "settings", "store_schedule"), config, { merge: true });
};
