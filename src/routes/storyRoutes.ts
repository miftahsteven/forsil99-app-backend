import { Router } from 'express';
import { storyController } from '../controllers/storyController.js';
import { verifyBearerToken, optionalAuth, requireVerified } from '../middlewares/authMiddleware.js';

export const storyRoutes = Router();

storyRoutes.get('/', optionalAuth, storyController.getActiveStories);
storyRoutes.post('/', verifyBearerToken, requireVerified, storyController.createStory);
