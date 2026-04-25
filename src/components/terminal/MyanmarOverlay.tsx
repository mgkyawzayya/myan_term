/**
 * Myanmar overlay renderer (CLAUDE.md §3, PRD F-103/F-112).
 *
 * Strategy:
 *  - On every render we walk the visible viewport via xterm.js's public buffer
 *    API and find Myanmar runs per row.
 *  - For each run we render a span absolutely positioned over the canvas at the
 *    appropriate cell coordinates, sized to the run's cell width.
 *  - The span's font stack is the user's Myanmar font; the browser shapes it
 *    correctly using its system text engine (we don't ship HarfBuzz).
 *  - Overlay updates are RAF-batched with the renderer so scroll-syncing is
 *    pixel-perfect.
 */

import { useEffect, useRef } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';
import { findMyanmarRuns } from '@/lib/myanmar';
import { myanmarCellWidth } from '@/lib/wcwidth';
import { getMetadata, setMetadata, shapeKey } from './shapeCache';

export type MyanmarOverlayProps = {
  term: XTerm | null;
  myanmarFontStack: string;
  fontSizePx: number;
};

type OverlayItem = {
  key: string;
  text: string;
  row: number;
  col: number;
  cells: number;
};

export function MyanmarOverlay({ term, myanmarFontStack, fontSizePx }: MyanmarOverlayProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<OverlayItem[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!term) return;
    const layer = layerRef.current;
    if (!layer) return;

    const collect = (): OverlayItem[] => {
      const items: OverlayItem[] = [];
      const buf = term.buffer.active;
      const startY = buf.viewportY;
      const rows = term.rows;
      for (let row = 0; row < rows; row += 1) {
        const line = buf.getLine(startY + row);
        if (!line) continue;
        const text = line.translateToString(true);
        if (!text) continue;
        const runs = findMyanmarRuns(text);
        if (runs.length === 0) continue;
        for (const run of runs) {
          const cells = myanmarCellWidth(run.text);
          // Map JS string offset → terminal column. Myanmar codepoints all live
          // in the BMP (no surrogate pairs); however a single base + combining
          // sequence still occupies multiple JS code units but only some cells.
          // We use the string offset directly as the column anchor — xterm.js's
          // own width math has already laid out the row, so this is safe for
          // pure Myanmar runs surrounded by ASCII.
          const col = run.start;
          const key = `${startY + row}:${col}:${run.text}`;
          items.push({ key, text: run.text, row, col, cells });

          const sk = shapeKey({
            cluster: run.text,
            font: myanmarFontStack,
            pixelSize: fontSizePx,
            fg: 'inherit',
            bg: 'transparent',
            cellWidthPx: 0,
            cellHeightPx: 0,
          });
          if (!getMetadata(sk)) {
            setMetadata({
              key: sk,
              meta: { cells, graphemes: 1, pixelAdvance: -1 },
            });
          }
        }
      }
      return items;
    };

    const paint = () => {
      rafRef.current = null;
      const next = collect();
      itemsRef.current = next;

      // Reconcile minimally: clear and rebuild. The DOM count per viewport is
      // small (rows * Myanmar runs per row) so this stays cheap. If profiling
      // says otherwise we can move to a keyed reuse pool.
      while (layer.firstChild) layer.removeChild(layer.firstChild);

      const dims = (term as unknown as { _core?: { _renderService?: { dimensions?: { css?: { cell?: { width: number; height: number } } } } } });
      // Public API for cell metrics is not exposed; xterm.js exposes them via
      // a private renderer service. Fall back to char measure if absent.
      const cell =
        dims._core?._renderService?.dimensions?.css?.cell ??
        estimateCellSize(term, fontSizePx);

      for (const item of next) {
        const span = document.createElement('span');
        span.className = 'myanterm-cluster';
        span.textContent = item.text;
        span.style.position = 'absolute';
        span.style.top = `${item.row * cell.height}px`;
        span.style.left = `${item.col * cell.width}px`;
        span.style.width = `${item.cells * cell.width}px`;
        span.style.height = `${cell.height}px`;
        span.style.fontFamily = myanmarFontStack;
        span.style.fontSize = `${fontSizePx}px`;
        span.style.lineHeight = `${cell.height}px`;
        span.style.textAlign = 'center';
        span.style.pointerEvents = 'none';
        span.style.whiteSpace = 'pre';
        layer.appendChild(span);
      }
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(paint);
    };

    const offRender = term.onRender(schedule);
    const offScroll = term.onScroll(schedule);
    const offResize = term.onResize(schedule);
    const offCursor = term.onCursorMove(schedule);

    schedule();

    return () => {
      offRender.dispose();
      offScroll.dispose();
      offResize.dispose();
      offCursor.dispose();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [term, myanmarFontStack, fontSizePx]);

  return (
    <div
      ref={layerRef}
      className="myanterm-overlay"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        contain: 'strict',
      }}
    />
  );
}

function estimateCellSize(term: XTerm, fontSizePx: number): { width: number; height: number } {
  // Rough estimate when the renderer hasn't exposed dims (tests / fallback).
  const monoWidth = fontSizePx * 0.6;
  const lineHeight = fontSizePx * 1.2;
  return { width: monoWidth, height: lineHeight * (term.rows > 0 ? 1 : 1) };
}
