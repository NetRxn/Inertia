import type { EntityRef, Predicate } from './types.js';
export interface AssertionCandidate {
  assertion: { contract_version: 'partner-graph-v1'; subject: EntityRef; predicate: Predicate; object?: EntityRef | null; value?: string | number | boolean | null; qualifiers: Record<string,string> };
  knowledge_id: string; knowledge_revision: number; knowledge_hash: string; checked_at?: string | null; freshness_seconds?: number | null;
}
export interface ResearchQuery { capabilities: string[]; project_id?: string; opportunity_id?: string }
export interface ResearchInput {
  answer: string; candidates: AssertionCandidate[]; no_change_reason: string | null; expected_revisions?: Record<string,number>;
  opportunity_outcome: 'accepted' | 'rejected' | 'unknown' | null;
}
export interface DeltaReceipt {
  contract_version: 'partner-graph-v1'; run_id: string; query_receipt_id: string;
  committed: {assertion_id:string;revision:number}[]; reused: string[]; disputed: string[]; candidates: string[];
  ignored: unknown[]; source_bindings: string[]; projection_sequence: number;
  projection_state: 'pending' | 'current'; no_change_reason: string | null;
  opportunity_outcome: 'accepted' | 'rejected' | 'unknown' | null;
}
export interface ResearchSource {
  /** Bound to the authenticated principal. Performs indexed reuse query and records query-first receipt. */
  begin(runId: string, query: ResearchQuery): Promise<{query_receipt_id:string;items:unknown[];evidence_gaps:unknown[]}>;
  /** Trusted service owns admission policy. No producer actor, audience or verified flag is accepted. */
  commit(input: Omit<ResearchInput, 'answer'> & {run_id:string;idempotency_key:string;query_receipt_id:string}): Promise<DeltaReceipt>;
}
export interface ResearchRun {run_id:string;idempotency_key:string;query:ResearchQuery}
function fields(value: object, permitted: string[]) {
  if (!value || typeof value !== 'object' || Object.keys(value).some(key=>!permitted.includes(key))) throw Error('Unexpected research field');
}
/** Query first, research only the gaps, then answer + a durable receipt. */
export async function runPartnerResearch(source: ResearchSource, run: ResearchRun, research: (saved: Awaited<ReturnType<ResearchSource['begin']>>) => Promise<ResearchInput>): Promise<{answer:string;knowledge_receipt:DeltaReceipt;graph_refresh_pending:boolean}> {
  fields(run,['run_id','idempotency_key','query']);
  fields(run.query,['capabilities','project_id','opportunity_id']);
  for (const id of [run.run_id,run.idempotency_key]) if (typeof id !== 'string' || !id.trim() || id.length > 128) throw Error('Invalid research identity');
  for (const id of [run.query.project_id,run.query.opportunity_id]) if (id !== undefined && (typeof id !== 'string' || !id.trim() || id.length > 255)) throw Error('Invalid research scope');
  if (!Array.isArray(run.query.capabilities) || run.query.capabilities.length > 20 || run.query.capabilities.some(v=>typeof v!=='string' || !v.trim() || v.length>255)) throw Error('Unbounded research query');
  const saved = await source.begin(run.run_id,run.query);
  if (!saved.query_receipt_id) throw Error('Missing query-first receipt');
  const input = await research(saved);
  fields(input,['answer','candidates','no_change_reason','opportunity_outcome','expected_revisions']);
  if (typeof input.answer !== 'string' || !input.answer.trim() || input.answer.length > 100_000 || !Array.isArray(input.candidates) || input.candidates.length > 100) throw Error('Invalid bounded research result');
  if (input.no_change_reason !== null && (typeof input.no_change_reason !== 'string' || input.no_change_reason.length>2000)) throw Error('Invalid no-change reason');
  if (![null,'accepted','rejected','unknown'].includes(input.opportunity_outcome)) throw Error('Invalid opportunity outcome');
  if (!input.candidates.length && !input.no_change_reason?.trim()) throw Error('Empty delta requires a useful no-change reason');
  for (const candidate of input.candidates) {
    fields(candidate,['assertion','knowledge_id','knowledge_revision','knowledge_hash','checked_at','freshness_seconds']);
    fields(candidate.assertion,['contract_version','subject','predicate','object','value','qualifiers']);
    fields(candidate.assertion.subject,['entity_id','entity_type']);
    if(candidate.assertion.object) fields(candidate.assertion.object,['entity_id','entity_type']);
    if (candidate.assertion.contract_version !== 'partner-graph-v1' || !candidate.knowledge_id || !Number.isSafeInteger(candidate.knowledge_revision) || candidate.knowledge_revision<1 || !/^[a-f0-9]{64}$/.test(candidate.knowledge_hash)) throw Error('Invalid source-bound candidate');
  }
  if (input.expected_revisions !== undefined) {
    const revisions = input.expected_revisions;
    if (!revisions || typeof revisions !== 'object' || Array.isArray(revisions) || Object.keys(revisions).length>100 || Object.entries(revisions).some(([id,revision])=>!id.trim() || id.length>128 || !Number.isSafeInteger(revision) || revision<1)) throw Error('Invalid bounded expected revision map');
  }
  const {answer,...delta} = input;
  const receipt = await source.commit({...delta,run_id:run.run_id,idempotency_key:run.idempotency_key,query_receipt_id:saved.query_receipt_id});
  if (receipt.contract_version !== 'partner-graph-v1' || receipt.run_id !== run.run_id || receipt.query_receipt_id !== saved.query_receipt_id || !['pending','current'].includes(receipt.projection_state)) throw Error('Mismatched durable knowledge receipt');
  return {answer,knowledge_receipt:receipt,graph_refresh_pending:receipt.projection_state==='pending'};
}
