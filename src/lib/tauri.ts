import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { PtyId, PtySpawnArgs, SshProfile, Settings } from '@/types';

export const ptySpawn = (args: PtySpawnArgs): Promise<{ pty_id: PtyId }> =>
  invoke('pty_spawn', { args });

export const ptyWrite = (ptyId: PtyId, data: string): Promise<void> =>
  invoke('pty_write', { ptyId, data });

export const ptyResize = (ptyId: PtyId, cols: number, rows: number): Promise<void> =>
  invoke('pty_resize', { ptyId, cols, rows });

export const ptyKill = (ptyId: PtyId): Promise<void> => invoke('pty_kill', { ptyId });

export const onPtyData = (cb: (e: { ptyId: PtyId; data: string }) => void): Promise<UnlistenFn> =>
  listen<{ pty_id: PtyId; data: string }>('pty:data', (evt) =>
    cb({ ptyId: evt.payload.pty_id, data: evt.payload.data }),
  );

export const onPtyExit = (cb: (e: { ptyId: PtyId; code: number | null }) => void): Promise<UnlistenFn> =>
  listen<{ pty_id: PtyId; code: number | null }>('pty:exit', (evt) =>
    cb({ ptyId: evt.payload.pty_id, code: evt.payload.code }),
  );

export const profileList = (): Promise<SshProfile[]> => invoke('profile_list');
export const profileSave = (profile: SshProfile): Promise<void> =>
  invoke('profile_save', { profile });
export const profileDelete = (id: string): Promise<void> => invoke('profile_delete', { id });
export const profileToCommand = (
  id: string,
): Promise<{ argv: string[]; env: Record<string, string> }> =>
  invoke('profile_to_command', { id });

export const sshConfigHosts = (): Promise<string[]> => invoke('ssh_config_hosts');

export const settingsGet = (): Promise<Settings> => invoke('settings_get');
export const settingsSet = (settings: Settings): Promise<void> =>
  invoke('settings_set', { settings });

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
