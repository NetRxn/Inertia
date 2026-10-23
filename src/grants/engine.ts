import { createHash } from 'node:crypto';
import type { FrozenGrant, PacketIdentity, ReviewedGrantExport, ReviewedGrantSource } from './contracts.js';

export class GrantBoundaryError extends Error {}
function requireThat(value: unknown, message: string): asserts value {
  if (!value) throw new GrantBoundaryError(message);
}
export function sha256(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex'); }
/** v1 canonical form: JSON primitives, UTF-16 sorted object keys, ordered arrays, no coercion. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  function encode(item: unknown, depth: number): string {
    requireThat(depth <= 64, 'JSON nesting exceeds the packet limit');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') { requireThat(Number.isFinite(item), 'Non-finite JSON number'); return JSON.stringify(item); }
    requireThat(typeof item === 'object' && item !== null && !seen.has(item), 'Unsupported or cyclic JSON value');
    requireThat(Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null, 'Only plain JSON objects are allowed');
    seen.add(item);
    let result: string;
    if (Array.isArray(item)) {
      requireThat(Object.keys(item).length === item.length, 'Sparse or extended arrays are not JSON');
      result = '[' + item.map(x => encode(x, depth+1)).join(',') + ']';
    } else {
      requireThat(Object.getOwnPropertySymbols(item).length === 0, 'Symbol JSON keys are unsupported');
      const record = item as Record<string, unknown>;
      result = '{' + Object.keys(record).sort().map(k => {
        requireThat(Object.getOwnPropertyDescriptor(record,k)?.get === undefined, 'JSON accessors are unsupported');
        return JSON.stringify(k) + ':' + encode(record[k],depth+1);
      }).join(',') + '}';
    }
    seen.delete(item); return result;
  }
  const result=encode(value,0);
  requireThat(Buffer.byteLength(result) <= 2_000_000, 'Packet JSON exceeds 2 MB');
  return result;
}
export function snapshotHash(content: string): string { return sha256('inertia-grant-v1\n'+content); }
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function empty(value: unknown): boolean { return Array.isArray(value) && value.length === 0; }
function timestamp(value: unknown): number {
  requireThat(typeof value === 'string', 'Invalid timestamp');
  const parts = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  requireThat(parts, 'Invalid timestamp or missing explicit timezone');
  const calendar = new Date(parts[1] + 'T00:00:00Z');
  requireThat(Number.isFinite(calendar.getTime()) && calendar.toISOString().slice(0,10) === parts[1], 'Invalid timestamp calendar date');
  const time = Date.parse(value);
  requireThat(Number.isFinite(time), 'Invalid timestamp');
  // Preserve Python ISO microseconds beyond Date's millisecond parser precision.
  const fraction = (parts[5] ?? '').padEnd(6, '0');
  return time + Number(fraction.slice(3)) / 1000;
}
function validateReview(record: ReviewedGrantExport, identity: PacketIdentity, now: Date): void {
  const {packet:p,handoff:h,lifecycle:l,opportunity:o}=record;
  requireThat(nonempty(identity.packetId) && nonempty(identity.applicantId) && p.id===identity.packetId && p.applicant_id===identity.applicantId,'Packet identity mismatch');
  requireThat(Number.isSafeInteger(p.version) && p.version>0 && h.version===p.version,'Packet review version mismatch');
  requireThat(p.status==='submission_ready' && h.state==='approved_for_manual_submission','Complete existing engine review before requesting a submission vote');
  requireThat(h.submission_mode==='direct_application' && l.submission_mode===h.submission_mode && p.packet_data.submission_mode===h.submission_mode,'Only direct-application manual submission is supported');
  requireThat(h.submission===null && h.technically_ready===true && h.approvals_complete===true && h.mutation_allowed===true,'Engine handoff is not available');
  for (const blockers of [h.technical_blockers,h.placeholders,h.open_questions,h.unverified_forms,h.requirement_gates,h.missing_approvals,l.authorization_blockers]) requireThat(empty(blockers),'Resolve existing engine blockers before requesting authority');
  requireThat(l.is_latest_version===true && l.source_available===true && l.cycle_state==='current' && l.availability==='open_now','Refresh the current authoritative opportunity and packet');
  requireThat(o.namespace===p.opportunity_namespace && o.external_id===p.opportunity_external_id && o.status==='open','Opportunity identity or open state mismatch');
  requireThat(nonempty(o.source_url) && new URL(o.source_url).protocol==='https:','Authoritative HTTPS source required');
  requireThat(typeof o.close_date==='string' && /^\d{4}-\d\d-\d\d$/.test(o.close_date) && new Date(o.close_date+'T00:00:00Z').toISOString().slice(0,10)===o.close_date,'Known valid close date required');
  requireThat(Number.isFinite(now.getTime()) && o.close_date>=now.toISOString().slice(0,10),'Opportunity expired');
  const verified=timestamp(o.current_cycle_verified_at);
  requireThat(verified<=now.getTime() && now.getTime()-verified<=86_400_000,'Refresh source verification (maximum age 24 hours)');
  const match=p.packet_data.match;
  requireThat(match && typeof match==='object' && !Array.isArray(match),'Engine match evidence missing');
  requireThat(empty(match.unknowns) && empty(match.disqualifiers),'Eligibility unknowns or disqualifiers remain');
  const roles=['program','fiscal','legal_compliance','partner','authorized_representative'] as const;
  requireThat(Array.isArray(h.required_approval_roles) && h.required_approval_roles.length===roles.length && roles.every(r=>h.required_approval_roles.includes(r)),'Required engine signoff roles missing');
  for (const role of roles) {
    const approval=h.approvals[role];
    requireThat(approval && approval.packet_version===p.version && approval.reviewer_role===role && nonempty(approval.reviewer_name) && nonempty(approval.note),'Required engine signoff missing or bound to another version');
    requireThat(approval.decision==='approved' || (role==='partner' && approval.decision==='not_applicable'),'Required engine signoff not approved');
    requireThat(timestamp(approval.recorded_at)<=now.getTime(),'Review timestamp is in the future');
  }
}
export async function freezeReviewedPacket(source: ReviewedGrantSource, identity: PacketIdentity, now: Date): Promise<FrozenGrant> {
  // Snapshot caller policy and port functions before any await.
  const at = new Date(now.getTime());
  const readExport = source.readReviewedExport.bind(source);
  const readArtifact = source.readArtifact.bind(source);
  const request=Object.freeze({packetId:identity.packetId,applicantId:identity.applicantId});
  const record=JSON.parse(canonicalJson(await readExport(request))) as ReviewedGrantExport;
  validateReview(record,request,at);
  requireThat(Array.isArray(record.artifacts) && record.artifacts.length>=4 && record.artifacts.length<=64,'Expected complete artifact inventory');
  const keys=new Set<string>(); let bytes=0;
  for(const artifact of record.artifacts) {
    requireThat(nonempty(artifact.artifact_key) && !keys.has(artifact.artifact_key) && artifact.packet_id===request.packetId,'Duplicate artifact or packet mismatch'); keys.add(artifact.artifact_key);
    requireThat(/^[a-f0-9]{64}$/.test(artifact.content_hash) && empty(artifact.placeholders),'Artifact hash or unresolved placeholders invalid');
    const body=await readArtifact(request,artifact.artifact_key); bytes+=body.byteLength;
    requireThat(body.byteLength<=16_000_000 && bytes<=64_000_000,'Artifact content exceeds size limit');
    requireThat(sha256(body)===artifact.content_hash,'Artifact content integrity mismatch');
  }
  for(const key of ['application_packet_markdown','application_packet_docx','packet_data','review']) requireThat(keys.has(key),'Required packet artifact missing');
  // Bind reviews and package to content. Fetch/observation timestamps are not regenerated here.
  record.artifacts.sort((a,b)=>a.artifact_key<b.artifact_key?-1:a.artifact_key>b.artifact_key?1:0);
  const {current_cycle_verified_at: _observedAt, ...opportunity}=record.opportunity;
  const canonicalContent=canonicalJson({...record,opportunity});
  return Object.freeze({...request,version:record.packet.version,schema:'inertia-grant-v1',canonicalContent,contentHash:snapshotHash(canonicalContent)});
}
