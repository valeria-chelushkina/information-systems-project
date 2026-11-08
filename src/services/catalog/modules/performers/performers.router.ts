import { Router } from 'express';
import { PerformersController } from '@/services/catalog/modules/performers/performers.controller.js';

export const performersRouter = Router();

const performersController = new PerformersController();

performersRouter.post('/performers', performersController.create);
performersRouter.get('/performers', performersController.list);
performersRouter.get('/performers/:id', performersController.getById);
