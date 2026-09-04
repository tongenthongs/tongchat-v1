import type { VercelRequest, VercelResponse } from '@vercel/node';

const fallbackAvatar = (userId: number) =>
  `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers — allow same-origin and entong.store
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const username = (req.query.username as string) || '';
  const cleanUsername = username.trim().replace(/^@/, '');

  if (!cleanUsername || cleanUsername.length < 2) {
    return res.status(400).json({ success: false, message: 'Username terlalu pendek' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    let robloxRes: Response;
    try {
      robloxRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanUsername], excludeBannedUsers: false }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!robloxRes.ok) {
      if (robloxRes.status === 429) {
        return res.status(429).json({ success: false, message: 'Roblox rate limit, coba lagi sebentar' });
      }
      return res.status(robloxRes.status).json({ success: false, message: 'Roblox API Error' });
    }

    const data = (await robloxRes.json()) as any;
    const robloxUser = data.data?.[0];

    if (!robloxUser || !robloxUser.id) {
      return res.status(404).json({ success: false, message: 'Username tidak ditemukan di Roblox' });
    }

    // Fetch avatar thumbnail — fallback ke CDN URL kalau gagal
    let avatarUrl = fallbackAvatar(robloxUser.id);
    try {
      const thumbController = new AbortController();
      const thumbTimer = setTimeout(() => thumbController.abort(), 5000);
      const thumbRes = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png&isCircular=false`,
        { signal: thumbController.signal },
      );
      clearTimeout(thumbTimer);
      if (thumbRes.ok) {
        const thumbData = (await thumbRes.json()) as any;
        const img = thumbData?.data?.[0]?.imageUrl;
        if (img) avatarUrl = img;
      }
    } catch { /* keep fallback avatar */ }

    return res.status(200).json({
      success: true,
      data: {
        userId: robloxUser.id,
        username: robloxUser.name,
        displayName: robloxUser.displayName,
        avatarUrl,
      },
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'Roblox API timeout, coba lagi' });
    }
    console.error('Roblox Checker Serverless Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
}
