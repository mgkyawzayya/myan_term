/**
 * Toast subsystem (T-056).
 *
 * Module-scoped event bus exposing a tiny imperative API plus a hook that
 * subscribes via `useSyncExternalStore`. Hand-rolled because adding a UI
 * notification dependency for a four-state queue isn't worth the binary cost
 * (CLAUDE.md R10).
 *
 * Auto-dismiss behaviour:
 *   - info, success: 4 s default.
 *   - warning: 6 s default.
 *   - error: sticky (no auto-dismiss).
 * Callers may override via `timeoutMs` (pass 0 to make it sticky regardless of
 * kind, pass any positive number to override the default).
 */
import { useSyncExternalStore } from 'react';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  /**
   * Effective timeout in ms. `0` means sticky. The exported `showToast`
   * resolves the kind-specific default and stores the result here so the
   * `ToastContainer` can render without re-checking the kind.
   */
  timeoutMs: number;
};

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Toast[] {
  return toasts;
}

function defaultTimeout(kind: ToastKind): number {
  switch (kind) {
    case 'info':
    case 'success':
      return 4_000;
    case 'warning':
      return 6_000;
    case 'error':
      return 0;
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function showToast(kind: ToastKind, message: string, timeoutMs?: number): string {
  const id = makeId();
  const effective = typeof timeoutMs === 'number' ? Math.max(0, timeoutMs) : defaultTimeout(kind);
  const next: Toast = { id, kind, message, timeoutMs: effective };
  toasts = [...toasts, next];
  if (effective > 0) {
    const handle = setTimeout(() => dismissToast(id), effective);
    timers.set(id, handle);
  }
  emit();
  return id;
}

export function dismissToast(id: string): void {
  const handle = timers.get(id);
  if (handle) {
    clearTimeout(handle);
    timers.delete(id);
  }
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) emit();
}

/**
 * Test-only helper. Clears every queued toast and pending timer. Exposed so
 * vitest can isolate cases without leaking timers across suites.
 */
export function _resetToastsForTest(): void {
  for (const handle of timers.values()) clearTimeout(handle);
  timers.clear();
  toasts = [];
  emit();
}

/**
 * Test-only accessor returning a snapshot of the current queue. Avoids
 * dragging React's hook machinery into the unit tests.
 */
export function _currentToastsForTest(): Toast[] {
  return toasts;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
