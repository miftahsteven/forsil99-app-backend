import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

export const generalLimiter = rateLimit({
  windowMs: config.limits.rateLimitWindowMs,
  max: config.limits.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan dari IP ini. Silakan coba lagi setelah beberapa saat.',
  },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan masuk (login) gagal. Demi keamanan akun, silakan tunggu 15 menit sebelum mencoba kembali.',
  },
});

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 registrations per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak pendaftaran dari IP ini. Demi keamanan, silakan tunggu 15 menit.',
  },
});

export const searchAlumniLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // max 60 search queries per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Pencarian terlalu sering. Silakan tunggu beberapa detik.',
  },
});

export const authLimiter = loginLimiter;

export const postCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // max 60 posts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Batas pembuatan postingan per jam tercapai.',
  },
});
