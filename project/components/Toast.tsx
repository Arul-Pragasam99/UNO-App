'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useToast } from '@/lib/toastContext';

const Toast = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration || 3000}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
};

const ToastItem = ({
  id,
  message,
  type,
  duration,
  onRemove,
}: {
  id: string;
  message: string;
  type: string;
  duration: number;
  onRemove: (id: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: -20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }
      );
    }
    if (progressRef.current) {
      gsap.fromTo(
        progressRef.current,
        { scaleX: 1 },
        { scaleX: 0, duration: duration / 1000, ease: 'none' }
      );
    }
  }, [duration]);

  const getColors = () => {
    switch (type) {
      case 'success': return 'bg-emerald-500/95 border-emerald-400';
      case 'error': return 'bg-red-500/95 border-red-400';
      case 'warning': return 'bg-amber-500/95 border-amber-400';
      default: return 'bg-blue-500/95 border-blue-400';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  const getProgressColor = () => {
    switch (type) {
      case 'success': return 'bg-emerald-300';
      case 'error': return 'bg-red-300';
      case 'warning': return 'bg-amber-300';
      default: return 'bg-blue-300';
    }
  };

  return (
    <div
      ref={ref}
      className={`
        ${getColors()}
        pointer-events-auto rounded-xl border backdrop-blur-md
        shadow-lg shadow-black/20 overflow-hidden
      `}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-white font-bold text-sm w-5 h-5 flex items-center justify-center rounded-full bg-white/20 flex-shrink-0">
          {getIcon()}
        </span>
        <p className="text-white text-sm font-medium flex-1">{message}</p>
        <button
          onClick={() => onRemove(id)}
          className="text-white/70 hover:text-white text-lg leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>
      <div
        ref={progressRef}
        className={`h-0.5 ${getProgressColor()} origin-left`}
      />
    </div>
  );
};

export default Toast;
