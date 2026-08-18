import { Router } from 'express';
import { profileController } from '../controllers/profileController.js';
import { verifyBearerToken, optionalAuth } from '../middlewares/authMiddleware.js';

export const profileRoutes = Router();

profileRoutes.get('/', optionalAuth, profileController.getProfiles);
profileRoutes.put('/me', verifyBearerToken, profileController.updateMyProfile);
profileRoutes.post('/:id/follow', verifyBearerToken, profileController.toggleFollow);
profileRoutes.get('/:id/follow-status', optionalAuth, profileController.getFollowStatus);
profileRoutes.get('/:id/followers', optionalAuth, profileController.getFollowers);
profileRoutes.get('/:id/following', optionalAuth, profileController.getFollowing);
profileRoutes.get('/:id', optionalAuth, profileController.getProfileById);
