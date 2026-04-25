import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@/components/terminal/Terminal';
import { TabBar } from '@/components/tabs/TabBar';
import { CommandPalette, type PaletteAction } from '@/components/command-palette/CommandPalette';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ProfileManager } from '@/components/profile-manager/ProfileManager';
import { SplitPane } from '@/components/panes/SplitPane';
import {
  closeLeaf,
  findLeafIds,
  neighborLeaf,
  newLeaf,
  splitLeaf,
  type PaneDirection,
  type PaneNode,
  type SplitOrientation,
} from '@/components/panes/paneTree';
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
  paneTree: PaneNode;
  focusedLeafId: string;
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tabs, setTabs] = useState<StoredTab[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? '');
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

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

  const updateTab = useCallback((id: string, patch: Partial<StoredTab>) => {
    setTabs((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const setTabPaneTree = useCallback(
    (id: string, next: PaneNode) => {
      updateTab(id, { paneTree: next });
    },
    [updateTab],
  );

  const setTabFocusedLeaf = useCallback(
    (id: string, leafId: string) => {
      updateTab(id, { focusedLeafId: leafId });
    },
    [updateTab],
  );

  const splitActiveLeaf = useCallback(
    (orientation: SplitOrientation) => {
      const list = tabsRef.current;
      const activeIdNow = activeIdRef.current;
      const tab = list.find((t) => t.id === activeIdNow);
      if (!tab) return;
      const { tree, newLeafId } = splitLeaf(tab.paneTree, tab.focusedLeafId, orientation);
      if (tree === tab.paneTree) return;
      updateTab(tab.id, { paneTree: tree, focusedLeafId: newLeafId });
    },
    [updateTab],
  );

  const focusNeighborInActive = useCallback(
    (dir: PaneDirection) => {
      const list = tabsRef.current;
      const activeIdNow = activeIdRef.current;
      const tab = list.find((t) => t.id === activeIdNow);
      if (!tab) return false;
      const id = neighborLeaf(tab.paneTree, tab.focusedLeafId, dir);
      if (!id) return false;
      updateTab(tab.id, { focusedLeafId: id });
      return true;
    },
    [updateTab],
  );

  const openNewTab = useCallback((init?: Partial<StoredTab>) => {
    const tab: StoredTab = { ...newTab(), ...init };
    setTabs((cur) => [...cur, tab]);
    setActiveId(tab.id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((cur) => {
        const next = cur.filter((t) => t.id !== id);
        if (next.length === 0) {
          const fresh = newTab();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeIdRef.current) {
          const idx = cur.findIndex((t) => t.id === id);
          const newActive = next[Math.max(0, Math.min(idx - 1, next.length - 1))];
          if (newActive) setActiveId(newActive.id);
        }
        return next;
      });
    },
    [],
  );

  const closeActiveTab = useCallback(() => {
    closeTab(activeIdRef.current);
  }, [closeTab]);

  /**
   * ⌘W: close the focused pane if the active tab has more than one leaf,
   * otherwise close the tab.
   */
  const closeActivePaneOrTab = useCallback(() => {
    const list = tabsRef.current;
    const activeIdNow = activeIdRef.current;
    const tab = list.find((t) => t.id === activeIdNow);
    if (!tab) return;
    const ids = findLeafIds(tab.paneTree);
    if (ids.length <= 1) {
      closeActiveTab();
      return;
    }
    const next = closeLeaf(tab.paneTree, tab.focusedLeafId);
    if (next === null) {
      closeActiveTab();
      return;
    }
    if (next === tab.paneTree) return;
    const remaining = findLeafIds(next);
    const focus = remaining[0] ?? tab.focusedLeafId;
    updateTab(tab.id, { paneTree: next, focusedLeafId: focus });
  }, [closeActiveTab, updateTab]);

  const cycleTab = useCallback((delta: number) => {
    setActiveId((cur) => {
      const list = tabsRef.current;
      const idx = list.findIndex((t) => t.id === cur);
      if (idx === -1 || list.length === 0) return cur;
      const next = list[(idx + delta + list.length) % list.length];
      return next ? next.id : cur;
    });
  }, []);

  // Global keybindings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // Pane focus navigation: Cmd+Option+Arrow.
      if (e.altKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            focusNeighborInActive('left');
            return;
          case 'ArrowRight':
            e.preventDefault();
            focusNeighborInActive('right');
            return;
          case 'ArrowUp':
            e.preventDefault();
            focusNeighborInActive('up');
            return;
          case 'ArrowDown':
            e.preventDefault();
            focusNeighborInActive('down');
            return;
        }
      }
      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          openNewTab();
          break;
        case 'w':
          e.preventDefault();
          closeActivePaneOrTab();
          break;
        case 'd':
          e.preventDefault();
          splitActiveLeaf(e.shiftKey ? 'vertical' : 'horizontal');
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
  }, [openNewTab, closeActivePaneOrTab, splitActiveLeaf, focusNeighborInActive, cycleTab]);

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
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          const settingsForTab = isActive ? tabSettings : settings;
          return (
            <div
              key={tab.id}
              className={
                isActive
                  ? 'absolute inset-0 block'
                  : 'pointer-events-none absolute inset-0 hidden'
              }
            >
              <SplitPane
                tree={tab.paneTree}
                focusedLeafId={tab.focusedLeafId}
                onFocusLeaf={(leafId) => setTabFocusedLeaf(tab.id, leafId)}
                onTreeChange={(next) => setTabPaneTree(tab.id, next)}
                renderLeaf={(leafId) => (
                  <Terminal
                    key={leafId}
                    settings={settingsForTab}
                    cwd={tab.cwd}
                    onTitle={(title) => updateTab(tab.id, { title })}
                    onCwd={(cwd) => updateTab(tab.id, { cwd })}
                    onPtyId={(ptyId) => updateTab(tab.id, { ptyId })}
                  />
                )}
              />
            </div>
          );
        })}
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
  const leaf = newLeaf();
  return {
    id: cryptoId(),
    title: 'Terminal',
    ptyId: null,
    cwd: null,
    paneTree: leaf,
    focusedLeafId: leaf.id,
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
