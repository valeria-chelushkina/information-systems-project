import { Router } from 'express';
import { VenuesController } from '@/services/catalog/modules/venues/venues.controller.js';

export const venuesRouter = Router();

const venuesController = new VenuesController();

venuesRouter.post('/venues', venuesController.create);
venuesRouter.get('/venues', venuesController.list);
venuesRouter.get('/venues/:id', venuesController.getById);
