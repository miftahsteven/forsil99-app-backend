import { Router } from 'express';
import { shopController } from '../controllers/shopController.js';
import { verifyBearerToken, optionalAuth, requireVerified } from '../middlewares/authMiddleware.js';

export const shopRoutes = Router();

shopRoutes.get('/', optionalAuth, shopController.getShops);
shopRoutes.post('/', verifyBearerToken, requireVerified, shopController.createShop);
