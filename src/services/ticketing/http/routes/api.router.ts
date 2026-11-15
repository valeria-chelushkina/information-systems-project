import { Router } from 'express';
import { checkInRouter } from '@/services/ticketing/modules/check-in/check-in.router.js';
import { eventsRouter } from '@/services/ticketing/modules/events/events.router.js';
import { purchasesRouter } from '@/services/ticketing/modules/purchases/purchases.router.js';
import { tiersRouter } from '@/services/ticketing/modules/tiers/tiers.router.js';

export const apiRouter = Router();

apiRouter.use(eventsRouter);
apiRouter.use(tiersRouter);
apiRouter.use(purchasesRouter);
apiRouter.use(checkInRouter);
