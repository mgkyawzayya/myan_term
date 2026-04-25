import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@/components/terminal/Terminal';
import { TabBar } from '@/components/tabs/TabBar';
import { CommandPalette, type PaletteAction } from '@/components/command-palette/CommandPalette';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ProfileManager } from '@/components/profile-manager/ProfileManager';
import {
  isTauri,
  profileDelete,
  profileList,
  profileSave,
  profileToCommand,
  settingsGet,
  settingsSet,
} from '@/lib/tauri';
import { DEFAULT_SETTINGS, type Settings, type SshProfile, type TabState } from '@/types';

type StoredTab = TabState & {
  shellOverride?: { program: string | null; args: string[] };
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tabs, setTabs] = useState<StoredTab[]>([newTab()]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? '');
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Load persisted state.
  useEffect(() => {
    if (!isTauri()) return;
    void settingsGet()
      .then((s) => setSettings(s))
      .catch(() => undefined);
    void profileList()
      .then((p) => setProfiles(p))
      .catch(() => undefined);
  }, []);

  // Persist settings whenever they change.
  useEffect(() => {
    if (!isTauri()) return;
    void settingsSet(settings).catch(() => undefined);
  }, [settings]);

  // Global keybindings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          openNewTab();
          break;
        case 'w':
          e.preventDefault();
          closeActiveTab();
          break;
        case ',':
          e.preventDefault();
          setSettingsOpen(true);
          break;
        case 'p':
          if (e.shiftKey) {
            e.preventDefault();
            setPaletteOpen(true);
          }
          break;
        case ']':
          if (e.shiftKey) {
            e.preventDefault();
            cycleTab(1);
          }
          break;
        case '[':
          if (e.shiftKey) {
            e.preventDefault();
            cycleTab(-1);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewTab = useCallback((init?: Partial<StoredTab>) => {
    const tab: StoredTab = { ...newTab(), ...init };
    setTabs((cur) => [...cur, tab]);
    setActiveId(tab.id);
  }, []);

  const closeActiveTab = useCallback(() => {
    setTabs((cur) => {
      if (cur.length === 0) return cur;
      const next = cur.filter((t) => t.id !== activeId);
      if (next.length === 0) {
        const fresh = newTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      const idx = cur.findIndex((t) => t.id === activeId);
      const newActive = next[Math.max(0, Math.min(idx - 1, next.length - 1))];
      if (newActive) setActiveId(newActive.id);
      return next;
    });
  }, [activeId]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((cur) => {
        const next = cur.filter((t) => t.id !== id);
        if (next.length === 0) {
          const fresh = newTab();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeId) {
          const idx = cur.findIndex((t) => t.id === id);
          const newActive = next[Math.max(0, Math.min(idx - 1, next.length - 1))];
          if (newActive) setActiveId(newActive.id);
        }
        return next;
      });
    },
    [activeId],
  );

  const cycleTab = useCallback((delta: number) => {
    setActiveId((cur) => {
      const list = tabsRef.current;
      const idx = list.findIndex((t) => t.id === cur);
      if (idx === -1 || list.length === 0) return cur;
      const next = list[(idx + delta + list.length) % list.length];
      return next ? next.id : cur;
    });
  }, []);

  const updateTab = useCallback((id: string, patch: Partial<StoredTab>) => {
    setTabs((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const connectProfile = useCallback(
    async (profile: SshProfile) => {
      let argv: string[] = [];
      if (isTauri()) {
        try {
          const cmd = await profileToCommand(profile.id);
          argv = cmd.argv;
        } catch (err) {
          console.warn('profile_to_command failed, falling back to client-side build', err);
        }
      }
      if (argv.length === 0) argv = buildSshArgvLocally(profile);
      const [program, ...args] = argv;
      openNewTab({
        title: profile.name,
        shellOverride: { program: program ?? null, args },
      });
    },
    [openNewTab],
  );

  const handlePaletteAction = useCallback(
    async (action: PaletteAction) => {
      switch (action.kind) {
        case 'new-tab':
          openNewTab();
          break;
        case 'close-tab':
          closeActiveTab();
          break;
        case 'open-settings':
          setSettingsOpen(true);
          break;
        case 'theme':
          setSettings((s) => ({ ...s, theme: action.id }));
          break;
        case 'connect-profile': {
          const profile = profiles.find((p) => p.id === action.id);
          if (!profile) return;
          await connectProfile(profile);
          break;
        }
      }
    },
    [profiles, openNewTab, closeActiveTab, connectProfile],
  );

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeId) ?? null, [tabs, activeId]);

  const tabSettings: Settings = useMemo(() => {
    if (!activeTab?.shellOverride) return settings;
    return {
      ...settings,
      shell: {
        ...settings.shell,
        program: activeTab.shellOverride.program,
        args: activeTab.shellOverride.args,
      },
    };
  }, [activeTab, settings]);

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeTab}
        onNew={() => openNewTab()}
      />
      <div className="relative flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeId ? 'absolute inset-0 block' : 'pointer-events-none absolute inset-0 hidden'}
          >
            <Terminal
              settings={tab.id === activeId ? tabSettings : settings}
              cwd={tab.cwd}
              onTitle={(title) => updateTab(tab.id, { title })}
              onCwd={(cwd) => updateTab(tab.id, { cwd })}
              onPtyId={(ptyId) => updateTab(tab.id, { ptyId })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setProfilesOpen(true)}
          className="absolute bottom-3 right-3 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur hover:bg-zinc-800/80"
        >
          SSH
        </button>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        profiles={profiles}
        onAction={handlePaletteAction}
      />

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
      />

      <ProfileManager
        open={profilesOpen}
        profiles={profiles}
        onClose={() => setProfilesOpen(false)}
        onSave={async (profile) => {
          const next = profile.id ? profile : { ...profile, id: crypto.randomUUID() };
          if (isTauri()) await profileSave(next).catch(() => undefined);
          setProfiles((cur) => {
            const filtered = cur.filter((p) => p.id !== next.id);
            return [...filtered, next].sort((a, b) =>
              a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
            );
          });
        }}
        onDelete={async (id) => {
          if (isTauri()) await profileDelete(id).catch(() => undefined);
          setProfiles((cur) => cur.filter((p) => p.id !== id));
        }}
        onConnect={(p) => {
          setProfilesOpen(false);
          void connectProfile(p);
        }}
      />
    </div>
  );
}

function newTab(): StoredTab {
  return {
    id: cryptoId(),
    title: 'Terminal',
    ptyId: null,
    cwd: null,
  };
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function buildSshArgvLocally(profile: SshProfile): string[] {
  const argv: string[] = ['ssh'];
  if (profile.port != null) argv.push('-p', String(profile.port));
  if (profile.identity_file) argv.push('-i', profile.identity_file);
  if (profile.jump_host) argv.push('-J', profile.jump_host);
  if (profile.extra_args) argv.push(...profile.extra_args);
  argv.push(profile.user ? `${profile.user}@${profile.host}` : profile.host);
  if (profile.remote_command) argv.push(profile.remote_command);
  return argv;
}
