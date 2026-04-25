export type PtyId = string;

export type PtySpawnArgs = {
  shell?: string | null;
  args?: string[] | null;
  cwd?: string | null;
  env?: Record<string, string> | null;
  cols: number;
  rows: number;
};

export type SshProfile = {
  id: string;
  name: string;
  host: string;
  user?: string | null;
  port?: number | null;
  identity_file?: string | null;
  jump_host?: string | null;
  remote_command?: string | null;
  extra_args?: string[] | null;
  group?: string | null;
};

export type ThemeColors = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

export type ThemeId =
  | 'one-dark'
  | 'solarized-dark'
  | 'solarized-light'
  | 'dracula'
  | 'nord'
  | 'tokyo-night';

export type CursorStyle = 'block' | 'bar' | 'underline';

export type Settings = {
  schema_version: number;
  theme: ThemeId;
  font: {
    code_family: string;
    myanmar_family: string;
    size: number;
    line_height: number;
    letter_spacing: number;
  };
  cursor: {
    style: CursorStyle;
    blink: boolean;
  };
  shell: {
    program: string | null;
    args: string[];
    env: Record<string, string>;
  };
  scrollback: number;
  bell: boolean;
  webgl: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  schema_version: 1,
  theme: 'one-dark',
  font: {
    code_family: 'JetBrains Mono',
    myanmar_family: 'Padauk',
    size: 14,
    line_height: 1.2,
    letter_spacing: 0,
  },
  cursor: {
    style: 'block',
    blink: true,
  },
  shell: {
    program: null,
    args: [],
    env: {},
  },
  scrollback: 10_000,
  bell: false,
  webgl: true,
};

export type TabState = {
  id: string;
  title: string;
  ptyId: PtyId | null;
  cwd: string | null;
};
