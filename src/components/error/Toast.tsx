/**
 * Toast UI (T-056).
 *
 * Renders the queue produced by `src/lib/toast.ts`. Stack is bottom-right and
 * each toast carries an ARIA role appropriate to its severity:
 *   - info / success → role="status" (polite)
 *   - warning / error → role="alert" (assertive)
 *
 * Tailwind-only — no animation library. The fade-in is a one-shot opacity
 * transition triggered the first time the element mounts.
 */
import { t } from '@/lib/i18n';
import type { Toast, ToastKind } from '@/lib/toast';

export type { Toast, ToastKind } from '@/lib/toast';

export type ToastContainerProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const role = toast.kind === 'warning' || toast.kind === 'error' ? 'alert' : 'status';
  return (
    <div
      role={role}
      data-toast-kind={toast.kind}
      className={[
        'pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur',
        kindToClasses(toast.kind),
      ].join(' ')}
    >
      <div className="flex-1 whitespace-pre-wrap break-words">{toast.message}</div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('toast.dismiss')}
        className="-m-1 rounded p-1 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

function kindToClasses(kind: ToastKind): string {
  switch (kind) {
    case 'info':
      return 'border-zinc-700/70 bg-zinc-900/90 text-zinc-100';
    case 'success':
      return 'border-emerald-700/60 bg-emerald-950/80 text-emerald-100';
    case 'warning':
      return 'border-amber-700/60 bg-amber-950/80 text-amber-100';
    case 'error':
      return 'border-rose-700/60 bg-rose-950/80 text-rose-100';
  }
}
