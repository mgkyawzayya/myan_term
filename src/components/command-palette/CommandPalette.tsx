import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { t } from '@/lib/i18n';
import { themeIds } from '@/lib/themes';
import type { SshProfile, ThemeId } from '@/types';

export type PaletteAction =
  | { kind: 'new-tab' }
  | { kind: 'close-tab' }
  | { kind: 'open-settings' }
  | { kind: 'theme'; id: ThemeId }
  | { kind: 'connect-profile'; id: string };

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: SshProfile[];
  onAction: (action: PaletteAction) => void;
};

export function CommandPalette({ open, onOpenChange, profiles, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  const fire = (action: PaletteAction) => {
    onOpenChange(false);
    onAction(action);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-24 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <Command
        label="Command palette"
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl"
        loop
      >
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={t('palette.placeholder')}
          className="w-full bg-transparent px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        />
        <Command.List className="max-h-[360px] overflow-y-auto border-t border-zinc-800/60 p-2">
          <Command.Empty className="px-2 py-4 text-center text-xs text-zinc-500">
            {t('palette.empty')}
          </Command.Empty>
          <Command.Group heading="General" className="text-[10px] uppercase tracking-wide text-zinc-500">
            <Command.Item onSelect={() => fire({ kind: 'new-tab' })} className={paletteItemClass}>
              <span>{t('tab.new')}</span>
              <kbd className={kbdClass}>⌘T</kbd>
            </Command.Item>
            <Command.Item onSelect={() => fire({ kind: 'close-tab' })} className={paletteItemClass}>
              <span>{t('tab.close')}</span>
              <kbd className={kbdClass}>⌘W</kbd>
            </Command.Item>
            <Command.Item
              onSelect={() => fire({ kind: 'open-settings' })}
              className={paletteItemClass}
            >
              <span>{t('settings.open')}</span>
              <kbd className={kbdClass}>⌘,</kbd>
            </Command.Item>
          </Command.Group>
          <Command.Group heading="Themes" className="mt-2 text-[10px] uppercase tracking-wide text-zinc-500">
            {themeIds.map((id) => (
              <Command.Item
                key={id}
                onSelect={() => fire({ kind: 'theme', id })}
                className={paletteItemClass}
              >
                <span>{labelForTheme(id)}</span>
              </Command.Item>
            ))}
          </Command.Group>
          {profiles.length > 0 && (
            <Command.Group
              heading="SSH profiles"
              className="mt-2 text-[10px] uppercase tracking-wide text-zinc-500"
            >
              {profiles.map((p) => (
                <Command.Item
                  key={p.id}
                  onSelect={() => fire({ kind: 'connect-profile', id: p.id })}
                  className={paletteItemClass}
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-zinc-500">
                    {p.user ? `${p.user}@${p.host}` : p.host}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

const paletteItemClass =
  'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-zinc-300 aria-selected:bg-zinc-800/80 aria-selected:text-zinc-100';
const kbdClass =
  'rounded border border-zinc-700/80 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400';

function labelForTheme(id: ThemeId): string {
  switch (id) {
    case 'one-dark':
      return 'One Dark';
    case 'solarized-dark':
      return 'Solarized Dark';
    case 'solarized-light':
      return 'Solarized Light';
    case 'dracula':
      return 'Dracula';
    case 'nord':
      return 'Nord';
    case 'tokyo-night':
      return 'Tokyo Night';
  }
}
