export interface RobloxProfile {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export const fetchRobloxProfile = async (username: string): Promise<RobloxProfile | null> => {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername || cleanUsername.length < 3) return null;

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
