import { describe, expect, it } from 'vitest';
import { createNativeFundingReviewAdapter, nativeReviewDigest, type FundingReviewBinding, type FundingReviewCommand, type FundingReviewPort } from '../../src/grants/native-review.js';
import type { NativeInteraction } from '../../src/paperclip/adapter.js';

// The native and funding ports are deliberately host-only, not model tools.
function fixture(kind: 'proposal' | 'packet_role' = 'proposal') {
  const card = {
    id: 'interaction', companyId: 'company', issueId: 'issue', kind: 'request_item_verdicts',
    status: 'pending', requestedResolverPolicy: 'human_only', effectiveResolverPolicy: 'human_only', resolverPolicy: 'human_only',
    addresseeUserId: 'human', continuationPolicy: 'none', resolverPolicyProvenance:'explicit', effectiveResolverPolicySource:'requested', legacyResolverPolicyAliases:{requested:null,effective:null}, createdAt: '2026-10-23T10:00:00Z', updatedAt: '2026-10-23T10:01:00Z',
    payload: {version: 1, prompt: 'Review exact proposal', items: [{id: 'item', label: 'Proposal'}], target: {type: 'issue_document', key: 'draft', documentId: 'doc', issueId: 'issue', revisionId: 'rev'}},
    result: {version: 1, outcome: 'resolved', complete: false, items: [{id: 'item', verdict: 'approve', resolvedByUserId: 'human', resolvedAt: '2026-10-23T10:01:00Z'}]},
  } as NativeInteraction;
  const document = {id:'doc',companyId:'company',issueId:'issue',key:'draft',latestRevisionId:'rev'};
  const binding: FundingReviewBinding = {companyId:'company', issueId:'issue', interactionId:'interaction', itemId:'item',
    applicantId:'applicant', targetId:'proposal', targetVersion:1, expectedHead:'head', expectedWorkspaceHash:'workspace',
    allowedEvidenceIds:['evidence'], allowedTargets:['draft_answer:answer'], sourceScope:'scope', reviewerUserId:'human',
    reviewerRole:'program', kind, documentId:'doc',documentKey:'draft',documentRevisionId:'rev', interactionDigest:nativeReviewDigest(card)};
  const receipts = new Map<string, FundingReviewCommand>();
  let head = 'head'; let writes = 0; let authorized = true;
  let loseResponse = false; let failBeforeCommit = false; let unknownRead = false;
  const port: FundingReviewPort = {
    async authorize(b, actor) { return authorized && actor === b.reviewerUserId; },
    async readOutcome(key) { if(unknownRead) return {state:'unknown'}; const c = receipts.get(key); return c ? {state:'applied', command:c} : {state:'not_applied'}; },
    async applyGuarded(command) {
      if(failBeforeCommit) throw Error('transport');
      const previous=receipts.get(command.decisionKey);
      if(previous) return {state:'applied', command:previous};
      if(!authorized || head!==command.binding.expectedHead) return {state:'rejected',reason:'Domain head or authorization changed'};
      // Test-port equivalent of a funding transaction: CAS and existing audit append together.
      writes++; receipts.set(command.decisionKey, structuredClone(command));
      if(loseResponse) throw Error('response lost after commit');
      return {state:'applied',command};
    },
  };
  const native = {listInteractions: async () => [card], documents: {get: async () => document}};
  const adapter = createNativeFundingReviewAdapter(native as never, port, [binding], {withFence:async (_binding, effect)=>effect()});
  return {card,document,binding,port,adapter,receipts,get writes(){return writes;},set head(v:string){head=v;},set authorized(v:boolean){authorized=v;},set loseResponse(v:boolean){loseResponse=v;},set failBeforeCommit(v:boolean){failBeforeCommit=v;},set unknownRead(v:boolean){unknownRead=v;}};
}

describe('native human funding decisions',()=>{
  it('accepts the actual native terminal answered state',async()=>{
    const f=fixture(); f.card.status='answered';
    if(f.card.kind==='request_item_verdicts') f.card.result!.complete=true;
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('applied');
  });
  it('uses the partial item actor, not the card resolver, and maps approval',async()=>{
    const f=fixture(); f.card.resolvedByUserId='unrelated';
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('applied');
    expect([...f.receipts.values()][0]).toMatchObject({actorUserId:'human',action:'accepted',binding:{applicantId:'applicant',targetVersion:1}});
  });
  it.each([['reject','rejected'],['defer','deferred']] as const)('maps proposal %s without inventing authority',async(verdict,expected)=>{
    const f=fixture(); if(f.card.kind==='request_item_verdicts') f.card.result!.items[0]!.verdict=verdict;
    const r=await f.adapter.reconcile('interaction','item');
    if(expected==='deferred') {expect(r.state).toBe('deferred'); expect(f.writes).toBe(0);}
    else expect([...f.receipts.values()][0]?.action).toBe(expected);
  });
  it.each([['approve','approved'],['reject','changes_requested']] as const)('maps packet role %s',async(verdict,action)=>{
    const f=fixture('packet_role'); if(f.card.kind==='request_item_verdicts') f.card.result!.items[0]!.verdict=verdict;
    await f.adapter.reconcile('interaction','item'); expect([...f.receipts.values()][0]?.action).toBe(action);
  });
  it.each(['company','issue','actor','agent','policy','effective_policy','addressee','target','revision','payload','title','cancelled','duplicate_item','unknown_item','authorization','head'] as const)('fails closed for %s',async attack=>{
    const f=fixture(); const c=f.card; if(c.kind!=='request_item_verdicts') throw Error();
    if(attack==='company') c.companyId='elsewhere';
    if(attack==='issue') c.issueId='elsewhere';
    if(attack==='actor') c.result!.items[0]!.resolvedByUserId='attacker';
    if(attack==='agent') c.result!.items[0]!.resolvedByAgentId='agent';
    if(attack==='policy') c.requestedResolverPolicy='anyone';
    if(attack==='effective_policy') c.effectiveResolverPolicy='anyone';
    if(attack==='addressee') c.addresseeUserId='elsewhere';
    if(attack==='target') c.payload.target!.revisionId='elsewhere';
    if(attack==='revision') f.document.latestRevisionId='new';
    if(attack==='payload') c.payload.items[0]!.label='changed';
    if(attack==='title') c.title='Different human-visible request';
    if(attack==='cancelled') c.result!.outcome='cancelled';
    if(attack==='duplicate_item') c.result!.items.push({...c.result!.items[0]!});
    if(attack==='unknown_item') c.result!.items[0]!.id='unknown';
    if(attack==='authorization') f.authorized=false;
    if(attack==='head') f.head='new';
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('blocked'); expect(f.writes).toBe(0);
  });
  it('deduplicates concurrent delivery by native interaction plus item',async()=>{
    const f=fixture(); const results=await Promise.all([f.adapter.reconcile('interaction','item'),f.adapter.reconcile('interaction','item')]);
    expect(results.map(r=>r.state)).toEqual(['applied','applied']); expect(f.writes).toBe(1);
  });
  it('reconciles a lost response using domain audit readback',async()=>{
    const f=fixture(); f.loseResponse=true;
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('applied'); expect(f.writes).toBe(1);
  });
  it('does not retry an uncertain write and holds an unknown read',async()=>{
    const f=fixture(); f.failBeforeCommit=true;
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('retryable'); expect(f.writes).toBe(0);
    f.failBeforeCommit=false; f.unknownRead=true;
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('reconciliation_required'); expect(f.writes).toBe(0);
    f.unknownRead=false; expect((await f.adapter.reconcile('interaction','item')).state).toBe('applied');
  });
  it('rejects a changed decision against an existing audit outcome',async()=>{
    const f=fixture(); await f.adapter.reconcile('interaction','item');
    if(f.card.kind==='request_item_verdicts') f.card.result!.items[0]!.verdict='reject';
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('blocked'); expect(f.writes).toBe(1);
  });
  it('does not accept model-provided bindings or unknown items',async()=>{
    const f=fixture(); expect((await f.adapter.reconcile('forged','item')).state).toBe('blocked'); expect(f.writes).toBe(0);
  });
  it('preserves source scope and the exact evidence allowlist in the guarded command',async()=>{
    const f=fixture(); await f.adapter.reconcile('interaction','item');
    expect([...f.receipts.values()][0]?.binding).toMatchObject({sourceScope:'scope',allowedEvidenceIds:['evidence'],allowedTargets:['draft_answer:answer'],expectedWorkspaceHash:'workspace',expectedHead:'head'});
  });
  it('does not trust later mutation of host registration objects',async()=>{
    const f=fixture(); f.binding.applicantId='attacker';
    await f.adapter.reconcile('interaction','item'); expect([...f.receipts.values()][0]?.binding.applicantId).toBe('applicant');
  });
  it('reauthorizes inside the guarded domain transaction after preflight',async()=>{
    const f=fixture(); const read=f.port.readOutcome;
    f.port.readOutcome=async key=>{const r=await read(key);f.authorized=false;return r;};
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('blocked'); expect(f.writes).toBe(0);
  });
  it('compares the domain head inside apply rather than relying on preflight',async()=>{
    const f=fixture(); const read=f.port.readOutcome;
    f.port.readOutcome=async key=>{const r=await read(key);f.head='new';return r;};
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('blocked'); expect(f.writes).toBe(0);
  });
  it('keeps two partial items distinct even on the same native interaction',async()=>{
    const f=fixture(); if(f.card.kind!=='request_item_verdicts') throw Error();
    f.card.payload.items.push({id:'second',label:'Second'});
    f.card.result!.items.push({...f.card.result!.items[0]!,id:'second'});
    f.binding.interactionDigest=nativeReviewDigest(f.card);
    const second={...f.binding,itemId:'second',targetId:'proposal-2'};
    const native={listInteractions:async()=>[f.card],documents:{get:async()=>f.document}};
    const a=createNativeFundingReviewAdapter(native as never,f.port,[f.binding,second],{withFence:async (_binding,effect)=>effect()});
    await a.reconcile('interaction','item');await a.reconcile('interaction','second');
    expect(f.writes).toBe(2);expect(f.receipts.size).toBe(2);
  });
  it('fails closed on an ambiguous registration',()=>{
    const f=fixture();expect(()=>createNativeFundingReviewAdapter({} as never,f.port,[f.binding,f.binding])).toThrow();
  });
  it('does not retry when a lost write response cannot be reconciled',async()=>{
    const f=fixture();const apply=f.port.applyGuarded;
    f.port.applyGuarded=async c=>{await apply(c);f.unknownRead=true;throw Error('lost');};
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('reconciliation_required');expect(f.writes).toBe(1);
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('reconciliation_required');expect(f.writes).toBe(1);
    f.unknownRead=false;expect((await f.adapter.reconcile('interaction','item')).state).toBe('applied');expect(f.writes).toBe(1);
  });

  it('holds uncertain defer and detects defer conflicting with a persisted decision',async()=>{
    const f=fixture();await f.adapter.reconcile('interaction','item');
    if(f.card.kind==='request_item_verdicts')f.card.result!.items[0]!.verdict='defer';
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('blocked');
    const g=fixture();if(g.card.kind==='request_item_verdicts')g.card.result!.items[0]!.verdict='defer';g.unknownRead=true;
    expect((await g.adapter.reconcile('interaction','item')).state).toBe('reconciliation_required');expect(g.writes).toBe(0);
  });
  it('cannot apply without an explicitly composed native source fence',async()=>{
    const f=fixture();const a=createNativeFundingReviewAdapter({} as never,f.port,[f.binding]);
    expect((await a.reconcile('interaction','item')).state).toBe('blocked');expect(f.writes).toBe(0);
  });
  it('holds a rejected native source fence without calling the funding effect',async()=>{
    const f=fixture();const a=createNativeFundingReviewAdapter({} as never,f.port,[f.binding],{withFence:async()=>{throw Error('native head changed');}});
    expect((await a.reconcile('interaction','item')).state).toBe('blocked');expect(f.writes).toBe(0);
  });

  it('holds a fence-release failure after commit for reconciliation instead of claiming blocked',async()=>{
    const f=fixture();const native={listInteractions:async()=>[f.card],documents:{get:async()=>f.document}};
    const a=createNativeFundingReviewAdapter(native as never,f.port,[f.binding],{withFence:async(_binding,effect)=>{await effect();throw Error('release response lost');}});
    expect((await a.reconcile('interaction','item')).state).toBe('reconciliation_required');expect(f.writes).toBe(1);
    expect((await f.adapter.reconcile('interaction','item')).state).toBe('applied');expect(f.writes).toBe(1);
  });

});
