export interface RobloxProfile {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

const fallbackAvatar = (userId: number) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;

const fetchRobloxDirect = async (cleanUsername: string): Promise<RobloxProfile | null> => {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [cleanUsername], excludeBannedUsers: true })
  });
  if (!res.ok) return null;

  const data = await res.json() as any;
  const user = data?.data?.[0];
  if (!user || !user.id) return null;

  let avatarUrl = fallbackAvatar(user.id);
  try {
    const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=true`);
    if (thumbRes.ok) {
      const thumbData = await thumbRes.json() as any;
      if (thumbData?.data?.[0]?.imageUrl) avatarUrl = thumbData.data[0].imageUrl;
    }
  } catch {}

  return {
    userId: user.id,
    username: user.name,
    displayName: user.displayName,
    avatarUrl
  };
};

export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername || cleanUsername.length < 3) return null;

  // 1. Direct ke Roblox API (CORS-enabled, tidak bergantung pada server proxy).
  try {
    const direct = await fetchRobloxDirect(cleanUsername);
    if (direct) return direct;
  } catch (error) {
    console.warn('Direct Roblox fetch failed, fallback ke proxy:', error);
  }

  // 2. Fallback ke internal server proxy (berfungsi saat express server aktif, e.g. localhost).
  try {
    const res = await fetch(`/api/roblox-checker?username=${encodeURIComponent(cleanUsername)}`);
    if (!res.ok) return null;
    const result = await res.json();
    if (result.success && result.data) {
      return result.data as RobloxProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching internal roblox-checker:', error);
    return null;
  }
};
