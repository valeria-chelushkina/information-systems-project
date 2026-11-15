import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import type { AuthValue } from '@/typedefs/auth.typedefs';

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
