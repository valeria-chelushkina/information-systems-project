import { createContext, useCallback, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import type {
  ChildrenProps,
  Toast,
  ToastTone,
  ToastValue,
} from '@/typedefs/ui.typedefs';

export const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: ChildrenProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = 'ok') => {
      const id = Date.now() + Math.random();

      setToasts((items) => [...items, { id, message, tone }]);

      window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id));
      }, 5000);
    },
    [],
  );

  const value = useMemo<ToastValue>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
            <Icon name={toast.tone === 'ok' ? 'check' : 'bell'} className="toast__icon" />
            <span>{toast.message}</span>
            <button
              className="toast__close"
              type="button"
              aria-label="Dismiss"
              onClick={() => remove(toast.id)}
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
