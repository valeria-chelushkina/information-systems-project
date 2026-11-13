import { Router } from 'express';
import { SessionController } from '@/services/web/api/session.controller.js';

export const sessionRouter = Router();

const controller = new SessionController();

sessionRouter.get('/session', controller.current);
sessionRouter.post('/session', controller.login);
sessionRouter.post('/register', controller.register);
sessionRouter.delete('/session', controller.logout);
