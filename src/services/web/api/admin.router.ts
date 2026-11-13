import { Router } from 'express';
import { AdminController } from '@/services/web/api/admin.controller.js';
import { requireAdmin, requireStaff } from '@/services/web/modules/session/session.middleware.js';

export const adminRouter = Router();

const controller = new AdminController();

adminRouter.use(requireStaff());

adminRouter.get('/dashboard', controller.dashboard);

adminRouter.get('/events', controller.events);
adminRouter.post('/events', controller.createEvent);
adminRouter.get('/events/:id', controller.event);
adminRouter.patch('/events/:id', controller.updateEvent);
adminRouter.delete('/events/:id', controller.deleteEvent);
adminRouter.post('/events/:id/tiers', controller.createTier);

adminRouter.patch('/tiers/:id', controller.updateTier);
adminRouter.delete('/tiers/:id', controller.deleteTier);

adminRouter.get('/performers', controller.performers);
adminRouter.post('/performers', controller.createPerformer);

adminRouter.get('/venues', controller.venues);
adminRouter.post('/venues', controller.createVenue);

adminRouter.get('/bookings', controller.bookings);
adminRouter.post('/bookings/:id/decision', controller.decideBooking);

adminRouter.get('/orders/:id', controller.order);
adminRouter.post('/orders/:id/refund', controller.refundOrder);

adminRouter.get('/users', requireAdmin(), controller.users);
adminRouter.post('/users', requireAdmin(), controller.createUser);
