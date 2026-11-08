import { Router } from 'express';
import { tiersController } from '@/container.js';

export const tiersRouter = Router();

tiersRouter.post('/events/:eventId/tiers', tiersController.create);
tiersRouter.get('/events/:eventId/tiers', tiersController.list);
tiersRouter.patch('/tiers/:tierId', tiersController.update);
tiersRouter.delete('/tiers/:tierId', tiersController.remove);
