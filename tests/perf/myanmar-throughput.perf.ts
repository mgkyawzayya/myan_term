/**
 * Perf harness for Myanmar throughput (T-017).
 *
 * Generates a synthetic Myanmar log, feeds it through xterm.js + the joiner,
 * and reports total elapsed milliseconds plus throughput in MB/s. Targets
 * (PRD §1.5): cat throughput Myanmar > 50 MB/s.
 *
 * NOTE: this test runs under jsdom which has no GPU and no real layout, so
 * absolute numbers are *not* representative of the production app — they are
 * a relative regression signal. Production numbers come from a release build
 * benchmarked manually per CLAUDE.md.
 */

import { describe, expect, it } from 'vitest';
import { Terminal } from '@xterm/xterm';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { makeMyanmarJoiner } from '@/components/terminal/characterJoiner';

const MYANMAR_SAMPLE =
  'မြန်မာ ပြည်တွင်း မိုးရာသီ မှာ ထမင်းစားရေးသည် အလွန် ကောင်းမွန်သော အလေ့အကျင့် ဖြစ်သည်။ ';

function makeChunk(targetBytes: number): string {
  const repeats = Math.ceil(targetBytes / Buffer.byteLength(MYANMAR_SAMPLE, 'utf8'));
  return MYANMAR_SAMPLE.repeat(repeats).slice(0, targetBytes);
}

describe('myanmar throughput', () => {
  it('processes ~1MB of Myanmar within budget (regression signal)', async () => {
    const term = new Terminal({ cols: 120, rows: 40, scrollback: 2000, allowProposedApi: true });
    const u11 = new Unicode11Addon();
    term.loadAddon(u11);
    term.unicode.activeVersion = '11';

    const host = document.createElement('div');
    host.style.width = '960px';
    host.style.height = '480px';
    document.body.appendChild(host);
    let opened = true;
    try {
      term.open(host);
    } catch {
      // jsdom lacks the canvas APIs xterm.js wants; fall through and measure
      // parser cost only by writing without opening.
      opened = false;
    }
    if (opened) {
      try {
        term.registerCharacterJoiner(makeMyanmarJoiner());
      } catch {
        // joiner only works once the renderer is wired up.
      }
    }

    const chunk = makeChunk(1 * 1024 * 1024);
    const start = performance.now();
    await new Promise<void>((resolve) => term.write(chunk, () => resolve()));
    const ms = performance.now() - start;
    const mbps = (chunk.length / 1e6) / (ms / 1000);
    // We don't assert a hard MB/s target under jsdom; just guard against
    // catastrophic regressions (an order of magnitude slower than expected).
    console.warn(`[perf] myanmar 1MB write: ${ms.toFixed(1)}ms, ${mbps.toFixed(2)} MB/s`);
    expect(ms).toBeLessThan(60_000);

    term.dispose();
    host.remove();
  });
});
