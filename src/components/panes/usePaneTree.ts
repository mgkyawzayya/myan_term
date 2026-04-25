/**
 * usePaneTree (T-031).
 *
 * Encapsulates a single tab's pane layout. The tree itself plus the focused
 * leaf id are owned by the caller (so that they can be persisted alongside
 * the rest of `StoredTab`); the hook just exposes pure transformations on top
 * of the existing setters.
 */
import { useCallback } from 'react';
import {
  closeLeaf,
  findLeafIds,
  neighborLeaf,
  splitLeaf,
  type PaneDirection,
  type PaneNode,
  type SplitOrientation,
} from './paneTree';

export type UsePaneTreeArgs = {
  tree: PaneNode;
  focusedLeafId: string;
  setTree: (next: PaneNode) => void;
  setFocused: (id: string) => void;
};

export type UsePaneTreeReturn = {
  tree: PaneNode;
  focusedLeafId: string;
  setTree: (next: PaneNode) => void;
  setFocused: (id: string) => void;
  splitFocused: (orientation: SplitOrientation) => string | null;
  closeFocused: () => boolean;
  focusNeighbor: (dir: PaneDirection) => boolean;
};

export function usePaneTree({
  tree,
  focusedLeafId,
  setTree,
  setFocused,
}: UsePaneTreeArgs): UsePaneTreeReturn {
  const splitFocused = useCallback(
    (orientation: SplitOrientation): string | null => {
      const target = focusedLeafId;
      if (!target) return null;
      const { tree: next, newLeafId } = splitLeaf(tree, target, orientation);
      if (next === tree) return null;
      setTree(next);
      setFocused(newLeafId);
      return newLeafId;
    },
    [tree, focusedLeafId, setTree, setFocused],
  );

  const closeFocused = useCallback((): boolean => {
    const target = focusedLeafId;
    if (!target) return false;
    const next = closeLeaf(tree, target);
    if (next === null) return false; // signal: tree is empty, caller closes the tab
    if (next === tree) return false;
    setTree(next);
    const remaining = findLeafIds(next);
    if (remaining.length > 0) {
      const fallback = remaining[0];
      if (fallback) setFocused(fallback);
    }
    return true;
  }, [tree, focusedLeafId, setTree, setFocused]);

  const focusNeighbor = useCallback(
    (dir: PaneDirection): boolean => {
      const id = neighborLeaf(tree, focusedLeafId, dir);
      if (!id) return false;
      setFocused(id);
      return true;
    },
    [tree, focusedLeafId, setFocused],
  );

  return {
    tree,
    focusedLeafId,
    setTree,
    setFocused,
    splitFocused,
    closeFocused,
    focusNeighbor,
  };
}
