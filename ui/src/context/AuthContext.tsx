import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import type { SessionResponse, SessionUser } from '@/lib/types';
import { ApiError } from '@/lib/api';

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await api.get<SessionResponse>('/session');
      setUser(session.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.post<SessionResponse>('/session', { email, password });

    if (!session.user) {
      throw new ApiError(401, 'invalid_credentials', 'Login failed');
    }

    setUser(session.user);
    return session.user;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const session = await api.post<SessionResponse>('/register', { email, password });

    if (!session.user) {
      throw new ApiError(400, 'request_failed', 'Registration failed');
    }

    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.remove<undefined>('/session');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

export function isStaff(user: SessionUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'staff';
}
