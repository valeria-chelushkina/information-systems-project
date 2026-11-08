import { Router } from 'express';
import { eventsController } from '@/container.js';

export const eventsRouter = Router();

eventsRouter.post('/events', eventsController.create);
eventsRouter.get('/events', eventsController.list);
eventsRouter.get('/events/:id', eventsController.getById);
eventsRouter.patch('/events/:id', eventsController.update);
eventsRouter.delete('/events/:id', eventsController.remove);
