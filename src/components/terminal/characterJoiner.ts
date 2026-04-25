/**
 * registerCharacterJoiner callback for xterm.js (CLAUDE.md §3, F-102).
 *
 * The joiner returns inclusive `[startCol, endCol]` cell ranges for runs that
 * the renderer should treat as a single rendering unit. We mark every Myanmar
 * run so the WebGL renderer doesn't split combining marks across cells.
 *
 * The callback is invoked with the line's text already flattened by xterm.js;
 * we walk it once per call. Performance is critical: this fires per redraw of
 * every visible row.
 */

import { isMyanmarCodepoint } from '@/lib/myanmar';

export type JoinerRange = [number, number];

/**
 * Build joiner ranges by walking the line string.
 *
 * IMPORTANT: xterm.js columns and JS string offsets diverge for wide chars and
 * surrogate pairs. The version here returns *string-offset* ranges. Callers
 * that need column ranges (because they want to position overlays) should pass
 * the result through `stringRangesToCellRanges` with the line's cell map.
 */
export function findRunsByCodepoint(line: string): JoinerRange[] {
  if (!line) return [];
  const ranges: JoinerRange[] = [];
  let runStart = -1;
  let i = 0;
  while (i < line.length) {
    const cp = line.codePointAt(i);
    if (cp === undefined) {
      i += 1;
      continue;
    }
    const len = cp > 0xffff ? 2 : 1;
    if (isMyanmarCodepoint(cp)) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      ranges.push([runStart, i - 1]);
      runStart = -1;
    }
    i += len;
  }
  if (runStart !== -1) ranges.push([runStart, line.length - 1]);
  return ranges;
}

/**
 * Produce a callback compatible with `term.registerCharacterJoiner`.
 *
 * xterm.js gives the joiner the raw rendered text of one line; the joiner
 * returns column index ranges (inclusive) that should be drawn as a single
 * unit. For our purposes the column index === string offset because Myanmar
 * codepoints all live in the BMP — but we still skip surrogate-low halves to
 * be robust.
 */
export function makeMyanmarJoiner(): (line: string) => JoinerRange[] {
  return (line: string) => findRunsByCodepoint(line);
}
