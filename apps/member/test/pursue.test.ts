import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members, organization, orgPassages, orgSources, workEvents } from '../src/db/schema';
import { createMemoryWorkSource } from '../src/adapters/memory-work';
import type { FundingOpportunity } from '../src/adapters/types';
import { addSource } from '../src/org/ingest';
import type { AskJson } from '../src/org/llm';
import { getOrganization, saveBasics } from '../src/org/organization';
import { pursueOpportunity, pursuedOpportunities } from '../src/work/pursue';

let db: Db;
beforeAll(async () => { db = (await createTestDb()) as Db; });
beforeEach(async () => {
  await db.delete(workEvents);
  await db.delete(orgPassages);
  await db.delete(orgSources);
  await db.delete(organization);
  await db.delete(members);
});

const opportunity: FundingOpportunity = {
  id: 'opp-1', sponsor: 'Texas Library Fund', program: 'Digital Literacy Grant', route: 'direct',
  summary: 'Funds community digital literacy workshops in Tarrant County.', deadline: '2026-12-01', benefit: 'Up to $25,000',
  effort: 'Medium', nextStep: 'Submit a letter of intent', sourceUrl: 'https://example.org/grant', observedAt: '2026-10-27T00:00:00Z', initiativeId: null,
};

describe('pursuing an opportunity', () => {
  it('creates a project under the grant initiative with agent and human tasks, once', async () => {
    const [kyle] = await db.insert(members).values({ externalId: 'm-kyle', email: 'k@example.org', displayName: 'Kyle', role: 'admin' }).returning();
    await saveBasics(db, { name: 'FWTX DAO' });
    await addSource(db, { kind: 'meeting', title: 'October roundtable', content: 'Rob: The library can host our digital literacy workshops.' });
    const prompts: string[] = [];
    const askJson = (async ({ prompt, schema }) => {
      prompts.push(prompt);
      return schema.parse({
        brief: 'Fits our workshops (October roundtable).',
        tasks: [
          { title: 'Check eligibility', description: 'Read the rules', lane: 'agent' },
          { title: 'Draft the narrative', description: 'Use the brief', lane: 'agent' },
          { title: 'Confirm the library partner', description: 'Ask Rob', lane: 'human', kind: 'outreach', estimateMinutes: 15 },
          { title: '', lane: 'human' },
        ],
      });
    }) as AskJson;
    const work = createMemoryWorkSource();

    const result = await pursueOpportunity(db, { work }, askJson, opportunity, kyle.id);
    expect(result).toMatchObject({ created: 3, already: false });
    expect(prompts[0]).toContain('<opportunity sponsor="Texas Library Fund"');
    expect(prompts[0]).toContain('October roundtable');

    const [initiative] = await work.listInitiatives();
    expect(initiative).toMatchObject({ title: 'Pursue grant funding strategy', statusLabel: 'proposed' });
    expect((await getOrganization(db))?.profile?.initiatives[0]).toMatchObject({ title: 'Pursue grant funding strategy', workId: initiative.id, adopted: false });
    const human = await work.listHumanTasks();
    expect(human).toEqual([expect.objectContaining({ title: 'Confirm the library partner', kind: 'outreach', estimateMinutes: 15, initiativeId: initiative.id, prepared: expect.stringContaining('October roundtable') })]);
    expect(await work.listAgentTasks!()).toHaveLength(2);
    expect((await pursuedOpportunities(db)).has('opp-1')).toBe(true);

    const again = await pursueOpportunity(db, { work }, askJson, opportunity, kyle.id);
    expect(again.already).toBe(true);
    expect(prompts).toHaveLength(1);
  });
});
