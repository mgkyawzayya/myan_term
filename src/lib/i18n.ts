/**
 * Minimal i18n facade per CLAUDE.md R5.
 * v1.0 ships English only; switching to Burmese later is a config swap.
 */

const STRINGS_EN: Record<string, string> = {
  'app.title': 'MyanTerm',
  'tab.new': 'New tab',
  'tab.close': 'Close tab',
  'tab.untitled': 'Terminal',
  'pane.split.horizontal': 'Split horizontally',
  'pane.split.vertical': 'Split vertically',
  'pane.close': 'Close pane',
  'palette.placeholder': 'Type a command…',
  'palette.empty': 'No matching commands',
  'settings.open': 'Open settings',
  'settings.theme': 'Theme',
  'settings.font.code': 'Code font',
  'settings.font.myanmar': 'Myanmar font',
  'settings.font.size': 'Font size',
  'settings.cursor.style': 'Cursor style',
  'settings.cursor.blink': 'Cursor blink',
  'settings.scrollback': 'Scrollback lines',
  'settings.webgl': 'GPU rendering',
  'profile.add': 'Add SSH profile',
  'profile.connect': 'Connect',
  'profile.delete': 'Delete profile',
  'pty.exit': 'Process exited',
  'updater.section': 'Updates',
  'updater.check': 'Check for updates',
  'updater.checking': 'Checking…',
  'updater.uptodate': "You're on the latest version",
  'updater.available': 'Update available',
  'updater.download': 'Download & restart',
  'updater.downloading': 'Downloading…',
  'updater.failed': 'Update check failed',
};

let strings: Record<string, string> = STRINGS_EN;

export function setLocale(_locale: 'en' | 'my'): void {
  // Reserved for v1.1: load Burmese strings here.
  strings = STRINGS_EN;
}

export function t(key: string, fallback?: string): string {
  return strings[key] ?? fallback ?? key;
}
