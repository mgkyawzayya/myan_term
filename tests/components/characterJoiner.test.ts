import { describe, expect, it } from 'vitest';
import { findRunsByCodepoint, makeMyanmarJoiner } from '@/components/terminal/characterJoiner';

describe('findRunsByCodepoint', () => {
  it('returns empty for empty string', () => {
    expect(findRunsByCodepoint('')).toEqual([]);
  });

  it('returns empty for ASCII-only', () => {
    expect(findRunsByCodepoint('hello')).toEqual([]);
  });

  it('returns one inclusive range for a Myanmar run', () => {
    const text = 'မြန်မာ';
    const ranges = findRunsByCodepoint(text);
    expect(ranges.length).toBe(1);
    expect(ranges[0]).toEqual([0, text.length - 1]);
  });

  it('returns multiple ranges for separated runs', () => {
    const ranges = findRunsByCodepoint('a မြန် b မာ c');
    expect(ranges.length).toBe(2);
  });

  it('handles trailing run at end of line', () => {
    const text = 'foo မြန်';
    const ranges = findRunsByCodepoint(text);
    expect(ranges.length).toBe(1);
    expect(ranges[0]?.[1]).toBe(text.length - 1);
  });
});

describe('makeMyanmarJoiner', () => {
  it('produces a callable joiner', () => {
    const joiner = makeMyanmarJoiner();
    expect(typeof joiner).toBe('function');
    expect(joiner('hello')).toEqual([]);
    expect(joiner('မြန်').length).toBe(1);
  });
});
