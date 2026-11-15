export type UserRole = 'customer' | 'staff' | 'admin';

export type LoginMode = 'login' | 'register';

export interface SessionUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface SessionResponse {
  user: SessionUser | null;
}

export interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
