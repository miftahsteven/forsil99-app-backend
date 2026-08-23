import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter object using SMTP transport
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true' || (process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

const transporter = nodemailer.createTransport(smtpConfig);

const senderAddress = process.env.SMTP_FROM || `"Forsil99 - Alumni SMAN 59" <${process.env.SMTP_USER || 'admin@mscode.id'}>`;

function formatWaLink(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return `https://wa.me/${cleaned}`;
}

/**
 * Send email notification to the chosen alumni referral with complete applicant profile and 1-click actions
 * Uses CID inline attachments so Gmail NEVER clips the email (<102KB).
 */
export async function sendReferralRequestEmail(params: {
  referralEmail: string;
  referralName: string;
  applicantName: string;
  applicantNickname?: string | null;
  applicantClass: string;
  applicantWhatsapp: string;
  applicantEmail: string;
  applicantSelfieUrl?: string | null;
  registrationId: string;
  submittedAt?: Date | string;
}): Promise<boolean> {
  const {
    referralEmail,
    referralName,
    applicantName,
    applicantNickname,
    applicantClass,
    applicantWhatsapp,
    applicantEmail,
    applicantSelfieUrl,
    registrationId,
    submittedAt,
  } = params;

  if (!referralEmail) {
    console.warn('⚠️ [EmailService] Skipping referral email: No referral email provided.');
    return false;
  }

  const jwtSecret = process.env.JWT_SECRET || 'RUANG59_SUPER_SECURE_JWT_SECRET_KEY_99_ALUMNI_AUTHENTICATION_2026';
  const publicBaseUrl =
    process.env.PUBLIC_API_URL &&
    !process.env.PUBLIC_API_URL.includes('192.168') &&
    !process.env.PUBLIC_API_URL.includes('localhost')
      ? process.env.PUBLIC_API_URL
      : 'https://forsil99.mscode.id';

  // Generate secure action tokens valid for 14 days
  const approveToken = jwt.sign(
    { registrationId, action: 'approve', referralEmail, applicantName },
    jwtSecret,
    { expiresIn: '14d' }
  );

  const rejectToken = jwt.sign(
    { registrationId, action: 'reject', referralEmail, applicantName },
    jwtSecret,
    { expiresIn: '14d' }
  );

  const approveUrl = `${publicBaseUrl}/api/v1/alumni-registration/verify-email-action?token=${approveToken}&action=approve`;
  const rejectUrl = `${publicBaseUrl}/api/v1/alumni-registration/verify-email-action?token=${rejectToken}&action=reject`;
  const waUrl = formatWaLink(applicantWhatsapp);

  const attachments: any[] = [];
  let selfieHtml = '';

  // Extract base64 to CID attachment to keep HTML body tiny (<10KB) and prevent Gmail clipping
  if (applicantSelfieUrl && applicantSelfieUrl.startsWith('data:image')) {
    try {
      const commaIdx = applicantSelfieUrl.indexOf(',');
      if (commaIdx !== -1) {
        const rawBase64 = applicantSelfieUrl.slice(commaIdx + 1);
        const buffer = Buffer.from(rawBase64, 'base64');
        attachments.push({
          filename: 'selfie.jpg',
          content: buffer,
          cid: 'applicant_selfie_cid',
        });
        selfieHtml = `
          <div style="text-align: center; margin: 18px 0 22px;">
            <img src="cid:applicant_selfie_cid" alt="Foto Selfie Pendaftar" style="width: 130px; height: 130px; border-radius: 65px; object-fit: cover; border: 3px solid #2563EB; box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);" />
            <div style="font-size: 12px; color: #64748B; margin-top: 6px; font-weight: 600;">Foto Verifikasi Wajah Saat Registrasi</div>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Error creating selfie CID attachment:', e);
    }
  } else if (applicantSelfieUrl && (applicantSelfieUrl.startsWith('http://') || applicantSelfieUrl.startsWith('https://'))) {
    selfieHtml = `
      <div style="text-align: center; margin: 18px 0 22px;">
        <img src="${applicantSelfieUrl}" alt="Foto Selfie Pendaftar" style="width: 130px; height: 130px; border-radius: 65px; object-fit: cover; border: 3px solid #2563EB;" />
        <div style="font-size: 12px; color: #64748B; margin-top: 6px; font-weight: 600;">Foto Verifikasi Wajah Saat Registrasi</div>
      </div>
    `;
  }

  const dateStr = submittedAt
    ? new Date(submittedAt).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konfirmasi Referral Alumni</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; margin: 0; padding: 20px; color: #1E293B; }
        .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2); }
        .header { background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #2563EB 100%); padding: 30px 24px; text-align: center; color: #FFFFFF; }
        .header h1 { margin: 0 0 6px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 0; font-size: 13px; color: #93C5FD; }
        .content { padding: 26px 24px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0F172A; margin-bottom: 10px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 18px; }
        .applicant-card { background: #F8FAFC; border-radius: 12px; padding: 18px 20px; margin-bottom: 22px; border: 1px solid #E2E8F0; border-left: 5px solid #2563EB; }
        .card-title { font-size: 13px; font-weight: 700; color: #2563EB; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #64748B; font-weight: 500; }
        .value { color: #0F172A; font-weight: 700; text-align: right; }
        .btn-approve { display: block; background: #16A34A; color: #FFFFFF !important; font-size: 15px; font-weight: 700; padding: 15px 20px; text-decoration: none; border-radius: 10px; text-align: center; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); margin-bottom: 12px; }
        .btn-reject { display: block; background: #FFF5F5; color: #DC2626 !important; font-size: 14px; font-weight: 600; padding: 12px 20px; text-decoration: none; border-radius: 10px; text-align: center; border: 1px solid #FECACA; margin-bottom: 12px; }
        .btn-wa { display: inline-block; background: #25D366; color: #FFFFFF !important; font-size: 13px; font-weight: 700; padding: 8px 14px; text-decoration: none; border-radius: 6px; }
        .footer { background: #F8FAFC; padding: 16px 24px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>FORSIL 99</h1>
          <p>Forum Silaturahmi Alumni SMAN 59 Jakarta Angkatan 1999</p>
        </div>
        <div class="content">
          <div class="greeting">Halo ${referralName},</div>
          <div class="desc">
            Rekan alumni berikut baru saja mendaftar di aplikasi <strong>Ruang59 (Forsil 99)</strong> dan memilih Anda sebagai <strong>rekan referral (teman seangkatan)</strong> untuk memverifikasi keanggotaannya:
          </div>

          ${selfieHtml}

          <div class="applicant-card">
            <div class="card-title">📋 Profil Calon Anggota (Pendaftar)</div>
            
            <div class="info-row">
              <span class="label">Nama Lengkap:</span>
              <span class="value">${applicantName}</span>
            </div>

            ${
              applicantNickname
                ? `<div class="info-row">
                    <span class="label">Nama Panggilan / Alias:</span>
                    <span class="value">${applicantNickname}</span>
                  </div>`
                : ''
            }

            <div class="info-row">
              <span class="label">Kelas Terakhir di 59:</span>
              <span class="value">Kelas ${applicantClass} (Angkatan 1999)</span>
            </div>

            <div class="info-row">
              <span class="label">Nomor WhatsApp:</span>
              <span class="value">
                ${applicantWhatsapp}
                ${waUrl ? ` &nbsp;<a href="${waUrl}" class="btn-wa">Chat WA</a>` : ''}
              </span>
            </div>

            <div class="info-row">
              <span class="label">Email Akun Google:</span>
              <span class="value">${applicantEmail}</span>
            </div>

            <div class="info-row">
              <span class="label">Waktu Pendaftaran:</span>
              <span class="value" style="font-weight: 500; font-size: 13px; color: #475569;">${dateStr}</span>
            </div>
          </div>

          <div style="font-size: 14px; line-height: 1.5; text-align: center; font-weight: 600; color: #1E293B; margin-bottom: 18px;">
            Apakah Anda mengenal rekan di atas sebagai sesama alumni SMAN 59 Jakarta Angkatan 1999?
          </div>

          <div>
            <a href="${approveUrl}" class="btn-approve">
              ✅ YA, SAYA KENAL & SETUJUI PENDAFTARAN
            </a>
            <a href="${rejectUrl}" class="btn-reject">
              ❌ BUKAN ALUMNI 59 (TOLAK)
            </a>
          </div>

          <div style="text-align: center; font-size: 12px; color: #64748B; margin-top: 14px;">
            💡 <em>Anda juga dapat menyetujui langsung melalui menu Notifikasi di aplikasi mobile Forsil 99.</em>
          </div>
        </div>
        <div class="footer">
          Email ini dikirim secara otomatis oleh sistem verifikasi Forsil 99 SMAN 59 Jakarta.<br/>
          ID Pendaftaran: ${registrationId}
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('ℹ️ [EmailService] SMTP credentials not set in .env. Email content prepared for:', referralEmail);
      return true;
    }

    const info = await transporter.sendMail({
      from: senderAddress,
      to: referralEmail,
      subject: `[Forsil 99] Permintaan Konfirmasi Teman Angkatan: ${applicantName} (${applicantClass})`,
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log(`✅ [EmailService] Referral email sent successfully to ${referralEmail} (MessageId: ${info.messageId})`);
    return true;
  } catch (err: any) {
    console.error('❌ [EmailService] Error sending referral request email:', err.message || err);
    return false;
  }
}

/**
 * Send email notification when alumni registration is approved
 */
export async function sendRegistrationApprovedEmail(params: {
  toEmail: string;
  fullName: string;
  className: string;
}): Promise<boolean> {
  const { toEmail, fullName, className } = params;

  if (!toEmail) return false;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F172A; margin: 0; padding: 20px; color: #1E293B; }
        .card { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2); }
        .header { background: linear-gradient(135deg, #15803D 0%, #16A34A 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
        .header h1 { margin: 0 0 6px; font-size: 24px; font-weight: 800; }
        .content { padding: 26px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
        .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 16px; }
        .info-pill { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 14px; margin-bottom: 20px; text-align: center; font-weight: 600; color: #166534; }
        .footer { background: #F8FAFC; padding: 16px 24px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Selamat Datang di Forsil 99! 🎉</h1>
          <p>Pendaftaran Akun Alumni Anda Telah Disetujui</p>
        </div>
        <div class="content">
          <div class="greeting">Halo ${fullName},</div>
          <div class="desc">
            Kabar gembira! Permohonan pendaftaran akun Anda untuk <strong>Kelas ${className} (Angkatan 1999 SMAN 59 Jakarta)</strong> telah berhasil dikonfirmasi dan disetujui.
          </div>
          <div class="info-pill">
            ✅ Akun Anda kini aktif dengan akses penuh ke seluruh fitur Forsil 99
          </div>
          <div class="desc">
            Silakan buka aplikasi <strong>Ruang59</strong> di ponsel Anda dan masuk menggunakan akun Google (<strong>${toEmail}</strong>) untuk mulai berjejaring dengan teman-teman seangkatan.
          </div>
        </div>
        <div class="footer">
          Forum Silaturahmi Alumni SMAN 59 Jakarta Angkatan 1999
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('ℹ️ [EmailService] Approval email prepared for:', toEmail);
      return true;
    }

    await transporter.sendMail({
      from: senderAddress,
      to: toEmail,
      subject: `[Forsil 99] Selamat! Pendaftaran Alumni Anda Telah Disetujui 🎉`,
      html: htmlContent,
    });
    return true;
  } catch (err: any) {
    console.error('❌ [EmailService] Error sending approval email:', err.message || err);
    return false;
  }
}
