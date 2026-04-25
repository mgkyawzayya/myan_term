import { describe, expect, it } from 'vitest';
import { reorderTabs } from '@/components/tabs/reorderTabs';

const tabs = [
  { id: 'tab-1', title: 'One', ptyId: null, cwd: null },
  { id: 'tab-2', title: 'Two', ptyId: null, cwd: null },
  { id: 'tab-3', title: 'Three', ptyId: null, cwd: null },
] as const;

describe('reorderTabs', () => {
  it('moves the dragged tab into the drop target position', () => {
    const next = reorderTabs([...tabs], 'tab-1', 'tab-3');
    expect(next.map((tab) => tab.id)).toEqual(['tab-2', 'tab-1', 'tab-3']);
  });

  it('supports moving a later tab earlier in the list', () => {
    const next = reorderTabs([...tabs], 'tab-3', 'tab-1');
    expect(next.map((tab) => tab.id)).toEqual(['tab-3', 'tab-1', 'tab-2']);
  });

  it('returns the original list when source and target match', () => {
    const next = reorderTabs([...tabs], 'tab-2', 'tab-2');
    expect(next).toEqual(tabs);
  });

  it('returns the original list when either tab id is missing', () => {
    const next = reorderTabs([...tabs], 'missing', 'tab-2');
    expect(next).toEqual(tabs);
  });
});
