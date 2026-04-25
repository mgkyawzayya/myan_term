/**
 * Toast subsystem tests (T-056).
 *
 * Pins the imperative API surface of `src/lib/toast.ts`:
 *   1. `showToast` returns a unique id and pushes a Toast into the queue.
 *   2. `dismissToast` removes a toast by id.
 *   3. info/success auto-dismiss after 4 s, warning after 6 s.
 *   4. error toasts are sticky (no auto-dismiss).
 *   5. Per-call `timeoutMs` overrides the default; 0 forces sticky.
 *
 * Uses fake timers so we can advance the clock without flakiness.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _currentToastsForTest,
  _resetToastsForTest,
  dismissToast,
  showToast,
} from '@/lib/toast';

describe('toast subsystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetToastsForTest();
  });

  afterEach(() => {
    _resetToastsForTest();
    vi.useRealTimers();
  });

  it('showToast returns a non-empty id', () => {
    const id = showToast('info', 'hello');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('showToast returns a different id each call', () => {
    const a = showToast('info', 'one');
    const b = showToast('info', 'two');
    expect(a).not.toBe(b);
  });

  it('queues each toast in insertion order', () => {
    showToast('info', 'one');
    showToast('warning', 'two');
    showToast('error', 'three');
    const queue = _currentToastsForTest();
    expect(queue.map((t) => t.message)).toEqual(['one', 'two', 'three']);
    expect(queue.map((t) => t.kind)).toEqual(['info', 'warning', 'error']);
  });

  it('dismissToast removes the toast immediately', () => {
    const id = showToast('error', 'sticky');
    expect(_currentToastsForTest()).toHaveLength(1);
    dismissToast(id);
    expect(_currentToastsForTest()).toHaveLength(0);
  });

  it('dismissToast on an unknown id is a no-op', () => {
    showToast('info', 'live');
    expect(_currentToastsForTest()).toHaveLength(1);
    dismissToast('does-not-exist');
    expect(_currentToastsForTest()).toHaveLength(1);
  });

  it('info auto-dismisses after 4 s', () => {
    showToast('info', 'fade');
    expect(_currentToastsForTest()).toHaveLength(1);
    vi.advanceTimersByTime(3_999);
    expect(_currentToastsForTest()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(_currentToastsForTest()).toHaveLength(0);
  });

  it('success auto-dismisses after 4 s', () => {
    showToast('success', 'done');
    vi.advanceTimersByTime(4_001);
    expect(_currentToastsForTest()).toHaveLength(0);
  });

  it('warning auto-dismisses after 6 s', () => {
    showToast('warning', 'careful');
    vi.advanceTimersByTime(5_999);
    expect(_currentToastsForTest()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(_currentToastsForTest()).toHaveLength(0);
  });

  it('error toasts are sticky (no auto-dismiss)', () => {
    showToast('error', 'broken');
    vi.advanceTimersByTime(60_000);
    expect(_currentToastsForTest()).toHaveLength(1);
  });

  it('respects an explicit timeoutMs override', () => {
    showToast('info', 'short', 1_000);
    vi.advanceTimersByTime(1_001);
    expect(_currentToastsForTest()).toHaveLength(0);
  });

  it('treats timeoutMs=0 as sticky regardless of kind', () => {
    showToast('info', 'pinned', 0);
    vi.advanceTimersByTime(60_000);
    expect(_currentToastsForTest()).toHaveLength(1);
  });
});
