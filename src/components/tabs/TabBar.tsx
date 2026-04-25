import { useCallback } from 'react';
import { t } from '@/lib/i18n';
import type { TabState } from '@/types';

export type TabBarProps = {
  tabs: TabState[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
};

export function TabBar({ tabs, activeId, onSelect, onClose, onNew }: TabBarProps) {
  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onClose(id);
    },
    [onClose],
  );

  return (
    <div className="flex h-9 select-none items-center gap-1 border-b border-zinc-800/80 bg-zinc-950/60 px-2 backdrop-blur">
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={[
                'group flex max-w-[220px] items-center gap-2 rounded-md px-3 py-1 text-xs transition',
                isActive
                  ? 'bg-zinc-800/80 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200',
              ].join(' ')}
              title={tab.title}
            >
              <span className="truncate">{tab.title || t('tab.untitled')}</span>
              <span
                role="button"
                aria-label={t('tab.close')}
                onClick={(e) => handleClose(e, tab.id)}
                className="rounded px-1 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-700/60 hover:text-zinc-100"
              >
                ×
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onNew}
        className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
        title={`${t('tab.new')} (⌘T)`}
      >
        +
      </button>
    </div>
  );
}
