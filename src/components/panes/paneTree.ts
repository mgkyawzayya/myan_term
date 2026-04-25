/**
 * Pane tree (T-029).
 *
 * Recursive immutable data structure used to describe the panel layout of a
 * single tab. A `LeafNode` corresponds to one terminal (one PTY); a
 * `SplitNode` arranges its children either side-by-side (`horizontal` —
 * vertical divider) or stacked (`vertical` — horizontal divider).
 *
 * All helpers below are pure: they never mutate the input tree, instead they
 * return a new tree that shares unchanged subtrees with the original. This
 * keeps React reconciliation cheap and lets `<Terminal>` instances survive
 * unrelated splits/resizes (their key — the leaf id — is stable).
 */

export type LeafNode = { kind: 'leaf'; id: string };

export type SplitOrientation = 'horizontal' | 'vertical';

export type SplitNode = {
  kind: 'split';
  id: string;
  /**
   * `horizontal` = side-by-side panes separated by a vertical divider.
   * `vertical`   = stacked panes separated by a horizontal divider.
   */
  orientation: SplitOrientation;
  ratios: number[];
  children: PaneNode[];
};

export type PaneNode = LeafNode | SplitNode;

export type PaneDirection = 'left' | 'right' | 'up' | 'down';

function genId(prefix: 'leaf' | 'split'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function newLeaf(id?: string): LeafNode {
  return { kind: 'leaf', id: id ?? genId('leaf') };
}

export function findLeafIds(tree: PaneNode): string[] {
  if (tree.kind === 'leaf') return [tree.id];
  const out: string[] = [];
  for (const child of tree.children) out.push(...findLeafIds(child));
  return out;
}

export function findLeaf(
  tree: PaneNode,
  id: string,
  path: number[] = [],
): { node: LeafNode; path: number[] } | null {
  if (tree.kind === 'leaf') {
    return tree.id === id ? { node: tree, path } : null;
  }
  for (let i = 0; i < tree.children.length; i++) {
    const child = tree.children[i];
    if (!child) continue;
    const found = findLeaf(child, id, [...path, i]);
    if (found) return found;
  }
  return null;
}

/**
 * Replace the leaf identified by `leafId` with a 50/50 split that reuses the
 * original leaf as its first child and a fresh leaf as its second.
 */
export function splitLeaf(
  tree: PaneNode,
  leafId: string,
  orientation: SplitOrientation,
  newLeafId?: string,
): { tree: PaneNode; newLeafId: string } {
  const fresh = newLeaf(newLeafId);

  function recurse(node: PaneNode): PaneNode {
    if (node.kind === 'leaf') {
      if (node.id !== leafId) return node;
      const split: SplitNode = {
        kind: 'split',
        id: genId('split'),
        orientation,
        ratios: [0.5, 0.5],
        children: [node, fresh],
      };
      return split;
    }
    let changed = false;
    const nextChildren = node.children.map((c) => {
      const next = recurse(c);
      if (next !== c) changed = true;
      return next;
    });
    if (!changed) return node;
    return { ...node, children: nextChildren };
  }

  return { tree: recurse(tree), newLeafId: fresh.id };
}

/**
 * Remove the leaf with `leafId`. If its parent split is left with a single
 * child, that child collapses into the parent's slot. If the entire tree was
 * just the targeted leaf, returns `null` (caller should handle empty tree).
 */
export function closeLeaf(tree: PaneNode, leafId: string): PaneNode | null {
  if (tree.kind === 'leaf') {
    return tree.id === leafId ? null : tree;
  }

  // Recurse first so deeper collapses propagate up. Track which original
  // child indices survive so we can preserve their ratios.
  const updatedChildren: PaneNode[] = [];
  const survivingRatios: number[] = [];
  let changed = false;
  for (let i = 0; i < tree.children.length; i++) {
    const child = tree.children[i];
    if (!child) continue;
    const next = closeLeaf(child, leafId);
    if (next !== child) changed = true;
    if (next != null) {
      updatedChildren.push(next);
      survivingRatios.push(tree.ratios[i] ?? 0);
    }
  }

  if (!changed) return tree;

  if (updatedChildren.length === 0) return null;
  if (updatedChildren.length === 1) {
    // Collapse: parent becomes its single remaining child.
    return updatedChildren[0] ?? null;
  }

  const sum = survivingRatios.reduce((a, b) => a + b, 0);
  const nextRatios =
    sum > 0
      ? survivingRatios.map((r) => r / sum)
      : updatedChildren.map(() => 1 / updatedChildren.length);

  return { ...tree, children: updatedChildren, ratios: nextRatios };
}

export function updateRatios(tree: PaneNode, splitId: string, next: number[]): PaneNode {
  if (tree.kind === 'leaf') return tree;
  if (tree.id === splitId) {
    if (next.length !== tree.children.length) return tree;
    const sum = next.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sum) || sum <= 0) return tree;
    const normalised = next.map((r) => r / sum);
    return { ...tree, ratios: normalised };
  }
  let changed = false;
  const nextChildren = tree.children.map((c) => {
    const r = updateRatios(c, splitId, next);
    if (r !== c) changed = true;
    return r;
  });
  if (!changed) return tree;
  return { ...tree, children: nextChildren };
}

/**
 * Walk the tree to find the nearest leaf in the requested direction relative
 * to `fromLeafId`. Returns `null` when there is no neighbour (e.g. the leaf is
 * at the edge of the layout).
 *
 * Algorithm: walk up the path until we find an ancestor split whose
 * orientation matches the requested axis and whose child along the path has a
 * sibling on the desired side. From there, descend into the sibling subtree
 * picking the boundary child closest to the original leaf.
 */
export function neighborLeaf(
  tree: PaneNode,
  fromLeafId: string,
  dir: PaneDirection,
): string | null {
  const located = findLeaf(tree, fromLeafId);
  if (!located) return null;

  const wantOrientation: SplitOrientation =
    dir === 'left' || dir === 'right' ? 'horizontal' : 'vertical';
  const wantPositive = dir === 'right' || dir === 'down';

  // Reconstruct the chain of ancestor split nodes along the path.
  const ancestors: SplitNode[] = [];
  {
    let cur: PaneNode = tree;
    for (const idx of located.path) {
      if (cur.kind !== 'split') break;
      ancestors.push(cur);
      const child = cur.children[idx];
      if (!child) break;
      cur = child;
    }
  }

  for (let depth = ancestors.length - 1; depth >= 0; depth--) {
    const ancestor = ancestors[depth];
    if (!ancestor) continue;
    if (ancestor.orientation !== wantOrientation) continue;
    const childIdx = located.path[depth];
    if (childIdx == null) continue;
    const siblingIdx = wantPositive ? childIdx + 1 : childIdx - 1;
    if (siblingIdx < 0 || siblingIdx >= ancestor.children.length) continue;
    const sibling = ancestor.children[siblingIdx];
    if (!sibling) continue;
    return descendBoundary(sibling, wantOrientation, !wantPositive);
  }

  return null;
}

/**
 * Descend into `node` always picking the first or last child along splits of
 * matching orientation; for splits of the perpendicular orientation pick the
 * first child as a stable default. Returns the leaf id at the boundary.
 */
function descendBoundary(
  node: PaneNode,
  axis: SplitOrientation,
  pickFirst: boolean,
): string {
  let cur: PaneNode = node;
  while (cur.kind === 'split') {
    if (cur.orientation === axis) {
      const idx = pickFirst ? 0 : cur.children.length - 1;
      const next = cur.children[idx];
      if (!next) break;
      cur = next;
    } else {
      const next = cur.children[0];
      if (!next) break;
      cur = next;
    }
  }
  if (cur.kind === 'leaf') return cur.id;
  // Should be unreachable, but fall back to a known leaf.
  const ids = findLeafIds(cur);
  return ids[0] ?? '';
}
