import { describe, it, expect } from 'vitest';
import type { Initiative } from '../src/adapters/types';
import type { ProposedInitiative } from '../src/org/profile-types';
import { mergeInitiatives } from '../src/work/org-initiatives';

function proposed(id: string, title: string, change: Partial<ProposedInitiative> = {}): ProposedInitiative {
  return { id, title, summary: '', citations: [], status: 'accepted', workId: null, adopted: false, ...change };
}

function org(initiatives: ProposedInitiative[], governanceEnabled = false) {
  return { governanceEnabled, profile: { mission: null, programs: [], people: [], recent: [], initiatives } };
}

const rootGoal: Initiative = { id: 'g-root', title: 'Turn DAO priorities into evidenced, reviewed work', status: 'active' };

describe('mergeInitiatives', () => {
  it('lists an accepted initiative that never reached the work engine', () => {
    const list = mergeInitiatives(org([proposed('p-1', 'HackFW 2026')]), []);
    expect(list).toEqual([{ id: 'org:p-1', title: 'HackFW 2026', status: 'active', priority: 0, source: 'organization' }]);
  });

  it('marks it awaiting a vote when governance is on and it is not adopted', () => {
    const [one] = mergeInitiatives(org([proposed('p-1', 'HackFW 2026')], true), []);
    expect(one).toMatchObject({ status: 'active', awaitingVote: true, statusLabel: 'Awaiting vote' });
  });

  it('does not mark adopted initiatives as awaiting a vote', () => {
    const [one] = mergeInitiatives(org([proposed('p-1', 'HackFW 2026', { adopted: true })], true), []);
    expect(one.awaitingVote).toBeUndefined();
  });

  it('lists an initiative found in both sources once, with the engine id and progress', () => {
    const engine: Initiative[] = [{ id: 'g-1', title: 'HackFW 2026', status: 'active', progress: 0.4 }];
    const list = mergeInitiatives(org([proposed('p-1', 'HackFW 2026', { workId: 'g-1' })]), engine);
    expect(list).toEqual([{ id: 'g-1', title: 'HackFW 2026', status: 'active', progress: 0.4, priority: 0, source: 'both' }]);
  });

  it('links an engine goal by title when the profile has no work id', () => {
    const engine: Initiative[] = [{ id: 'g-1', title: 'hackfw 2026 ', status: 'active' }];
    const [one] = mergeInitiatives(org([proposed('p-1', 'HackFW 2026')]), engine);
    expect(one).toMatchObject({ id: 'g-1', title: 'HackFW 2026', source: 'both' });
  });

  it('keeps the onboarding order', () => {
    const list = mergeInitiatives(org([proposed('p-2', 'Roundtables'), proposed('p-1', 'HackFW 2026')]), []);
    expect(list.map((i) => [i.title, i.priority])).toEqual([['Roundtables', 0], ['HackFW 2026', 1]]);
  });

  it('leaves out proposed and dismissed initiatives', () => {
    const list = mergeInitiatives(org([proposed('p-1', 'A', { status: 'proposed' }), proposed('p-2', 'B', { status: 'dismissed' })]), []);
    expect(list).toEqual([]);
  });

  it('leaves out engine goals not linked to an accepted initiative, such as the agents’ root goal', () => {
    const list = mergeInitiatives(org([proposed('p-1', 'HackFW 2026')]), [rootGoal]);
    expect(list.map((i) => i.title)).toEqual(['HackFW 2026']);
  });

  it('falls back to the engine’s goals when nothing was accepted in onboarding', () => {
    const planned: Initiative = { id: 'g-2', title: 'Grants', status: 'paused', statusLabel: 'proposed' };
    const list = mergeInitiatives(null, [rootGoal, planned]);
    expect(list).toEqual([
      { ...rootGoal, source: 'engine' },
      { id: 'g-2', title: 'Grants', status: 'active', statusLabel: 'Awaiting vote', awaitingVote: true, source: 'engine' },
    ]);
  });

  it('takes done from the engine', () => {
    const engine: Initiative[] = [{ id: 'g-1', title: 'HackFW 2026', status: 'done' }];
    const [one] = mergeInitiatives(org([proposed('p-1', 'HackFW 2026', { workId: 'g-1' })]), engine);
    expect(one.status).toBe('done');
  });
});
