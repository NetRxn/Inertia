import { createHash, randomUUID } from 'node:crypto';
import {
  BatchCondition, Client, g, IndexSpec, NodeRef, Order, Predicate as P,
  parseIndexDdlReceipt, parseIndexOperationStatus, readBatch, writeBatch,
  type QueryRequest,
} from '@helix-db/helix-db';
import type { CandidateQuery, Json, PartnerScope, Pointer, ProjectionLease, ProjectionReceipt, ProjectionSnapshot, ProjectionTarget } from './types.js';

export const HELIX_SDK_VERSION = '3.1.0';
export const HELIX_EMBEDDED_VERSION = '0.3.3';
/** Projection contains opaque references and lookup digests, never names, contact values or quotes. */
const indexes = [
  IndexSpec.nodeUniqueEquality('PartnerFence', 'key'),
  IndexSpec.nodeUniqueEquality('PartnerReceipt', 'key'),
  IndexSpec.nodeUniqueEquality('PartnerEntity', 'key'),
  IndexSpec.nodeUniqueEquality('PartnerAssertion', 'key'),
  IndexSpec.nodeEquality('PartnerAssertion', 'lookup_key'),
  IndexSpec.nodeEquality('PartnerAssertion', 'tenant_predicate'),
  IndexSpec.nodeEquality('PartnerAssertion', 'subject_key'),
  IndexSpec.nodeEquality('PartnerAssertion', 'object_key'),
  IndexSpec.nodeEquality('PartnerEvidence', 'assertion_key'),
];
const key = (...parts: string[]) => JSON.stringify(parts);
const entityTypes = new Set(['Organization','Person','Program','Project','Event','Opportunity','Capability']);
const edgePredicates = new Set(['PROGRAM_OF','AFFILIATED_WITH','PARTICIPATED_IN','WORKED_WITH','RELATIONSHIP_OWNER','CONTACT_FOR','INTRODUCED_TO','RELEVANT_TO_OPPORTUNITY']);
const predicates = new Set([...edgePredicates,'HAS_CAPABILITY','NAME','ALIAS','IDENTIFIER','STATUS','DELIVERY_STAGE','RELATIONSHIP_KIND','WORK_CONTACT','ROLE_ELIGIBILITY','EXTERNAL_BINDING']);
function canonical(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(',')}}`;
}
const hash = (value: Json) => createHash('sha256').update(canonical(value)).digest('hex');
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > 512 || /[\x00-\x1f]/.test(value)) throw Error('Invalid graph identifier');
}
function integer(value: number) { if (!Number.isSafeInteger(value) || value < 1) throw Error('Invalid graph revision'); }
function leaseValid(lease: ProjectionLease) {
  text(lease.organization_id); text(lease.owner); integer(lease.epoch);
  if (!Number.isFinite(Date.parse(lease.expires_at)) || Date.parse(lease.expires_at) <= Date.now()) throw Error('Projection lease expired');
}
function snapshotHash(snapshot: ProjectionSnapshot) {
  return hash({ ...snapshot, object: snapshot.object ?? null, evidence: [...snapshot.evidence].sort((a, b) => (canonical(a as unknown as Json) < canonical(b as unknown as Json) ? -1 : canonical(a as unknown as Json) > canonical(b as unknown as Json) ? 1 : 0)) } as unknown as Json);
}
function byKey(label: string, value: string) { return g().nWithLabelWhere(label, P.eq('key', value)); }
function rows(result: unknown, field: string): Record<string, unknown>[] {
  if (!result || typeof result !== 'object') throw Error('Invalid Helix response');
  const value = (result as Record<string, unknown>)[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw Error('Invalid Helix rows');
  return value as Record<string, unknown>[];
}
function receiptFrom(row: Record<string, unknown>): ProjectionReceipt {
  text(row.assertion_id); text(row.snapshot_hash);
  if (typeof row.revision !== 'number' || typeof row.deleted !== 'boolean') throw Error('Invalid projection receipt');
  integer(row.revision);
  return { assertion_id: row.assertion_id, revision: row.revision, snapshot_hash: row.snapshot_hash, deleted: row.deleted, ...(row.projection_omitted === true ? {projection_omitted:true} : {}) };
}
export interface HelixOptions { embedded?: boolean; indexTimeoutMs?: number }
/** Server mode requires writer reads and durable writes. Embedded mode must be explicitly selected. */
export function createHelixProjection(client: Client, options: HelixOptions = {}): ProjectionTarget & { initialize(): Promise<void> } {
  let ready = false;
  async function send(request: QueryRequest, write = false): Promise<unknown> {
    return options.embedded ? client.query(request).send()
      : (write ? client.requestBuilder().writerOnly().shouldAwaitDurability(true) : client.requestBuilder().writerOnly()).query(request).send();
  }
  const requireReady = () => { if (!ready) throw Error('Projection indexes are not confirmed active'); };
  async function receipt(organizationId: string, assertionId: string): Promise<ProjectionReceipt | null> {
    text(organizationId); text(assertionId);
    const result = await send(readBatch().varAs('receipt', byKey('PartnerReceipt', key(organizationId, assertionId)).valueMap(['assertion_id', 'revision', 'snapshot_hash', 'deleted', 'projection_omitted'])).returning(['receipt']).toQueryRequest());
    const row = rows(result, 'receipt')[0]; return row ? receiptFrom(row) : null;
  }
  return {
    async initialize() {
      ready = false;
      for (const spec of indexes) {
        const result = await send(writeBatch().varAs('index', g().createIndexIfNotExists(spec)).returning(['index']).toQueryRequest(), true);
        const ddl = parseIndexDdlReceipt((result as Record<string, unknown>).index);
        if (ddl.kind === 'already_active') continue;
        const deadline = Date.now() + (options.indexTimeoutMs ?? 30_000);
        for (;;) {
          const result = await send(readBatch().varAs('operation', g().getIndexOperation(ddl.operation_id)).returning(['operation']).toQueryRequest());
          const operation = parseIndexOperationStatus((result as Record<string, unknown>).operation);
          if (operation.status === 'succeeded') break;
          if (operation.status === 'blocked' || operation.status === 'aborted') throw Error(`Projection index ${operation.status}`);
          if (Date.now() >= deadline) throw Error('Projection indexes pending activation');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      ready = true;
    },
    async advanceFence(lease) {
      requireReady(); leaseValid(lease);
      const request = writeBatch()
        .varAs('existing', byKey('PartnerFence', lease.organization_id))
        .varAsIf('created', BatchCondition.varEmpty('existing'), g().addN('PartnerFence', { key: lease.organization_id, epoch: 0, owner: '' }))
        .varAs('fence', byKey('PartnerFence', lease.organization_id)
          .where(P.or([P.lt('epoch', lease.epoch), P.and([P.eq('epoch', lease.epoch), P.eq('owner', lease.owner)])]))
          .setProperty('epoch', lease.epoch).setProperty('owner', lease.owner).setProperty('touch', randomUUID()).valueMap(['epoch', 'owner']))
        .returning(['fence']).toQueryRequest();
      const result = await send(request, true);
      if (rows(result, 'fence').length !== 1) throw Error('Stale projection fence');
    },
    receipt,
    async apply(lease, snapshot) {
      requireReady(); leaseValid(lease);
      if (snapshot.contract_version !== 'partner-graph-v1' || snapshot.organization_id !== lease.organization_id) throw Error('Projection tenant/contract mismatch');
      text(snapshot.assertion_id); text(snapshot.subject.entity_id); integer(snapshot.revision);
      if (!entityTypes.has(snapshot.subject.entity_type) || (snapshot.object && !entityTypes.has(snapshot.object.entity_type))) throw Error('Invalid entity type');
      if (!predicates.has(snapshot.predicate)) throw Error('Invalid graph predicate');
      if (!snapshot.deleted) {
        if ((snapshot.object == null) === (snapshot.value == null)) throw Error('Exactly one typed object or value is required');
        if (edgePredicates.has(snapshot.predicate) && !snapshot.object) throw Error('Relationship requires typed object');
        if (!edgePredicates.has(snapshot.predicate) && snapshot.predicate !== 'HAS_CAPABILITY' && snapshot.object) throw Error('Attribute requires typed value');
        if (snapshot.value !== null && !['string','number','boolean'].includes(typeof snapshot.value)) throw Error('Invalid typed value');
        if (typeof snapshot.value === 'number' && !Number.isSafeInteger(snapshot.value)) throw Error('Invalid typed value');
        if (typeof snapshot.value === 'string' && (!snapshot.value.trim() || snapshot.value.length > 2000)) throw Error('Invalid typed value');
        if (!snapshot.qualifiers || Object.keys(snapshot.qualifiers).length > 16 || Object.values(snapshot.qualifiers).some(v=>typeof v!=='string' || v.length>500)) throw Error('Invalid qualifiers');
      }
      if (snapshot.object) text(snapshot.object.entity_id);
      if (snapshot.projection_omitted && (!snapshot.deleted || snapshot.evidence.length || snapshot.omission_reason !== 'evidence_limit' || !Number.isSafeInteger(snapshot.evidence_count) || snapshot.evidence_count! <= 100)) throw Error('Invalid explicit projection omission');
      if (snapshot.evidence.length > 100 || (!snapshot.deleted && !snapshot.evidence.length)) throw Error('Projection requires bounded admitted evidence');
      for (const evidence of snapshot.evidence) {
        text(evidence.knowledge_id); integer(evidence.knowledge_revision); text(evidence.scope_id);
        if (!['public','internal','restricted'].includes(evidence.audience) || !['organization','project','opportunity'].includes(evidence.scope_kind)
          || (evidence.scope_kind === 'organization' && evidence.scope_id !== lease.organization_id)) throw Error('Invalid projection evidence scope');
      }
      const tenant = lease.organization_id, assertionKey = key(tenant, snapshot.assertion_id), digest = snapshotHash(snapshot);
      const desired: ProjectionReceipt = { assertion_id: snapshot.assertion_id, revision: snapshot.revision, snapshot_hash: digest, deleted: snapshot.deleted, ...(snapshot.projection_omitted ? {projection_omitted:true} : {}) };
      // Touch the fence in the SAME transaction as the conditional replacement. This
      // creates a write/write conflict with takeover, not a read-only check vulnerable to write skew.
      const entities = [snapshot.subject, ...(snapshot.object ? [snapshot.object] : [])];
      let batch = writeBatch()
        .varAs('identityMismatch', g().nWithLabelWhere('PartnerEntity', P.or(entities.map(entity=>P.and([P.eq('key',key(tenant,entity.entity_id)),P.neq('entity_type',entity.entity_type)])))))
        .varAsIf('fence', BatchCondition.varEmpty('identityMismatch'), byKey('PartnerFence', tenant).where(P.and([P.eq('epoch', lease.epoch), P.eq('owner', lease.owner)])).setProperty('touch', randomUUID()))
        .varAs('newer', byKey('PartnerReceipt', assertionKey).where(P.gte('revision', snapshot.revision)))
        .varAsIf('eligible', BatchCondition.varEmpty('newer'), g().n(NodeRef.var('fence')))
        .varAsIf('clearEvidence', BatchCondition.varNotEmpty('eligible'), g().nWithLabelWhere('PartnerEvidence', P.eq('assertion_key', assertionKey)).drop())
        .varAsIf('clearAssertion', BatchCondition.varNotEmpty('eligible'), byKey('PartnerAssertion', assertionKey).drop())
        .varAsIf('clearReceipt', BatchCondition.varNotEmpty('eligible'), byKey('PartnerReceipt', assertionKey).drop())
        .varAsIf('newReceipt', BatchCondition.varNotEmpty('eligible'), g().addN('PartnerReceipt', { key: assertionKey, tenant, projection_omitted: snapshot.projection_omitted ?? false, ...desired }));
      if (!snapshot.deleted) {
        for (const [index, entity] of entities.entries()) {
          batch = batch.varAsIf(`entity${index}`, BatchCondition.varNotEmpty('eligible'), byKey('PartnerEntity', key(tenant, entity.entity_id)))
            .varAsIf(`missing${index}`, BatchCondition.varEmpty(`entity${index}`), g().n(NodeRef.var('eligible')))
            .varAsIf(`create${index}`, BatchCondition.varNotEmpty(`missing${index}`), g().addN('PartnerEntity', { key: key(tenant, entity.entity_id), tenant, entity_id: entity.entity_id, entity_type: entity.entity_type }));
        }
        batch = batch.varAsIf('assertion', BatchCondition.varNotEmpty('eligible'), g().addN('PartnerAssertion', {
          key: assertionKey, tenant, assertion_id: snapshot.assertion_id, revision: snapshot.revision,
          subject_id: snapshot.subject.entity_id, object_id: snapshot.object?.entity_id ?? '', predicate: snapshot.predicate,
          tenant_predicate: key(tenant, snapshot.predicate), lookup_key: hash([tenant, snapshot.predicate, snapshot.value]),
          subject_key: key(tenant, snapshot.subject.entity_id), object_key: key(tenant, snapshot.object?.entity_id ?? ''),
        })).varAsIf('subject', BatchCondition.varNotEmpty('eligible'), byKey('PartnerEntity', key(tenant, snapshot.subject.entity_id)))
          .varAsIf('subjectEdge', BatchCondition.varNotEmpty('eligible'), g().n(NodeRef.var('assertion')).addE('SUBJECT', NodeRef.var('subject')));
        if (snapshot.object) batch = batch.varAsIf('object', BatchCondition.varNotEmpty('eligible'), byKey('PartnerEntity', key(tenant, snapshot.object.entity_id)))
          .varAsIf('objectEdge', BatchCondition.varNotEmpty('eligible'), g().n(NodeRef.var('assertion')).addE(snapshot.predicate, NodeRef.var('object')));
        for (const [i, evidence] of snapshot.evidence.entries()) {
          const from = evidence.effective_from === null ? -8_640_000_000_000_000 : Date.parse(evidence.effective_from);
          const until = evidence.effective_until === null ? 8_640_000_000_000_000 : Date.parse(evidence.effective_until);
          let checkedAt = -8_640_000_000_000_000, freshUntil = 8_640_000_000_000_000;
          if (evidence.checked_at != null || evidence.freshness_seconds != null) {
            if (!evidence.checked_at || !Number.isSafeInteger(evidence.freshness_seconds) || evidence.freshness_seconds! < 1 || evidence.freshness_seconds! > 31_536_000) throw Error('Invalid freshness policy');
            checkedAt = Date.parse(evidence.checked_at);
            freshUntil = checkedAt + evidence.freshness_seconds! * 1000;
            if (!Number.isFinite(checkedAt) || !Number.isFinite(freshUntil)) throw Error('Invalid freshness policy');
          }
          const observedAt = Date.parse(evidence.observed_at);
          if (!Number.isFinite(observedAt) || !Number.isFinite(from) || !Number.isFinite(until) || until <= from) throw Error('Invalid evidence interval');
          batch = batch.varAsIf(`evidence${i}`, BatchCondition.varNotEmpty('eligible'), g().addN('PartnerEvidence', {
            assertion_key: assertionKey, tenant, knowledge_id: evidence.knowledge_id, knowledge_revision: evidence.knowledge_revision,
            audience: evidence.audience, scope_kind: evidence.scope_kind, scope_id: evidence.scope_id, valid_from: from, valid_until: until, observed_at: observedAt, checked_at: checkedAt, fresh_until: freshUntil,
          })).varAsIf(`evidenceEdge${i}`, BatchCondition.varNotEmpty('eligible'), g().n(NodeRef.var('assertion')).addE('SUPPORTED_BY', NodeRef.var(`evidence${i}`)));
        }
      }
      batch = batch.varAs('result', byKey('PartnerReceipt', assertionKey).valueMap(['assertion_id', 'revision', 'snapshot_hash', 'deleted', 'projection_omitted']))
        .returning(['fence', 'result', 'identityMismatch']);
      let result: unknown;
      try { result = await send(batch.toQueryRequest(), true); }
      catch (error) {
        // No blind mutation retry after a lost response. A writer read reconciles it.
        const observed = await receipt(tenant, snapshot.assertion_id).catch(() => null);
        if (observed?.revision === desired.revision && observed.snapshot_hash === desired.snapshot_hash) return observed;
        throw error;
      }
      if (rows(result, 'identityMismatch').length) throw Error('Canonical identity type mismatch');
      if (!rows(result, 'fence').length) throw Error('Stale projection fence');
      const observed = rows(result, 'result')[0];
      if (!observed) throw Error('Projection receipt unavailable');
      const applied = receiptFrom(observed);
      if (applied.revision !== desired.revision || applied.snapshot_hash !== desired.snapshot_hash) throw Error('Stale revision or changed same-revision content');
      const verified = await receipt(tenant, snapshot.assertion_id);
      if (!verified || verified.revision !== desired.revision || verified.snapshot_hash !== digest) throw Error('Projection readback changed; reconcile source');
      return verified;
    },
    async candidates(scope: PartnerScope, query: CandidateQuery): Promise<Pointer[]> {
      requireReady(); text(scope.organization_id); text(scope.principal_id);
      if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 200) throw Error('Invalid graph query limit');
      const at = Date.parse(scope.as_of); if (!Number.isFinite(at)) throw Error('Invalid query time');
      if (scope.audiences.length > 3 || scope.project_ids.length > 100 || scope.opportunity_ids.length > 100) throw Error('Unbounded scope');
      let start = query.value !== undefined
        ? g().nWithLabelWhere('PartnerAssertion', P.eq('lookup_key', hash([scope.organization_id, query.predicate, query.value])))
        : g().nWithLabelWhere('PartnerAssertion', P.eq('tenant_predicate', key(scope.organization_id, query.predicate)));
      start = start.where(P.eq('tenant', scope.organization_id));
      if (query.entity_id) start = start.where(P.or([P.eq('subject_id', query.entity_id), P.eq('object_id', query.entity_id)]));
      if (query.after) start = start.where(P.gt('assertion_id', query.after));
      const authorized = P.and([
        P.eq('tenant', scope.organization_id), P.isIn('audience', scope.audiences), P.lte('observed_at', at), P.lte('checked_at', at), P.gt('fresh_until', at), P.lte('valid_from', at), P.gt('valid_until', at),
        P.or([P.and([P.eq('scope_kind', 'organization'), P.eq('scope_id', scope.organization_id)]),
          P.and([P.eq('scope_kind', 'project'), P.isIn('scope_id', scope.project_ids)]),
          P.and([P.eq('scope_kind', 'opportunity'), P.isIn('scope_id', scope.opportunity_ids)])]),
      ]);
      // Start at an indexed tenant-qualified assertion lookup, inspect every evidence
      // binding separately, and return opaque pointers only. PG always revalidates.
      const request = readBatch().varAs('hits', start.out('SUPPORTED_BY').where(authorized).in('SUPPORTED_BY')
        .dedup().orderBy('assertion_id', Order.Asc).limit(query.limit)
        .valueMap(['assertion_id', 'revision', 'subject_id', 'object_id', 'predicate'])).returning(['hits']).toQueryRequest();
      return rows(await send(request), 'hits').map(row => {
        for (const field of ['assertion_id','subject_id','predicate']) text(row[field]);
        if (typeof row.object_id !== 'string' || typeof row.revision !== 'number') throw Error('Invalid graph pointer');
        integer(row.revision);
        return row as unknown as Pointer;
      });
    },
  };
}
