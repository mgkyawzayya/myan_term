import { describe, expect, it } from 'vitest';
import { myanmarCellWidth, wcswidth, wcwidthCp } from '@/lib/wcwidth';

describe('wcwidthCp', () => {
  it('returns 1 for ASCII letters', () => {
    expect(wcwidthCp('a'.codePointAt(0)!)).toBe(1);
    expect(wcwidthCp('Z'.codePointAt(0)!)).toBe(1);
  });

  it('returns 0 for combining marks', () => {
    expect(wcwidthCp(0x0300)).toBe(0);
    expect(wcwidthCp(0x0303)).toBe(0);
  });

  it('returns 2 for CJK', () => {
    expect(wcwidthCp(0x4e2d)).toBe(2); // 中
    expect(wcwidthCp(0x3042)).toBe(2); // あ
  });

  it('returns 2 for wide emoji', () => {
    expect(wcwidthCp(0x1f600)).toBe(2);
  });

  it('returns -1 for control characters', () => {
    expect(wcwidthCp(0x07)).toBe(-1);
    expect(wcwidthCp(0x7f)).toBe(-1);
  });
});

describe('wcswidth', () => {
  it('sums widths', () => {
    expect(wcswidth('hello')).toBe(5);
    expect(wcswidth('中文')).toBe(4);
  });

  it('returns -1 for strings with control characters', () => {
    expect(wcswidth('a\x07b')).toBe(-1);
  });
});

describe('myanmarCellWidth (the contract)', () => {
  it('returns 2 for any Myanmar cluster (CLAUDE.md cell-width formula)', () => {
    expect(myanmarCellWidth('မ')).toBe(2);
    expect(myanmarCellWidth('မြန်')).toBe(2);
    expect(myanmarCellWidth('မင်္ဂလာ')).toBe(2);
  });

  it('falls back to wcswidth for non-Myanmar', () => {
    expect(myanmarCellWidth('hello')).toBe(5);
    expect(myanmarCellWidth('中')).toBe(2);
  });

  it('returns 0 for empty', () => {
    expect(myanmarCellWidth('')).toBe(0);
  });
});
