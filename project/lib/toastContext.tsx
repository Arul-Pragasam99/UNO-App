'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ToastMessage } from './types';

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 5;

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastMessage['type'] = 'info', duration: number = 3000) => {
      // Prevent duplicate identical toasts
      setToasts((prev) => {
        const lastToast = prev[prev.length - 1];
        if (lastToast && lastToast.message === message && lastToast.type === type) {
          return prev;
        }
        
        const id = Date.now().toString() + Math.random().toString(36).slice(2);
        const toast: ToastMessage = { id, message, type, duration };
        
        const newToasts = [...prev, toast];
        // Limit number of toasts
        if (newToasts.length > MAX_TOASTS) {
          const removed = newToasts.shift();
          if (removed) {
            const timeout = timeoutsRef.current.get(removed.id);
            if (timeout) clearTimeout(timeout);
            timeoutsRef.current.delete(removed.id);
          }
        }
        
        // Set auto-remove timeout
        const timeout = setTimeout(() => {
          removeToast(id);
        }, duration);
        timeoutsRef.current.set(id, timeout);
        
        return newToasts;
      });
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};