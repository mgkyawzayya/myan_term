import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

const terminalState = vi.hoisted(() => ({
  joinerRegisteredAfterOpen: false,
  lastConstructorOptions: null as Record<string, unknown> | null,
}));

const openSpy = vi.hoisted(() => vi.fn());
const registerCharacterJoinerSpy = vi.hoisted(() => vi.fn());

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    cols = 80;
    rows = 24;
    options: Record<string, unknown>;
    unicode = { activeVersion: '' };
    parser = { registerOscHandler: vi.fn(() => ({ dispose: vi.fn() })) };
    buffer = { active: { viewportY: 0, getLine: vi.fn(() => null) } };
    element: HTMLDivElement | null = null;
    private readonly _renderDisposable = { dispose: vi.fn() };
    private readonly _scrollDisposable = { dispose: vi.fn() };
    private readonly _resizeDisposable = { dispose: vi.fn() };
    private readonly _cursorDisposable = { dispose: vi.fn() };

    constructor(opts: Record<string, unknown> = {}) {
      this.options = { ...opts };
      terminalState.lastConstructorOptions = this.options;
    }

    loadAddon = vi.fn();
    onData = vi.fn();
    onTitleChange = vi.fn();
    onRender = vi.fn(() => this._renderDisposable);
    onScroll = vi.fn(() => this._scrollDisposable);
    onResize = vi.fn(() => this._resizeDisposable);
    onCursorMove = vi.fn(() => this._cursorDisposable);
    write = vi.fn();
    resize = vi.fn();
    dispose = vi.fn();

    open(element: HTMLDivElement) {
      this.element = element;
      openSpy();
    }

    registerCharacterJoiner() {
      registerCharacterJoinerSpy();
      if (!this.element) throw new Error('Terminal must be opened first');
      terminalState.joinerRegisteredAfterOpen = true;
      return 1;
    }
  }

  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = vi.fn();
  },
}));
vi.mock('@xterm/addon-search', () => ({ SearchAddon: class MockSearchAddon {} }));
vi.mock('@xterm/addon-serialize', () => ({ SerializeAddon: class MockSerializeAddon {} }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: class MockUnicode11Addon {} }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class MockWebLinksAddon {} }));
vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class MockWebglAddon {
    onContextLoss = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock('@/components/terminal/MyanmarOverlay', () => ({
  MyanmarOverlay: () => <div data-testid="overlay" />,
}));
vi.mock('@/lib/tauri', () => ({
  isTauri: () => false,
  onPtyData: vi.fn(),
  onPtyExit: vi.fn(),
  ptyKill: vi.fn(),
  ptyResize: vi.fn(),
  ptySpawn: vi.fn(),
  ptyWrite: vi.fn(),
}));

import { Terminal } from '@/components/terminal/Terminal';
import { DEFAULT_SETTINGS } from '@/types';

let container: HTMLDivElement;
let root: Root;
let originalResizeObserver: typeof globalThis.ResizeObserver | undefined;

beforeEach(() => {
  terminalState.joinerRegisteredAfterOpen = false;
  terminalState.lastConstructorOptions = null;
  openSpy.mockClear();
  registerCharacterJoinerSpy.mockClear();
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as typeof ResizeObserver;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  if (originalResizeObserver) {
    globalThis.ResizeObserver = originalResizeObserver;
  } else {
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  }
});

describe('Terminal startup ordering', () => {
  it('opens the xterm instance before registering the Myanmar joiner', () => {
    expect(() => {
      act(() => {
        root.render(<Terminal settings={DEFAULT_SETTINGS} />);
      });
    }).not.toThrow();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(registerCharacterJoinerSpy).toHaveBeenCalledTimes(1);
    expect(terminalState.joinerRegisteredAfterOpen).toBe(true);
  });

  it('does not include Myanmar fonts in the xterm fontFamily stack', () => {
    act(() => {
      root.render(<Terminal settings={DEFAULT_SETTINGS} />);
    });

    const fontFamily = String(terminalState.lastConstructorOptions?.fontFamily ?? '');
    expect(fontFamily).not.toMatch(/Padauk|Noto Sans Myanmar|Pyidaungsu/);
  });
});
