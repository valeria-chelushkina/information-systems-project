import { Router } from 'express';
import { AuthController } from '@/services/auth/modules/auth.controller.js';

export const authRouter = Router();

const authController = new AuthController();

authRouter.post('/auth/login', authController.login);
authRouter.post('/auth/register', authController.register);
authRouter.post('/auth/logout', authController.logout);
authRouter.post('/auth/introspect', authController.introspect);
authRouter.get('/auth/me', authController.me);
authRouter.get('/auth/users', authController.listUsers);
authRouter.post('/auth/users', authController.createUser);
