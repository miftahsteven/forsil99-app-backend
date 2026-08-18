import { Router } from 'express';
import { shopController } from '../controllers/shopController.js';
import { verifyBearerToken, optionalAuth, requireVerified } from '../middlewares/authMiddleware.js';
export const productRoutes = Router();
productRoutes.get('/', optionalAuth, shopController.getProducts);
productRoutes.get('/:id', optionalAuth, shopController.getProductById);
productRoutes.post('/', verifyBearerToken, requireVerified, shopController.createProduct);
productRoutes.put('/:id', verifyBearerToken, requireVerified, shopController.updateProduct);
productRoutes.delete('/:id', verifyBearerToken, requireVerified, shopController.deleteProduct);
