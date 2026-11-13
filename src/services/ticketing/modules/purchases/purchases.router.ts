import { Router } from 'express';
import { PurchasesController } from '@/services/ticketing/modules/purchases/purchases.controller.js';

export const purchasesRouter = Router();

const purchasesController = new PurchasesController();

purchasesRouter.post('/holds', purchasesController.createHold);
purchasesRouter.delete('/holds/:id', purchasesController.cancelHold);
purchasesRouter.post('/purchases', purchasesController.purchase);
purchasesRouter.get('/orders', purchasesController.listOrders);
purchasesRouter.get('/orders/:id', purchasesController.getOrder);
purchasesRouter.post('/orders/:id/refund', purchasesController.refund);
