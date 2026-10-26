// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { describe, it, expect, afterEach, vi } from 'vitest';

let mockActionHandler: ((action: string, params: unknown) => Promise<unknown>) | undefined;

vi.mock('@paperclipai/plugin-sdk/ui', async () => {
  const actual = await vi.importActual('@paperclipai/plugin-sdk/ui');
  return {
    ...actual,
    usePluginAction: (actionName: string) => {
      return async (params: unknown) => {
        if (!mockActionHandler) throw new Error('Mock action handler not set');
        return mockActionHandler(actionName, params);
      };
    },
  };
});

const context = {
  companyId: 'company',
  companyPrefix: 'company',
  projectId: null,
  entityId: 'issue-1',
  entityType: 'issue' as const,
  userId: 'user-1',
};

let root: Root | undefined;
let dom: JSDOM | undefined;

afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  dom?.window.close();
  vi.unstubAllGlobals();
  mockActionHandler = undefined;
});

async function mount(actionHandler: (action: string, params: unknown) => Promise<unknown>) {
  mockActionHandler = actionHandler;

  dom = new JSDOM('<div id="root"></div>', { url: 'https://native.example/' });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('navigator', dom.window.navigator);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  const { TaskTrailTab } = await import('../../src/ui/index.js');

  root = createRoot(document.getElementById('root')!);
  await act(async () => {
    root!.render(<TaskTrailTab context={context} />);
  });
  return document.getElementById('root')!;
}

const trailData = {
  title: 'Test Task',
  status: 'in_progress',
  assignee: 'user-1',
  doneWhen: 'Tests pass',
  nextStep: 'Write tests',
  trail: {
    summary: 'from Test Meeting · uses 1 source',
    steps: [
      { label: 'Source', detail: 'Source not available to you', available: false },
      { label: 'Intake', detail: 'Pulled into intake as "Test"', available: true },
      { label: 'Task', detail: 'This task', available: true },
    ],
    alsoUsed: [],
  },
};

describe('TaskTrailTab', () => {
  it('details element is closed on first render; summary text starts with "Why this exists"', async () => {
    const el = await mount(async () => ({ ok: true, data: trailData }));
    const details = el.querySelector('details');
    expect(details).toBeTruthy();
    expect(details!.hasAttribute('open')).toBe(false);
    const summary = details?.querySelector('summary');
    expect(summary?.textContent).toContain('Why this exists');
  });

  it('"No recorded source" summary renders with no step list', async () => {
    const noSourceData = {
      ...trailData,
      trail: { summary: 'No recorded source', steps: [], alsoUsed: [] },
    };
    const el = await mount(async () => ({ ok: true, data: noSourceData }));
    const summary = el.querySelector('summary');
    expect(summary?.textContent).toContain('No recorded source');
    const steps = el.querySelectorAll('ol li');
    expect(steps.length).toBe(0);
  });

  it('unavailable step renders "Source not available to you"', async () => {
    const el = await mount(async () => ({ ok: true, data: trailData }));
    expect(el.textContent).toContain('Source not available to you');
  });

  it('Done when / Next step cards omitted when null', async () => {
    const noCardsData = {
      ...trailData,
      doneWhen: null,
      nextStep: null,
    };
    const el = await mount(async () => ({ ok: true, data: noCardsData }));
    expect(el.textContent).not.toContain('Done when');
    expect(el.textContent).not.toContain('Next step');
  });

  it('non-issue entity renders nothing', async () => {
    const nonIssueContext = {
      ...context,
      entityType: 'note' as const,
    };

    mockActionHandler = async () => ({ ok: true, data: trailData });

    dom = new JSDOM('<div id="root"></div>', { url: 'https://native.example/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

    const { TaskTrailTab } = await import('../../src/ui/index.js');

    root = createRoot(document.getElementById('root')!);
    await act(async () => {
      root!.render(<TaskTrailTab context={nonIssueContext} />);
    });
    const el = document.getElementById('root')!;
    expect(el.firstChild).toBeNull();
  });
});
