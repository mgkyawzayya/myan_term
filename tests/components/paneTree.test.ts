import { describe, expect, it } from 'vitest';
import {
  closeLeaf,
  findLeaf,
  findLeafIds,
  neighborLeaf,
  newLeaf,
  splitLeaf,
  updateRatios,
  type PaneNode,
  type SplitNode,
} from '@/components/panes/paneTree';

describe('paneTree.newLeaf', () => {
  it('creates a leaf with a unique id when none is provided', () => {
    const a = newLeaf();
    const b = newLeaf();
    expect(a.kind).toBe('leaf');
    expect(b.kind).toBe('leaf');
    expect(a.id).not.toEqual(b.id);
  });

  it('uses the provided id when given', () => {
    expect(newLeaf('explicit').id).toBe('explicit');
  });
});

describe('paneTree.findLeaf / findLeafIds', () => {
  it('locates a leaf in a single-leaf tree', () => {
    const tree = newLeaf('only');
    expect(findLeafIds(tree)).toEqual(['only']);
    const found = findLeaf(tree, 'only');
    expect(found).not.toBeNull();
    expect(found?.path).toEqual([]);
  });

  it('locates leaves inside nested splits with full path', () => {
    const { tree } = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b');
    const { tree: tree2 } = splitLeaf(tree, 'b', 'vertical', 'c');
    expect(findLeafIds(tree2).sort()).toEqual(['a', 'b', 'c']);
    const found = findLeaf(tree2, 'c');
    expect(found?.path).toEqual([1, 1]);
  });

  it('returns null when leaf is missing', () => {
    expect(findLeaf(newLeaf('a'), 'missing')).toBeNull();
  });
});

describe('paneTree.splitLeaf', () => {
  it('replaces a single leaf with a 50/50 horizontal split', () => {
    const start = newLeaf('a');
    const { tree, newLeafId } = splitLeaf(start, 'a', 'horizontal', 'b');
    expect(tree.kind).toBe('split');
    const split = tree as SplitNode;
    expect(split.orientation).toBe('horizontal');
    expect(split.ratios).toEqual([0.5, 0.5]);
    expect(split.children.length).toBe(2);
    expect(split.children[0]).toEqual({ kind: 'leaf', id: 'a' });
    expect(split.children[1]).toEqual({ kind: 'leaf', id: 'b' });
    expect(newLeafId).toBe('b');
  });

  it('splits a leaf inside an existing split', () => {
    const { tree: t1 } = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b');
    const { tree: t2, newLeafId } = splitLeaf(t1, 'b', 'vertical', 'c');
    expect(newLeafId).toBe('c');
    expect(findLeafIds(t2).sort()).toEqual(['a', 'b', 'c']);
    const root = t2 as SplitNode;
    expect(root.orientation).toBe('horizontal');
    const inner = root.children[1] as SplitNode;
    expect(inner.kind).toBe('split');
    expect(inner.orientation).toBe('vertical');
    expect(inner.children.map((c) => (c.kind === 'leaf' ? c.id : ''))).toEqual(['b', 'c']);
  });

  it('returns the original tree unchanged when leafId is missing', () => {
    const start = newLeaf('a');
    const { tree } = splitLeaf(start, 'missing', 'horizontal');
    expect(tree).toBe(start);
  });
});

describe('paneTree.closeLeaf', () => {
  it('returns null when closing the only leaf', () => {
    const tree = newLeaf('only');
    expect(closeLeaf(tree, 'only')).toBeNull();
  });

  it('collapses a parent split when only one child remains', () => {
    const { tree } = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b');
    const closed = closeLeaf(tree, 'b');
    expect(closed).not.toBeNull();
    expect(closed?.kind).toBe('leaf');
    if (closed?.kind === 'leaf') expect(closed.id).toBe('a');
  });

  it('keeps a split intact when more than one child survives', () => {
    let tree: PaneNode = newLeaf('a');
    tree = splitLeaf(tree, 'a', 'horizontal', 'b').tree;
    tree = splitLeaf(tree, 'b', 'horizontal', 'c').tree;
    // tree: split-h [ a, split-h [ b, c ] ]
    const closed = closeLeaf(tree, 'a');
    expect(closed).not.toBeNull();
    expect(closed?.kind).toBe('split');
    const ids = findLeafIds(closed as PaneNode).sort();
    expect(ids).toEqual(['b', 'c']);
  });

  it('renormalises ratios when a sibling is removed', () => {
    let tree: PaneNode = newLeaf('a');
    tree = splitLeaf(tree, 'a', 'horizontal', 'b').tree;
    tree = splitLeaf(tree, 'b', 'horizontal', 'c').tree;
    // After splitting 'b' inside the existing horizontal split, react-resizable
    // gets a 3-way split via flatten? In our implementation it nests, so the
    // parent has children [a, split[b,c]]. Closing 'a' collapses the parent
    // into the inner split, so ratios stay [0.5,0.5].
    tree = updateRatios(tree, (tree as SplitNode).id, [0.7, 0.3]);
    const closed = closeLeaf(tree, 'a') as SplitNode;
    expect(closed.kind).toBe('split');
    expect(closed.ratios.length).toBe(2);
    const total = closed.ratios.reduce((s, r) => s + r, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('returns the original tree when leaf is not present', () => {
    const tree: PaneNode = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b').tree;
    expect(closeLeaf(tree, 'missing')).toBe(tree);
  });
});

describe('paneTree.updateRatios', () => {
  it('normalises new ratios to sum to 1', () => {
    const start = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b').tree as SplitNode;
    const next = updateRatios(start, start.id, [70, 30]) as SplitNode;
    expect(next.ratios[0]).toBeCloseTo(0.7, 6);
    expect(next.ratios[1]).toBeCloseTo(0.3, 6);
  });

  it('rejects updates whose length differs from children count', () => {
    const start = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b').tree as SplitNode;
    const next = updateRatios(start, start.id, [0.5, 0.3, 0.2]);
    expect(next).toBe(start);
  });

  it('leaves the tree alone when splitId is unknown', () => {
    const start = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b').tree;
    const next = updateRatios(start, 'unknown', [0.6, 0.4]);
    expect(next).toBe(start);
  });
});

describe('paneTree.neighborLeaf', () => {
  it('finds a left/right neighbour in a horizontal split', () => {
    const { tree } = splitLeaf(newLeaf('a'), 'a', 'horizontal', 'b');
    expect(neighborLeaf(tree, 'a', 'right')).toBe('b');
    expect(neighborLeaf(tree, 'b', 'left')).toBe('a');
    expect(neighborLeaf(tree, 'a', 'up')).toBeNull();
    expect(neighborLeaf(tree, 'b', 'down')).toBeNull();
  });

  it('finds an up/down neighbour in a vertical split', () => {
    const { tree } = splitLeaf(newLeaf('a'), 'a', 'vertical', 'b');
    expect(neighborLeaf(tree, 'a', 'down')).toBe('b');
    expect(neighborLeaf(tree, 'b', 'up')).toBe('a');
    expect(neighborLeaf(tree, 'a', 'left')).toBeNull();
  });

  it('descends into the boundary leaf across nested splits', () => {
    // Layout:
    //   horizontal: [ A, vertical: [ B, C ] ]
    let tree: PaneNode = newLeaf('A');
    tree = splitLeaf(tree, 'A', 'horizontal', 'B').tree;
    tree = splitLeaf(tree, 'B', 'vertical', 'C').tree;
    // Moving right from A should land on the topmost leaf of the right
    // subtree, which is B.
    expect(neighborLeaf(tree, 'A', 'right')).toBe('B');
    // Moving left from B/C should always land on A.
    expect(neighborLeaf(tree, 'B', 'left')).toBe('A');
    expect(neighborLeaf(tree, 'C', 'left')).toBe('A');
  });

  it('returns null when no neighbour exists in the requested direction', () => {
    expect(neighborLeaf(newLeaf('only'), 'only', 'left')).toBeNull();
  });
});
