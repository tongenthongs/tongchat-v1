export interface RobloxProfile {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

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

// ── In-memory cache (session only, no persistence) ───────────────────────────
const memCache = new Map<string, { profile: RobloxProfile; at: number }>();
const MEM_TTL = 10 * 60 * 1000; // 10 min

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Express server proxy (/api/roblox-checker) ────────────────────────────────
// The Express server (same origin as the app) proxies to Roblox server-side,
// bypassing all CORS restrictions. This is the only network path.
// Works on both dev (localhost:3000) and production (www.entong.store).
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

// ── Main exported function ────────────────────────────────────────────────────
/**
 * Lookup Roblox profile. Returns the profile if the username exists, or null
 * if it definitively does not (or cannot be resolved).
 *
 * Resolution order:
 * 1. In-memory cache (session, 10 min) — instant, no DB
 * 2. /api/roblox-checker proxy (server-side, no CORS) — with retry
 *
 * Negative results are NEVER cached. A transient proxy/server failure must not
 * permanently mark a valid username as "not found".
 * Use `lookupRobloxProfile` to distinguish "not found" from "could not verify".
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

  // 1. Memory cache (instant, session-only)
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL) {
    return { status: 'found', profile: mem.profile };
  }

  // 2. Server proxy (only reliable network path — no CORS, works in prod + dev)
  const res = await viaProxy(clean);

  if (res.status === 'found') {
    // Only cache successful lookups. Never cache notfound/error.
    memCache.set(key, { profile: res.profile, at: Date.now() });
  }

  return res;
};

export const clearRobloxCache = (username: string) => {
  memCache.delete(username.trim().toLowerCase());
};
