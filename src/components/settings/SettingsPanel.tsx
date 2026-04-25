import { useState } from 'react';
import { themeIds } from '@/lib/themes';
import { t } from '@/lib/i18n';
import { isTauri } from '@/lib/tauri';
import type { CursorStyle, Settings, ThemeId } from '@/types';

export type SettingsPanelProps = {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (next: Settings) => void;
};

export function SettingsPanel({ open, settings, onClose, onChange }: SettingsPanelProps) {
  const [section, setSection] = useState<'appearance' | 'cursor' | 'shell' | 'advanced'>(
    'appearance',
  );

  if (!open) return null;

  const update = (mut: (draft: Settings) => Settings) => onChange(mut(structuredClone(settings)));

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[560px] w-[820px] max-w-[94vw] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <nav className="flex w-44 flex-col gap-1 border-r border-zinc-800 bg-zinc-900/50 p-3 text-sm">
          {(['appearance', 'cursor', 'shell', 'advanced'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={[
                'rounded-md px-3 py-2 text-left capitalize transition',
                section === id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100',
              ].join(' ')}
            >
              {id}
            </button>
          ))}
          <div className="mt-auto px-3 py-2 text-[10px] text-zinc-500">MyanTerm 0.1.0</div>
        </nav>
        <div className="flex-1 overflow-y-auto p-6 text-sm text-zinc-200">
          {section === 'appearance' && (
            <div className="space-y-5">
              <Field label={t('settings.theme')}>
                <select
                  value={settings.theme}
                  onChange={(e) =>
                    update((d) => {
                      d.theme = e.target.value as ThemeId;
                      return d;
                    })
                  }
                  className={selectClass}
                >
                  {themeIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('settings.font.code')}>
                <input
                  className={inputClass}
                  value={settings.font.code_family}
                  onChange={(e) =>
                    update((d) => {
                      d.font.code_family = e.target.value;
                      return d;
                    })
                  }
                />
              </Field>
              <Field label={t('settings.font.myanmar')}>
                <input
                  className={inputClass}
                  value={settings.font.myanmar_family}
                  onChange={(e) =>
                    update((d) => {
                      d.font.myanmar_family = e.target.value;
                      return d;
                    })
                  }
                />
              </Field>
              <Field label={t('settings.font.size')}>
                <input
                  type="number"
                  min={8}
                  max={36}
                  step={1}
                  className={inputClass}
                  value={settings.font.size}
                  onChange={(e) =>
                    update((d) => {
                      d.font.size = Number(e.target.value);
                      return d;
                    })
                  }
                />
              </Field>
              <Field label="Line height">
                <input
                  type="number"
                  min={1}
                  max={2}
                  step={0.05}
                  className={inputClass}
                  value={settings.font.line_height}
                  onChange={(e) =>
                    update((d) => {
                      d.font.line_height = Number(e.target.value);
                      return d;
                    })
                  }
                />
              </Field>
              <Field label="Letter spacing">
                <input
                  type="number"
                  step={0.5}
                  className={inputClass}
                  value={settings.font.letter_spacing}
                  onChange={(e) =>
                    update((d) => {
                      d.font.letter_spacing = Number(e.target.value);
                      return d;
                    })
                  }
                />
              </Field>
            </div>
          )}
          {section === 'cursor' && (
            <div className="space-y-5">
              <Field label={t('settings.cursor.style')}>
                <select
                  value={settings.cursor.style}
                  onChange={(e) =>
                    update((d) => {
                      d.cursor.style = e.target.value as CursorStyle;
                      return d;
                    })
                  }
                  className={selectClass}
                >
                  <option value="block">Block</option>
                  <option value="bar">Bar</option>
                  <option value="underline">Underline</option>
                </select>
              </Field>
              <Field label={t('settings.cursor.blink')}>
                <Toggle
                  checked={settings.cursor.blink}
                  onChange={(v) =>
                    update((d) => {
                      d.cursor.blink = v;
                      return d;
                    })
                  }
                />
              </Field>
            </div>
          )}
          {section === 'shell' && (
            <div className="space-y-5">
              <Field label="Shell program">
                <input
                  className={inputClass}
                  placeholder="leave blank for system default"
                  value={settings.shell.program ?? ''}
                  onChange={(e) =>
                    update((d) => {
                      d.shell.program = e.target.value || null;
                      return d;
                    })
                  }
                />
              </Field>
              <Field label="Shell args (one per line)">
                <textarea
                  className={`${inputClass} h-24 font-mono`}
                  value={settings.shell.args.join('\n')}
                  onChange={(e) =>
                    update((d) => {
                      d.shell.args = e.target.value.split('\n').filter((x) => x.length > 0);
                      return d;
                    })
                  }
                />
              </Field>
            </div>
          )}
          {section === 'advanced' && (
            <div className="space-y-5">
              <Field label={t('settings.scrollback')}>
                <input
                  type="number"
                  min={1000}
                  max={1_000_000}
                  step={1000}
                  className={inputClass}
                  value={settings.scrollback}
                  onChange={(e) =>
                    update((d) => {
                      d.scrollback = Number(e.target.value);
                      return d;
                    })
                  }
                />
              </Field>
              <Field label={t('settings.webgl')}>
                <Toggle
                  checked={settings.webgl}
                  onChange={(v) =>
                    update((d) => {
                      d.webgl = v;
                      return d;
                    })
                  }
                />
              </Field>
              <Field label="Audible bell">
                <Toggle
                  checked={settings.bell}
                  onChange={(v) =>
                    update((d) => {
                      d.bell = v;
                      return d;
                    })
                  }
                />
              </Field>
              {isTauri() && <UpdatesSection />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="flex-1 max-w-xs">{children}</span>
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 items-center rounded-full transition',
        checked ? 'bg-emerald-500/80' : 'bg-zinc-700',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white transition',
          checked ? 'translate-x-4' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

const inputClass =
  'w-full rounded-md border border-zinc-700/70 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500/60';
const selectClass = inputClass;

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'uptodate' }
  | { kind: 'available'; version: string; notes: string; update: UpdateLike }
  | { kind: 'downloading' }
  | { kind: 'error'; message: string };

type UpdateLike = {
  available: boolean;
  version: string;
  body?: string | null;
  downloadAndInstall: () => Promise<void>;
};

function UpdatesSection() {
  const [state, setState] = useState<UpdateState>({ kind: 'idle' });

  const handleCheck = async () => {
    setState({ kind: 'checking' });
    try {
      const mod = await import('@tauri-apps/plugin-updater');
      const update = (await mod.check()) as UpdateLike | null;
      if (update && update.available) {
        setState({
          kind: 'available',
          version: update.version,
          notes: update.body ?? '',
          update,
        });
      } else {
        setState({ kind: 'uptodate' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('updater:check failed', err);
      setState({ kind: 'error', message });
    }
  };

  const handleInstall = async () => {
    if (state.kind !== 'available') return;
    const update = state.update;
    setState({ kind: 'downloading' });
    try {
      await update.downloadAndInstall();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('updater:install failed', err);
      setState({ kind: 'error', message });
    }
  };

  return (
    <section className="space-y-3 border-t border-zinc-800 pt-5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-zinc-400">{t('updater.section')}</span>
        <button
          type="button"
          onClick={handleCheck}
          disabled={state.kind === 'checking' || state.kind === 'downloading'}
          className="rounded-md border border-zinc-700/70 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-100 transition hover:border-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === 'checking' ? t('updater.checking') : t('updater.check')}
        </button>
      </div>
      {state.kind === 'uptodate' && (
        <p className="rounded-md bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
          {t('updater.uptodate')}
        </p>
      )}
      {state.kind === 'available' && (
        <div className="space-y-2 rounded-md border border-emerald-700/40 bg-emerald-950/20 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-emerald-200">
              {t('updater.available')}{' '}
              <span className="font-mono text-emerald-100">v{state.version}</span>
            </p>
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white transition hover:bg-emerald-500"
            >
              {t('updater.download')}
            </button>
          </div>
          {state.notes && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950/70 p-2 text-[11px] leading-snug text-zinc-300">
              {state.notes}
            </pre>
          )}
        </div>
      )}
      {state.kind === 'downloading' && (
        <p className="rounded-md bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
          {t('updater.downloading')}
        </p>
      )}
      {state.kind === 'error' && (
        <p className="rounded-md border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {`${t('updater.failed')}: ${state.message}`}
        </p>
      )}
    </section>
  );
}
