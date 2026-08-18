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

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.limits.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak upaya login/registrasi. Demi keamanan, silakan tunggu 15 menit.',
  },
});

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
