import { createHash } from 'node:crypto';
import type { PluginContext } from '@paperclipai/plugin-sdk';
import type { NativeInteraction } from '../paperclip/adapter.js';
import type { ReviewRole } from './contracts.js';

/** Host-owned registration, never arguments accepted from an agent or event body. */
export interface FundingReviewBinding {
  companyId: string; issueId: string; interactionId: string; itemId: string;
  applicantId: string; targetId: string; targetVersion: number;
  kind: 'proposal' | 'packet_role'; reviewerUserId: string; reviewerRole: ReviewRole;
  expectedHead: string; expectedWorkspaceHash: string;
  sourceScope: string; allowedEvidenceIds: readonly string[]; allowedTargets: readonly string[];
  documentId: string; documentKey: string; documentRevisionId: string; interactionDigest: string;
}
export interface FundingReviewCommand {
  decisionKey: string; binding: FundingReviewBinding; actorUserId: string;
  action: 'accepted' | 'rejected' | 'approved' | 'changes_requested';
  reason: string; resolvedAt: string;
}
export type FundingReviewOutcome = {state:'applied';command:FundingReviewCommand} | {state:'not_applied'} | {state:'unknown'};
export interface FundingReviewPort {
  /** Trusted identity directory: current active human membership, configured role and applicant/source scope. */
  authorize(binding: FundingReviewBinding, actorUserId: string): Promise<boolean>;
  /** Read the existing domain audit by key. not_applied MUST exclude pending/uncertain transactions. */
  readOutcome(decisionKey: string): Promise<FundingReviewOutcome>;
  /**
   * Atomic domain transaction: deduplicate key with FULL command equality; reauthorize
   * human/role/scope; lock applicant/current target; compare version, workspace and
   * expectedHead including review AND artifact bytes; validate allowed targets/evidence,
   * route, latest version and all current domain gates; apply existing domain semantics
   * and append native provenance to existing audit in that SAME transaction.
   * Return the original command on duplicate. Never submit or change a native card.
   * A preflight plus unguarded review_suggestion/web request DOES NOT implement this port.
   */
  applyGuarded(command: FundingReviewCommand): Promise<{state:'applied';command:FundingReviewCommand} | {state:'rejected';reason:string}>;
}
export type NativeReviewResult = {state:'applied'|'deferred'|'retryable'|'reconciliation_required'|'blocked';reason?:string};
type NativeReadPort = Pick<PluginContext['issues'],'listInteractions'|'documents'>;
function canonical(value: unknown): string {
  if(value===null || typeof value!=='object') return JSON.stringify(value) ?? 'null';
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
}
/** Immutable native card content. Resolution actors are mutable and checked per item. */
export function nativeReviewDigest(card: NativeInteraction): string {
  return createHash('sha256').update(canonical({id:card.id,companyId:card.companyId,issueId:card.issueId,
    kind:card.kind,title:card.title,summary:card.summary,payload:card.payload,addresseeUserId:card.addresseeUserId,addresseeAgentId:card.addresseeAgentId,
    requestedResolverPolicy:card.requestedResolverPolicy,effectiveResolverPolicy:card.effectiveResolverPolicy})).digest('hex');
}
function blocked(reason:string): NativeReviewResult { return {state:'blocked',reason}; }
function key(b:FundingReviewBinding):string {return JSON.stringify([b.companyId,b.issueId,b.interactionId,b.itemId]);}
function compare(outcome: FundingReviewOutcome, command: FundingReviewCommand):NativeReviewResult {
  if(outcome.state==='unknown') return {state:'reconciliation_required'};
  if(outcome.state==='not_applied') return {state:'retryable'};
  return canonical(outcome.command)===canonical(command) ? {state:'applied'} : blocked('Native identity already has a different domain outcome');
}
/**
 * Host extension contract, NOT a Paperclip SDK method. Must serialize changes to
 * this interaction and document head from before effect() until funding commit.
 * A second read or a process-local mutex that native writers bypass is insufficient.
 * The pinned plugin SDK has no such primitive; live composition stays disabled.
 */
export interface NativeReviewFence {
  withFence(binding: FundingReviewBinding, effect:()=>Promise<NativeReviewResult>):Promise<NativeReviewResult>;
}
/** Read-only native adapter; deliberately not registered as an agent tool or started by worker.ts. */
export function createNativeFundingReviewAdapter(native: NativeReadPort, funding: FundingReviewPort, registrations: readonly FundingReviewBinding[], fence?: NativeReviewFence) {
  // Prevent later mutation of caller-owned host configuration; duplicate identities fail closed.
  const bindings=structuredClone(registrations);
  const identities=new Set<string>();
  for(const b of bindings) {
    const id=JSON.stringify([b.interactionId,b.itemId]);
    if(identities.has(id) || !Number.isSafeInteger(b.targetVersion) || b.targetVersion<1 ||
      !['proposal','packet_role'].includes(b.kind) || !['program','fiscal','legal_compliance','partner','authorized_representative'].includes(b.reviewerRole) ||
      Object.values(b).some(v=>typeof v==='string' && !v.trim())) throw Error('Invalid or ambiguous trusted review registration');
    identities.add(id);
  }
  return {
    async reconcile(interactionId:string,itemId:string):Promise<NativeReviewResult> {
      const stored=bindings.find(b=>b.interactionId===interactionId && b.itemId===itemId);
      if(!stored) return blocked('No trusted native/domain binding');
      if(!fence) return blocked('Native source-fence host composition is not configured');
      let effectStarted=false;
      try {return await fence.withFence(structuredClone(stored),async()=> {
      effectStarted=true;
      const b=structuredClone(stored);
      let command:FundingReviewCommand;
      try {
        const cards=await native.listInteractions(b.issueId,b.companyId);
        const matches=cards.filter(c=>c.id===b.interactionId);
        if(matches.length!==1) return blocked('Native decision missing or ambiguous');
        const c=matches[0]!;
        if(c.companyId!==b.companyId || c.issueId!==b.issueId || c.kind!=='request_item_verdicts' ||
          c.requestedResolverPolicy!=='human_only' || c.effectiveResolverPolicy!=='human_only' ||
          c.addresseeUserId!==b.reviewerUserId || c.addresseeAgentId || c.acceptanceBlocker ||
          !['pending','answered'].includes(c.status) || nativeReviewDigest(c)!==b.interactionDigest)
          return blocked('Native task, policy or content mismatch');
        const target=c.payload.target;
        if(!target || target.type!=='issue_document' || target.key!==b.documentKey || target.revisionId!==b.documentRevisionId ||
          (target.issueId && target.issueId!==b.issueId) || (target.documentId && target.documentId!==b.documentId)) return blocked('Native revision target mismatch');
        const document=await native.documents.get(b.issueId,b.documentKey,b.companyId);
        if(!document || document.companyId!==b.companyId || document.issueId!==b.issueId || document.id!==b.documentId ||
          document.key!==b.documentKey || document.latestRevisionId!==b.documentRevisionId) return blocked('Document revision is stale');
        if(c.payload.items.filter(i=>i.id===b.itemId).length!==1 || c.result?.outcome!=='resolved') return blocked('Item is not authoritatively resolved');
        const items=c.result.items.filter(i=>i.id===b.itemId);
        if(items.length!==1 || new Set(c.result.items.map(i=>i.id)).size!==c.result.items.length ||
          c.result.items.some(i=>!c.payload.items.some(p=>p.id===i.id))) return blocked('Native item result mismatch');
        const item=items[0]!;
        if(item.resolvedByUserId!==b.reviewerUserId || item.resolvedByAgentId || item.resolvedByRunId ||
          !await funding.authorize(structuredClone(b),item.resolvedByUserId)) return blocked('Resolver is not an authorized scoped human');
        const resolvedAt=new Date(item.resolvedAt);
        if(!Number.isFinite(resolvedAt.getTime())) return blocked('Invalid native decision timestamp');
        if(item.verdict==='defer') {
          const prior=await funding.readOutcome(key(b));
          if(prior.state==='unknown') return {state:'reconciliation_required'};
          return prior.state==='applied' ? blocked('Deferred native item conflicts with a persisted domain decision') : {state:'deferred'};
        }
        if(item.verdict!=='approve' && item.verdict!=='reject') return blocked('Unsupported decision');
        command={decisionKey:key(b),binding:b,actorUserId:item.resolvedByUserId,
          action:b.kind==='proposal' ? (item.verdict==='approve'?'accepted':'rejected') : (item.verdict==='approve'?'approved':'changes_requested'),
          reason:item.reason??'',resolvedAt:resolvedAt.toISOString()};
        const previous=await funding.readOutcome(command.decisionKey);
        if(previous.state!=='not_applied') return compare(previous,command);
      } catch {return {state:'reconciliation_required',reason:'Authoritative native or domain read unavailable'};}
      try {
        const outcome=await funding.applyGuarded(structuredClone(command));
        if(outcome.state==='rejected') return blocked(outcome.reason);
        return compare(outcome,command);
      } catch {
        // No automatic second write after a lost response. Only the funding audit can resolve it.
        try {return compare(await funding.readOutcome(command.decisionKey),command);}
        catch {return {state:'reconciliation_required'};}
      }
      });} catch {return effectStarted ? {state:'reconciliation_required',reason:'Native fence outcome uncertain after effect started'} : blocked('Native source fence unavailable or changed');}
    },
  };
}
