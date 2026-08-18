import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { verifyBearerToken } from '../middlewares/authMiddleware.js';
export const notificationRoutes = Router();
notificationRoutes.get('/', verifyBearerToken, notificationController.getNotifications);
notificationRoutes.put('/read-all', verifyBearerToken, notificationController.markAllAsRead);
notificationRoutes.put('/:id/read', verifyBearerToken, notificationController.markAsRead);
notificationRoutes.post('/register-token', verifyBearerToken, notificationController.registerFcmToken);
