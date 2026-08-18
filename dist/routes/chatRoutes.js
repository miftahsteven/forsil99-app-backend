import { Router } from 'express';
import { chatController } from '../controllers/chatController.js';
import { verifyBearerToken, requireVerified } from '../middlewares/authMiddleware.js';
export const chatRoutes = Router();
chatRoutes.get('/threads', verifyBearerToken, chatController.getThreads);
chatRoutes.post('/start', verifyBearerToken, requireVerified, chatController.startDirectChat);
chatRoutes.get('/threads/:id/messages', verifyBearerToken, chatController.getThreadMessages);
chatRoutes.post('/threads/:id/messages', verifyBearerToken, requireVerified, chatController.sendMessage);
