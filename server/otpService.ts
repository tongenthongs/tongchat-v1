import { getFirebaseAdmin } from "./emailService";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

interface StoredOtpData {
  identifier: string;
  userId: string;
  email: string;
  phone: string;
  otp: string;
  status: 'pending' | 'used' | 'expired';
  createdAt: number;
  createdAtIso?: string;
  expiresAt: number;
  expiresAtIso?: string;
}

// In-memory OTP storage cache as high-speed fallback and synchronization
const otpCache = new Map<string, StoredOtpData>();

/**
 * Format phone number to clean WhatsApp international format (e.g. 0812... -> 62812..., +62812... -> 62812...)
 */
export function formatToWhatsAppNumber(rawPhone: string): string {
  let cleaned = String(rawPhone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  } else if (cleaned.startsWith('620')) {
    cleaned = '62' + cleaned.slice(3);
  }
  return cleaned;
}

/**
 * Send WhatsApp Message via external gateway (Fonnte / Wablas / Custom Webhook) with robust error handling
 */
export async function dispatchWhatsAppMessage(
  cleanPhone: string, 
  messageText: string
): Promise<{ success: boolean; gateway?: string; error?: string }> {
  const fonnteToken = process.env.FONNTE_TOKEN || process.env.FONNTE_API_KEY;
  const wablasToken = process.env.WABLAS_TOKEN;
  const wablasServer = process.env.WABLAS_SERVER || 'https://jogja.wablas.com';
  const customWaUrl = process.env.WHATSAPP_GATEWAY_URL;
  const customWaKey = process.env.WHATSAPP_API_KEY;

  // 1. Fonnte Gateway
  if (fonnteToken && fonnteToken.trim() !== '') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': fonnteToken.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: cleanPhone,
          message: messageText,
          countryCode: '62'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const resData = await res.json().catch(() => ({}));
      
      if (res.ok && (resData.status === true || resData.status === 'true' || resData.id)) {
        console.log(`✅ [FONNTE GATEWAY] Sukses mengirim OTP WhatsApp ke ${cleanPhone}`);
        return { success: true, gateway: 'fonnte' };
      } else {
        const errMsg = resData.reason || resData.message || `HTTP ${res.status}`;
        console.error(`❌ [FONNTE GATEWAY ERROR] Gagal mengirim ke ${cleanPhone}:`, errMsg);
        return { success: false, gateway: 'fonnte', error: errMsg };
      }
    } catch (err: any) {
      console.error(`❌ [FONNTE GATEWAY EXCEPTION]`, err?.message || err);
      return { success: false, gateway: 'fonnte', error: err?.message || 'Fonnte connection timeout' };
    }
  }

  // 2. Wablas Gateway
  if (wablasToken && wablasToken.trim() !== '') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const endpoint = `${wablasServer.replace(/\/$/, '')}/api/send-message`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': wablasToken.trim(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: messageText
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const resData = await res.json().catch(() => ({}));

      if (res.ok && resData.status === true) {
        console.log(`✅ [WABLAS GATEWAY] Sukses mengirim OTP WhatsApp ke ${cleanPhone}`);
        return { success: true, gateway: 'wablas' };
      } else {
        const errMsg = resData.message || `HTTP ${res.status}`;
        console.error(`❌ [WABLAS GATEWAY ERROR] Gagal mengirim ke ${cleanPhone}:`, errMsg);
        return { success: false, gateway: 'wablas', error: errMsg };
      }
    } catch (err: any) {
      console.error(`❌ [WABLAS GATEWAY EXCEPTION]`, err?.message || err);
      return { success: false, gateway: 'wablas', error: err?.message || 'Wablas connection timeout' };
    }
  }

  // 3. Custom Webhook Gateway
  if (customWaUrl && customWaUrl.trim() !== '') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(customWaUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customWaKey ? { 'Authorization': `Bearer ${customWaKey.trim()}` } : {})
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: messageText
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (res.ok) {
        console.log(`✅ [CUSTOM WA GATEWAY] Sukses mengirim OTP WhatsApp ke ${cleanPhone}`);
        return { success: true, gateway: 'custom' };
      } else {
        console.error(`❌ [CUSTOM WA GATEWAY ERROR] Status HTTP: ${res.status}`);
        return { success: false, gateway: 'custom', error: `HTTP ${res.status}` };
      }
    } catch (err: any) {
      console.error(`❌ [CUSTOM WA GATEWAY EXCEPTION]`, err?.message || err);
      return { success: false, gateway: 'custom', error: err?.message || 'Custom Gateway timeout' };
    }
  }

  // No external gateway active
  console.log(`ℹ️ [WHATSAPP OTP] Tidak ada gateway otomatis aktif. Menggunakan direct WhatsApp Link untuk ${cleanPhone}.`);
  return { success: true, gateway: 'direct_link' };
}

/**
 * Mask phone number for security display (e.g. 081234567890 -> 0812****7890)
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 7) return phone || '-';
  const start = phone.slice(0, 4);
  const end = phone.slice(-4);
  return `${start}••••${end}`;
}

/**
 * Find user profile by email or username in Firestore or Firebase Auth
 */
export async function findUserByIdentifier(rawIdentifier: string): Promise<{
  uid: string;
  email: string;
  username: string;
  name: string;
  phone: string;
} | null> {
  const cleanId = rawIdentifier.trim().toLowerCase();
  const adminApp = getFirebaseAdmin();

  if (adminApp) {
    try {
      const dbAdmin = getFirestore(adminApp);
      const usersRef = dbAdmin.collection('users');

      // 1. Query by email
      const byEmailSnap = await usersRef.where('email', '==', cleanId).limit(1).get();
      if (!byEmailSnap.empty) {
        const doc = byEmailSnap.docs[0];
        const data = doc.data();
        const phone = data.whatsappNumber || data.phone || data.whatsapp || data.noHp || '';
        return {
          uid: doc.id,
          email: data.email || cleanId,
          username: data.username || '',
          name: data.name || data.displayName || 'Pelanggan',
          phone: String(phone).trim()
        };
      }

      // 2. Query by usernameLower or username
      const byUserSnap = await usersRef.where('usernameLower', '==', cleanId).limit(1).get();
      if (!byUserSnap.empty) {
        const doc = byUserSnap.docs[0];
        const data = doc.data();
        const phone = data.whatsappNumber || data.phone || data.whatsapp || data.noHp || '';
        return {
          uid: doc.id,
          email: data.email || '',
          username: data.username || cleanId,
          name: data.name || data.displayName || 'Pelanggan',
          phone: String(phone).trim()
        };
      }

      const byUserDirect = await usersRef.where('username', '==', cleanId).limit(1).get();
      if (!byUserDirect.empty) {
        const doc = byUserDirect.docs[0];
        const data = doc.data();
        const phone = data.whatsappNumber || data.phone || data.whatsapp || data.noHp || '';
        return {
          uid: doc.id,
          email: data.email || '',
          username: data.username || cleanId,
          name: data.name || data.displayName || 'Pelanggan',
          phone: String(phone).trim()
        };
      }

      // 3. Fallback check Firebase Auth if identifier is email
      if (cleanId.includes('@')) {
        try {
          const authAdmin = getAuth(adminApp);
          const userRecord = await authAdmin.getUserByEmail(cleanId);
          if (userRecord) {
            // Check if user doc exists
            const userDocSnap = await usersRef.doc(userRecord.uid).get();
            const userData = userDocSnap.exists ? userDocSnap.data() : {};
            const phone = userData?.whatsappNumber || userData?.phone || userRecord.phoneNumber || '';
            return {
              uid: userRecord.uid,
              email: userRecord.email || cleanId,
              username: userData?.username || cleanId.split('@')[0],
              name: userData?.name || userRecord.displayName || 'Pelanggan',
              phone: String(phone).trim()
            };
          }
        } catch (_) {}
      }
    } catch (e: any) {
      console.warn("⚠️ Error querying user in Firebase Admin Firestore:", e?.message);
    }
  }

  return null;
}

/**
 * Generate 6-digit WhatsApp OTP and prepare WhatsApp message
 */
export async function generateWhatsAppOtp(identifier: string): Promise<{
  success: boolean;
  message?: string;
  maskedPhone?: string;
  rawPhone?: string;
  directWaUrl?: string;
  otp?: string;
  expiresInSeconds?: number;
}> {
  const cleanId = identifier.trim().toLowerCase();
  const user = await findUserByIdentifier(cleanId);

  if (!user) {
    return {
      success: false,
      message: "Akun tidak ditemukan. Pastikan email atau username yang Anda masukkan sudah benar."
    };
  }

  if (!user.phone || user.phone === '-' || user.phone.length < 6) {
    return {
      success: false,
      message: "Akun tidak ditemukan atau belum menautkan nomor WhatsApp. Hubungi admin untuk bantuan."
    };
  }

  // Generate 6 Digit Random OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const durationSeconds = 300; // 5 Menit
  const expiresAt = now + durationSeconds * 1000;

  const otpData: StoredOtpData = {
    identifier: cleanId,
    userId: user.uid,
    email: user.email,
    phone: user.phone,
    otp: otpCode,
    status: 'pending',
    createdAt: now,
    expiresAt: expiresAt
  };

  // Store in cache
  otpCache.set(cleanId, otpData);
  if (user.email) otpCache.set(user.email.toLowerCase(), otpData);
  if (user.username) otpCache.set(user.username.toLowerCase(), otpData);

  // Store in Firestore password_resets collection
  const adminApp = getFirebaseAdmin();
  if (adminApp) {
    try {
      const dbAdmin = getFirestore(adminApp);
      await dbAdmin.collection('password_resets').doc(user.uid).set({
        ...otpData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e: any) {
      console.warn("Failed saving password_resets doc in Firestore:", e?.message);
    }
  }

  const cleanWaNumber = formatToWhatsAppNumber(user.phone);
  const waMessage = `Halo dari Entong Store! Kode OTP reset password akun Anda adalah: *${otpCode}*. Jangan berikan kode ini kepada siapapun. Kode berlaku selama 5 menit.`;
  const directWaUrl = `https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(waMessage)}`;

  console.log(`📱 [WHATSAPP OTP DISPATCH] Generated OTP for ${user.email || user.username} (${cleanWaNumber}): ${otpCode}`);

  return {
    success: true,
    maskedPhone: maskPhoneNumber(user.phone),
    rawPhone: cleanWaNumber,
    directWaUrl: directWaUrl,
    otp: otpCode,
    expiresInSeconds: durationSeconds
  };
}

/**
 * Verify WhatsApp OTP code
 */
export async function verifyWhatsAppOtp(identifier: string, inputOtp: string): Promise<{
  success: boolean;
  message?: string;
  userId?: string;
}> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanOtp = inputOtp.trim();

  let stored = otpCache.get(cleanId);

  // If not found in cache, check Firestore
  if (!stored) {
    const adminApp = getFirebaseAdmin();
    if (adminApp) {
      try {
        const user = await findUserByIdentifier(cleanId);
        if (user) {
          const dbAdmin = getFirestore(adminApp);
          const snap = await dbAdmin.collection('password_resets').doc(user.uid).get();
          if (snap.exists) {
            stored = snap.data() as StoredOtpData;
          }
        }
      } catch (e: any) {
        console.warn("Firestore verify OTP lookup error:", e?.message);
      }
    }
  }

  if (!stored) {
    return {
      success: false,
      message: "Kode OTP tidak ditemukan atau sudah kedaluwarsa. Silakan kirim ulang OTP."
    };
  }

  if (Date.now() > stored.expiresAt) {
    return {
      success: false,
      message: "Kode OTP telah kedaluwarsa (berlaku 5 menit). Silakan kirim ulang OTP baru."
    };
  }

  if (stored.otp !== cleanOtp) {
    return {
      success: false,
      message: "Kode OTP yang Anda masukkan salah. Periksa kembali WhatsApp Anda."
    };
  }

  return {
    success: true,
    userId: stored.userId
  };
}

/**
 * Reset password using verified OTP
 */
export async function resetPasswordWithOtp(
  identifier: string,
  inputOtp: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const verifyRes = await verifyWhatsAppOtp(identifier, inputOtp);
  if (!verifyRes.success || !verifyRes.userId) {
    return {
      success: false,
      message: verifyRes.message || "Verifikasi OTP gagal."
    };
  }

  if (!newPassword || newPassword.trim().length < 8) {
    return {
      success: false,
      message: "Kata sandi baru minimal 8 karakter."
    };
  }

  const cleanPass = newPassword.trim();
  const uid = verifyRes.userId;
  const adminApp = getFirebaseAdmin();

  let updatedInAuth = false;
  if (adminApp) {
    try {
      const authAdmin = getAuth(adminApp);
      await authAdmin.updateUser(uid, {
        password: cleanPass
      });
      updatedInAuth = true;
      console.log(`🔐 [AUTH] Updated Firebase Auth password for uid: ${uid}`);
    } catch (e: any) {
      console.warn("Could not update Firebase Auth user password directly:", e?.message);
    }

    try {
      const dbAdmin = getFirestore(adminApp);
      await dbAdmin.collection('users').doc(uid).set({
        password: cleanPass,
        pass: cleanPass,
        pin: cleanPass,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Invalidate used OTP
      await dbAdmin.collection('password_resets').doc(uid).delete().catch(() => {});
    } catch (e: any) {
      console.warn("Could not update Firestore user doc password:", e?.message);
    }
  }

  // Clear from cache
  otpCache.delete(identifier.trim().toLowerCase());

  return {
    success: true,
    message: "Kata sandi berhasil diubah! Silakan login dengan kata sandi baru Anda."
  };
}
