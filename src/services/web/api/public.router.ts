import { Router } from 'express';
import { PublicController } from '@/services/web/api/public.controller.js';

export const publicRouter = Router();

const controller = new PublicController();

publicRouter.get('/public/events', controller.events);
publicRouter.get('/public/events/:id', controller.event);
