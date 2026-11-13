import { Router } from 'express';
import { accountRouter } from '@/services/web/api/account.router.js';
import { adminRouter } from '@/services/web/api/admin.router.js';
import { publicRouter } from '@/services/web/api/public.router.js';
import { sessionRouter } from '@/services/web/api/session.router.js';

export const apiRouter = Router();

apiRouter.use(sessionRouter);
apiRouter.use(publicRouter);
apiRouter.use(accountRouter);
apiRouter.use('/admin', adminRouter);
