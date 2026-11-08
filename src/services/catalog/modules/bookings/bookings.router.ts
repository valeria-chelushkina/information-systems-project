import { Router } from 'express';
import { BookingsController } from '@/services/catalog/modules/bookings/bookings.controller.js';

export const bookingsRouter = Router();

const bookingsController = new BookingsController();

bookingsRouter.post('/bookings', bookingsController.create);
bookingsRouter.get('/bookings', bookingsController.list);
bookingsRouter.get('/bookings/:id', bookingsController.getById);
bookingsRouter.patch('/bookings/:id', bookingsController.decide);
