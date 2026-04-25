/**
 * ErrorBoundary tests (T-056).
 *
 * Verifies the only contract that matters from the rest of the app's POV:
 *   1. A throwing child is intercepted and replaced with a fallback UI.
 *   2. The `onError` callback fires with the original error.
 *   3. A custom `fallback` render-prop is honoured when provided.
 *
 * React intentionally re-throws the error to the console after a boundary
 * catches it; we silence that with a `console.error` spy so the test output
 * stays readable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

function Boom({ message = 'kaboom' }: { message?: string }): React.JSX.Element {
  throw new Error(message);
}

let container: HTMLDivElement;
let root: Root;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // React logs the error to console.error after the boundary catches it.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  // The boundary itself logs via console.warn (CLAUDE.md R9).
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <div data-testid="happy">ok</div>
        </ErrorBoundary>,
      );
    });
    expect(container.querySelector('[data-testid="happy"]')?.textContent).toBe('ok');
  });

  it('renders the default fallback when a child throws', () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <Boom message="bad render" />
        </ErrorBoundary>,
      );
    });
    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('bad render');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('invokes the onError callback with the thrown error', () => {
    const onError = vi.fn();
    act(() => {
      root.render(
        <ErrorBoundary onError={onError}>
          <Boom message="callback" />
        </ErrorBoundary>,
      );
    });
    expect(onError).toHaveBeenCalledTimes(1);
    const arg = onError.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe('callback');
  });

  it('honours a custom fallback render prop', () => {
    act(() => {
      root.render(
        <ErrorBoundary
          fallback={(err) => <div data-testid="custom">caught: {err.message}</div>}
        >
          <Boom message="custom path" />
        </ErrorBoundary>,
      );
    });
    expect(container.querySelector('[data-testid="custom"]')?.textContent).toBe(
      'caught: custom path',
    );
  });

  it('swallows errors thrown by onError without crashing the app', () => {
    const onError = vi.fn(() => {
      throw new Error('observer broken');
    });
    expect(() => {
      act(() => {
        root.render(
          <ErrorBoundary onError={onError}>
            <Boom message="primary" />
          </ErrorBoundary>,
        );
      });
    }).not.toThrow();
    // Default fallback should still render even though onError blew up.
    expect(container.textContent).toContain('Something went wrong');
  });
});
