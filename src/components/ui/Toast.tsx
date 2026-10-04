import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
    show: (item: Omit<ToastItem, 'id'>) => void;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts(prev => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const toastMethods = useMemo(
    () => ({
      success: (title: string, message?: string) => show({ type: 'success', title, message }),
      error: (title: string, message?: string) => show({ type: 'error', title, message }),
      warning: (title: string, message?: string) => show({ type: 'warning', title, message }),
      info: (title: string, message?: string) => show({ type: 'info', title, message }),
      show,
      dismiss
    }),
    [show, dismiss]
  );

  const contextValue = useMemo(() => ({ toast: toastMethods }), [toastMethods]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast Viewport */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
        role="region"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-neutral-200 dark:border-white/[0.1] shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-200"
          >
            {getIcon(t.type)}
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {t.title}
              </h5>
              {t.message && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Tutup notifikasi"
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
