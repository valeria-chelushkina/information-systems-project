import { useContext } from 'react';
import { ToastContext } from '@/context/ToastContext';
import type { ToastValue } from '@/typedefs/ui.typedefs';

export function useToast(): ToastValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}
