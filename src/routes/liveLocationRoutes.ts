import { Router } from 'express';
import { liveLocationController } from '../controllers/liveLocationController.js';
import { verifyBearerToken, optionalAuth, requireVerified } from '../middlewares/authMiddleware.js';

export const liveLocationRoutes = Router();

liveLocationRoutes.get('/', optionalAuth, liveLocationController.getLiveLocations);
liveLocationRoutes.post('/', verifyBearerToken, requireVerified, liveLocationController.updateLiveLocation);
