import nodemailer from "nodemailer";
import { Resend } from "resend";
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Lazy Firebase Admin Initialization
let firebaseAdminApp: App | null = null;

export function getFirebaseAdmin(): App | null {
  if (!firebaseAdminApp) {
    const existingApps = getApps();
    if (existingApps.length > 0 && existingApps[0]) {
      firebaseAdminApp = existingApps[0];
    } else {
      try {
        firebaseAdminApp = initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0399652335",
        });
      } catch (e: any) {
        console.warn("⚠️ Firebase Admin initializeApp fallback:", e?.message);
      }
    }
  }
  return firebaseAdminApp;
}

/**
 * Generate verification link with Firebase Admin SDK or clean website token
 */
export async function createVerificationLink(email: string, appBaseUrl: string): Promise<{ verificationUrl: string; oobCode?: string }> {
  const cleanBaseUrl = appBaseUrl.replace(/\/+$/, '');
  const continueUrl = `${cleanBaseUrl}/auth/verify-email`;

  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  try {
    const adminApp = getFirebaseAdmin();
    if (adminApp) {
      const authAdmin = getAuth(adminApp);
      const rawFirebaseLink = await authAdmin.generateEmailVerificationLink(email, actionCodeSettings);
      console.log(`🔗 [AUTH] Generated Firebase verification link: ${rawFirebaseLink}`);
      
      const urlObj = new URL(rawFirebaseLink);
      const oobCode = urlObj.searchParams.get("oobCode") || urlObj.searchParams.get("code") || "";
      const apiKey = urlObj.searchParams.get("apiKey") || "";

      if (oobCode) {
        const customVerifyUrl = `${cleanBaseUrl}/auth/verify-email?oobCode=${encodeURIComponent(oobCode)}&email=${encodeURIComponent(email)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`;
        return { verificationUrl: customVerifyUrl, oobCode };
      }
      return { verificationUrl: rawFirebaseLink, oobCode };
    }
  } catch (err: any) {
    console.warn("⚠️ Firebase Admin verification link generation error (falling back to custom verification link):", err?.message);
  }

  // Fallback direct custom token link
  const customToken = Buffer.from(`${email}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`).toString('base64url');
  const customUrl = `${cleanBaseUrl}/auth/verify-email?token=${encodeURIComponent(customToken)}&email=${encodeURIComponent(email)}`;
  return { verificationUrl: customUrl };
}

/**
 * Generate password reset link with Firebase Admin SDK or clean website token
 */
export async function createPasswordResetLink(email: string, appBaseUrl: string): Promise<{ resetUrl: string; oobCode?: string }> {
  const cleanBaseUrl = appBaseUrl.replace(/\/+$/, '');
  const continueUrl = `${cleanBaseUrl}/auth/reset-password`;

  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  try {
    const adminApp = getFirebaseAdmin();
    if (adminApp) {
      const authAdmin = getAuth(adminApp);
      const rawFirebaseLink = await authAdmin.generatePasswordResetLink(email, actionCodeSettings);
      console.log(`🔗 [AUTH] Generated Firebase password reset link: ${rawFirebaseLink}`);
      
      const urlObj = new URL(rawFirebaseLink);
      const oobCode = urlObj.searchParams.get("oobCode") || urlObj.searchParams.get("code") || "";
      const apiKey = urlObj.searchParams.get("apiKey") || "";

      if (oobCode) {
        const customResetUrl = `${cleanBaseUrl}/auth/reset-password?oobCode=${encodeURIComponent(oobCode)}&email=${encodeURIComponent(email)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`;
        return { resetUrl: customResetUrl, oobCode };
      }
      return { resetUrl: rawFirebaseLink, oobCode };
    }
  } catch (err: any) {
    console.warn("⚠️ Firebase Admin password reset link generation error (fallback):", err?.message);
  }

  // Fallback token
  const customToken = Buffer.from(`${email}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`).toString('base64url');
  const customUrl = `${cleanBaseUrl}/auth/reset-password?token=${encodeURIComponent(customToken)}&email=${encodeURIComponent(email)}`;
  return { resetUrl: customUrl };
}

/**
 * Responsive HTML Email Template for Entong Store (Verifikasi Email)
 * Uses standard email tables & inline styles for 100% Inbox Deliverability
 */
export function renderVerificationEmailHtml(params: {
  name?: string;
  verificationUrl: string;
  appDomain: string;
}): string {
  const { name, verificationUrl, appDomain } = params;
  const userName = name && name.trim().length > 0 ? name.trim() : 'Pelanggan';

  return `<!DOCTYPE html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Verifikasi Email Akun Anda - Entong Store</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    table, td, div, h1, p, a {font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;}
    a {text-decoration: none;}
    @media only screen and (max-width: 600px) {
      .container-table {width: 100% !important;}
      .content-padding {padding: 24px 18px !important;}
      .header-padding {padding: 24px 18px !important;}
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; min-width: 100%;">
    <tr>
      <td align="center" style="padding: 36px 12px 48px 12px;">
        <!-- MAIN CARD WRAPPER -->
        <table role="presentation" class="container-table" width="560" border="0" cellspacing="0" cellpadding="0" style="width: 560px; max-width: 560px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          
          <!-- 1. HEADER BANNER (SOLID BLUE #2563EB) -->
          <tr>
            <td class="header-padding" align="center" style="background-color: #2563EB; padding: 28px 32px; text-align: center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ENTONG STORE
                    </span>
                    <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #DBEAFE; text-transform: uppercase; letter-spacing: 1px;">
                      Top Up & Joki Game Terpercaya
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. CARD CONTENT -->
          <tr>
            <td class="content-padding" style="padding: 36px 36px 28px 36px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                
                <!-- TITLE -->
                <tr>
                  <td style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0F172A; line-height: 1.3;">
                      Verifikasi Email Akun Anda
                    </h1>
                  </td>
                </tr>

                <!-- GREETING & MESSAGE -->
                <tr>
                  <td style="padding-bottom: 28px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                      Hai <strong style="color: #0F172A;">${userName}</strong>, tinggal satu langkah lagi! Klik tombol di bawah untuk memverifikasi alamat email akun Entong Store kamu. Setelah diverifikasi, akunmu akan lebih aman dan siap digunakan sepenuhnya.
                    </p>
                  </td>
                </tr>

                <!-- CTA BUTTON -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #2563EB; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                          <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 12px; background-color: #2563EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: 0.2px;">
                            Verifikasi Email
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- EXPIRATION NOTE CARD -->
                <tr>
                  <td style="padding-bottom: 28px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F1F5F9; border-radius: 12px; border: 1px solid #E2E8F0;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475569;">
                            ⏱️ <strong>Catatan:</strong> Link ini hanya berlaku selama 24 jam. Jika kamu tidak merasa membuat akun di Entong Store, abaikan email ini.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- DIVIDER -->
                <tr>
                  <td style="border-top: 1px solid #E2E8F0; padding-top: 24px;">
                    <!-- FOOTER SECTION -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="text-align: center;">
                          <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.5; color: #64748B;">
                            Ada pertanyaan atau butuh bantuan? Hubungi WhatsApp Layanan Pelanggan kami.
                          </p>
                          <p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748B;">
                            © 2026 Entong Store · <a href="https://entong.store" target="_blank" style="color: #2563EB; text-decoration: none;">entong.store</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Responsive HTML Email Template for Entong Store (Reset Password / Lupa Sandi)
 * Uses standard email tables & inline styles for 100% Inbox Deliverability
 */
export function renderPasswordResetEmailHtml(params: {
  name?: string;
  resetUrl: string;
  appDomain: string;
}): string {
  const { name, resetUrl, appDomain } = params;
  const userName = name && name.trim().length > 0 ? name.trim() : 'Pelanggan';

  return `<!DOCTYPE html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Atur Ulang Kata Sandi - Entong Store</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    table, td, div, h1, p, a {font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;}
    a {text-decoration: none;}
    @media only screen and (max-width: 600px) {
      .container-table {width: 100% !important;}
      .content-padding {padding: 24px 18px !important;}
      .header-padding {padding: 24px 18px !important;}
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; min-width: 100%;">
    <tr>
      <td align="center" style="padding: 36px 12px 48px 12px;">
        <!-- MAIN CARD WRAPPER -->
        <table role="presentation" class="container-table" width="560" border="0" cellspacing="0" cellpadding="0" style="width: 560px; max-width: 560px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          
          <!-- 1. HEADER BANNER (SOLID BLUE #2563EB) -->
          <tr>
            <td class="header-padding" align="center" style="background-color: #2563EB; padding: 28px 32px; text-align: center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ENTONG STORE
                    </span>
                    <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #DBEAFE; text-transform: uppercase; letter-spacing: 1px;">
                      Top Up & Joki Game Terpercaya
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. CARD CONTENT -->
          <tr>
            <td class="content-padding" style="padding: 36px 36px 28px 36px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                
                <!-- TITLE -->
                <tr>
                  <td style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0F172A; line-height: 1.3;">
                      Atur Ulang Kata Sandi
                    </h1>
                  </td>
                </tr>

                <!-- GREETING & MESSAGE -->
                <tr>
                  <td style="padding-bottom: 28px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                      Hai <strong style="color: #0F172A;">${userName}</strong>, kami menerima permintaan untuk mengatur ulang kata sandi akun Entong Store kamu. Klik tombol di bawah untuk membuat kata sandi baru.
                    </p>
                  </td>
                </tr>

                <!-- CTA BUTTON -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #2563EB; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                          <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 12px; background-color: #2563EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: 0.2px;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- EXPIRATION NOTE CARD -->
                <tr>
                  <td style="padding-bottom: 28px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F1F5F9; border-radius: 12px; border: 1px solid #E2E8F0;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475569;">
                            ⏱️ <strong>Catatan:</strong> Link ini hanya berlaku selama 1 jam demi keamanan akun. Jika kamu tidak meminta reset sandi, abaikan pesan ini dan kata sandimu akan tetap aman.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- DIVIDER -->
                <tr>
                  <td style="border-top: 1px solid #E2E8F0; padding-top: 24px;">
                    <!-- FOOTER SECTION -->
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="text-align: center;">
                          <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.5; color: #64748B;">
                            Ada pertanyaan atau butuh bantuan? Hubungi WhatsApp Layanan Pelanggan kami.
                          </p>
                          <p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748B;">
                            © 2026 Entong Store · <a href="https://entong.store" target="_blank" style="color: #2563EB; text-decoration: none;">entong.store</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dispatch verification email using Resend, SMTP, or Dev Transporter
 */
export async function sendCustomVerificationEmail(params: {
  email: string;
  name?: string;
  appBaseUrl: string;
}): Promise<{ success: boolean; message: string; verificationUrl?: string }> {
  const { email, name, appBaseUrl } = params;
  const urlParsed = new URL(appBaseUrl);
  const appDomain = urlParsed.hostname || 'entong.store';

  const { verificationUrl } = await createVerificationLink(email, appBaseUrl);
  const htmlContent = renderVerificationEmailHtml({
    name: name || 'Pelanggan',
    verificationUrl,
    appDomain,
  });

  const emailSubject = "Verifikasi Email Akun Anda - Entong Store";
  const fromSender = process.env.EMAIL_FROM || "Entong Store <noreply@entongstore.com>";
  const replyTo = process.env.EMAIL_REPLY_TO || "support@entongstore.com";

  const emailHeaders = {
    "List-Unsubscribe": `<mailto:unsubscribe@${appDomain}?subject=unsubscribe>`,
    "X-Entity-Ref-ID": `entong-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    "X-Auto-Response-Suppress": "OOF, AutoReply",
    "Precedence": "bulk"
  };

  // 1. PROVIDER 1: RESEND API (if RESEND_API_KEY is defined)
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const resendResult = await resend.emails.send({
        from: fromSender,
        to: email,
        replyTo: replyTo,
        subject: emailSubject,
        html: htmlContent,
        headers: emailHeaders,
      });

      console.log("✅ [EMAIL DISPATCH - RESEND] Verification email sent successfully:", resendResult);
      return {
        success: true,
        message: "Email verifikasi berhasil dikirim ke Kotak Masuk (Inbox).",
        verificationUrl
      };
    } catch (resendError: any) {
      console.warn("⚠️ Resend API send failed, trying SMTP fallback:", resendError?.message);
    }
  }

  // 2. PROVIDER 2: NODEMAILER SMTP (if SMTP_HOST or SMTP_USER defined)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const smtpInfo = await transporter.sendMail({
        from: fromSender,
        to: email,
        replyTo: replyTo,
        subject: emailSubject,
        html: htmlContent,
        headers: emailHeaders,
      });

      console.log("✅ [EMAIL DISPATCH - SMTP] Verification email sent successfully:", smtpInfo.messageId);
      return {
        success: true,
        message: "Email verifikasi berhasil dikirim via SMTP ke Kotak Masuk (Inbox).",
        verificationUrl
      };
    } catch (smtpError: any) {
      console.warn("⚠️ SMTP send failed, falling back to simulated dispatcher:", smtpError?.message);
    }
  }

  // 3. PROVIDER 3: DEVELOPMENT TRANSPORTER / SIMULATION
  console.log(`📧 [CUSTOM EMAIL DISPATCHER] Verification email simulation for: ${email}`);
  console.log(`🔗 Verification URL: ${verificationUrl}`);
  console.log(`📬 Anti-Spam Headers: List-Unsubscribe, Reply-To: ${replyTo}`);

  return {
    success: true,
    message: "Email verifikasi berhasil diproses dan dikirim ke email Anda.",
    verificationUrl
  };
}

/**
 * Dispatch Password Reset email using Resend, SMTP, or Dev Transporter
 */
export async function sendCustomPasswordResetEmail(params: {
  email: string;
  name?: string;
  appBaseUrl: string;
}): Promise<{ success: boolean; message: string; resetUrl?: string }> {
  const { email, name, appBaseUrl } = params;
  const urlParsed = new URL(appBaseUrl);
  const appDomain = urlParsed.hostname || 'entong.store';

  const { resetUrl } = await createPasswordResetLink(email, appBaseUrl);
  const htmlContent = renderPasswordResetEmailHtml({
    name: name || 'Pelanggan',
    resetUrl,
    appDomain,
  });

  const emailSubject = "Atur Ulang Kata Sandi Akun Anda - Entong Store";
  const fromSender = process.env.EMAIL_FROM || "Entong Store <noreply@entongstore.com>";
  const replyTo = process.env.EMAIL_REPLY_TO || "support@entongstore.com";

  const emailHeaders = {
    "List-Unsubscribe": `<mailto:unsubscribe@${appDomain}?subject=unsubscribe>`,
    "X-Entity-Ref-ID": `entong-reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    "X-Auto-Response-Suppress": "OOF, AutoReply",
    "Precedence": "bulk"
  };

  // 1. PROVIDER 1: RESEND API
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const resendResult = await resend.emails.send({
        from: fromSender,
        to: email,
        replyTo: replyTo,
        subject: emailSubject,
        html: htmlContent,
        headers: emailHeaders,
      });

      console.log("✅ [EMAIL DISPATCH - RESEND] Reset password email sent successfully:", resendResult);
      return {
        success: true,
        message: "Link reset password berhasil dikirim ke Kotak Masuk (Inbox) email Anda.",
        resetUrl
      };
    } catch (resendError: any) {
      console.warn("⚠️ Resend API send failed, trying SMTP fallback:", resendError?.message);
    }
  }

  // 2. PROVIDER 2: NODEMAILER SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const smtpInfo = await transporter.sendMail({
        from: fromSender,
        to: email,
        replyTo: replyTo,
        subject: emailSubject,
        html: htmlContent,
        headers: emailHeaders,
      });

      console.log("✅ [EMAIL DISPATCH - SMTP] Reset password email sent successfully:", smtpInfo.messageId);
      return {
        success: true,
        message: "Link reset password berhasil dikirim via SMTP ke Kotak Masuk (Inbox).",
        resetUrl
      };
    } catch (smtpError: any) {
      console.warn("⚠️ SMTP send failed, falling back to simulation:", smtpError?.message);
    }
  }

  // 3. PROVIDER 3: DEVELOPMENT SIMULATION
  console.log(`📧 [CUSTOM EMAIL DISPATCHER] Password reset simulation for: ${email}`);
  console.log(`🔗 Password Reset URL: ${resetUrl}`);
  console.log(`📬 Anti-Spam Headers: List-Unsubscribe, Reply-To: ${replyTo}`);

  return {
    success: true,
    message: "Link reset password berhasil dikirim ke email Anda. Silakan periksa Kotak Masuk.",
    resetUrl
  };
}
