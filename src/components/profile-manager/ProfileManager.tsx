import { useEffect, useRef, useState } from 'react';
import type { SshProfile } from '@/types';
import { t } from '@/lib/i18n';
import { isTauri, sshConfigHosts } from '@/lib/tauri';

export type ProfileManagerProps = {
  open: boolean;
  profiles: SshProfile[];
  onClose: () => void;
  onSave: (profile: SshProfile) => void;
  onDelete: (id: string) => void;
  onConnect: (profile: SshProfile) => void;
};

export function ProfileManager({
  open,
  profiles,
  onClose,
  onSave,
  onDelete,
  onConnect,
}: ProfileManagerProps) {
  const [draft, setDraft] = useState<SshProfile>(emptyProfile());
  const [configHosts, setConfigHosts] = useState<string[]>([]);
  const firstFocusRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    sshConfigHosts()
      .then((hosts) => {
        if (!cancelled) setConfigHosts(hosts);
      })
      .catch((err) => {
        // Non-fatal: autocomplete is purely a convenience.
        console.warn('ssh_config_hosts failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // T-055: focus the first form field on open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const focusId = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusId);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.manager.label')}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[560px] w-[820px] max-w-[94vw] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex w-72 flex-col gap-1 overflow-y-auto border-r border-zinc-800 bg-zinc-900/50 p-3 text-sm">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
            Profiles
          </div>
          {profiles.length === 0 && (
            <div className="px-2 py-3 text-xs text-zinc-500">
              No profiles yet — add one on the right.
            </div>
          )}
          {profiles.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-2 rounded-md px-2 py-2 text-zinc-300 hover:bg-zinc-800/50"
            >
              <button
                type="button"
                onClick={() => setDraft(structuredClone(p))}
                aria-label={`${t('profile.add')}: ${p.name}`}
                className="flex flex-1 flex-col items-start rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              >
                <span className="truncate text-sm text-zinc-100">{p.name}</span>
                <span className="text-xs text-zinc-500">
                  {p.user ? `${p.user}@${p.host}` : p.host}
                </span>
              </button>
              <button
                type="button"
                aria-label={`${t('profile.connect')}: ${p.name}`}
                title={t('profile.connect')}
                onClick={() => onConnect(p)}
                className="rounded px-2 py-1 text-xs text-emerald-400 transition hover:bg-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              >
                <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                aria-label={`${t('profile.delete')}: ${p.name}`}
                title={t('profile.delete')}
                onClick={() => onDelete(p.id)}
                className="rounded px-2 py-1 text-xs text-zinc-500 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 group-hover:opacity-100 hover:bg-rose-900/30 hover:text-rose-300 opacity-0"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          ))}
        </div>

        <form
          className="flex flex-1 flex-col gap-3 overflow-y-auto p-6 text-sm text-zinc-200"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setDraft(emptyProfile());
          }}
        >
          <h3 className="text-base font-semibold text-zinc-100">{t('profile.add')}</h3>
          <Row label="Name">
            <input
              required
              ref={firstFocusRef}
              className={inputClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Row>
          <Row label="Host">
            <>
              <input
                required
                list="ssh-config-hosts"
                className={inputClass}
                value={draft.host}
                onChange={(e) => setDraft({ ...draft, host: e.target.value })}
              />
              <datalist id="ssh-config-hosts">
                {configHosts.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </>
          </Row>
          <Row label="User">
            <input
              className={inputClass}
              value={draft.user ?? ''}
              onChange={(e) => setDraft({ ...draft, user: e.target.value || null })}
            />
          </Row>
          <Row label="Port">
            <input
              type="number"
              className={inputClass}
              value={draft.port ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, port: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Row>
          <Row label="Identity file">
            <input
              className={inputClass}
              placeholder="~/.ssh/id_ed25519"
              value={draft.identity_file ?? ''}
              onChange={(e) => setDraft({ ...draft, identity_file: e.target.value || null })}
            />
          </Row>
          <Row label="Jump host">
            <input
              className={inputClass}
              placeholder="user@bastion.example"
              value={draft.jump_host ?? ''}
              onChange={(e) => setDraft({ ...draft, jump_host: e.target.value || null })}
            />
          </Row>
          <Row label="Remote command">
            <input
              className={inputClass}
              placeholder="tmux new -A -s main"
              value={draft.remote_command ?? ''}
              onChange={(e) => setDraft({ ...draft, remote_command: e.target.value || null })}
            />
          </Row>
          <Row label="Group">
            <input
              className={inputClass}
              value={draft.group ?? ''}
              onChange={(e) => setDraft({ ...draft, group: e.target.value || null })}
            />
          </Row>
          <div className="mt-auto flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              onClick={() => setDraft(emptyProfile())}
            >
              Reset
            </button>
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-zinc-50 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              Save profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  // The wrapping `<label>` already associates clicks on the label text with
  // the first focusable child, so we don't need an explicit `htmlFor` here.
  // Aria semantics carry through React 19's nested-label support.
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-zinc-400">{label}</span>
      <span className="flex-1 max-w-sm">{children}</span>
    </label>
  );
}

function emptyProfile(): SshProfile {
  return {
    id: '',
    name: '',
    host: '',
    user: null,
    port: null,
    identity_file: null,
    jump_host: null,
    remote_command: null,
    extra_args: null,
    group: null,
  };
}

const inputClass =
  'w-full rounded-md border border-zinc-700/70 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500/60';
