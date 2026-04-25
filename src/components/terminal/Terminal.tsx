/**
 * Terminal component (PRD F-002, T-006).
 *
 * Wraps an xterm.js Terminal instance, attaches the WebGL renderer, registers
 * the Myanmar character joiner, and binds keystrokes to the Tauri PTY.
 *
 * Browser-only-mode: when not running inside Tauri (e.g. dev preview, tests),
 * we skip the IPC and emit a friendly notice into the local terminal so the
 * UI is still usable for visual debugging.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal as XTerm, type ITerminalOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import type { UnlistenFn } from '@tauri-apps/api/event';

import '@xterm/xterm/css/xterm.css';

import { THEMES } from '@/lib/themes';
import type { CursorStyle, Settings, ThemeId } from '@/types';
import { isTauri, onPtyData, onPtyExit, ptyKill, ptyResize, ptySpawn, ptyWrite } from '@/lib/tauri';
import { makeMyanmarJoiner } from './characterJoiner';
import { MyanmarOverlay } from './MyanmarOverlay';

export type TerminalProps = {
  settings: Settings;
  cwd?: string | null;
  onTitle?: (title: string) => void;
  onCwd?: (cwd: string) => void;
  onExit?: (code: number | null) => void;
  onPtyId?: (id: string | null) => void;
};

export function Terminal({
  settings,
  cwd,
  onTitle,
  onCwd,
  onExit,
  onPtyId,
}: TerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [term, setTerm] = useState<XTerm | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  const fontFamilyCode = useMemo(
    () =>
      `${cssQuoteFontStack(settings.font.code_family)}, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace`,
    [settings.font.code_family],
  );
  const fontFamilyMyanmar = useMemo(
    () =>
      `${cssQuoteFontStack(settings.font.myanmar_family)}, Padauk, "Noto Sans Myanmar", "Pyidaungsu", sans-serif`,
    [settings.font.myanmar_family],
  );

  const handleData = useCallback((data: string) => {
    const id = ptyIdRef.current;
    if (id && isTauri()) void ptyWrite(id, data);
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;

    const opts: ITerminalOptions = {
      fontFamily: `${fontFamilyCode}, ${fontFamilyMyanmar}`,
      fontSize: settings.font.size,
      lineHeight: settings.font.line_height,
      letterSpacing: settings.font.letter_spacing,
      cursorBlink: settings.cursor.blink,
      cursorStyle: cursorStyleToXterm(settings.cursor.style),
      scrollback: settings.scrollback,
      allowProposedApi: true,
      allowTransparency: false,
      drawBoldTextInBrightColors: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      theme: themeColors(settings.theme),
    };

    const term = new XTerm(opts);
    termRef.current = term;

    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new SearchAddon());
    term.loadAddon(new SerializeAddon());

    const u11 = new Unicode11Addon();
    term.loadAddon(u11);
    term.unicode.activeVersion = '11';

    if (settings.webgl) {
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl.dispose());
        term.loadAddon(webgl);
      } catch (e) {
        console.warn('WebGL renderer unavailable, falling back to canvas', e);
      }
    }

    term.registerCharacterJoiner(makeMyanmarJoiner());
    term.open(hostRef.current);
    try {
      fit.fit();
    } catch {
      /* host not yet measured */
    }
    setTerm(term);

    term.onData(handleData);
    term.onTitleChange((title) => onTitle?.(title));

    // OSC 7 (current working directory) — xterm.js exposes via parser hook.
    const osc7 = term.parser.registerOscHandler(7, (payload) => {
      const cwd = parseOsc7(payload);
      if (cwd) onCwd?.(cwd);
      return true;
    });

    let unlistenData: UnlistenFn | undefined;
    let unlistenExit: UnlistenFn | undefined;

    const startPty = async () => {
      if (!isTauri()) {
        const banner =
          '\x1b[1;36mMyanTerm\x1b[0m \x1b[2m(browser preview)\x1b[0m — PTY disabled outside Tauri.\r\n' +
          'Run with \x1b[33mpnpm tauri dev\x1b[0m to attach a real shell.\r\n\r\n' +
          '\x1b[2mMyanmar smoke test:\x1b[0m မင်္ဂလာပါ ထမင်းစားရေး\r\n$ ';
        term.write(banner);
        return;
      }
      try {
        const { pty_id } = await ptySpawn({
          shell: settings.shell.program,
          args: settings.shell.args,
          cwd: cwd ?? null,
          env: settings.shell.env,
          cols: term.cols,
          rows: term.rows,
        });
        ptyIdRef.current = pty_id;
        onPtyId?.(pty_id);
        unlistenData = await onPtyData(({ ptyId, data }) => {
          if (ptyId === pty_id) term.write(data);
        });
        unlistenExit = await onPtyExit(({ ptyId, code }) => {
          if (ptyId !== pty_id) return;
          term.write(`\r\n\x1b[2m[process exited${code != null ? ` with code ${code}` : ''}]\x1b[0m\r\n`);
          onExit?.(code);
        });
      } catch (e) {
        console.error('Failed to spawn PTY', e);
        term.write(`\r\n\x1b[31mFailed to spawn shell: ${String(e)}\x1b[0m\r\n`);
      }
    };

    void startPty();

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        const id = ptyIdRef.current;
        if (id && isTauri()) void ptyResize(id, term.cols, term.rows);
      } catch {
        /* ignore */
      }
    });
    if (hostRef.current) ro.observe(hostRef.current);

    return () => {
      ro.disconnect();
      osc7.dispose();
      unlistenData?.();
      unlistenExit?.();
      const id = ptyIdRef.current;
      ptyIdRef.current = null;
      if (id && isTauri()) void ptyKill(id).catch(() => undefined);
      term.dispose();
      termRef.current = null;
      setTerm(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply settings updates without rebuilding the terminal.
  useEffect(() => {
    const t = termRef.current;
    if (!t) return;
    t.options.fontFamily = `${fontFamilyCode}, ${fontFamilyMyanmar}`;
    t.options.fontSize = settings.font.size;
    t.options.lineHeight = settings.font.line_height;
    t.options.letterSpacing = settings.font.letter_spacing;
    t.options.cursorBlink = settings.cursor.blink;
    t.options.cursorStyle = cursorStyleToXterm(settings.cursor.style);
    t.options.scrollback = settings.scrollback;
    t.options.theme = themeColors(settings.theme);
    try {
      fitRef.current?.fit();
    } catch {
      /* ignore */
    }
  }, [
    settings.font.size,
    settings.font.line_height,
    settings.font.letter_spacing,
    settings.cursor.blink,
    settings.cursor.style,
    settings.scrollback,
    settings.theme,
    fontFamilyCode,
    fontFamilyMyanmar,
  ]);

  return (
    <div className="myanterm-host relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" />
      <MyanmarOverlay
        term={term}
        myanmarFontStack={fontFamilyMyanmar}
        fontSizePx={settings.font.size}
      />
    </div>
  );
}

function cursorStyleToXterm(style: CursorStyle): 'block' | 'bar' | 'underline' {
  switch (style) {
    case 'bar':
    case 'underline':
    case 'block':
      return style;
  }
}

function themeColors(themeId: ThemeId) {
  const t = THEMES[themeId];
  return {
    background: t.background,
    foreground: t.foreground,
    cursor: t.cursor,
    cursorAccent: t.cursorAccent,
    selectionBackground: t.selectionBackground,
    black: t.black,
    red: t.red,
    green: t.green,
    yellow: t.yellow,
    blue: t.blue,
    magenta: t.magenta,
    cyan: t.cyan,
    white: t.white,
    brightBlack: t.brightBlack,
    brightRed: t.brightRed,
    brightGreen: t.brightGreen,
    brightYellow: t.brightYellow,
    brightBlue: t.brightBlue,
    brightMagenta: t.brightMagenta,
    brightCyan: t.brightCyan,
    brightWhite: t.brightWhite,
  };
}

function cssQuoteFontStack(name: string): string {
  if (!name.trim()) return 'monospace';
  return /[\s"]/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name;
}

function parseOsc7(payload: string): string | null {
  if (!payload.startsWith('file://')) return null;
  try {
    const url = new URL(payload);
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}
