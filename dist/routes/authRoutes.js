import { Router } from 'express';
import { authController, loginSchema, registerSchema } from '../controllers/authController.js';
import { verifyBearerToken } from '../middlewares/authMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
export const authRoutes = Router();
authRoutes.post('/login', authLimiter, validateBody(loginSchema), authController.login);
authRoutes.post('/register', authLimiter, validateBody(registerSchema), authController.register);
authRoutes.get('/me', verifyBearerToken, authController.getMe);
