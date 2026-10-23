import { afterEach, describe, expect, it } from 'vitest';
import { Client, g, readBatch } from '@helix-db/helix-db';
import { createHelixProjection } from '../../src/partners/helix.js';
import type { PartnerScope, ProjectionLease, ProjectionSnapshot } from '../../src/partners/types.js';

const clients: Client[] = [];
afterEach(async () => { for (const client of clients.splice(0)) await client.close(); });
const lease: ProjectionLease = { organization_id: 'dao', owner: 'worker', epoch: 1, expires_at: '2030-01-01T00:00:00Z' };
const scope: PartnerScope = { organization_id: 'dao', principal_id: 'member', audiences: ['public'], project_ids: [], opportunity_ids: [], as_of: '2026-10-23T00:00:00Z' };
function snapshot(overrides: Partial<ProjectionSnapshot> = {}): ProjectionSnapshot {
  return { contract_version: 'partner-graph-v1', organization_id: 'dao', assertion_id: 'assertion-1', revision: 1, deleted: false,
    subject: { entity_id: 'org-techfw', entity_type: 'Organization' }, object: null,
    predicate: 'HAS_CAPABILITY', value: 'manufacturing', qualifiers: {},
    evidence: [{ knowledge_id: 'knowledge-1', knowledge_revision: 1, audience: 'public', scope_kind: 'organization', scope_id: 'dao', source_id: 'official-page', source_revision: '1', source_hash: 'a'.repeat(64), source_locator: { line: 1 }, observed_at: '2026-10-22T00:00:00Z', effective_from: null, effective_until: null }], ...overrides };
}
async function setup() {
  const client = await Client.embedded({ kind: 'inMemory', database: crypto.randomUUID() }); clients.push(client);
  const graph = createHelixProjection(client, { embedded: true }); await graph.initialize(); await graph.advanceFence(lease);
  return { client, graph };
}
describe('actual official embedded Helix projection', () => {
  it('creates indexed scoped capability pointers and keeps contact/quote values out of projection', async () => {
    const { client, graph } = await setup();
    const receipt = await graph.apply(lease, snapshot());
    expect(receipt.revision).toBe(1);
    expect(await graph.candidates(scope, { predicate: 'HAS_CAPABILITY', value: 'manufacturing', limit: 20 })).toEqual([
      { assertion_id: 'assertion-1', revision: 1, subject_id: 'org-techfw', object_id: '', predicate: 'HAS_CAPABILITY' },
    ]);
    const raw = await client.query(readBatch().varAs('all', g().nWithLabel('PartnerAssertion').valueMap()).returning(['all']).toQueryRequest()).send();
    expect(JSON.stringify(raw)).not.toContain('manufacturing');
  });
  it('deduplicates replay and ignores reordered evidence while preserving source-scoped corroboration', async () => {
    const { graph } = await setup(); const one = snapshot(); const two = { ...one.evidence[0]!, knowledge_id: 'knowledge-2', audience: 'restricted' as const };
    one.evidence.push(two); const receipt = await graph.apply(lease, one);
    expect(await graph.apply(lease, { ...one, evidence: [...one.evidence].reverse() })).toEqual(receipt);
    expect(await graph.candidates(scope, { predicate: 'HAS_CAPABILITY', limit: 20 })).toHaveLength(1);
  });
  it('rejects altered same-version content and never resurrects a tombstone on delayed replay', async () => {
    const { graph } = await setup(); const first = snapshot(); await graph.apply(lease, first);
    await expect(graph.apply(lease, { ...first, value: 'different' })).rejects.toThrow(/revision|content/);
    await graph.apply(lease, snapshot({ revision: 2, deleted: true, evidence: [] }));
    await expect(graph.apply(lease, first)).rejects.toThrow(/stale|revision/);
    expect(await graph.candidates(scope, { predicate: 'HAS_CAPABILITY', limit: 20 })).toEqual([]);
    expect((await graph.receipt('dao', 'assertion-1'))?.deleted).toBe(true);
  });
  it('rejects an old worker after takeover and new deletion', async () => {
    const { graph } = await setup(); await graph.apply(lease, snapshot());
    const next = { ...lease, owner: 'replacement', epoch: 2 }; await graph.advanceFence(next);
    await graph.apply(next, snapshot({ revision: 2, deleted: true, evidence: [] }));
    await expect(graph.apply(lease, snapshot({ revision: 3 }))).rejects.toThrow(/fence/);
    await expect(graph.advanceFence(lease)).rejects.toThrow(/fence/);
    expect((await graph.receipt('dao', 'assertion-1'))?.revision).toBe(2);
  });
  it('filters tenant, audience, project, opportunity and validity before returning any pointer', async () => {
    const { graph } = await setup(); const first = snapshot();
    await graph.apply(lease, { ...first, evidence: [{ ...first.evidence[0]!, audience: 'restricted', scope_kind: 'project', scope_id: 'project-x' }] });
    expect(await graph.candidates(scope, { predicate: 'HAS_CAPABILITY', limit: 20 })).toEqual([]);
    expect(await graph.candidates({ ...scope, audiences: ['restricted'] }, { predicate: 'HAS_CAPABILITY', limit: 20 })).toEqual([]);
    expect(await graph.candidates({ ...scope, audiences: ['restricted'], project_ids: ['project-x'] }, { predicate: 'HAS_CAPABILITY', limit: 20 })).toHaveLength(1);
    expect(await graph.candidates({ ...scope, organization_id: 'other', audiences: ['restricted'], project_ids: ['project-x'] }, { predicate: 'HAS_CAPABILITY', limit: 20 })).toEqual([]);
    await graph.apply(lease, snapshot({ revision: 2, evidence: [{ ...first.evidence[0]!, effective_until: '2026-10-20T00:00:00Z' }] }));
    expect(await graph.candidates(scope, { predicate: 'HAS_CAPABILITY', limit: 20 })).toEqual([]);
  });
  it('bounds and keyset-pages deterministic pointers without inventing graph path semantics', async () => {
    const { graph } = await setup();
    await graph.apply(lease, snapshot({ assertion_id: 'a' })); await graph.apply(lease, snapshot({ assertion_id: 'b' }));
    expect((await graph.candidates(scope, { predicate: 'HAS_CAPABILITY', limit: 1 }))[0]?.assertion_id).toBe('a');
    expect((await graph.candidates(scope, { predicate: 'HAS_CAPABILITY', limit: 1, after: 'a' }))[0]?.assertion_id).toBe('b');
    await expect(graph.candidates(scope, { predicate: 'HAS_CAPABILITY', limit: 1001 })).rejects.toThrow(/limit/);
  });
});
