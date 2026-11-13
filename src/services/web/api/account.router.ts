import { Router } from 'express';
import { AccountController } from '@/services/web/api/account.controller.js';
import { requireUser } from '@/services/web/modules/session/session.middleware.js';

export const accountRouter = Router();

const controller = new AccountController();

accountRouter.post('/events/:id/purchase', requireUser(), controller.purchase);
accountRouter.get('/orders', requireUser(), controller.orders);
accountRouter.get('/orders/:id', requireUser(), controller.order);
accountRouter.post('/orders/:id/refund', requireUser(), controller.refund);
