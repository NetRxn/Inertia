import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members, organization, orgPassages, orgSources, workEvents } from '../src/db/schema';
import { createMemoryWorkSource } from '../src/adapters/memory-work';
import type { FundingOpportunity } from '../src/adapters/types';
import { addSource } from '../src/org/ingest';
import type { AskJson } from '../src/org/llm';
import { pursueOpportunity, pursuedOpportunities } from '../src/work/pursue';
import { listOrgInitiatives } from '../src/work/org-initiatives';
import { buildTimeline } from '../src/feed/timeline';
import { getOrganization, saveBasics, saveProfile, setGovernance } from '../src/org/organization';

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

  it('shows the grant project on Home and Agents, beside the initiatives from onboarding', async () => {
    const [kyle] = await db.insert(members).values({ externalId: 'm-kyle', email: 'k@example.org', displayName: 'Kyle', role: 'admin' }).returning();
    await saveBasics(db, { name: 'FWTX DAO' });
    // Onboarding accepted one initiative; governance is on.
    await saveProfile(db, { mission: null, programs: [], people: [], recent: [], initiatives: [
      { id: 'p-hack', title: 'HackFW 2026', summary: '', citations: [], status: 'accepted', workId: null, adopted: true },
    ] });
    await setGovernance(db, true);
    const work = createMemoryWorkSource(() => new Date('2026-10-28T12:00:00Z'));
    const askJson = (async ({ schema }) => schema.parse({
      brief: 'Fits our workshops.',
      tasks: [
        { title: 'Check eligibility', lane: 'agent' },
        { title: 'Confirm the library partner', lane: 'human', kind: 'outreach', estimateMinutes: 15 },
      ],
    })) as AskJson;

    await pursueOpportunity(db, { work }, askJson, opportunity, kyle.id);

    // Home and Agents read this list: onboarding's initiative, then the grant initiative awaiting a vote.
    const initiatives = await listOrgInitiatives(db, work);
    expect(initiatives.map((i) => [i.title, i.statusLabel])).toEqual([['HackFW 2026', undefined], ['Pursue grant funding strategy', 'Awaiting vote']]);
    const grant = initiatives[1];

    // The suggested task needs a person and sits under the grant initiative, not General.
    const [ask] = await work.listHumanTasks();
    expect(ask).toMatchObject({ title: 'Confirm the library partner', status: 'open', initiativeId: grant.id });

    // When the agent finishes its task, Agents shows it under the grant initiative.
    const agentsDone = (await work.listAgentTasks!()).map((t) => ({ ...t, status: 'done' as const }));
    const { items } = buildTimeline(
      { initiatives, names: new Map(), humanTasks: [], agentTasks: agentsDone, meetings: [], shares: [], proposals: [], opportunities: [], applications: [], sources: [] },
      { limit: 10, actors: ['agent'] },
    );
    expect(items.map((i) => [i.title, i.initiative?.title])).toEqual([['Check eligibility', 'Pursue grant funding strategy']]);
  });

  it('pursues an opportunity the catalog has not assessed, without printing null', async () => {
    const [kyle] = await db.insert(members).values({ externalId: 'm-kyle', email: 'k@example.org', displayName: 'Kyle', role: 'admin' }).returning();
    await saveBasics(db, { name: 'FWTX DAO' });
    const prompts: string[] = [];
    const askJson = (async ({ prompt, schema }) => {
      prompts.push(prompt);
      return schema.parse({ brief: '', tasks: [{ title: 'Check eligibility', lane: 'agent' }] });
    }) as AskJson;
    const work = createMemoryWorkSource();
    const unassessed: FundingOpportunity = { ...opportunity, id: 'native-1', sponsor: null, route: null, summary: null, nextStep: null };

    await pursueOpportunity(db, { work }, askJson, unassessed, kyle.id);
    expect(prompts[0]).not.toContain('null');
    const [agentTask] = await work.listAgentTasks!();
    expect(agentTask.title).toBe('Check eligibility');
    expect(JSON.stringify(await work.listAgentTasks!())).not.toContain('(null)');
  });
});

