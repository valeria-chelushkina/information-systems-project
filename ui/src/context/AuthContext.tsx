import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '@/helpers/api';
import type { AuthValue, SessionResponse, SessionUser } from '@/typedefs/auth.typedefs';
import type { ChildrenProps } from '@/typedefs/ui.typedefs';

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: ChildrenProps) {
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
