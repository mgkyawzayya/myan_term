import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { TabBar } from '@/components/tabs/TabBar';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const tabs = [
  { id: 'tab-1', title: 'One', ptyId: null, cwd: null },
  { id: 'tab-2', title: 'Two', ptyId: null, cwd: null },
  { id: 'tab-3', title: 'Three', ptyId: null, cwd: null },
];

describe('TabBar', () => {
  it('reorders a tab left with Shift+ArrowLeft', () => {
    const onReorder = vi.fn();
    act(() => {
      root.render(
        <TabBar
          tabs={tabs}
          activeId="tab-2"
          onSelect={vi.fn()}
          onClose={vi.fn()}
          onReorder={onReorder}
          onNew={vi.fn()}
        />,
      );
    });

    const renderedTabs = container.querySelectorAll('[role="tab"]');
    expect(renderedTabs).toHaveLength(3);
    const tab = renderedTabs[1];
    expect(tab).toBeTruthy();
    act(() => {
      tab!.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft', shiftKey: true }),
      );
    });
    expect(onReorder).toHaveBeenCalledWith('tab-2', 'tab-1');
  });

  it('reorders a tab right with Shift+ArrowRight', () => {
    const onReorder = vi.fn();
    act(() => {
      root.render(
        <TabBar
          tabs={tabs}
          activeId="tab-2"
          onSelect={vi.fn()}
          onClose={vi.fn()}
          onReorder={onReorder}
          onNew={vi.fn()}
        />,
      );
    });

    const renderedTabs = container.querySelectorAll('[role="tab"]');
    expect(renderedTabs).toHaveLength(3);
    const tab = renderedTabs[1];
    expect(tab).toBeTruthy();
    act(() => {
      tab!.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight', shiftKey: true }),
      );
    });
    expect(onReorder).toHaveBeenCalledWith('tab-2', 'tab-3');
  });
});
