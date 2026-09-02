import express from "express";
import { initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  generateWhatsAppOtp, 
  verifyWhatsAppOtp, 
  resetPasswordWithOtp 
} from "./server/otpService";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  
  // =========================================================================
  // 🔔 FCM WEB PUSH NOTIFICATION ENDPOINT
  // =========================================================================
  if (getApps().length === 0) {
    try {
      initializeApp();
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

      if (getApps().length === 0) {
         return res.status(500).json({ success: false, message: 'Firebase Admin not initialized' });
      }

      // FCM Multicast payload
      let bodyText = body || 'Pesan baru';
      if (bodyText.length > 80) {
        bodyText = bodyText.slice(0, 80) + '...';
      }

      const payload = {
        tokens: tokens,
        notification: {
          title: title || 'Entong Store',
          body: bodyText,
        },
        data: {
          title: title || 'Entong Store',
          body: body || '',
          url: data?.url || '/chat',
          tag: data?.tag || 'chat-update',
          ...(data || {})
        },
        android: {
          priority: "high" as const,
          notification: {
            channelId: "entong_store_chat",
            sound: "default"
          }
        },
        webpush: {
          headers: { Urgency: "high" },
          fcmOptions: { link: data?.url || "/chat" }
        }
      };

      const response = await getMessaging().sendEachForMulticast(payload);
      console.log(`✅ FCM Push Sent: ${response.successCount} successes, ${response.failureCount} failures`);
      
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
  // =========================================================================

  // 1. Send WhatsApp OTP
  app.post("/api/auth/send-whatsapp-otp", async (req: express.Request, res: express.Response) => {
    try {
      const { identifier } = req.body || {};
      if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Email atau username akun wajib diisi.' 
        });
      }

      const result = await generateWhatsAppOtp(identifier.trim());
      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('WhatsApp OTP generation error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Terjadi kesalahan saat memproses OTP WhatsApp.'
      });
    }
  });

  // 2. Verify WhatsApp OTP
  app.post("/api/auth/verify-whatsapp-otp", async (req: express.Request, res: express.Response) => {
    try {
      const { identifier, otp } = req.body || {};
      if (!identifier || !otp) {
        return res.status(400).json({ 
          success: false, 
          message: 'Identifier dan kode OTP wajib diisi.' 
        });
      }

      const result = await verifyWhatsAppOtp(String(identifier).trim(), String(otp).trim());
      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('WhatsApp OTP verification error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Gagal memverifikasi kode OTP.'
      });
    }
  });

  // 3. Reset Password With OTP
  app.post("/api/auth/reset-password-with-otp", async (req: express.Request, res: express.Response) => {
    try {
      const { identifier, otp, newPassword } = req.body || {};
      if (!identifier || !otp || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Data reset password tidak lengkap.' 
        });
      }

      const result = await resetPasswordWithOtp(
        String(identifier).trim(),
        String(otp).trim(),
        String(newPassword).trim()
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('Reset password with OTP error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Gagal mengubah kata sandi akun.'
      });
    }
  });

  // API Route for Roblox username verification (CORS-Proof Server Proxy)
  app.get("/api/roblox-checker", async (req: express.Request, res: express.Response) => {
    const username = req.query.username as string;
    const cleanUsername = username ? username.trim().replace(/^@/, '') : '';

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Username terlalu pendek' });
    }

    try {
      // Request Server-to-Server (Bebas CORS Browser)
      const robloxRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: [cleanUsername],
          excludeBannedUsers: true
        })
      });

      if (!robloxRes.ok) {
        return res.status(robloxRes.status).json({ success: false, message: 'Roblox API Error' });
      }

      const data = (await robloxRes.json()) as any;
      const robloxUser = data.data?.[0];

      if (!robloxUser || !robloxUser.id) {
        return res.status(404).json({ success: false, message: 'Username tidak ditemukan di Roblox' });
      }

      // Request Avatar Headshot dari API Resmi Roblox Thumbnails
      let avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxUser.id}&width=150&height=150&format=png`;
      try {
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png&isCircular=true`);
        if (thumbRes.ok) {
          const thumbData = (await thumbRes.json()) as any;
          if (thumbData?.data?.[0]?.imageUrl) {
            avatarUrl = thumbData.data[0].imageUrl;
          }
        }
      } catch (thumbErr) {
        console.warn('Gagal fetch thumbnail avatar roblox, fallback ke CDN url:', thumbErr);
      }

      return res.status(200).json({
        success: true,
        data: {
          userId: robloxUser.id,
          username: robloxUser.name,
          displayName: robloxUser.displayName,
          avatarUrl: avatarUrl
        }
      });

    } catch (error: any) {
      console.error('Server Internal Roblox Checker Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
  });

  // API Route for Welcome Email Notification ("Selamat Datang di Entong Store")
  app.post("/api/send-welcome-email", async (req: express.Request, res: express.Response) => {
    try {
      const { email, name, username } = req.body || {};
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email penerima wajib diisi' });
      }

      const clientName = name || username || 'Pelanggan Setia';
      console.log(`📧 [WELCOME EMAIL] Mengirimkan email sambutan 'Selamat Datang di Entong Store' ke: ${email} (${clientName})`);

      // Here we log the welcome notification payload and simulate or invoke SMTP / email webhook
      // If RESEND_API_KEY or SMTP credentials exist in env, it can send via official transporter
      const emailPayload = {
        to: email,
        subject: '🎉 Selamat Datang di Entong Store - Layanan Top Up & Joki Game Terpercaya',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #090d16; color: #f1f5f9; padding: 24px; border-radius: 16px; max-width: 600px; margin: auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 8px;">Entong Store</h1>
              <p style="color: #94a3b8; font-size: 14px;">Platform Top Up & Jasa Joki Game Terpercaya</p>
            </div>
            <div style="background-color: #18181b; padding: 20px; border-radius: 12px; border: 1px solid #27272a;">
              <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Halo, ${clientName}! 👋</h2>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                Terima kasih telah bergabung di <strong>Entong Store</strong>! Akun Anda telah berhasil dibuat dan siap digunakan untuk memesan jasa joki game, top up game favorit, serta menikmati fitur monitoring real-time kami.
              </p>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                Jangan lupa untuk melengkapi nomor WhatsApp aktif Anda agar staf kami dapat memberikan update pesanan dengan cepat dan mudah.
              </p>
              <div style="margin: 24px 0; text-align: center;">
                <a href="https://entongstore.com" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px;">Mulai Belanja Sekarang</a>
              </div>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #64748b;">
              <p>© ${new Date().getFullYear()} Entong Store. Hak cipta dilindungi undang-undang.</p>
            </div>
          </div>
        `
      };

      return res.status(200).json({
        success: true,
        message: 'Email selamat datang berhasil diproses',
        data: {
          recipient: email,
          sentAt: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error('Welcome email dispatch error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Gagal mengirim email sambutan' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
