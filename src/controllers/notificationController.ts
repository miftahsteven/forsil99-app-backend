import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/paramHelper.js';

export const notificationController = {
  /**
   * GET /api/v1/notifications
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { recipientId: currentUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      notifications: notifications.map((n) => ({
        id: n.id,
        recipientId: n.recipientId,
        actorName: n.actorName || undefined,
        actorPhotoUrl: n.actorPhotoUrl || undefined,
        type: n.type,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  },

  /**
   * PUT /api/v1/notifications/:id/read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const currentUserId = req.user?.id;

    await prisma.notification.updateMany({
      where: {
        id,
        recipientId: currentUserId,
      },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Notifikasi ditandai telah dibaca.' });
  },

  /**
   * PUT /api/v1/notifications/read-all
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    await prisma.notification.updateMany({
      where: {
        recipientId: currentUserId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca.' });
  },

  /**
   * POST /api/v1/notifications/register-token
   */
  async registerFcmToken(req: Request, res: Response): Promise<void> {
    const currentUserId = req.user?.id;
    const { fcmToken } = req.body;

    if (!currentUserId || !fcmToken) {
      res.status(400).json({ success: false, message: 'FCM Token diperlukan.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (user && !user.fcmTokens.includes(fcmToken)) {
      await prisma.user.update({
        where: { id: currentUserId },
        data: {
          fcmTokens: { push: fcmToken },
        },
      });
    }

    res.json({ success: true, message: 'FCM Token berhasil didaftarkan.' });
  },
};
