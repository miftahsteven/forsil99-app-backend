import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { alumniRegistrationRoutes } from './alumniRegistrationRoutes.js';
import { profileRoutes } from './profileRoutes.js';
import { postRoutes } from './postRoutes.js';
import { storyRoutes } from './storyRoutes.js';
import { shopRoutes } from './shopRoutes.js';
import { productRoutes } from './productRoutes.js';
import { chatRoutes } from './chatRoutes.js';
import { eventRoutes } from './eventRoutes.js';
import { liveLocationRoutes } from './liveLocationRoutes.js';
import { notificationRoutes } from './notificationRoutes.js';
import { verificationRoutes } from './verificationRoutes.js';
import { reportRoutes } from './reportRoutes.js';
import { memorialRoutes } from './memorialRoutes.js';

export const apiRouter = Router();

// Health Check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Forsil 99 API',
    timestamp: new Date().toISOString(),
  });
});

// Mount Resource Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/alumni-registration', alumniRegistrationRoutes);
apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/posts', postRoutes);
apiRouter.use('/stories', storyRoutes);
apiRouter.use('/shops', shopRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/events', eventRoutes);
apiRouter.use('/live-locations', liveLocationRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/verification', verificationRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/memorial', memorialRoutes);
