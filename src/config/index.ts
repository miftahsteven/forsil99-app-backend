import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5001', 10),
  appName: process.env.APP_NAME || 'RUANG59 Backend API',

  databaseUrl: process.env.DATABASE_URL || 'postgresql://miftahsyarief@localhost:5432/ruanglixdb?schema=public',

  jwt: {
    secret: process.env.JWT_SECRET || 'RUANG59_SUPER_SECURE_JWT_SECRET_KEY_99_ALUMNI',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'ruang59-e9dde',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-ruang59@ruang59-e9dde.iam.gserviceaccount.com',
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || '325547457949-ep283f1bhl94uqdeufnnj71dbin91jpv.apps.googleusercontent.com',
  },

  limits: {
    imageUploadMaxBytes: parseInt(process.env.IMAGE_UPLOAD_MAX_BYTES || '12582912', 10), // 12MB
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
    authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100', 10),
  },
};
