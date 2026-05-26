import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const bgColor = (type: ToastType) => {
    switch (type) {
      case 'error': return 'bg-red-600/90 border-red-500/50';
      case 'success': return 'bg-green-600/90 border-green-500/50';
      case 'info': return 'bg-accent-pink/90 border-accent-pink/50';
    }
  };

  const icon = (type: ToastType) => {
    switch (type) {
      case 'error': return '⚠';
      case 'success': return '✓';
      case 'info': return 'i';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-md pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`${bgColor(toast.type)} border backdrop-blur-xl text-white text-xs font-mono px-4 py-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] animate-subtle-fadeIn pointer-events-auto`}
          >
            <span className="mr-2">{icon(toast.type)}</span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
