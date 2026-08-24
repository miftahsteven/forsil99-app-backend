import { config } from '../config/index.js';

export async function verifyRecaptchaToken(token?: string, platform?: string): Promise<{ success: boolean; message?: string }> {
  // Mobile applications (Expo Android/iOS native app) do not send web reCAPTCHA tokens
  if (platform && !platform.startsWith('web') && platform !== 'unknown') {
    return { success: true };
  }

  // If no token provided on web
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, message: 'Harap selesaikan verifikasi reCAPTCHA ("Saya bukan robot").' };
  }

  try {
    const secret = config.recaptchaSecretKey;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`;

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data: any = await response.json();

    if (data.success) {
      return { success: true };
    }

    console.warn('[RECAPTCHA_VERIFY_FAILED]', data['error-codes'] || data);
    return { success: false, message: 'Verifikasi reCAPTCHA gagal. Silakan centang ulang.' };
  } catch (error) {
    console.error('[RECAPTCHA_ERROR]', error);
    // If Google reCAPTCHA server is momentarily unreachable, do not hard-block legitimate users
    return { success: true };
  }
}
