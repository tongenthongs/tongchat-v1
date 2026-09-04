import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface RobloxProfile {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

// ── In-memory cache ───────────────────────────────────────────────────────────
const memCache = new Map<string, { profile: RobloxProfile; at: number }>();
const MEM_TTL = 10 * 60 * 1000; // 10 min

const fallbackAvatar = (userId: number) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;

// ── Firestore persistent cache ────────────────────────────────────────────────
const FS_COLLECTION = 'robloxProfiles';
const FS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const readFromFirestore = async (key: string): Promise<RobloxProfile | null> => {
  try {
    const snap = await getDoc(doc(db, FS_COLLECTION, key));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    const at = d.cachedAt?.toMillis?.() ?? d.cachedAt ?? 0;
    if (Date.now() - at > FS_TTL) return null;
    return {
      userId: d.userId,
      username: d.username,
      displayName: d.displayName,
      avatarUrl: d.avatarUrl || fallbackAvatar(d.userId),
    };
  } catch { return null; }
};

const writeToFirestore = (key: string, p: RobloxProfile) => {
  setDoc(doc(db, FS_COLLECTION, key), {
    ...p,
    cachedAt: serverTimestamp(),
    updatedAt: new Date().toISOString(),
  }).catch(() => {});
};

// ── Express server proxy (/api/roblox-checker) ────────────────────────────────
// This is the ONLY reliable path — the Express server (same origin as the app)
// proxies to Roblox server-side, bypassing all CORS restrictions.
// Works on production (www.entong.store) since node dist/server.cjs serves both.
const viaProxy = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetch(`/api/roblox-checker?username=${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      console.debug('[roblox] proxy status:', r.status, 'for', username);
      return null;
    }
    const j = await r.json() as any;
    if (j?.success && j?.data?.userId) {
      console.debug('[roblox] proxy found:', j.data.username);
      return j.data as RobloxProfile;
    }
    console.debug('[roblox] proxy: user not found -', username);
    return null;
  } catch (e) {
    console.debug('[roblox] proxy error:', e);
    return null;
  }
};

// ── Main exported function ────────────────────────────────────────────────────
/**
 * Lookup Roblox profile with 3-layer caching:
 * 1. In-memory (session, 10 min) — instant
 * 2. Firestore (persistent, 7 days) — fast, no CORS, survives page reload
 * 3. /api/roblox-checker proxy (server-side, no CORS) — network call
 *
 * After a successful proxy lookup, result is saved to both caches.
 */
export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const clean = username.trim().replace(/^@/, '');
  if (!clean || clean.length < 2) return null;
  const key = clean.toLowerCase();

  // 1. Memory cache (instant)
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL) {
    return mem.profile;
  }

  // 2. Firestore cache (fast, persistent)
  const fsProfile = await readFromFirestore(key);
  if (fsProfile) {
    memCache.set(key, { profile: fsProfile, at: Date.now() });
    return fsProfile;
  }

  // 3. Server proxy (only reliable network path on production)
  const profile = await viaProxy(clean);

  if (profile) {
    memCache.set(key, { profile, at: Date.now() });
    writeToFirestore(key, profile); // async, non-blocking
  }

  return profile;
};

export const clearRobloxCache = (username: string) => {
  memCache.delete(username.trim().toLowerCase());
};
