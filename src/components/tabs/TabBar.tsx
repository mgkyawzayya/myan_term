import { useCallback, useState } from 'react';
import { t } from '@/lib/i18n';
import type { TabState } from '@/types';

export type TabBarProps = {
  tabs: TabState[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (sourceId: string, targetId: string) => void;
  onNew: () => void;
};

/**
 * TabBar (T-055).
 *
 * ARIA model: the wrapping `<div>` advertises `role="tablist"`, each tab
 * button is a `role="tab"` with `aria-selected` reflecting active state, and
 * the close affordance is a real `<button>` with an explicit `aria-label`.
 * Focus rings use `focus-visible` so mouse users don't see the highlight.
 */
export function TabBar({ tabs, activeId, onSelect, onClose, onReorder, onNew }: TabBarProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleClose = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
      e.stopPropagation();
      onClose(id);
    },
    [onClose],
  );

  const clearDragState = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!draggedId || draggedId === targetId) {
        clearDragState();
        return;
      }
      onReorder(draggedId, targetId);
      clearDragState();
    },
    [clearDragState, draggedId, onReorder],
  );

  return (
    <div className="flex h-9 select-none items-center gap-1 border-b border-zinc-800/80 bg-zinc-950/60 px-2 backdrop-blur">
      <div
        role="tablist"
        aria-label={t('tab.list')}
        aria-orientation="horizontal"
        className="flex flex-1 items-center gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                draggable
                onClick={() => onSelect(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(tab.id);
                  }
                }}
                onDragStart={(e) => {
                  setDraggedId(tab.id);
                  setDragOverId(tab.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', tab.id);
                }}
                onDragEnter={() => {
                  if (draggedId && draggedId !== tab.id) setDragOverId(tab.id);
                }}
                onDragOver={(e) => {
                  if (!draggedId || draggedId === tab.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverId(tab.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(tab.id);
                }}
                onDragEnd={clearDragState}
                className={[
                  'group flex max-w-[220px] cursor-pointer items-center gap-2 rounded-md px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
                  isActive
                    ? 'bg-zinc-800/80 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200',
                  draggedId === tab.id ? 'opacity-60' : '',
                  dragOverId === tab.id && draggedId !== tab.id ? 'ring-2 ring-emerald-500/50' : '',
                ].join(' ')}
                title={tab.title}
              >
              <span className="truncate">{tab.title || t('tab.untitled')}</span>
              <button
                type="button"
                aria-label={`${t('tab.close')}: ${tab.title || t('tab.untitled')}`}
                onClick={(e) => handleClose(e, tab.id)}
                className="rounded px-1 text-zinc-500 opacity-0 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 group-hover:opacity-100 hover:bg-zinc-700/60 hover:text-zinc-100"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onNew}
        aria-label={t('tab.new')}
        title={`${t('tab.new')} (⌘T)`}
        className="rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
