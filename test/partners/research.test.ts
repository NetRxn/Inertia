import { expect, it } from 'vitest';
import { runPartnerResearch, type AssertionCandidate, type DeltaReceipt, type ResearchSource } from '../../src/partners/research.js';
const candidate: AssertionCandidate = {assertion:{contract_version:'partner-graph-v1',subject:{entity_id:'program-made',entity_type:'Program'},predicate:'PROGRAM_OF',object:{entity_id:'org-techfw',entity_type:'Organization'},qualifiers:{}},knowledge_id:'k1',knowledge_revision:1,knowledge_hash:'a'.repeat(64)};
const receipt: DeltaReceipt={contract_version:'partner-graph-v1',run_id:'run',query_receipt_id:'query',committed:[{assertion_id:'a',revision:1}],reused:[],disputed:[],candidates:[],ignored:[],source_bindings:['b'],projection_sequence:1,projection_state:'pending',no_change_reason:null,opportunity_outcome:'rejected'};
const run={run_id:'run',idempotency_key:'delta',query:{capabilities:['manufacturing']}};
it('queries reusable evidence first and durably saves useful findings even for a rejected opportunity',async()=>{
  const order:string[]=[];
  const source:ResearchSource={begin:async()=>{order.push('query');return {query_receipt_id:'query',items:['existing partner'],evidence_gaps:['program ownership']};},commit:async input=>{order.push('commit');expect(input.candidates).toEqual([candidate]);expect(input.opportunity_outcome).toBe('rejected');expect(input.query_receipt_id).toBe('query');return receipt;}};
  const result=await runPartnerResearch(source,run,async saved=>{order.push('research');expect(saved.items).toEqual(['existing partner']);return {answer:'Not eligible for this opportunity; TechFW MADE remains useful.',candidates:[candidate],no_change_reason:null,opportunity_outcome:'rejected'};});
  expect(order).toEqual(['query','research','commit']);expect(result.knowledge_receipt).toEqual(receipt);expect(result.graph_refresh_pending).toBe(true);
});
it('does not report a successful answer when knowledge persistence fails',async()=>{
  const source:ResearchSource={begin:async()=>({query_receipt_id:'query',items:[],evidence_gaps:[]}),commit:async()=>{throw Error('PG write failed');}};
  await expect(runPartnerResearch(source,run,async()=>({answer:'result',candidates:[candidate],no_change_reason:null,opportunity_outcome:null}))).rejects.toThrow('PG write failed');
});
it('allows a useful zero delta with an explicit no-change receipt, not filler',async()=>{
  const source:ResearchSource={begin:async()=>({query_receipt_id:'query',items:[],evidence_gaps:[]}),commit:async input=>({...receipt,committed:[],projection_state:'current',no_change_reason:input.no_change_reason})};
  const result=await runPartnerResearch(source,run,async()=>({answer:'Already current.',candidates:[],no_change_reason:'All useful source-backed findings already stored.',opportunity_outcome:null}));
  expect(result.graph_refresh_pending).toBe(false);expect(result.knowledge_receipt.no_change_reason).toContain('already stored');
  await expect(runPartnerResearch(source,run,async()=>({answer:'Nothing.',candidates:[],no_change_reason:null,opportunity_outcome:null}))).rejects.toThrow(/no.change/);
});
it('rejects producer authority fields instead of forwarding them to a trusted service',async()=>{
  const source:ResearchSource={begin:async()=>({query_receipt_id:'query',items:[],evidence_gaps:[]}),commit:async()=>receipt};
  await expect(runPartnerResearch(source,run,async()=>({answer:'result',candidates:[{...candidate,verified:true}],no_change_reason:null,opportunity_outcome:null}))).rejects.toThrow(/field/);
});
it('rejects mismatched durable receipt instead of claiming the answer was saved',async()=>{
  const source:ResearchSource={begin:async()=>({query_receipt_id:'query',items:[],evidence_gaps:[]}),commit:async()=>({...receipt,run_id:'other'})};
  await expect(runPartnerResearch(source,run,async()=>({answer:'result',candidates:[candidate],no_change_reason:null,opportunity_outcome:null}))).rejects.toThrow(/receipt/);
});
it('rejects caller-selected authority in the query envelope before consulting source tools',async()=>{
  let calls=0;const source:ResearchSource={begin:async()=>{calls++;return {query_receipt_id:'query',items:[],evidence_gaps:[]};},commit:async()=>receipt};
  await expect(runPartnerResearch(source,{...run,query:{...run.query,principal_id:'admin'} as never},async()=>({answer:'result',candidates:[candidate],no_change_reason:null,opportunity_outcome:null}))).rejects.toThrow(/field/);
  expect(calls).toBe(0);
});
it('forwards explicit expected revisions for freshness corrections without producer authority',async()=>{
  let forwarded:unknown;
  const source:ResearchSource={begin:async()=>({query_receipt_id:'query',items:[{assertion_id:'a',revision:4}],evidence_gaps:[]}),commit:async input=>{forwarded=input;return receipt;}};
  await expect(runPartnerResearch(source,run,async()=>({answer:'Freshness checked.',candidates:[candidate],no_change_reason:null,opportunity_outcome:null,expected_revisions:{a:4}}))).resolves.toHaveProperty('knowledge_receipt');
  expect(forwarded).toMatchObject({expected_revisions:{a:4}});
  await expect(runPartnerResearch(source,run,async()=>({answer:'Freshness checked.',candidates:[candidate],no_change_reason:null,opportunity_outcome:null,expected_revisions:{a:-1}}))).rejects.toThrow(/revision/);
});
