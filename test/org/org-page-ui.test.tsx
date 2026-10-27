// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { describe, it, expect, afterEach, vi } from 'vitest';

const context = {
  companyId: 'company-1',
  companyPrefix: 'company',
  projectId: null,
  entityId: null,
  entityType: null,
  userId: 'user-1',
};

let root: Root | undefined;
let dom: JSDOM | undefined;
let mockActions: Map<string, (params: unknown) => Promise<unknown>>;

vi.mock('@paperclipai/plugin-sdk/ui', () => ({
  usePluginAction: (key: string) => {
    return (params: unknown) => {
      const action = mockActions.get(key);
      if (!action) throw new Error(`No mock for action ${key}`);
      return action(params);
    };
  },
}));

const { OrgPage } = await import('../../src/ui/OrgPage.js');

afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = undefined;
  dom?.window.close();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

async function mount(actions: Record<string, (params: unknown) => Promise<unknown>>) {
  mockActions = new Map();
  Object.entries(actions).forEach(([key, fn]) => mockActions.set(key, fn));
  dom = new JSDOM('<div id="root"></div>', { url: 'https://native.example/' });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('navigator', dom.window.navigator);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(document.getElementById('root')!);
  await act(async () => {
    root!.render(<OrgPage context={context} />);
  });
  return document.getElementById('root')!;
}

describe('OrgPage', () => {
  it('renders setup form when org.overview returns {ok:true,data:null}', async () => {
    const el = await mount({
      'org.overview': async () => ({ ok: true, data: null }),
    });
    expect(el.textContent).toContain('DAO name');
    expect(el.textContent).toContain('Your display name');
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('feed-first: share box appears before the activity feed in DOM order; sidebar lists initiatives and key documents', async () => {
    const el = await mount({
      'org.overview': async () => ({
        ok: true,
        data: {
          profile: { companyId: 'company-1', name: 'Test DAO', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z' },
          role: 'member',
          memberCount: 5,
          feed: [{ companyId: 'company-1', seq: 1, actor: 'user-2', action: 'source.share', subject: 'doc-1', reason: '', at: '2026-10-25T10:00:00Z' }],
          labels: {},
          keyDocuments: [{ sourceKey: 'doc-1', title: 'Budget 2026', score: 1 }],
          initiatives: [{ issueId: 'issue-1', title: 'Q4 Planning', openTasks: 3 }],
        },
      }),
    });

    const shareBox = el.querySelector('form[aria-label="Share with the DAO"]');
    expect(shareBox).toBeTruthy();

    const feedSection = el.querySelector('section[aria-label="Activity feed"]');
    expect(feedSection).toBeTruthy();
    const feedItems = feedSection!.querySelectorAll('article');
    expect(feedItems.length).toBeGreaterThan(0);

    const allElements = Array.from(el.querySelectorAll('*'));
    const shareBoxIndex = allElements.indexOf(shareBox!);
    const feedIndex = allElements.indexOf(feedSection!);
    expect(shareBoxIndex).toBeLessThan(feedIndex);

    expect(el.textContent).toContain('Initiatives');
    expect(el.textContent).toContain('Q4 Planning');
    expect(el.textContent).toContain('Key documents');
    expect(el.textContent).toContain('Budget 2026');
  });

  it('member role: no Sources tab, no member edit controls', async () => {
    const el = await mount({
      'org.overview': async () => ({
        ok: true,
        data: {
          profile: { companyId: 'company-1', name: 'Test DAO', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z' },
          role: 'member',
          memberCount: 5,
          feed: [],
          labels: {},
          keyDocuments: [],
          initiatives: [],
        },
      }),
      'org.members': async () => ({
        ok: true,
        data: [
          { companyId: 'company-1', userId: 'user-1', displayName: 'Alice', role: 'founder', status: 'active', joinedAt: '2026-01-01T00:00:00Z' },
          { companyId: 'company-1', userId: 'user-2', displayName: 'Bob', role: 'member', status: 'active', joinedAt: '2026-02-01T00:00:00Z' },
        ],
      }),
    });

    const tabs = el.querySelectorAll('button[role="tab"]');
    const tabTexts = Array.from(tabs).map(t => t.textContent);
    expect(tabTexts).toContain('Overview');
    expect(tabTexts).toContain('Members');
    expect(tabTexts).not.toContain('Sources');

    const membersTab = Array.from(tabs).find(t => t.textContent === 'Members') as HTMLElement;
    await act(async () => {
      membersTab.click();
    });

    expect(el.textContent).not.toContain('Add member');
    expect(el.textContent).not.toContain('Remove');
    expect(el.textContent).not.toContain('Make moderator');
  });

  it('moderator: Members shows "Sync source: not connected yet." and each edit control shows "Will require a DAO vote"', async () => {
    const el = await mount({
      'org.overview': async () => ({
        ok: true,
        data: {
          profile: { companyId: 'company-1', name: 'Test DAO', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z' },
          role: 'moderator',
          memberCount: 5,
          feed: [],
          labels: {},
          keyDocuments: [],
          initiatives: [],
        },
      }),
      'org.members': async () => ({
        ok: true,
        data: [
          { companyId: 'company-1', userId: 'user-1', displayName: 'Alice', role: 'founder', status: 'active', joinedAt: '2026-01-01T00:00:00Z' },
          { companyId: 'company-1', userId: 'user-2', displayName: 'Bob', role: 'member', status: 'active', joinedAt: '2026-02-01T00:00:00Z' },
        ],
      }),
    });

    const tabs = el.querySelectorAll('button[role="tab"]');
    const membersTab = Array.from(tabs).find(t => t.textContent === 'Members') as HTMLElement;
    await act(async () => {
      membersTab.click();
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('Sync source: not connected yet.');

    const addButton = Array.from(el.querySelectorAll('button')).find(b => b.textContent === 'Add member');
    await act(async () => {
      addButton!.click();
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const voteTexts = el.textContent?.match(/Will require a DAO vote/g);
    expect(voteTexts).toBeTruthy();
    expect(voteTexts!.length).toBeGreaterThan(0);
  });

  it('Remove member without reason does not call the action', async () => {
    let removeCalled = false;
    const el = await mount({
      'org.overview': async () => ({
        ok: true,
        data: {
          profile: { companyId: 'company-1', name: 'Test DAO', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z' },
          role: 'founder',
          memberCount: 2,
          feed: [],
          labels: {},
          keyDocuments: [],
          initiatives: [],
        },
      }),
      'org.members': async () => ({
        ok: true,
        data: [
          { companyId: 'company-1', userId: 'user-1', displayName: 'Alice', role: 'founder', status: 'active', joinedAt: '2026-01-01T00:00:00Z' },
          { companyId: 'company-1', userId: 'user-2', displayName: 'Bob', role: 'member', status: 'active', joinedAt: '2026-02-01T00:00:00Z' },
        ],
      }),
      'org.member.remove': async () => {
        removeCalled = true;
        return { ok: true, data: null };
      },
    });

    const tabs = el.querySelectorAll('button[role="tab"]');
    const membersTab = Array.from(tabs).find(t => t.textContent === 'Members') as HTMLElement;
    await act(async () => {
      membersTab.click();
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const removeButtons = Array.from(el.querySelectorAll('button')).filter(b => b.textContent?.includes('Remove'));
    expect(removeButtons.length).toBeGreaterThan(0);

    await act(async () => {
      removeButtons[0]!.click();
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(removeCalled).toBe(false);
  });

  it('Hide as spam calls org.source.hide with sourceKey and reason, then reloads sources', async () => {
    let hideCalls: unknown[] = [];
    let sourcesCallCount = 0;

    const el = await mount({
      'org.overview': async () => ({
        ok: true,
        data: {
          profile: { companyId: 'company-1', name: 'Test DAO', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z' },
          role: 'moderator',
          memberCount: 2,
          feed: [],
          labels: {},
          keyDocuments: [],
          initiatives: [],
        },
      }),
      'org.sources': async () => {
        sourcesCallCount++;
        return {
          ok: true,
          data: [
            {
              companyId: 'company-1',
              sourceKey: 'source-1',
              kind: 'link',
              title: 'Spam Link',
              url: 'https://spam.example',
              mediaType: null,
              byteLength: null,
              sha256: null,
              sharedBy: 'user-2',
              audience: 'members',
              hidden: null,
              pins: 0,
              createdAt: '2026-10-25T10:00:00Z',
              feeds: { tasks: 0 },
            },
          ],
        };
      },
      'org.source.hide': async (params) => {
        hideCalls.push(params);
        return { ok: true, data: null };
      },
    });

    const tabs = el.querySelectorAll('button[role="tab"]');
    const sourcesTab = Array.from(tabs).find(t => t.textContent === 'Sources') as HTMLElement;
    expect(sourcesTab).toBeTruthy();

    await act(async () => {
      sourcesTab.click();
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const initialCallCount = sourcesCallCount;

    const hideButtons = Array.from(el.querySelectorAll('button')).filter(b => b.textContent?.includes('Hide as spam'));
    expect(hideButtons.length).toBeGreaterThan(0);

    await act(async () => {
      hideButtons[0]!.click();
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const reasonInput = el.querySelector('input[type="text"]') as HTMLInputElement;
    expect(reasonInput).toBeTruthy();

    await act(async () => {
      Object.getOwnPropertyDescriptor(dom!.window.HTMLInputElement.prototype, 'value')!.set!.call(reasonInput, 'Spam content');
      reasonInput.dispatchEvent(new dom!.window.Event('input', { bubbles: true }));
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const forms = el.querySelectorAll('form');
    const hideForm = Array.from(forms).find(f => f.textContent?.includes('Hide as spam'));
    expect(hideForm).toBeTruthy();

    await act(async () => {
      hideForm!.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(hideCalls.length).toBe(1);
    expect((hideCalls[0] as any).sourceKey).toBe('source-1');
    expect((hideCalls[0] as any).reason).toBeTruthy();
    expect(sourcesCallCount).toBeGreaterThan(initialCallCount);
  });

  it('forbidden overview shows "You\'re not a member of this DAO yet."', async () => {
    const el = await mount({
      'org.overview': async () => ({
        ok: false,
        error: { kind: 'forbidden', message: 'Access denied.' },
      }),
    });

    expect(el.textContent).toContain('You\'re not a member of this DAO yet.');
  });

  it('org-client rejects a response with unexpected keys', async () => {
    const { parseOrgOverview } = await import('../../src/ui/org-client.js');

    expect(() => {
      parseOrgOverview({ profile: { companyId: 'c1', name: 'DAO', createdBy: 'u1', createdAt: '2026-01-01T00:00:00Z' }, role: 'member', memberCount: 5, feed: [], labels: {}, keyDocuments: [], initiatives: [], extraKey: 'unexpected' });
    }).toThrow();
  });

  describe('share box params', () => {
    const overview = async () => ({
      ok: true,
      data: {
        profile: { companyId: 'company-1', name: 'Test DAO', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z' },
        role: 'member',
        memberCount: 1,
        feed: [],
        labels: {},
        keyDocuments: [],
        initiatives: [],
      },
    });

    async function type(input: HTMLInputElement, value: string) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom!.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new dom!.window.Event('input', { bubbles: true }));
      });
    }

    async function submit(form: HTMLFormElement) {
      await act(async () => {
        form.dispatchEvent(new dom!.window.Event('submit', { bubbles: true, cancelable: true }));
      });
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    function parts(el: HTMLElement) {
      const form = el.querySelector('form[aria-label="Share with the DAO"]') as HTMLFormElement;
      const [content, title] = Array.from(form.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
      const file = form.querySelector('input[type="file"]') as HTMLInputElement;
      return { form, content: content!, title: title!, file };
    }

    it('sends {kind:"link",title,url} and {kind:"note",title,text}', async () => {
      const calls: unknown[] = [];
      const el = await mount({
        'org.overview': overview,
        'org.source.share': async params => { calls.push(params); return { ok: true, data: null }; },
      });

      let p = parts(el);
      await type(p.content, 'https://example.com/doc');
      await type(p.title, 'Budget');
      await submit(p.form);

      p = parts(el);
      await type(p.content, 'Remember the vote');
      await type(p.title, 'Reminder');
      await submit(p.form);

      expect(calls).toEqual([
        { kind: 'link', title: 'Budget', url: 'https://example.com/doc' },
        { kind: 'note', title: 'Reminder', text: 'Remember the vote' },
      ]);
    });

    it('requires a title for links and notes', async () => {
      const calls: unknown[] = [];
      const el = await mount({
        'org.overview': overview,
        'org.source.share': async params => { calls.push(params); return { ok: true, data: null }; },
      });
      const p = parts(el);
      await type(p.content, 'https://example.com/doc');
      await submit(p.form);
      expect(calls).toEqual([]);
      expect(el.textContent).toContain('Title is required');
    });

    it('sends {kind:"file",title,mediaType,base64} with the title defaulting to the file name', async () => {
      const calls: unknown[] = [];
      const el = await mount({
        'org.overview': overview,
        'org.source.share': async params => { calls.push(params); return { ok: true, data: null }; },
      });
      vi.stubGlobal('FileReader', dom!.window.FileReader);
      const p = parts(el);
      const file = new dom!.window.File(['hello file'], 'notes.txt', { type: 'text/plain' });
      Object.defineProperty(p.file, 'files', { value: [file], configurable: true });
      await act(async () => {
        p.file.dispatchEvent(new dom!.window.Event('change', { bubbles: true }));
      });
      await submit(p.form);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(calls).toEqual([
        { kind: 'file', title: 'notes.txt', mediaType: 'text/plain', base64: Buffer.from('hello file').toString('base64') },
      ]);
    });
  });
});
