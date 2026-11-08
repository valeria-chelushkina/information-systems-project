import { Router } from 'express';
import { bookingsRouter } from '@/services/catalog/modules/bookings/bookings.router.js';
import { performersRouter } from '@/services/catalog/modules/performers/performers.router.js';
import { venuesRouter } from '@/services/catalog/modules/venues/venues.router.js';

export const apiRouter = Router();

apiRouter.use(performersRouter);
apiRouter.use(venuesRouter);
apiRouter.use(bookingsRouter);
