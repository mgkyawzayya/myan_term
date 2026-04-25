/**
 * Myanmar codepoint detection and grapheme segmentation.
 *
 * Per CLAUDE.md project knowledge, Myanmar text spans three Unicode blocks:
 *   - Myanmar:           U+1000–U+109F
 *   - Myanmar Extended-B: U+A9E0–U+A9FF
 *   - Myanmar Extended-A: U+AA60–U+AA7F
 *
 * Grapheme clustering uses Intl.Segmenter (UAX #29) — never hand-roll.
 */

export const MYANMAR_BLOCK_PRIMARY = { start: 0x1000, end: 0x109f } as const;
export const MYANMAR_BLOCK_EXT_B = { start: 0xa9e0, end: 0xa9ff } as const;
export const MYANMAR_BLOCK_EXT_A = { start: 0xaa60, end: 0xaa7f } as const;

/** True if a single Unicode scalar value belongs to a Myanmar block. */
export function isMyanmarCodepoint(cp: number): boolean {
  return (
    (cp >= MYANMAR_BLOCK_PRIMARY.start && cp <= MYANMAR_BLOCK_PRIMARY.end) ||
    (cp >= MYANMAR_BLOCK_EXT_B.start && cp <= MYANMAR_BLOCK_EXT_B.end) ||
    (cp >= MYANMAR_BLOCK_EXT_A.start && cp <= MYANMAR_BLOCK_EXT_A.end)
  );
}

/** True if any codepoint in the string belongs to a Myanmar block. */
export function containsMyanmar(text: string): boolean {
  if (!text) return false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && isMyanmarCodepoint(cp)) return true;
  }
  return false;
}

let segmenter: Intl.Segmenter | null = null;
function getSegmenter(): Intl.Segmenter {
  if (!segmenter) {
    segmenter = new Intl.Segmenter('my', { granularity: 'grapheme' });
  }
  return segmenter;
}

/** Split text into grapheme clusters using Intl.Segmenter (UAX #29). */
export function graphemeClusters(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const seg of getSegmenter().segment(text)) {
    out.push(seg.segment);
  }
  return out;
}

/**
 * Walk the text and yield contiguous Myanmar runs.
 * Each yielded run carries the substring and the JS string offsets [start, end).
 *
 * Useful for the xterm.js character joiner — Myanmar runs need to be marked
 * as "treat as one rendering unit" so the WebGL renderer doesn't split them.
 */
export type MyanmarRun = {
  text: string;
  /** UTF-16 code unit offset (inclusive). */
  start: number;
  /** UTF-16 code unit offset (exclusive). */
  end: number;
};

export function findMyanmarRuns(line: string): MyanmarRun[] {
  if (!line) return [];
  const runs: MyanmarRun[] = [];
  let runStart = -1;
  let i = 0;
  while (i < line.length) {
    const cp = line.codePointAt(i);
    if (cp === undefined) {
      i += 1;
      continue;
    }
    const charLen = cp > 0xffff ? 2 : 1;
    const isMm = isMyanmarCodepoint(cp);
    if (isMm) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      runs.push({ text: line.slice(runStart, i), start: runStart, end: i });
      runStart = -1;
    }
    i += charLen;
  }
  if (runStart !== -1) {
    runs.push({ text: line.slice(runStart), start: runStart, end: line.length });
  }
  return runs;
}
