import { isDeepStrictEqual } from 'node:util';
import { contributionHash, validateArtifacts } from './artifacts.js';
import type { Candidate, ContributionActor, ContributionBinding, ContributionDependencies, Enrollment } from './contracts.js';
const fields = ['memberId','agentId','authorityEpoch','companyId','projectId','issueId','taskRevision','runId','checkoutRunId','providerLeaseId','lifecycleGeneration','enrollmentRevision'] as const;
const same = isDeepStrictEqual;
function binding(e: Enrollment): ContributionBinding {
  return {memberId:e.memberId,agentId:e.agentId,authorityEpoch:e.authorityEpoch,companyId:e.companyId,projectId:e.projectId,issueId:e.issueId,taskRevision:e.taskRevision,runId:e.runId,checkoutRunId:e.checkoutRunId,providerLeaseId:e.providerLeaseId,lifecycleGeneration:e.lifecycleGeneration,lifecycleDisposition:e.lifecycleDisposition,enrollmentRevision:e.enrollmentRevision,expiresAt:e.expiresAt,dataClass:e.dataClass,artifactClass:e.artifactClass,inputHash:contributionHash(e.input)};
}
export type SubmissionResult = {state:'disabled'|'denied'|'invalid-artifacts'|'conflict'} | {state:'candidate-for-review'|'uncertain';operationId:string};
/** Deliberately has no accepted/completed state and no native mutation dependency. */
export function createContributionBoundary(d: ContributionDependencies) {
  async function authorize(actor: ContributionActor, issueId: string) {
    const original = await d.loadEnrollment(actor,issueId);
    if (!original) return null;
    const e = structuredClone(original);
    const now = d.clock();
    if (d.enabled() !== true || e.enabled !== true || e.active !== true || !Number.isFinite(now) || !Number.isFinite(e.expiresAt) || e.expiresAt <= now ||
      fields.some(k=>typeof e[k] !== 'string'||!e[k]||e[k].length>256) ||
      e.memberId !== actor.memberId || e.agentId !== actor.agentId || e.authorityEpoch !== actor.authorityEpoch || e.issueId !== issueId ||
      e.lifecycleDisposition !== 'active' || e.dataClass !== 'approved-public' || e.artifactClass !== 'text-evidence' || typeof e.input !== 'string' || Buffer.byteLength(e.input)>65536) return null;
    const b = binding(e), n = await d.readNative(b);
    if (!n || !n.running || n.companyId!==b.companyId || n.projectId!==b.projectId || n.issueId!==b.issueId ||
      n.taskRevision!==b.taskRevision || n.agentId!==b.agentId || n.runId!==b.runId || n.checkoutRunId!==b.checkoutRunId || b.runId!==b.checkoutRunId) return null;
    // Re-read server-owned enrollment after the native await. Still not a transaction.
    const current = await d.loadEnrollment(actor,issueId);
    if (d.enabled() !== true || !current || current.enabled !== true || current.active !== true || current.expiresAt<=d.clock() || !same(e,current)) return null;
    return {binding:b,input:e.input};
  }
  return {
    async exportInput(actor: ContributionActor, issueId: string) {
      if (d.enabled() !== true) return {state:'disabled'} as const;
      try { const a=await authorize(structuredClone(actor),issueId); return a ? {state:'input',...a} as const : {state:'denied'} as const; }
      catch { return {state:'denied'} as const; }
    },
    async submit(actor: ContributionActor, supplied: ContributionBinding, value: unknown): Promise<SubmissionResult> {
      if (d.enabled() !== true) return {state:'disabled'};
      // Untrusted caller objects are copied before the first await.
      let b: ContributionBinding; let artifacts;
      try { actor=structuredClone(actor); b=structuredClone(supplied); artifacts=validateArtifacts(value); } catch { return {state:'invalid-artifacts'}; }
      try {
        if (!b || typeof b.issueId!=='string') return {state:'denied'};
        const a=await authorize(actor,b.issueId);
        if (!a || !same(a.binding,b)) return {state:'denied'};
        const operationId=contributionHash(JSON.stringify(['inertia-member-candidate-v1',a.binding]));
        const digest=contributionHash(JSON.stringify(artifacts));
        const candidate:Candidate={operationId,binding:a.binding,digest,artifacts,disposition:'untrusted-candidate'};
        // INSERT may have committed before its response was lost. Always reconcile.
        try { await d.journal.put(candidate); } catch { /* Outcome may be uncertain. */ }
        const stored=await d.journal.get(operationId,b.companyId).catch(()=>null);
        if (!stored) return {state:'uncertain',operationId};
        if (!same(stored,candidate)) return {state:'conflict'};
        // Revocation during staging suppresses receipt disclosure. Stored data remains untrusted.
        const current=await authorize(actor,b.issueId);
        if (!current || !same(current.binding,b)) return {state:'denied'};
        return {state:'candidate-for-review',operationId};
      } catch { return {state:'denied'}; }
    },
  };
}
