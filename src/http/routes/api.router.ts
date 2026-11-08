import { Router } from 'express';
import { eventsRouter } from '@/modules/events/events.router.js';
import { tiersRouter } from '@/modules/tiers/tiers.router.js';

export const apiRouter = Router();

apiRouter.use(eventsRouter);
apiRouter.use(tiersRouter);
