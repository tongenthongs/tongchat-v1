import { MASKED_GAMER_NAMES, REAL_CATALOG_MAPPINGS, SLANG_REVIEW_TEMPLATES } from '../data/masterReviewsData';
import { formatRelativeTime } from './timeUtils';

export const isFictionalOrTemplateReview = (r: any): boolean => {
  if (!r) return false;
  
  // Explicitly allow authentic generated reviews and admin manual inputs
  if (
    r.source === 'review_generator' || 
    r.source === 'manual_input' || 
    r.source === 'gamer_slang_sync' ||
    r.isManualOrBot === true
  ) {
    return false;
  }

  if (
    r.isFiktif === true ||
    r.isDummy === true ||
    r.isFictional === true ||
    r.isFake === true ||
    r.type === 'fiktif' ||
    r.generatedBy === 'tools' ||
    (typeof r.userId === 'string' && r.userId.toLowerCase().startsWith('u-dummy'))
  ) {
    return true;
  }

  const comment = (r.comment || r.review || '').toString().trim().toUpperCase();
  if (
    comment.includes('SATSET. DUARR') ||
    comment.includes('DUARR') ||
    comment.includes('DVM (DRESS TO IMPRESS)')
  ) {
    return true;
  }

  return false;
};

// Generator for authentic gamer slang 5-star review
export const generateNaturalSlangReview = (customDateMillis?: number) => {
  const name = MASKED_GAMER_NAMES[Math.floor(Math.random() * MASKED_GAMER_NAMES.length)];
  const mapping = REAL_CATALOG_MAPPINGS[Math.floor(Math.random() * REAL_CATALOG_MAPPINGS.length)];
  const comment = SLANG_REVIEW_TEMPLATES[Math.floor(Math.random() * SLANG_REVIEW_TEMPLATES.length)];
  
  // Default to August 2026 within past 7 days
  const baseNow = customDateMillis || (new Date('2026-08-25T06:00:00.000Z').getTime() - Math.floor(Math.random() * 6 * 24 * 3600 * 1000) - Math.floor(Math.random() * 3600 * 1000 * 12));
  const isoDate = new Date(baseNow).toISOString();

  return {
    userName: name,
    customerName: name,
    rating: 5,
    comment,
    gameTitle: mapping.gameTitle,
    gameName: mapping.gameTitle,
    productName: mapping.productName,
    createdAt: isoDate,
    createdAtMillis: baseNow,
    helpfulCount: Math.floor(Math.random() * 25) + 5,
    isAnonymous: false
  };
};

const ID_MONTH_MAP: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, agt: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oct: 9, oktober: 9, october: 9,
  nov: 10, nop: 10, november: 10,
  des: 11, dec: 11, desember: 11, december: 11
};

export const parseIndonesianOrIsoDate = (val: string): number => {
  if (!val || typeof val !== 'string') return 0;
  const str = val.trim();
  if (!str) return 0;

  // 1. Standard ISO or English Date
  const directParse = new Date(str).getTime();
  if (!isNaN(directParse) && directParse > 0) {
    return directParse;
  }

  // 2. Format: "25 Agu 2026, 19.30" or "25 Agustus 2026 19:30:00"
  const textMonthRegex = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})(?:[,\s]+(\d{1,2})[:\.](\d{1,2})(?:[:\.](\d{1,2}))?)?/;
  const matchText = str.match(textMonthRegex);
  if (matchText) {
    const day = parseInt(matchText[1], 10);
    const mStr = matchText[2].toLowerCase();
    const year = parseInt(matchText[3], 10);
    const hour = matchText[4] ? parseInt(matchText[4], 10) : 0;
    const min = matchText[5] ? parseInt(matchText[5], 10) : 0;
    const sec = matchText[6] ? parseInt(matchText[6], 10) : 0;

    const monthIndex = ID_MONTH_MAP[mStr];
    if (monthIndex !== undefined && !isNaN(day) && !isNaN(year)) {
      const d = new Date(year, monthIndex, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  // 3. Format: "25/08/2026" or "25-08-2026 19:30"
  const numDateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2})[:\.](\d{1,2})(?:[:\.](\d{1,2}))?)?/;
  const matchNum = str.match(numDateRegex);
  if (matchNum) {
    const day = parseInt(matchNum[1], 10);
    const month = parseInt(matchNum[2], 10) - 1;
    const year = parseInt(matchNum[3], 10);
    const hour = matchNum[4] ? parseInt(matchNum[4], 10) : 0;
    const min = matchNum[5] ? parseInt(matchNum[5], 10) : 0;
    const sec = matchNum[6] ? parseInt(matchNum[6], 10) : 0;

    if (!isNaN(day) && month >= 0 && month <= 11 && !isNaN(year)) {
      const d = new Date(year, month, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  return 0;
};

export const getReviewTimestamp = (r: any): number => {
  if (!r) return 0;
  if (typeof r.createdAtMillis === 'number' && r.createdAtMillis > 0) {
    return r.createdAtMillis;
  }

  const val = r.createdAt ?? r.timestamp ?? r.date ?? r.reviewedAt ?? r.time;
  if (!val) return 0;

  if (typeof val?.toMillis === 'function') {
    try {
      const ms = val.toMillis();
      if (!isNaN(ms) && ms > 0) return ms;
    } catch {}
  }

  if (typeof val?.toDate === 'function') {
    try {
      const ms = val.toDate().getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    } catch {}
  }

  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    const sec = Number(val.seconds) || 0;
    const nano = Number(val.nanoseconds) || 0;
    return sec * 1000 + Math.floor(nano / 1000000);
  }

  if (typeof val === 'number') {
    return val > 1e11 ? val : val * 1000;
  }

  if (typeof val === 'string') {
    const parsed = parseIndonesianOrIsoDate(val);
    if (parsed > 0) return parsed;
  }

  return 0;
};

export const formatReviewDate = (dateVal: any): string => {
  const ms = getReviewTimestamp({ createdAt: dateVal });
  if (ms <= 0) return 'Baru saja';
  return formatRelativeTime(ms);
};

