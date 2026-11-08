import { Router } from 'express';
import { listUpcomingEvents } from '@/modules/events/events.service.js';

export const eventsRouter = Router();

eventsRouter.get('/events', async (_req, res, next) => {
  try {
    const data = await listUpcomingEvents();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});
