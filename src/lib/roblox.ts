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
const MEM_TTL  = 10 * 60 * 1000; // 10 min

// ── Helpers ───────────────────────────────────────────────────────────────────
const fallbackAvatar = (userId: number) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;

// Fetch with AbortController timeout
const fetchT = (url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

// ── Firestore persistent cache ────────────────────────────────────────────────
const FS_COLLECTION = 'robloxProfiles';
const FS_TTL        = 7 * 24 * 60 * 60 * 1000; // 7 days

const readFromFirestore = async (key: string): Promise<RobloxProfile | null> => {
  try {
    const snap = await getDoc(doc(db, FS_COLLECTION, key));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    const at = d.cachedAt?.toMillis?.() ?? d.cachedAt ?? 0;
    if (Date.now() - at > FS_TTL) return null;
    return { userId: d.userId, username: d.username, displayName: d.displayName, avatarUrl: d.avatarUrl || fallbackAvatar(d.userId) };
  } catch { return null; }
};

const writeToFirestore = (key: string, p: RobloxProfile) => {
  setDoc(doc(db, FS_COLLECTION, key), { ...p, cachedAt: serverTimestamp(), updatedAt: new Date().toISOString() }).catch(() => {});
};

// ── Method 1: Express server proxy (same origin, no CORS) ─────────────────────
const viaProxy = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchT(`/api/roblox-checker?username=${encodeURIComponent(username)}`, {}, 8000);
    if (!r.ok) return null;
    const j = await r.json() as any;
    if (j?.success && j?.data?.userId) return j.data as RobloxProfile;
    return null;
  } catch { return null; }
};

// ── Method 2: Direct Roblox API (works when CORS not blocked) ─────────────────
const viaDirect = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchT('https://users.roblox.com/v1/usernames/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    }, 8000);
    if (!r.ok) { if (r.status === 429) throw new Error('RATE_LIMITED'); return null; }
    const data = await r.json() as any;
    const user = data?.data?.[0];
    if (!user?.id) return null;
    let avatarUrl = fallbackAvatar(user.id);
    try {
      const tr = await fetchT(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`, {}, 5000);
      if (tr.ok) { const td = await tr.json() as any; if (td?.data?.[0]?.imageUrl) avatarUrl = td.data[0].imageUrl; }
    } catch { /* keep fallback */ }
    return { userId: user.id, username: user.name, displayName: user.displayName, avatarUrl };
  } catch (e: any) { if (e?.message === 'RATE_LIMITED') throw e; return null; }
};

// ── Method 3: Roblox user search API (GET, different endpoint, less CORS issues) ──
const viaSearch = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchT(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`,
      {}, 8000
    );
    if (!r.ok) return null;
    const data = await r.json() as any;
    const user = data?.data?.[0];
    // Only accept exact match (case-insensitive)
    if (!user?.id || user.name.toLowerCase() !== username.toLowerCase()) return null;
    const avatarUrl = fallbackAvatar(user.id);
    return { userId: user.id, username: user.name, displayName: user.displayName, avatarUrl };
  } catch { return null; }
};

// ── Method 4: Roblox user by username via different endpoint ──────────────────
const viaUsernameEndpoint = async (username: string): Promise<RobloxProfile | null> => {
  try {
    // This endpoint sometimes has different CORS behavior
    const r = await fetchT(
      `https://www.roblox.com/users/profile/profileheader-json?username=${encodeURIComponent(username)}`,
      {}, 8000
    );
    if (!r.ok) return null;
    const data = await r.json() as any;
    const id = data?.UserId;
    const name = data?.Username;
    const displayName = data?.UserName || name;
    if (!id || !name) return null;
    return { userId: id, username: name, displayName, avatarUrl: fallbackAvatar(id) };
  } catch { return null; }
};

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Lookup Roblox profile with multiple fallback layers:
 * 1. Memory cache
 * 2. Firestore persistent cache (works offline/without proxy)
 * 3. Express proxy (/api/roblox-checker)
 * 4. Direct POST to users.roblox.com
 * 5. GET search endpoint
 * 6. Profile header endpoint
 */
export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const clean = username.trim().replace(/^@/, '');
  if (!clean || clean.length < 2) return null;
  const key = clean.toLowerCase();

  // 1. Memory cache (instant)
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL) return mem.profile;

  // 2. Firestore cache (fast, persistent, no CORS)
  // Run in parallel with proxy attempt to not block fast path
  const [fsResult, proxyResult] = await Promise.allSettled([
    readFromFirestore(key),
    viaProxy(clean),
  ]);

  const fsProfile  = fsResult.status  === 'fulfilled' ? fsResult.value  : null;
  const proxProfile = proxyResult.status === 'fulfilled' ? proxyResult.value : null;

  // Prefer proxy (freshest data), fall back to Firestore
  let profile = proxProfile || fsProfile;

  if (!profile) {
    // 3. Direct Roblox POST API
    try { profile = await viaDirect(clean); } catch (e: any) {
      if (e?.message === 'RATE_LIMITED') {
        await new Promise(r => setTimeout(r, 1500));
        profile = await viaProxy(clean);
      }
    }
  }

  if (!profile) {
    // 4. Search endpoint fallback
    profile = await viaSearch(clean);
  }

  if (!profile) {
    // 5. Profile header endpoint fallback
    profile = await viaUsernameEndpoint(clean);
  }

  if (profile) {
    memCache.set(key, { profile, at: Date.now() });
    writeToFirestore(key, profile); // non-blocking persist
  }

  return profile;
};

export const clearRobloxCache = (username: string) => {
  memCache.delete(username.trim().toLowerCase());
};
