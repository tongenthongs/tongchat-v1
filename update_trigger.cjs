const fs = require('fs');
let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

const replacement = `
  // Anti-spam throttling map
  const lastPushSentMap = new Map<string, { time: number, count: number }>();

  const triggerPushNotification = async (fcmToken: string | string[], title: string, body: string, data?: any) => {
    if (!fcmToken) return;
    const tokens = Array.isArray(fcmToken) ? fcmToken : [fcmToken];
    if (tokens.length === 0) return;

    // Throttling logic (anti-spam) per user/chat
    const throttleKey = tokens[0]; 
    const now = Date.now();
    const lastSent = lastPushSentMap.get(throttleKey);
    
    if (lastSent) {
      if (now - lastSent.time < 3000) {
        lastSent.count++;
        if (lastSent.count >= 3) {
           console.log('Push skipped to prevent spam.');
           return; // Skip if >= 3 messages within 3 seconds
        }
      } else {
        lastPushSentMap.set(throttleKey, { time: now, count: 1 });
      }
    } else {
      lastPushSentMap.set(throttleKey, { time: now, count: 1 });
    }

    try {
      // Use the local API route
      const payload = {
        tokens: tokens,
        title,
        body,
        data: data || {}
      };

      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log('Push notification response:', await response.json());
    } catch (err) {
      console.error('Failed to send push notification via API:', err);
    }
  };`;

content = content.replace(
  /const triggerPushNotification = async \(fcmToken: string, title: string, body: string, data\?: any\) => \{[\s\S]*?console\.error\('Failed to send push notification:', err\);\s*\}\s*\};\s*/,
  replacement
);

fs.writeFileSync('src/context/AppContext.tsx', content);
