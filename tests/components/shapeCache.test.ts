import { afterEach, describe, expect, it } from 'vitest';
import {
  clearShapeCache,
  getMetadata,
  setMetadata,
  shapeCacheStats,
  shapeKey,
} from '@/components/terminal/shapeCache';

afterEach(() => clearShapeCache());

describe('shapeKey', () => {
  it('produces stable composite keys', () => {
    const a = shapeKey({
      cluster: 'မ',
      font: 'Padauk',
      pixelSize: 14,
      fg: '#fff',
      bg: '#000',
      cellWidthPx: 8,
      cellHeightPx: 16,
    });
    const b = shapeKey({
      cluster: 'မ',
      font: 'Padauk',
      pixelSize: 14,
      fg: '#fff',
      bg: '#000',
      cellWidthPx: 8,
      cellHeightPx: 16,
    });
    expect(a).toBe(b);
  });

  it('changes when font changes', () => {
    const args = {
      cluster: 'မ',
      font: 'Padauk',
      pixelSize: 14,
      fg: '#fff',
      bg: '#000',
      cellWidthPx: 8,
      cellHeightPx: 16,
    } as const;
    expect(shapeKey({ ...args, font: 'Noto Sans Myanmar' })).not.toBe(shapeKey(args));
  });
});

describe('shape cache stats', () => {
  it('records hits and misses and reaches > 95% hit rate on warm cache', () => {
    const key = shapeKey({
      cluster: 'မြန်မာ',
      font: 'Padauk',
      pixelSize: 14,
      fg: '#fff',
      bg: '#000',
      cellWidthPx: 8,
      cellHeightPx: 16,
    });
    setMetadata({ key, meta: { cells: 2, graphemes: 4, pixelAdvance: -1 } });

    // Cold miss not counted (we set, didn't get).
    expect(getMetadata(key)).toBeDefined();
    for (let i = 0; i < 99; i += 1) {
      getMetadata(key);
    }
    const stats = shapeCacheStats();
    expect(stats.hitRate).toBeGreaterThan(0.95);
  });
});
