import { Router } from 'express';
import { PublicCatalogController } from '@/services/catalog/modules/public/public.controller.js';

export const publicRouter = Router();

const controller = new PublicCatalogController();

publicRouter.get('/performers', controller.listPerformers);
publicRouter.get('/performers/:id', controller.getPerformer);
