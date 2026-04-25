/**
 * T-042 — session restore round-trip tests.
 *
 * These tests pin the JSON contract between the React frontend and the Rust
 * `SessionStore`. Specifically:
 *   1. `PaneNode` is plain JSON (no class instances, no `Map`/`Set`) so a
 *      `JSON.parse(JSON.stringify(...))` round-trip is lossless. The Rust
 *      backend stores the pane tree as opaque `serde_json::Value`, so
 *      losslessness on the frontend side is the entire correctness story.
 *   2. `safeAsPaneTree` rejects malformed payloads (e.g. missing `kind`)
 *      so a corrupt `session.json` can never crash the app on launch
 *      (CLAUDE.md §1 robustness).
 */
import { describe, expect, it } from 'vitest';
import { newLeaf, splitLeaf, type PaneNode } from '@/components/panes/paneTree';
import { safeAsPaneTree } from '@/App';
import type { SessionState } from '@/lib/tauri';

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeState(tree: PaneNode, focused: string): SessionState {
  return {
    schema_version: 1,
    active_tab_id: 'tab-1',
    tabs: [
      {
        id: 'tab-1',
        title: 'Terminal',
        cwd: '/tmp',
        pane_tree: tree,
        focused_leaf_id: focused,
        shell_override: null,
      },
    ],
  };
}

describe('session round-trip', () => {
  it('round-trips a single-leaf tree losslessly', () => {
    const leaf = newLeaf('leaf-only');
    const state = makeState(leaf, 'leaf-only');
    const after = roundTrip(state);
    expect(after).toEqual(state);
    expect((after.tabs[0]?.pane_tree as PaneNode).kind).toBe('leaf');
  });

  it('round-trips a nested split losslessly (incl. ratios + child ids)', () => {
    const a = newLeaf('a');
    const { tree: t1 } = splitLeaf(a, 'a', 'horizontal', 'b');
    const { tree: t2 } = splitLeaf(t1, 'b', 'vertical', 'c');
    const state = makeState(t2, 'c');
    const after = roundTrip(state);
    expect(after).toEqual(state);
    // Spot-check that the nested split structure survives byte-for-byte.
    const tree = after.tabs[0]?.pane_tree as PaneNode;
    expect(tree.kind).toBe('split');
    if (tree.kind === 'split') {
      expect(tree.children).toHaveLength(2);
      expect(tree.ratios).toEqual([0.5, 0.5]);
    }
  });

  it('preserves shell_override across round-trip', () => {
    const leaf = newLeaf('a');
    const state: SessionState = {
      schema_version: 1,
      active_tab_id: 'tab-1',
      tabs: [
        {
          id: 'tab-1',
          title: 'ssh prod',
          cwd: null,
          pane_tree: leaf,
          focused_leaf_id: 'a',
          shell_override: { program: '/usr/bin/ssh', args: ['user@prod'] },
        },
      ],
    };
    expect(roundTrip(state)).toEqual(state);
  });
});

describe('safeAsPaneTree', () => {
  it('accepts a valid leaf', () => {
    const leaf = newLeaf('a');
    expect(safeAsPaneTree(leaf)).toEqual(leaf);
  });

  it('accepts a valid split', () => {
    const { tree } = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b');
    expect(safeAsPaneTree(tree)).toEqual(tree);
  });

  it('rejects null / non-object payloads', () => {
    expect(safeAsPaneTree(null)).toBeNull();
    expect(safeAsPaneTree(undefined)).toBeNull();
    expect(safeAsPaneTree(42)).toBeNull();
    expect(safeAsPaneTree('leaf')).toBeNull();
  });

  it('rejects an object missing the discriminant `kind`', () => {
    // E.g. a value migrated from a future schema that drops `kind`.
    expect(safeAsPaneTree({ id: 'x', children: [] })).toBeNull();
  });

  it('rejects an object with an unknown `kind`', () => {
    expect(safeAsPaneTree({ kind: 'tabbed', id: 'x' })).toBeNull();
  });
});
