/**
 * ErrorBoundary (T-056).
 *
 * Class component is mandatory — `componentDidCatch` and
 * `getDerivedStateFromError` have no functional/hook equivalent in React 19.
 *
 * The boundary catches any render-phase error in its subtree, surfaces a
 * graceful fallback (with a "Reload window" affordance) and forwards the
 * error to `props.onError` so callers can also push a toast notification.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '@/lib/i18n';

export type ErrorBoundaryProps = {
  children: ReactNode;
  /** Called whenever the boundary intercepts a render-phase error. */
  onError?: (err: Error) => void;
  /** Optional fully-custom fallback. Default fallback is rendered if absent. */
  fallback?: (err: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  err: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { err: null };

  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return { err };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // CLAUDE.md R9: warn-only; the toast is the user-visible surface.
    console.warn('ErrorBoundary caught:', error, info.componentStack);
    try {
      this.props.onError?.(error);
    } catch (innerErr) {
      console.warn('ErrorBoundary onError threw:', innerErr);
    }
  }

  reset = (): void => {
    this.setState({ err: null });
  };

  override render(): ReactNode {
    const { err } = this.state;
    if (!err) return this.props.children;
    if (this.props.fallback) return this.props.fallback(err, this.reset);
    return <DefaultFallback err={err} />;
  }
}

function DefaultFallback({ err }: { err: Error }) {
  return (
    <div
      role="alert"
      className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-8 text-zinc-100"
    >
      <div className="max-w-md space-y-4 rounded-xl border border-rose-800/60 bg-zinc-900/80 p-6 shadow-2xl">
        <h1 className="text-lg font-semibold text-rose-200">{t('error.crash')}</h1>
        <p className="text-sm text-zinc-300">{err.message || String(err)}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-zinc-50 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          {t('error.reload_window')}
        </button>
      </div>
    </div>
  );
}
