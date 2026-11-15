import { Router } from 'express';
import { AnalyticsController } from '@/services/ticketing/modules/analytics/analytics.controller.js';

export const analyticsRouter = Router();

const analyticsController = new AnalyticsController();

analyticsRouter.get('/reports', analyticsController.report);
