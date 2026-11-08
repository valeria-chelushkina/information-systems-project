import { Router } from 'express';
import { TiersController } from '@/modules/tiers/tiers.controller.js';

export const tiersRouter = Router();

const tiersController = new TiersController();

tiersRouter.post('/events/:eventId/tiers', tiersController.create);
tiersRouter.get('/events/:eventId/tiers', tiersController.list);
tiersRouter.patch('/tiers/:tierId', tiersController.update);
tiersRouter.delete('/tiers/:tierId', tiersController.remove);
