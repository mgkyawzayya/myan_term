/**
 * Cluster-level shape cache for Myanmar runs (CLAUDE.md §4.3).
 *
 * Two-tier:
 *   1. A pure-string LRU keyed by `cluster|font|size|fg|bg` that records
 *      whether a cluster is "interesting" (any Myanmar codepoint) and any
 *      precomputed metadata (advance width, has-virama, etc.). This tier is
 *      checked on every render of every Myanmar-bearing line.
 *   2. An OffscreenCanvas-backed pixel cache keyed by the same composite key
 *      but storing an ImageBitmap that the overlay renderer can blit. This
 *      tier is opt-in via `getOrRender`. Browsers without OffscreenCanvas fall
 *      back to per-frame DOM text rendering — slower but always correct.
 *
 * Capacity: LRU 5000 entries (per PRD F-105).
 */

import { LRUCache } from 'lru-cache';

export type ShapeKey = string;

export type ShapeMetadata = {
  /** Logical cell width as reported by the wcwidth contract. */
  cells: number;
  /** Number of grapheme clusters in the run. */
  graphemes: number;
  /** Pixel advance after shaping; -1 if not yet measured. */
  pixelAdvance: number;
};

export type ShapeEntry = {
  key: ShapeKey;
  meta: ShapeMetadata;
  bitmap?: ImageBitmap;
};

export type ShapeRenderArgs = {
  cluster: string;
  font: string;
  pixelSize: number;
  fg: string;
  bg: string;
  cellWidthPx: number;
  cellHeightPx: number;
};

export function shapeKey(args: ShapeRenderArgs): ShapeKey {
  return `${args.cluster}|${args.font}|${args.pixelSize}|${args.fg}|${args.bg}`;
}

const META_CACHE = new LRUCache<ShapeKey, ShapeEntry>({ max: 5000 });
const BITMAP_CACHE = new LRUCache<ShapeKey, ImageBitmap>({
  max: 2048,
  dispose: (bitmap) => {
    try {
      bitmap.close();
    } catch {
      /* older browsers without close() */
    }
  },
});

let hits = 0;
let misses = 0;

export function getMetadata(key: ShapeKey): ShapeEntry | undefined {
  const e = META_CACHE.get(key);
  if (e) hits += 1;
  else misses += 1;
  return e;
}

export function setMetadata(entry: ShapeEntry): void {
  META_CACHE.set(entry.key, entry);
}

export function getBitmap(key: ShapeKey): ImageBitmap | undefined {
  return BITMAP_CACHE.get(key);
}

export function setBitmap(key: ShapeKey, bitmap: ImageBitmap): void {
  BITMAP_CACHE.set(key, bitmap);
}

export function clearShapeCache(): void {
  META_CACHE.clear();
  BITMAP_CACHE.clear();
  hits = 0;
  misses = 0;
}

export function shapeCacheStats(): { entries: number; bitmaps: number; hits: number; misses: number; hitRate: number } {
  const total = hits + misses;
  return {
    entries: META_CACHE.size,
    bitmaps: BITMAP_CACHE.size,
    hits,
    misses,
    hitRate: total === 0 ? 0 : hits / total,
  };
}

const offscreenSupported = typeof OffscreenCanvas !== 'undefined';

/**
 * Render the cluster to an OffscreenCanvas and cache the resulting bitmap.
 * Returns undefined on browsers without OffscreenCanvas or createImageBitmap.
 */
export async function renderClusterBitmap(args: ShapeRenderArgs): Promise<ImageBitmap | undefined> {
  if (!offscreenSupported) return undefined;
  const key = shapeKey(args);
  const cached = getBitmap(key);
  if (cached) return cached;

  const width = Math.max(1, Math.ceil(args.cellWidthPx * 2));
  const height = Math.max(1, Math.ceil(args.cellHeightPx));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.clearRect(0, 0, width, height);
  if (args.bg && args.bg !== 'transparent') {
    ctx.fillStyle = args.bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = args.fg;
  ctx.font = `${args.pixelSize}px ${args.font}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(args.cluster, width / 2, height / 2);

  if (typeof createImageBitmap === 'undefined') return undefined;
  const bitmap = await createImageBitmap(canvas);
  setBitmap(key, bitmap);
  return bitmap;
}
