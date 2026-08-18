import { Router } from 'express';
import { eventController } from '../controllers/eventController.js';
import { verifyBearerToken, optionalAuth, requireVerified } from '../middlewares/authMiddleware.js';

export const eventRoutes = Router();

eventRoutes.get('/', optionalAuth, eventController.getEvents);
eventRoutes.post('/:id/rsvp', verifyBearerToken, requireVerified, eventController.rsvpEvent);
