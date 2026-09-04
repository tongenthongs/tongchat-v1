import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface RobloxProfile {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

// ── In-memory cache (session) ─────────────────────────────────────────────────
const memCache = new Map<string, { profile: RobloxProfile; at: number }>();
const MEM_TTL  = 10 * 60 * 1000; // 10 min

// ── Helpers ───────────────────────────────────────────────────────────────────
const fallbackAvatar = (userId: number) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;

const fetchWithTimeout = (url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

// ── Firestore cache ───────────────────────────────────────────────────────────
const FIRESTORE_COLLECTION = 'robloxProfiles';
const FIRESTORE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const readFromFirestore = async (key: string): Promise<RobloxProfile | null> => {
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, key));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    // Check if still fresh
    const cachedAt = data.cachedAt?.toMillis?.() ?? data.cachedAt ?? 0;
    if (Date.now() - cachedAt > FIRESTORE_TTL) return null;
    return {
      userId:      data.userId,
      username:    data.username,
      displayName: data.displayName,
      avatarUrl:   data.avatarUrl || fallbackAvatar(data.userId),
    };
  } catch {
    return null;
  }
};

const writeToFirestore = async (key: string, profile: RobloxProfile): Promise<void> => {
  try {
    await setDoc(doc(db, FIRESTORE_COLLECTION, key), {
      ...profile,
      cachedAt:  serverTimestamp(),
      updatedAt: new Date().toISOString(),
    });
  } catch { /* non-critical, ignore */ }
};

// ── Network fetchers ──────────────────────────────────────────────────────────

/** Via Express server proxy (server-side → no CORS) */
const viaProxy = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchWithTimeout(
      `/api/roblox-checker?username=${encodeURIComponent(username)}`, {}, 10000
    );
    if (!r.ok) return null;
    const j = await r.json() as any;
    if (j?.success && j?.data?.userId) return j.data as RobloxProfile;
    return null;
  } catch {
    return null;
  }
};

/** Direct Roblox API (may be blocked by CORS in some browsers) */
const viaDirect = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchWithTimeout('https://users.roblox.com/v1/usernames/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    }, 8000);
    if (!r.ok) {
      if (r.status === 429) throw new Error('RATE_LIMITED');
      return null;
    }
    const data = await r.json() as any;
    const user = data?.data?.[0];
    if (!user?.id) return null;

    // Fetch thumbnail (optional, silent fallback)
    let avatarUrl = fallbackAvatar(user.id);
    try {
      const tr = await fetchWithTimeout(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`,
        {}, 5000
      );
      if (tr.ok) {
        const td = await tr.json() as any;
        if (td?.data?.[0]?.imageUrl) avatarUrl = td.data[0].imageUrl;
      }
    } catch { /* keep fallback */ }

    return { userId: user.id, username: user.name, displayName: user.displayName, avatarUrl };
  } catch (e: any) {
    if (e?.message === 'RATE_LIMITED') throw e;
    return null;
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a Roblox profile with 3-layer caching:
 *   1. In-memory (session, 10 min)
 *   2. Firestore (persistent, 7 days) — works even without proxy
 *   3. Network (proxy → direct)
 * Results are saved back to both caches.
 */
export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const clean = username.trim().replace(/^@/, '');
  if (!clean || clean.length < 2) return null;
  const key = clean.toLowerCase();

  // 1. Memory cache
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL) return mem.profile;

  // 2. Firestore cache (fast, no CORS, persistent across sessions)
  const fs = await readFromFirestore(key);
  if (fs) {
    memCache.set(key, { profile: fs, at: Date.now() });
    return fs;
  }

  // 3. Network: try proxy first, then direct
  let profile: RobloxProfile | null = await viaProxy(clean);

  if (!profile) {
    try {
      profile = await viaDirect(clean);
    } catch (e: any) {
      if (e?.message === 'RATE_LIMITED') {
        await new Promise(r => setTimeout(r, 1500));
        profile = await viaProxy(clean);
      }
    }
  }

  if (profile) {
    // Save to both caches so future calls are instant
    memCache.set(key, { profile, at: Date.now() });
    writeToFirestore(key, profile); // async, non-blocking
  }

  return profile;
};

/** Force-refresh a profile (e.g. after username change) */
export const clearRobloxCache = (username: string) => {
  memCache.delete(username.trim().toLowerCase());
};
