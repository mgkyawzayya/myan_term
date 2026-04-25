/**
 * SplitPane (T-030, T-032).
 *
 * Recursive React component that mirrors a `PaneNode` tree onto
 * `react-resizable-panels`. Leaf nodes are rendered via the caller-provided
 * `renderLeaf` callback wrapped in a focus-aware container; split nodes render
 * as a `Group` of `Panel` + `Separator` children.
 *
 * The component is layout-only — it never owns terminal state. PTY resizing
 * still happens inside `<Terminal>` via its `ResizeObserver`, which fires when
 * `react-resizable-panels` updates the panel widths/heights (CLAUDE.md R2).
 */
import { useCallback } from 'react';
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels';
import {
  updateRatios,
  type PaneNode,
  type SplitNode,
} from './paneTree';

export type SplitPaneProps = {
  tree: PaneNode;
  focusedLeafId: string;
  onFocusLeaf: (id: string) => void;
  onTreeChange: (next: PaneNode) => void;
  renderLeaf: (id: string) => React.ReactNode;
  /**
   * The full root tree. Used internally so child `SplitPane` instances can
   * dispatch ratio updates relative to the entire tab tree rather than the
   * subtree they happen to render. External callers usually do not pass this.
   */
  rootTree?: PaneNode;
};

export function SplitPane(props: SplitPaneProps) {
  const { tree, focusedLeafId, onFocusLeaf, onTreeChange, renderLeaf } = props;
  const root = props.rootTree ?? tree;

  if (tree.kind === 'leaf') {
    const isFocused = tree.id === focusedLeafId;
    return (
      <div
        data-leaf-id={tree.id}
        onMouseDownCapture={() => {
          if (!isFocused) onFocusLeaf(tree.id);
        }}
        onFocusCapture={() => {
          if (!isFocused) onFocusLeaf(tree.id);
        }}
        className={[
          'relative h-full w-full overflow-hidden rounded-[2px]',
          isFocused ? 'ring-2 ring-emerald-500/40' : 'ring-0',
        ].join(' ')}
      >
        {renderLeaf(tree.id)}
      </div>
    );
  }

  return (
    <SplitGroup
      split={tree}
      root={root}
      focusedLeafId={focusedLeafId}
      onFocusLeaf={onFocusLeaf}
      onTreeChange={onTreeChange}
      renderLeaf={renderLeaf}
    />
  );
}

type SplitGroupProps = {
  split: SplitNode;
  root: PaneNode;
  focusedLeafId: string;
  onFocusLeaf: (id: string) => void;
  onTreeChange: (next: PaneNode) => void;
  renderLeaf: (id: string) => React.ReactNode;
};

function SplitGroup({
  split,
  root,
  focusedLeafId,
  onFocusLeaf,
  onTreeChange,
  renderLeaf,
}: SplitGroupProps) {
  const handleLayoutChanged = useCallback(
    (layout: Layout) => {
      const next: number[] = [];
      for (const child of split.children) {
        const id = panelId(split.id, child);
        const value = layout[id];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          // Bail out if any panel is missing — react-resizable should always
          // include every panel id we rendered.
          return;
        }
        next.push(value);
      }
      const sum = next.reduce((a, b) => a + b, 0);
      if (sum <= 0) return;
      const normalised = next.map((v) => v / sum);
      // Cheap equality: avoid pushing identical updates that would just trigger
      // pointless re-renders.
      const same = split.ratios.every(
        (r, i) => Math.abs(r - (normalised[i] ?? 0)) < 1e-4,
      );
      if (same) return;
      onTreeChange(updateRatios(root, split.id, normalised));
    },
    [split, root, onTreeChange],
  );

  return (
    <Group
      orientation={split.orientation}
      onLayoutChanged={handleLayoutChanged}
      className="h-full w-full"
    >
      {split.children.flatMap((child, idx) => {
        const ratio = split.ratios[idx] ?? 1 / split.children.length;
        const items: React.ReactNode[] = [
          <Panel
            key={panelId(split.id, child)}
            id={panelId(split.id, child)}
            defaultSize={ratio * 100}
            minSize={5}
            className="h-full w-full"
          >
            <SplitPane
              tree={child}
              rootTree={root}
              focusedLeafId={focusedLeafId}
              onFocusLeaf={onFocusLeaf}
              onTreeChange={onTreeChange}
              renderLeaf={renderLeaf}
            />
          </Panel>,
        ];
        if (idx < split.children.length - 1) {
          items.push(
            <Separator
              key={`sep-${split.id}-${idx}`}
              className={[
                'shrink-0 bg-zinc-800 transition-colors hover:bg-emerald-500/40',
                split.orientation === 'horizontal' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize',
              ].join(' ')}
            />,
          );
        }
        return items;
      })}
    </Group>
  );
}

function panelId(splitId: string, child: PaneNode): string {
  return child.kind === 'leaf' ? `${splitId}::leaf:${child.id}` : `${splitId}::split:${child.id}`;
}
