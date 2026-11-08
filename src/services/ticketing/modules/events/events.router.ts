import { Router } from 'express';
import { EventsController } from '@/services/ticketing/modules/events/events.controller.js';

export const eventsRouter = Router();
const eventsController = new EventsController();

eventsRouter.post('/events', eventsController.create);
eventsRouter.get('/events', eventsController.list);
eventsRouter.get('/events/:id', eventsController.getById);
eventsRouter.patch('/events/:id', eventsController.update);
eventsRouter.delete('/events/:id', eventsController.remove);
