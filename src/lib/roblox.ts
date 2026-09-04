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

// ── Lookup result type ────────────────────────────────────────────────────────
// Distinguish the three real outcomes so callers never treat a transient
// server/network failure as "user does not exist".
//   'found'    → profile resolved
//   'notfound' → Roblox confirmed the username does not exist (404)
//   'error'    → proxy/network unreachable, result is unknown
export type LookupResult =
  | { status: 'found'; profile: RobloxProfile }
  | { status: 'notfound' }
  | { status: 'error' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Express server proxy (/api/roblox-checker) ────────────────────────────────
// The Express server (same origin as the app) proxies to Roblox server-side,
// bypassing all CORS restrictions. This is the primary path.
// Works on production (www.entong.store) since node dist/server.cjs serves both.
const viaProxyOnce = async (username: string): Promise<LookupResult> => {
  try {
    const r = await fetch(`/api/roblox-checker?username=${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json' },
    });

    // 404 = Roblox definitively says the user does not exist.
    if (r.status === 404) {
      console.debug('[roblox] proxy: user not found -', username);
      return { status: 'notfound' };
    }

    // Any other non-OK (429 rate limit, 5xx, 502 from dev/Vite fallback, etc.)
    // is a transient/unknown error — do NOT treat as "not found".
    if (!r.ok) {
      console.debug('[roblox] proxy status:', r.status, 'for', username);
      return { status: 'error' };
    }

    // Guard against Vite/dev returning index.html (HTML, not JSON) with 200.
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      console.debug('[roblox] proxy non-JSON response for', username);
      return { status: 'error' };
    }

    const j = (await r.json()) as any;
    if (j?.success && j?.data?.userId) {
      console.debug('[roblox] proxy found:', j.data.username);
      return { status: 'found', profile: j.data as RobloxProfile };
    }

    // success:false with an explicit not-found message.
    if (j?.success === false && /tidak ditemukan|not found/i.test(j?.message || '')) {
      return { status: 'notfound' };
    }

    return { status: 'error' };
  } catch (e) {
    console.debug('[roblox] proxy error:', e);
    return { status: 'error' };
  }
};

// Retry the proxy on transient errors before giving up.
const viaProxy = async (username: string): Promise<LookupResult> => {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await viaProxyOnce(username);
    if (res.status === 'found' || res.status === 'notfound') return res;
    if (attempt < MAX_ATTEMPTS) await sleep(400 * attempt); // 400ms, 800ms backoff
  }
  return { status: 'error' };
};

// ── Direct browser fallback ───────────────────────────────────────────────────
// Used ONLY when the proxy is unreachable (server down / network). Roblox APIs
// may block this via CORS, so it is best-effort. If it works it saves the day;
// if CORS blocks it, we fall through and the caller keeps the username as
// unverified (never a hard "not found").
const viaDirect = async (username: string): Promise<LookupResult> => {
  try {
    const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      signal: AbortSignal.timeout(8000),
    });
    if (!searchRes.ok) return { status: 'error' };
    const searchData = (await searchRes.json()) as any;
    const user = searchData?.data?.[0];
    if (!user?.id) return { status: 'notfound' };

    let avatarUrl = fallbackAvatar(user.id);
    try {
      const thumbRes = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (thumbRes.ok) {
        const thumbData = (await thumbRes.json()) as any;
        if (thumbData?.data?.[0]?.imageUrl) avatarUrl = thumbData.data[0].imageUrl;
      }
    } catch { /* keep fallback avatar */ }

    return {
      status: 'found',
      profile: {
        userId: user.id,
        username: user.name,
        displayName: user.displayName || user.name,
        avatarUrl,
      },
    };
  } catch (e) {
    console.debug('[roblox] direct fallback blocked/error:', e);
    return { status: 'error' };
  }
};

// ── Main exported function ────────────────────────────────────────────────────
/**
 * Lookup Roblox profile. Returns the profile if the username exists, or null
 * if it definitively does not (or cannot be resolved).
 *
 * Resolution order:
 * 1. In-memory cache (session, 10 min) — instant
 * 2. Firestore cache (persistent, 7 days) — fast, no CORS, survives reload
 * 3. /api/roblox-checker proxy (server-side, no CORS) — with retry
 * 4. Direct browser fallback (best-effort) — only if the proxy is unreachable
 *
 * IMPORTANT: negative results are NEVER cached. A transient proxy/server
 * failure must not permanently mark a valid username as "not found".
 * Use `lookupRobloxProfile` if you need to distinguish "not found" from
 * "could not verify".
 */
export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const res = await lookupRobloxProfile(username);
  return res.status === 'found' ? res.profile : null;
};

/**
 * Full lookup that preserves the distinction between a confirmed non-existent
 * username ('notfound') and an unverifiable one ('error'). UI should show a
 * hard error only for 'notfound', and a soft "could not verify" for 'error'.
 */
export const lookupRobloxProfile = async (username: string): Promise<LookupResult> => {
  const clean = username.trim().replace(/^@/, '');
  if (!clean || clean.length < 2) return { status: 'notfound' };
  const key = clean.toLowerCase();

  // 1. Memory cache (instant)
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL) {
    return { status: 'found', profile: mem.profile };
  }

  // 2. Firestore cache (fast, persistent)
  const fsProfile = await readFromFirestore(key);
  if (fsProfile) {
    memCache.set(key, { profile: fsProfile, at: Date.now() });
    return { status: 'found', profile: fsProfile };
  }

  // 3. Server proxy (primary network path, with retry)
  let res = await viaProxy(clean);

  // 4. If the proxy is unreachable (not a definitive 404), try the direct
  //    browser path as a best-effort fallback.
  if (res.status === 'error') {
    const direct = await viaDirect(clean);
    if (direct.status !== 'error') res = direct;
  }

  if (res.status === 'found') {
    memCache.set(key, { profile: res.profile, at: Date.now() });
    writeToFirestore(key, res.profile); // async, non-blocking
  }

  // Never cache 'notfound' or 'error' — allow immediate re-check.
  return res;
};

export const clearRobloxCache = (username: string) => {
  memCache.delete(username.trim().toLowerCase());
};
