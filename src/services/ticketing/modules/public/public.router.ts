import { Router } from 'express';
import { PublicEventsController } from '@/services/ticketing/modules/public/public.controller.js';

export const publicRouter = Router();

const publicEventsController = new PublicEventsController();

publicRouter.get('/events', publicEventsController.list);
publicRouter.get('/events/:id', publicEventsController.getById);
publicRouter.get('/events/:id/tiers', publicEventsController.listTiers);
