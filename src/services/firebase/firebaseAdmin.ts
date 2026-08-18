import admin from 'firebase-admin';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';

let isFirebaseInitialized = false;
let googleAuthClient: OAuth2Client | null = null;

export function initFirebaseAdmin(): typeof admin | null {
  if (isFirebaseInitialized) return admin;

  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: config.firebase.projectId,
      });
      console.log('🔥 Firebase Admin SDK initialized successfully');
    }
    isFirebaseInitialized = true;
    return admin;
  } catch (err: any) {
    console.warn('⚠️ Firebase Admin SDK initialization warning:', err.message);
    return null;
  }
}

export function getGoogleOAuthClient(): OAuth2Client {
  if (!googleAuthClient) {
    googleAuthClient = new OAuth2Client(config.firebase.googleWebClientId);
  }
  return googleAuthClient;
}

/**
 * Verify Google ID Token from Mobile or Web App
 */
export async function verifyGoogleToken(idToken: string): Promise<{
  googleUid: string;
  email: string;
  name: string;
  picture?: string;
} | null> {
  // 1. Try Firebase Admin Auth
  try {
    const adminApp = initFirebaseAdmin();
    if (adminApp) {
      const decoded = await adminApp.auth().verifyIdToken(idToken);
      return {
        googleUid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || '',
        picture: decoded.picture,
      };
    }
  } catch (fbErr: any) {
    console.log('Firebase ID token verify attempt passed to Google Auth Library fallback:', fbErr.message);
  }

  // 2. Fallback: Google Auth Library verifyIdToken
  try {
    const client = getGoogleOAuthClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.firebase.googleWebClientId,
    });
    const payload = ticket.getPayload();
    if (payload) {
      return {
        googleUid: payload.sub,
        email: payload.email || '',
        name: payload.name || '',
        picture: payload.picture,
      };
    }
  } catch (gErr: any) {
    console.warn('Google token verification failed:', gErr.message);
  }

  return null;
}

/**
 * Send Push Notification via Firebase Cloud Messaging (FCM)
 */
export async function sendPushNotification(payload: {
  recipientId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  actorName?: string;
  actorPhotoUrl?: string;
  type: string;
}): Promise<boolean> {
  try {
    // 1. Store notification in PostgreSQL Database
    await prisma.notification.create({
      data: {
        recipientId: payload.recipientId,
        actorName: payload.actorName,
        actorPhotoUrl: payload.actorPhotoUrl,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        isRead: false,
        data: payload.data || {},
      },
    });

    // 2. Send FCM push to device tokens if registered
    const user = await prisma.user.findUnique({
      where: { id: payload.recipientId },
      select: { fcmTokens: true },
    });

    if (user && user.fcmTokens && user.fcmTokens.length > 0) {
      const adminApp = initFirebaseAdmin();
      if (adminApp) {
        const message: admin.messaging.MulticastMessage = {
          tokens: user.fcmTokens,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            type: payload.type,
            ...(payload.data || {}),
          },
        };
        await adminApp.messaging().sendEachForMulticast(message);
        console.log(`📲 Push notification sent to user ${payload.recipientId}`);
      }
    }
    return true;
  } catch (err: any) {
    console.warn('Push notification delivery warning:', err.message);
    return false;
  }
}
