import { config } from '../config/index.js';

export async function verifyRecaptchaToken(
  token?: string,
  platform?: string,
  expectedAction?: string
): Promise<{ success: boolean; message?: string; score?: number }> {
  // Mobile applications (Expo Android/iOS native app) do not send web reCAPTCHA tokens
  if (platform && !platform.startsWith('web') && platform !== 'unknown') {
    return { success: true };
  }

  // If no token provided on web
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, message: 'Verifikasi keamanan reCAPTCHA v3 tidak valid. Silakan muat ulang halaman.' };
  }

  try {
    const secret = config.recaptchaSecretKey;
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data: any = await response.json();

    if (data.success) {
      // In reCAPTCHA v3, data contains score (0.0 to 1.0)
      if (typeof data.score === 'number' && data.score < 0.3) {
        console.warn('[RECAPTCHA_LOW_SCORE]', data.score, data.action);
        return { success: false, message: 'Tindakan terindikasi otomatis/bot oleh sistem keamanan reCAPTCHA.' };
      }
      return { success: true, score: data.score };
    }

    console.warn('[RECAPTCHA_VERIFY_FAILED]', data['error-codes'] || data);
    return { success: false, message: 'Verifikasi keamanan reCAPTCHA gagal. Silakan coba kembali.' };
  } catch (error) {
    console.error('[RECAPTCHA_ERROR]', error);
    // If Google reCAPTCHA server is momentarily unreachable, do not hard-block legitimate users
    return { success: true };
  }
}
