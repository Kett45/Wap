import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useKam } from '../../context/KamContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useKam();
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const icon =
          t.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--kam-success)]" />
          ) : t.tone === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--kam-danger)]" />
          ) : t.tone === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--kam-warning)]" />
          ) : (
            <Info className="w-4 h-4 shrink-0 text-[var(--kam-primary)]" />
          );

        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--kam-surface-elevated)] border border-[var(--kam-border-strong)] text-[var(--kam-text-primary)] text-sm shadow-lg"
          >
            {icon}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="إغلاق التنبيه"
              className="p-1 rounded-md text-[var(--kam-text-muted)] hover:text-[var(--kam-text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
