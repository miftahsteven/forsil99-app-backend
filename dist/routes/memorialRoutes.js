import { Router } from 'express';
import { getDeceasedAlumni, getDeceasedAlumniById, giveFlower, getPrayers, submitPrayer, createDeceasedAlumni, deleteDeceasedAlumni, deletePrayer, } from '../controllers/memorialController.js';
import { verifyBearerToken, optionalAuth } from '../middlewares/authMiddleware.js';
export const memorialRoutes = Router();
// Public / Authenticated read endpoints
memorialRoutes.get('/', optionalAuth, getDeceasedAlumni);
memorialRoutes.get('/:id', optionalAuth, getDeceasedAlumniById);
memorialRoutes.get('/:id/prayers', optionalAuth, getPrayers);
// Protected action endpoints
memorialRoutes.post('/:id/flowers', verifyBearerToken, giveFlower);
memorialRoutes.post('/:id/prayers', verifyBearerToken, submitPrayer);
memorialRoutes.delete('/prayers/:prayerId', verifyBearerToken, deletePrayer);
memorialRoutes.post('/', verifyBearerToken, createDeceasedAlumni);
memorialRoutes.delete('/:id', verifyBearerToken, deleteDeceasedAlumni);
