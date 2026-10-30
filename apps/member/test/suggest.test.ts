import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { members, organization, orgPassages, orgSources, workEvents } from '../src/db/schema';
import { createMemoryWorkSource } from '../src/adapters/memory-work';
import { addSource } from '../src/org/ingest';
import type { AskJson } from '../src/org/llm';
import { saveBasics, saveProfile } from '../src/org/organization';
import { sourcesSearchedForWork, suggestWorkFromSource } from '../src/work/suggest';

let db: Db;
beforeAll(async () => { db = (await createTestDb()) as Db; });
beforeEach(async () => {
  await db.delete(workEvents);
  await db.delete(orgPassages);
  await db.delete(orgSources);
  await db.delete(organization);
  await db.delete(members);
});

describe('finding work in a source', () => {
  it('creates only quoted items under accepted initiatives, once per source', async () => {
    const [kyle] = await db.insert(members).values({ externalId: 'm-kyle', email: 'k@example.org', displayName: 'Kyle', role: 'admin' }).returning();
    const work = createMemoryWorkSource();
    const { id: hackId } = await work.createInitiative!({ title: 'HackFW 2026', summary: '', adopted: true });
    await saveBasics(db, { name: 'FWTX DAO' });
    await saveProfile(db, { mission: null, programs: [], people: [], recent: [], initiatives: [
      { id: 'i1', title: 'HackFW 2026', summary: 'Hackathon', citations: [], status: 'accepted', workId: hackId, adopted: true },
      { id: 'i2', title: 'Innovation Lab', summary: 'Civic tech', citations: [], status: 'proposed', workId: null, adopted: false },
    ] });
    const { source } = await addSource(db, { kind: 'meeting', title: 'October roundtable', content: 'Ana: We still need two more judges for demo day.\nRob: I can ask the Fort Worth Club about a venue.' });
    const prompts: string[] = [];
    const askJson = (async ({ prompt, schema }) => {
      prompts.push(prompt);
      return schema.parse({ items: [
        { title: 'Recruit two demo day judges', lane: 'human', kind: 'outreach', estimateMinutes: 30, initiative: 1, quote: 'We still need two more judges for demo day.' },
        { title: 'Invented task', lane: 'human', initiative: 1, quote: 'We agreed to buy a boat.' },
        { title: 'Ask about a venue', lane: 'human', initiative: null, quote: 'I can ask the Fort Worth Club about a venue.' },
        { title: 'Draft judge invite', lane: 'agent', initiative: 'HackFW demo day', quote: '“We still need two more judges for demo day.”' },
      ] });
    }) as AskJson;

    const result = await suggestWorkFromSource(db, { work }, askJson, source.id, kyle.id);
    expect(result).toEqual({ created: 3, skipped: 1, people: 2, already: false });
    expect(prompts[0]).toContain('1. HackFW 2026: Hackathon');
    expect(prompts[0]).not.toContain('Innovation Lab');
    const [human, loose] = await work.listHumanTasks();
    expect(loose).toMatchObject({ title: 'Ask about a venue', initiativeId: '' });
    expect(human).toMatchObject({ title: 'Recruit two demo day judges', initiativeId: hackId, kind: 'outreach', estimateMinutes: 30, status: 'open' });
    expect(human.prepared).toContain('From October roundtable: “We still need two more judges for demo day.”');
    expect(await work.listAgentTasks!()).toHaveLength(1);
    expect((await sourcesSearchedForWork(db)).has(source.id)).toBe(true);
    expect(await suggestWorkFromSource(db, { work }, askJson, source.id, kyle.id)).toMatchObject({ already: true });
    expect(prompts).toHaveLength(1);
  });

  it('asks for an initiative first', async () => {
    const [kyle] = await db.insert(members).values({ externalId: 'm-kyle', email: 'k@example.org', displayName: 'Kyle', role: 'admin' }).returning();
    await saveBasics(db, { name: 'FWTX DAO' });
    const { source } = await addSource(db, { kind: 'note', title: 'Note', content: 'Someone should update the website.' });
    await expect(suggestWorkFromSource(db, { work: createMemoryWorkSource() }, (async () => ({})) as unknown as AskJson, source.id, kyle.id)).rejects.toThrow(/Keep at least one initiative/);
  });

  it('says how to turn on writing when Paperclip is read-only', async () => {
    const [kyle] = await db.insert(members).values({ externalId: 'm-kyle', email: 'k@example.org', displayName: 'Kyle', role: 'admin' }).returning();
    const { source } = await addSource(db, { kind: 'note', title: 'Note', content: 'Someone should update the website.' });
    const { createTask: _createTask, ...readOnly } = createMemoryWorkSource();
    const work = { ...readOnly, engine: { name: 'Paperclip', url: null, readOnly: true } };
    await expect(suggestWorkFromSource(db, { work }, (async () => ({})) as unknown as AskJson, source.id, kyle.id)).rejects.toThrow(/PAPERCLIP_ACCESS=write/);
  });
});
