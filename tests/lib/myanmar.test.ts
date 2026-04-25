import { describe, expect, it } from 'vitest';
import {
  containsMyanmar,
  findMyanmarRuns,
  graphemeClusters,
  isMyanmarCodepoint,
  MYANMAR_BLOCK_EXT_A,
  MYANMAR_BLOCK_EXT_B,
  MYANMAR_BLOCK_PRIMARY,
} from '@/lib/myanmar';

describe('isMyanmarCodepoint', () => {
  it('matches the primary block boundaries', () => {
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_PRIMARY.start)).toBe(true);
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_PRIMARY.end)).toBe(true);
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_PRIMARY.start - 1)).toBe(false);
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_PRIMARY.end + 1)).toBe(false);
  });

  it('matches Myanmar Extended-B', () => {
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_EXT_B.start)).toBe(true);
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_EXT_B.end)).toBe(true);
  });

  it('matches Myanmar Extended-A', () => {
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_EXT_A.start)).toBe(true);
    expect(isMyanmarCodepoint(MYANMAR_BLOCK_EXT_A.end)).toBe(true);
  });

  it('rejects ASCII', () => {
    for (let cp = 0x20; cp < 0x7e; cp += 1) {
      expect(isMyanmarCodepoint(cp)).toBe(false);
    }
  });

  it('rejects CJK and emoji', () => {
    expect(isMyanmarCodepoint(0x4e2d)).toBe(false); // 中
    expect(isMyanmarCodepoint(0x1f600)).toBe(false); // 😀
  });
});

describe('containsMyanmar', () => {
  it('returns false for empty string', () => {
    expect(containsMyanmar('')).toBe(false);
  });

  it('returns false for pure ASCII', () => {
    expect(containsMyanmar('git status -s')).toBe(false);
  });

  it('returns true when any Myanmar codepoint appears', () => {
    expect(containsMyanmar('မင်္ဂလာပါ')).toBe(true);
    expect(containsMyanmar('hello မြန်မာ world')).toBe(true);
  });
});

describe('graphemeClusters', () => {
  it('splits ASCII per character', () => {
    expect(graphemeClusters('abc')).toEqual(['a', 'b', 'c']);
  });

  it('keeps Myanmar combining sequences together', () => {
    // မြန်မာ — 4 visible syllables; segmenter should give exactly 4 graphemes.
    expect(graphemeClusters('မြန်မာ').length).toBe(4);
  });

  it('keeps emoji ZWJ sequences together', () => {
    expect(graphemeClusters('👩‍💻')).toEqual(['👩‍💻']);
  });
});

describe('findMyanmarRuns', () => {
  it('returns no runs for ASCII-only', () => {
    expect(findMyanmarRuns('hello world')).toEqual([]);
  });

  it('returns the whole string for pure Myanmar', () => {
    const runs = findMyanmarRuns('မင်္ဂလာပါ');
    expect(runs.length).toBe(1);
    expect(runs[0]?.start).toBe(0);
    expect(runs[0]?.end).toBe('မင်္ဂလာပါ'.length);
  });

  it('finds Myanmar islands inside ASCII', () => {
    const text = 'hi မြန်မာ end';
    const runs = findMyanmarRuns(text);
    expect(runs.length).toBe(1);
    expect(text.slice(runs[0]!.start, runs[0]!.end)).toBe('မြန်မာ');
  });

  it('finds multiple Myanmar runs separated by ASCII', () => {
    const runs = findMyanmarRuns('a မြန် b မာ c');
    expect(runs.length).toBe(2);
  });
});
