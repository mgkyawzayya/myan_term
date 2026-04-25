import type { TabState } from '@/types';

export function reorderTabs<T extends TabState>(
  tabs: T[],
  sourceId: string,
  targetId: string,
): T[] {
  if (sourceId === targetId) return tabs;
  const sourceIndex = tabs.findIndex((tab) => tab.id === sourceId);
  const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return tabs;

  const next = [...tabs];
  const moved = next[sourceIndex]!;
  next.splice(sourceIndex, 1);
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  next.splice(insertIndex, 0, moved);
  return next;
}
