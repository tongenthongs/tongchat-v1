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

const fallbackAvatar = (userId: number) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;

const fetchT = (url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

// ── Firestore persistent cache ────────────────────────────────────────────────
const FS_COLLECTION = 'robloxProfiles';
const FS_TTL = 7 * 24 * 60 * 60 * 1000;

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

// ── Method 1: Express proxy (same port, no CORS) ──────────────────────────────
const viaProxy = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchT(`/api/roblox-checker?username=${encodeURIComponent(username)}`, {}, 10000);
    if (!r.ok) {
      console.debug('[roblox] proxy status:', r.status);
      return null;
    }
    const j = await r.json() as any;
    if (j?.success && j?.data?.userId) {
      console.debug('[roblox] proxy success:', j.data.username);
      return j.data as RobloxProfile;
    }
    console.debug('[roblox] proxy returned no user:', j);
    return null;
  } catch (e) {
    console.debug('[roblox] proxy failed:', e);
    return null;
  }
};

// ── Method 2: Direct POST (works if CORS allowed) ─────────────────────────────
const viaDirect = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchT('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    }, 8000);
    if (!r.ok) {
      console.debug('[roblox] direct status:', r.status);
      if (r.status === 429) throw new Error('RATE_LIMITED');
      return null;
    }
    const data = await r.json() as any;
    const user = data?.data?.[0];
    if (!user?.id) {
      console.debug('[roblox] direct: user not found in response', data);
      return null;
    }
    let avatarUrl = fallbackAvatar(user.id);
    try {
      const tr = await fetchT(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`, {}, 5000);
      if (tr.ok) { const td = await tr.json() as any; if (td?.data?.[0]?.imageUrl) avatarUrl = td.data[0].imageUrl; }
    } catch { /**/ }
    console.debug('[roblox] direct success:', user.name);
    return { userId: user.id, username: user.name, displayName: user.displayName, avatarUrl };
  } catch (e: any) {
    console.debug('[roblox] direct failed:', e?.message);
    if (e?.message === 'RATE_LIMITED') throw e;
    return null;
  }
};

// ── Method 3: Search GET endpoint ─────────────────────────────────────────────
const viaSearch = async (username: string): Promise<RobloxProfile | null> => {
  try {
    const r = await fetchT(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=5`, {}, 8000);
    if (!r.ok) { console.debug('[roblox] search status:', r.status); return null; }
    const data = await r.json() as any;
    // find exact match case-insensitive
    const user = (data?.data || []).find((u: any) => u.name?.toLowerCase() === username.toLowerCase());
    if (!user?.id) { console.debug('[roblox] search: no exact match for', username); return null; }
    console.debug('[roblox] search success:', user.name);
    return { userId: user.id, username: user.name, displayName: user.displayName, avatarUrl: fallbackAvatar(user.id) };
  } catch (e) { console.debug('[roblox] search failed:', e); return null; }
};

// ── Method 4: Public CORS proxy as last resort ────────────────────────────────
const viaCorsProxy = async (username: string): Promise<RobloxProfile | null> => {
  const ROBLOX_API = 'https://users.roblox.com/v1/usernames/users';
  // Try multiple public CORS proxies
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(ROBLOX_API)}`,
    `https://corsproxy.io/?${encodeURIComponent(ROBLOX_API)}`,
  ];
  for (const proxyUrl of proxies) {
    try {
      const r = await fetchT(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      }, 8000);
      if (!r.ok) continue;
      const data = await r.json() as any;
      const user = data?.data?.[0];
      if (!user?.id) continue;
      console.debug('[roblox] cors-proxy success via', proxyUrl);
      return { userId: user.id, username: user.name, displayName: user.displayName, avatarUrl: fallbackAvatar(user.id) };
    } catch { continue; }
  }
  return null;
};

// ── Main ──────────────────────────────────────────────────────────────────────
export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const clean = username.trim().replace(/^@/, '');
  if (!clean || clean.length < 2) return null;
  const key = clean.toLowerCase();

  // 1. Memory cache
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL) {
    console.debug('[roblox] cache hit:', clean);
    return mem.profile;
  }

  // 2. Firestore + Proxy in parallel
  const [fsRes, proxyRes] = await Promise.allSettled([
    readFromFirestore(key),
    viaProxy(clean),
  ]);
  const fsProfile    = fsRes.status    === 'fulfilled' ? fsRes.value    : null;
  const proxyProfile = proxyRes.status === 'fulfilled' ? proxyRes.value : null;
  let profile = proxyProfile || fsProfile;
  console.debug('[roblox] fs:', !!fsProfile, 'proxy:', !!proxyProfile);

  // 3. Direct API
  if (!profile) {
    try { profile = await viaDirect(clean); }
    catch (e: any) {
      if (e?.message === 'RATE_LIMITED') {
        await new Promise(r => setTimeout(r, 1500));
        profile = await viaProxy(clean);
      }
    }
  }

  // 4. Search endpoint
  if (!profile) profile = await viaSearch(clean);

  // 5. Public CORS proxy last resort
  if (!profile) profile = await viaCorsProxy(clean);

  console.debug('[roblox] final result for', clean, ':', profile ? 'FOUND' : 'NOT FOUND');

  if (profile) {
    memCache.set(key, { profile, at: Date.now() });
    writeToFirestore(key, profile);
  }

  return profile;
};

export const clearRobloxCache = (username: string) => {
  memCache.delete(username.trim().toLowerCase());
};
