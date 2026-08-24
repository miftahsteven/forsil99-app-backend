import { Router } from 'express';
import { authController, loginSchema, registerSchema } from '../controllers/authController.js';
import { verifyBearerToken } from '../middlewares/authMiddleware.js';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimiter.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
export const authRoutes = Router();
// Secure Public Authentication Endpoints
authRoutes.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
authRoutes.post('/register', registerLimiter, validateBody(registerSchema), authController.register);
authRoutes.get('/me', verifyBearerToken, authController.getMe);
