import { Router } from 'express';
import { postController } from '../controllers/postController.js';
import { verifyBearerToken, requireRole } from '../middlewares/authMiddleware.js';
import { prisma } from '../lib/prisma.js';

export const reportRoutes = Router();

reportRoutes.post('/', verifyBearerToken, postController.submitReport);

reportRoutes.get('/', verifyBearerToken, requireRole('admin', 'moderator'), async (req, res) => {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, reports });
});
