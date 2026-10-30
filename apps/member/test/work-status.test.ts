import { describe, it, expect } from 'vitest';
import { createMemoryWorkSource } from '../src/adapters/memory-work';
import { buildWorkStatus, recapSentence } from '../src/work/status';
import { mergeInitiatives } from '../src/work/org-initiatives';

describe('work status', () => {
  it('puts people and agents side by side per initiative, with a recap of both', async () => {
    const work = createMemoryWorkSource(() => new Date('2026-10-27T12:00:00Z'));
    const { id: grants } = await work.createInitiative!({ title: 'Pursue grant funding strategy', summary: '', adopted: false });
    const ask = await work.createTask!({ initiativeId: grants, title: 'Pick the lead story', description: 'A or B', lane: 'human', estimateMinutes: 10 });
    await work.createTask!({ initiativeId: grants, title: 'Draft narrative', description: '', lane: 'agent' });
    await work.createTask!({ initiativeId: grants, title: 'Confirm budget', description: '', lane: 'human' });
    await work.claim(ask.id, 'm-john');

    const status = await buildWorkStatus({ work }, new Date('2026-10-27T12:00:00Z'));
    expect(status.recap).toEqual({ peopleDoneThisWeek: 0, agentsDoneThisWeek: 0, waitingOnPeople: 1, agentsWorking: 0 });
    expect(status.initiatives).toHaveLength(1);
    const [group] = status.initiatives;
    expect(group.initiative).toMatchObject({ title: 'Pursue grant funding strategy', statusLabel: 'proposed' });
    expect(group.peopleCounts).toEqual({ open: 1, inProgress: 1, done: 0 });
    expect(group.agentCounts).toEqual({ open: 1, inProgress: 0, done: 0 });
    expect(recapSentence(status.recap)).toBe('This week agents finished 0 tasks and members finished 0. 1 thing is waiting on a person.');
  });

  it('groups agent work under goals the organization did not accept as not tied to an initiative', async () => {
    const work = createMemoryWorkSource(() => new Date('2026-10-27T12:00:00Z'));
    const { id: root } = await work.createInitiative!({ title: 'Turn DAO priorities into evidenced, reviewed work', summary: '', adopted: true });
    await work.createTask!({ initiativeId: root, title: 'Index meeting notes', description: '', lane: 'agent' });
    const initiatives = mergeInitiatives(
      { governanceEnabled: false, profile: { mission: null, programs: [], people: [], recent: [], initiatives: [
        { id: 'p-1', title: 'HackFW 2026', summary: '', citations: [], status: 'accepted', workId: null, adopted: false },
      ] } },
      await work.listInitiatives(),
    );

    const status = await buildWorkStatus({ work }, new Date('2026-10-27T12:00:00Z'), initiatives);
    expect(status.initiatives.map((g) => [g.initiative.title, g.agents.map((t) => t.title)])).toEqual([
      ['HackFW 2026', []],
      ['Not tied to an initiative', ['Index meeting notes']],
    ]);
  });
});
