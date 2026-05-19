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
  info: 'border-white/[0.10] bg-zinc-900/85 text-zinc-100',
  success: 'border-emerald-400/40 bg-emerald-500/[0.08] text-emerald-100',
  warning: 'border-amber-400/40 bg-amber-500/[0.08] text-amber-100',
  error: 'border-red-400/40 bg-red-500/[0.08] text-red-100',
};

const toneIconColor: Record<ToastTone, string> = {
  info: 'text-emerald-400',
  success: 'text-emerald-400',
  warning: 'text-amber-300',
  error: 'text-red-400',
};

const toneTitleColor: Record<ToastTone, string> = {
  info: 'text-zinc-100',
  success: 'text-emerald-200',
  warning: 'text-amber-200',
  error: 'text-red-200',
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
        'pointer-events-auto border px-3.5 py-3 backdrop-blur-xl',
        'grid grid-cols-[auto_1fr_auto] items-start gap-3',
        toneClass[toast.tone],
      )}
    >
      <Icon size={15} className={cn('mt-0.5 shrink-0', toneIconColor[toast.tone])} strokeWidth={1.5} />
      <div className="min-w-0">
        <div className={cn('text-[10px] font-mono uppercase tracking-[0.20em]', toneTitleColor[toast.tone])}>
          {toast.title}
        </div>
        {toast.description && (
          <div className="mt-1 text-[12px] leading-relaxed text-zinc-300">{toast.description}</div>
        )}
      </div>
      <button
        type="button"
        aria-label={`Dismiss ${toast.title}`}
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 text-zinc-500 hover:text-zinc-100 transition-colors"
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
