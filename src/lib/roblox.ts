export interface RobloxProfile {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

const fallbackAvatar = (userId: number) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;

// In-memory cache: username (lowercase) → { profile, cachedAt }
const profileCache = new Map<string, { profile: RobloxProfile; cachedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const fetchWithTimeout = (url: string, options: RequestInit = {}, ms = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const fetchRobloxDirect = async (cleanUsername: string): Promise<RobloxProfile | null> => {
  try {
    const res = await fetchWithTimeout('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // excludeBannedUsers: false so banned/restricted accounts are still found
      body: JSON.stringify({ usernames: [cleanUsername], excludeBannedUsers: false })
    }, 8000);

    if (!res.ok) {
      // 429 rate-limit: signal caller to retry via proxy
      if (res.status === 429) throw new Error('RATE_LIMITED');
      return null;
    }

    const data = await res.json() as any;
    const user = data?.data?.[0];
    if (!user || !user.id) return null;

    let avatarUrl = fallbackAvatar(user.id);
    try {
      const thumbRes = await fetchWithTimeout(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`,
        {}, 5000
      );
      if (thumbRes.ok) {
        const thumbData = await thumbRes.json() as any;
        if (thumbData?.data?.[0]?.imageUrl) avatarUrl = thumbData.data[0].imageUrl;
      }
    } catch { /* keep fallback avatar */ }

    return { userId: user.id, username: user.name, displayName: user.displayName, avatarUrl };
  } catch (err: any) {
    if (err?.message === 'RATE_LIMITED') throw err;
    return null;
  }
};

const fetchRobloxViaProxy = async (cleanUsername: string): Promise<RobloxProfile | null> => {
  try {
    const res = await fetchWithTimeout(
      `/api/roblox-checker?username=${encodeURIComponent(cleanUsername)}`,
      {}, 10000
    );
    if (!res.ok) return null;
    const result = await res.json() as any;
    if (result.success && result.data) return result.data as RobloxProfile;
    return null;
  } catch {
    return null;
  }
};

export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername || cleanUsername.length < 2) return null;

  const cacheKey = cleanUsername.toLowerCase();

  // Return from cache if still fresh
  const cached = profileCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.profile;
  }

  let profile: RobloxProfile | null = null;

  // 1. Try proxy first (server-side, no CORS issues, more reliable)
  profile = await fetchRobloxViaProxy(cleanUsername);

  // 2. Fallback to direct Roblox API if proxy fails/unavailable
  if (!profile) {
    try {
      profile = await fetchRobloxDirect(cleanUsername);
    } catch (err: any) {
      if (err?.message === 'RATE_LIMITED') {
        // Rate limited — wait 1s and retry once via proxy
        await new Promise(r => setTimeout(r, 1000));
        profile = await fetchRobloxViaProxy(cleanUsername);
      }
    }
  }

  // Store in cache if found
  if (profile) {
    profileCache.set(cacheKey, { profile, cachedAt: Date.now() });
  }

  return profile;
};

/** Clear cached entry for a username (call when you know the profile changed) */
export const clearRobloxCache = (username: string) => {
  profileCache.delete(username.trim().toLowerCase());
};
