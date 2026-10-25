import { expect,it } from "vitest";
import { documentHash } from "../../src/discovery/service.js";
import { fixture as publicFixture } from "../drafting/fixture.js";
import { registerTrustedCentral } from "../../src/central/host.js";
function fixture(){
 const f=publicFixture();
 const b:any={enabled:true,companyId:"company",projectId:"project",applicantSlug:"dao",matchId:"match",
  agents:[{...f.binding.producer,role:"central"},{...f.binding.reviewer,role:"reviewer"}],bridge:f.bridge,authorize:f.binding.authorize};
 registerTrustedCentral(f.ctx,[b],{own:async (_:any,work:any)=>work()} as any);
 return {...f,b};
}
it("keeps central tools separate and binds exact host identity rather than tool arguments",async()=>{
 const f=fixture();
 await f.tools.get("central_funding_workspace")({},f.producer);
 expect(f.seen[0].context).toEqual({company_id:"company",project_id:"project",applicant_slug:"dao",match_id:"match",principal_id:"producer-principal",agent_id:"author",issue_id:"producer",run_id:"run-author"});
 for(const args of [{company_id:"x"},{principal_id:"x"},{record:{audiences:["restricted"]}}])await expect(f.tools.get("central_funding_workspace")(args,f.producer)).rejects.toThrow();
 await expect(f.tools.get("central_funding_workspace")({},f.reviewer)).rejects.toThrow();
});
it("denies unconfigured agents and freshly checks reassignment/revocation/run ownership",async()=>{
 for(const modify of [(f:any)=>({...f.producer,agentId:"member"}),(f:any)=>({...f.producer,companyId:"else"}),(f:any)=>({...f.producer,projectId:"else"}),(f:any)=>({...f.producer,runId:"stale"}),(f:any)=>{f.revoke();return f.producer;},(f:any)=>{f.rows.producer.assigneeAgentId="other";return f.producer;}]){
  const f=fixture();await expect(f.tools.get("central_funding_workspace")({},modify(f))).rejects.toThrow();expect(f.seen).toHaveLength(0);
 }
 const f=fixture();f.bridge.call=async(_:any,__:any,c:any)=>{await c.context();f.rows.producer.assigneeAgentId="other";return c.context();};
 await expect(f.tools.get("central_funding_workspace")({},f.producer)).rejects.toThrow();
});
it("dispatches only review references, never private data in a native document",async()=>{
 const f=fixture(),request={request_id:"b".repeat(64),company_id:"company",project_id:"project",applicant_slug:"dao",match_id:"match",record_id:"record",record_revision:1,evidence_hash:"c".repeat(64),producer_principal_id:"producer-principal",reviewer_principal_id:"reviewer-principal",policy_id:"source-v1"};
 f.bridge.call=async(_:any,__:any,c:any)=>c.review(request);
 await f.tools.get("central_funding_knowledge")({operation:"admit",parameters:{record_id:"record",expected_revision:1,policy_id:"source-v1"}},f.producer);
 expect(f.docs.size).toBe(1);expect(f.wakeups.size).toBe(1);
 const body=[...f.docs.values()][0].body;
 expect(body).toContain(request.request_id);expect(body).not.toContain("source-v1");
 f.bridge.call=async(_:any,__:any,c:any)=>c.review({...request,value:"PRIVATE-FINANCIAL"});
 await expect(f.tools.get("central_funding_knowledge")({operation:"admit",parameters:{record_id:"record",expected_revision:1,policy_id:"source-v1"}},f.producer)).rejects.toThrow();
 expect([...f.docs.values()][0].body).not.toContain("PRIVATE");
});
it("only independent reviewer completion wakes configured producer, never auto-accepts",async()=>{
 const f=fixture(),request_id="d".repeat(64);
 f.bridge.call=async(_:any,__:any,c:any)=>{await c.context();return {state:"supported",request_id,producer_principal_id:"producer-principal"};};
 const args={operation:"review",parameters:{request_id}};
 await expect(f.tools.get("central_funding_knowledge")(args,f.producer)).rejects.toThrow();
 await f.tools.get("central_funding_knowledge")(args,f.reviewer);
 expect([...f.wakeups.values()][0].id).toBe("producer");
 expect([...f.wakeups.values()][0].reason).not.toContain("accepted");
});
it("never copies producer-chosen knowledge record identifiers into native documents",async()=>{
 const f=fixture(),request={request_id:"e".repeat(64),company_id:"company",project_id:"project",applicant_slug:"dao",match_id:"match",record_id:"PRIVATE-SOURCE-QUOTE-AS-IDENTIFIER",record_revision:1,evidence_hash:"c".repeat(64),producer_principal_id:"producer-principal",reviewer_principal_id:"reviewer-principal",policy_id:"source-v1"};
 f.bridge.call=async(_:any,__:any,c:any)=>c.review(request);
 await f.tools.get("central_funding_knowledge")({operation:"admit",parameters:{record_id:request.record_id,expected_revision:1,policy_id:"source-v1"}},f.producer);
 expect([...f.docs.values()][0].body).not.toContain("PRIVATE");
 expect([...f.docs.values()][0].body).not.toContain("record_id");
});

for(const change of ["revoke","reassign"] as const)for(const phase of ["list","get","reviewer-check"] as const)it(`does not write a native review reference after ${change} during ${phase}`,async()=>{
 const f=fixture(),request={request_id:"f".repeat(64),company_id:"company",project_id:"project",applicant_slug:"dao",match_id:"match",record_id:"record",record_revision:1,evidence_hash:"c".repeat(64),producer_principal_id:"producer-principal",reviewer_principal_id:"reviewer-principal",policy_id:"source-v1"};
 const mutate=()=>{if(change==="revoke")f.revoke();else f.rows.reviewer.assigneeAgentId="replacement";};
 let lists=0,reviewerChecks=0;
 const originalGet=f.ctx.issues.get;
 f.ctx.issues.get=async(id:string)=>{const row=await originalGet(id);if(id==="reviewer"&&++reviewerChecks===2&&phase==="reviewer-check")mutate();return row;};
 f.ctx.issues.documents.list=async()=>{lists++;if(lists===2){if(phase==="list")mutate();if(phase==="get")return [{key:"funding-"+documentHash("central-knowledge-review:"+request.request_id)+"-0000000001"}];}return [];};
 f.ctx.issues.documents.get=async()=>{if(phase==="get")mutate();return {body:"different prior snapshot"};};
 f.bridge.call=async(_:any,__:any,c:any)=>c.review(request);
 await expect(f.tools.get("central_funding_knowledge")({operation:"admit",parameters:{record_id:"record",expected_revision:1,policy_id:"source-v1"}},f.producer)).rejects.toThrow();
 expect(f.docs.size).toBe(0);expect(f.wakeups.size).toBe(0);
});
for(const change of ["revoke","reassign"] as const)it(`does not return private child output after ${change} following its final context callback`,async()=>{
 const f=fixture();f.bridge.call=async(_:any,__:any,c:any)=>{await c.context();if(change==="revoke")f.revoke();else f.rows.producer.assigneeAgentId="replacement";return {private_value:"restricted fixture result"};};
 await expect(f.tools.get("central_funding_workspace")({},f.producer)).rejects.toThrow();
});
