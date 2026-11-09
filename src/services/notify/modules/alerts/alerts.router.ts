import { Router } from 'express';
import { AlertsController } from '@/services/notify/modules/alerts/alerts.controller.js';

export const alertsRouter = Router();

const alertsController = new AlertsController();

alertsRouter.post('/alerts', alertsController.handle);
