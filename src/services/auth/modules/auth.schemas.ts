import { z } from 'zod';
import { USER_ROLES } from '@/services/auth/typedefs/user.typedefs.js';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

export const registerSchema = z.object({
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

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  roles: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value ||
        value
          .split(',')
          .every((role) => USER_ROLES.includes(role.trim() as (typeof USER_ROLES)[number])),
      { message: 'Unknown role in roles filter' },
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
