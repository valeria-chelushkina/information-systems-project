import { Router } from 'express';
import { NotificationsController } from '@/services/notify/modules/notifications/notifications.controller.js';

export const notificationsRouter = Router();

const controller = new NotificationsController();

notificationsRouter.get('/notifications', controller.list);
notificationsRouter.get('/notifications/summary', controller.summary);
