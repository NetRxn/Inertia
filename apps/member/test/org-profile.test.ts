import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import type { Db } from '../src/db/client';
import { organization, orgPassages, orgSources } from '../src/db/schema';
import { addSource } from '../src/org/ingest';
import { extractJson } from '../src/org/llm';
import { getOrganization, saveBasics, updateInitiative } from '../src/org/organization';
import { regenerateProfile } from '../src/org/profile';
import type { AskJson } from '../src/org/llm';

let db: Db;
beforeAll(async () => { db = (await createTestDb()) as Db; });
beforeEach(async () => {
  await db.delete(orgPassages);
  await db.delete(orgSources);
  await db.delete(organization);
});

/** A model stand-in that answers with a fixed draft, recording the prompt it saw. */
function scripted(draft: unknown, seen: string[] = []): AskJson {
  return (async ({ prompt, schema }) => { seen.push(prompt); return schema.parse(draft); }) as AskJson;
}

describe('organization profile', () => {
  it('keeps only cited lines and remembers accepted initiatives across redrafts', async () => {
    await saveBasics(db, { name: 'FWTX DAO', website: 'https://fwtx.city' });
    await addSource(db, { kind: 'website', title: 'fwtx.city', content: 'HackFW is our flagship hackathon.\n\nWeekly roundtables every Wednesday.' });
    const seen: string[] = [];
    const first = await regenerateProfile(db, scripted({
      mission: { text: 'Grow Fort Worth builders', cites: ['E1'] },
      programs: [{ text: 'HackFW hackathon', cites: ['E1'] }, { text: 'Invented program', cites: ['E99'] }],
      initiatives: [{ title: 'HackFW 2026', summary: 'Hackathon', cites: ['E1'] }, { title: 'Uncited', summary: '', cites: [] }],
    }, seen));
    expect(seen[0]).toContain('<excerpt id="E1"');
    expect(first.mission?.citations[0].title).toBe('fwtx.city');
    expect(first.programs.map((p) => p.text)).toEqual(['HackFW hackathon']);
    expect(first.initiatives.map((i) => i.title)).toEqual(['HackFW 2026']);

    await updateInitiative(db, first.initiatives[0].id, { status: 'accepted', workId: 'goal-1' });
    const second = await regenerateProfile(db, scripted({ initiatives: [{ title: 'Roundtables', summary: 'Weekly', cites: ['E1'] }] }));
    expect(second.initiatives.map((i) => [i.title, i.status, i.workId])).toEqual([
      ['Roundtables', 'proposed', null],
      ['HackFW 2026', 'accepted', 'goal-1'],
    ]);
    expect((await getOrganization(db))?.profileGeneratedAt).toBeInstanceOf(Date);
  });

  it('needs something shared before drafting', async () => {
    await saveBasics(db, { name: 'Empty org' });
    await expect(regenerateProfile(db, scripted({}))).rejects.toThrow(/Share something/);
  });

  it('reads JSON out of fenced or chatty replies', () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here: {"b": {"c": 2}} done')).toEqual({ b: { c: 2 } });
    expect(() => extractJson('no json')).toThrow();
  });
});
