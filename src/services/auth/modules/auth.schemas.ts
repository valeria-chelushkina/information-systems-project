import { z } from 'zod';
import { USER_ROLES } from '@/services/auth/typedefs/user.typedefs.js';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

export const tokenSchema = z.object({
  token: z.string().trim().min(16).max(256),
});

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
  role: z.enum(USER_ROLES).default('customer'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
