import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/Icon';

type Tone = 'ok' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastValue {
  push: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Tone = 'ok') => {
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

export function useToast(): ToastValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}
