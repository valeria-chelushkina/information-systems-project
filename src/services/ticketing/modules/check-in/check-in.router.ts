import { Router } from 'express';
import { CheckInController } from '@/services/ticketing/modules/check-in/check-in.controller.js';

export const checkInRouter = Router();

const checkInController = new CheckInController();

checkInRouter.post('/tickets/check-in', checkInController.checkIn);
