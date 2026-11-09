export const USER_ROLES = ['customer', 'staff', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
  created_at: string;
}

export interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: number;
  createdAt: string;
}

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
}
