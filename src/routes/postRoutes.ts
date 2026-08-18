import { Router } from 'express';
import { postController } from '../controllers/postController.js';
import { verifyBearerToken, optionalAuth, requireVerified } from '../middlewares/authMiddleware.js';
import { postCreationLimiter } from '../middlewares/rateLimiter.js';

export const postRoutes = Router();

postRoutes.get('/', optionalAuth, postController.getPosts);
postRoutes.post('/', verifyBearerToken, requireVerified, postCreationLimiter, postController.createPost);
postRoutes.get('/:id', optionalAuth, postController.getPostById);
postRoutes.put('/:id', verifyBearerToken, postController.updatePost);
postRoutes.delete('/:id', verifyBearerToken, postController.deletePost);

postRoutes.post('/:id/react', verifyBearerToken, postController.reactToPost);
postRoutes.get('/:id/comments', optionalAuth, postController.getComments);
postRoutes.post('/:id/comments', verifyBearerToken, requireVerified, postController.addComment);
