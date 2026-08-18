import { Router } from 'express';
import { verificationController } from '../controllers/verificationController.js';
import { verifyBearerToken, requireRole } from '../middlewares/authMiddleware.js';

export const verificationRoutes = Router();

verificationRoutes.post('/submit', verifyBearerToken, verificationController.submitVerification);
verificationRoutes.get('/status', verifyBearerToken, verificationController.getMyStatus);
verificationRoutes.get('/queue', verifyBearerToken, requireRole('admin', 'moderator'), verificationController.getQueue);
verificationRoutes.post('/:id/review', verifyBearerToken, requireRole('admin', 'moderator'), verificationController.reviewVerification);
