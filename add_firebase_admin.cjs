const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Insert firebase-admin imports
content = content.replace(
  /import express from "express";/,
  `import express from "express";
import * as admin from "firebase-admin";`
);

// Insert initialization and push route
const pushRoute = `
  // =========================================================================
  // 🔔 FCM WEB PUSH NOTIFICATION ENDPOINT
  // =========================================================================
  if (admin.apps.length === 0) {
    try {
      admin.initializeApp();
      console.log('🔥 Server-side Firebase Admin Initialized for FCM');
    } catch (e) {
      console.error('Firebase Admin init error:', e);
    }
  }

  app.post("/api/send-push", async (req: express.Request, res: express.Response) => {
    try {
      const { tokens, title, body, data } = req.body || {};
      
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ success: false, message: 'No tokens provided' });
      }

      if (!admin.apps.length) {
         return res.status(500).json({ success: false, message: 'Firebase Admin not initialized' });
      }

      // FCM Multicast payload
      const payload = {
        notification: {
          title: title || 'Entong Store',
          body: body || 'Pesan baru'
        },
        data: data || {},
        tokens: tokens
      };

      const response = await admin.messaging().sendMulticast(payload);
      console.log(\`✅ FCM Push Sent: \${response.successCount} successes, \${response.failureCount} failures\`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Push notification sent',
        successCount: response.successCount,
        failureCount: response.failureCount
      });
    } catch (err: any) {
      console.error('FCM Send Error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Error sending push' });
    }
  });

  // =========================================================================
  // 📱 WHATSAPP OTP RESET PASSWORD ENDPOINTS (ENTONG STORE)
  // =========================================================================`;

content = content.replace(
  /\/\/ =========================================================================\s*\/\/ 📱 WHATSAPP OTP RESET PASSWORD ENDPOINTS \(ENTONG STORE\)\s*\/\/ =========================================================================/,
  pushRoute
);

fs.writeFileSync('server.ts', content);
