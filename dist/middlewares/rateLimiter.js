import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
// High-capacity general API limiter (20,000 requests / 15 mins)
export const generalLimiter = rateLimit({
    windowMs: config.limits.rateLimitWindowMs,
    max: config.limits.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    message: {
        success: false,
        message: 'Trafik sangat tinggi. Silakan coba lagi setelah beberapa saat.',
    },
});
// Login Limiter: Only limits FAILED brute-force attempts.
// Legitimate successful logins are not counted, allowing 1,000+ simultaneous alumni
// to log in from the same NAT / Wi-Fi / Cellular network without being throttled.
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // max 30 failed login attempts per IP
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Terlalu banyak percobaan masuk gagal. Demi keamanan akun, silakan tunggu beberapa menit sebelum mencoba kembali.',
    },
});
// Register Limiter: Supports high-volume simultaneous registration
export const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Terlalu banyak pendaftaran dari jaringan ini. Silakan tunggu beberapa menit.',
    },
});
// Search Alumni Limiter: High throughput search for 1,000+ simultaneous users
export const searchAlumniLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 600, // max 600 queries per minute per IP
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
    max: 150, // max 150 posts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Batas pembuatan postingan per jam tercapai.',
    },
});
