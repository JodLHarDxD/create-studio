import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { transitions } from '@/design';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'description'>> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
const DEFAULT_DURATION = 4_000;
const VISIBLE_LIMIT = 3;

const toneClass: Record<ToastTone, string> = {
  info: 'border-white/15 bg-black text-white',
  success: 'border-green-400/30 bg-green-500/10 text-green-100',
  warning: 'border-yellow-400/30 bg-yellow-500/10 text-yellow-100',
  error: 'border-red-400/30 bg-red-500/10 text-red-100',
};

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} satisfies Record<ToastTone, typeof Info>;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    const id = `toast-${nextId.current}`;

    setToasts(current => [
      ...current,
      {
        id,
        title: options.title,
        description: options.description,
        tone: options.tone ?? 'info',
        duration: options.duration ?? DEFAULT_DURATION,
      },
    ]);

    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const visibleToasts = toasts.slice(0, VISIBLE_LIMIT);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="fixed right-4 top-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {visibleToasts.map(item => (
            <ToastCard key={item.id} toast={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const Icon = toneIcon[toast.tone];

  React.useEffect(() => {
    if (toast.duration <= 0) return;
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.duration, toast.id]);

  return (
    <motion.div
      role="status"
      data-tone={toast.tone}
      layout
      initial={{ opacity: 0, x: 20, y: -4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20, scale: 0.98 }}
      transition={transitions.fast}
      className={cn(
        'pointer-events-auto border px-3 py-3 text-[#f5f5f4] backdrop-blur-md',
        'grid grid-cols-[auto_1fr_auto] items-start gap-3',
        toneClass[toast.tone],
      )}
    >
      <Icon size={15} className="mt-0.5 shrink-0 opacity-80" />
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-white">{toast.title}</div>
        {toast.description && (
          <div className="mt-1 text-[11px] leading-relaxed text-[#cccccc]">{toast.description}</div>
        )}
      </div>
      <button
        type="button"
        aria-label={`Dismiss ${toast.title}`}
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 text-white/40 transition-colors hover:text-white"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
