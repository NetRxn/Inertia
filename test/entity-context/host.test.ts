import {describe,it,expect} from "vitest";
import {registerEntityContext,type EntityBinding} from "../../src/entity-context/host.js";
import {discoveryHash} from "../../src/discovery/service.js";
function fixture(review=false){
 const tools=new Map<string,any>(),calls:any[]=[];
 const grant={agentId:"alpha",principalId:"p-alpha",projectIds:["P"],canRefresh:true};
 const issue:any={id:"task",companyId:"company",projectId:"P",status:review?"in_review":"in_progress",assigneeAgentId:review?"beta":"alpha",executionRunId:"run"};
 let allowed=true;let duringCall:(()=>void)|undefined;
 const card:any={id:"card",companyId:"company",issueId:"task",kind:"request_confirmation",status:"pending",sourceRunId:"producer-run",addresseeAgentId:"alpha",addresseeUserId:null,payload:{target:{type:"custom",key:"native_completion_review",revisionId:"decision"}}};
 const metadata={version:1,companyId:"company",projectId:"P",issueId:"task",agentId:"alpha",runId:"run",principalId:"p-alpha",role:review?"reviewer":"researcher",canRefresh:!review,bindingHash:"fingerprint",review:review?{interactionId:"card",decisionId:"decision",producerRunId:"producer-run",producerAgentId:"beta"}:null};
 const ctx:any={tools:{register:(name:string,_def:any,fn:any)=>tools.set(name,fn)},agents:{get:async()=>({id:"alpha",companyId:"company",status:"running",role:"general"})},issues:{get:async()=>issue,getSubtree:async()=>({companyId:"company",rootIssueId:"task",issues:[issue],activeRuns:{task:[{id:"run",issueId:"task",agentId:"alpha",status:"running",finishedAt:null}]}}),listInteractions:async()=>[card]}};
 const b:EntityBinding={companyId:"company",applicantSlug:"dao",actorGrants:[grant],fingerprint:"fingerprint",authorize:async()=>allowed,bridge:{call:async(op,params,callbacks)=>{const current=await callbacks.context();calls.push({op,params,current});duringCall?.();return{public_only:true};}}};
 registerEntityContext(ctx,[b]);
 const invoke=(operation:string,parameters:any)=>tools.get("entity_context")({operation,parameters},{companyId:"company",projectId:"P",agentId:"alpha",runId:"run",entityExecution:metadata});
 return{invoke,calls,issue,card,metadata,revoke:()=>allowed=false,during:(f:()=>void)=>duringCall=f};
}
describe("generic entity native reader",()=>{
 it("owned admitted task reads and refreshes protected sources without a case binding",async()=>{const f=fixture();await f.invoke("context",{});await f.invoke("search",{query:"current public mission"});await f.invoke("refresh",{request_id:"refresh-1",source_ids:["canonical"]});expect(f.calls.map(c=>c.op)).toEqual(["context","search","refresh"]);expect(f.calls.every(c=>c.current.principal_id==="p-alpha")).toBe(true);});
 it("addressed reviewer reads exact current card but cannot refresh",async()=>{const f=fixture(true);await f.invoke("context",{});expect(f.calls[0].current.role).toBe("reviewer");await expect(f.invoke("refresh",{request_id:"x",source_ids:["canonical"]})).rejects.toThrow();f.card.payload.target.revisionId="replaced";await expect(f.invoke("context",{})).rejects.toThrow();expect(f.calls.length).toBe(1);});
 it("configuration revocation, hidden task and forged metadata fail closed",async()=>{for(const change of[(f:any)=>f.revoke(),(f:any)=>f.issue.hiddenAt=new Date(),(f:any)=>f.metadata.runId="other"]){const f=fixture();change(f);await expect(f.invoke("context",{})).rejects.toThrow();expect(f.calls.length).toBe(0);}});
 it("rejects model URL/audience/root arguments and malformed pagination",async()=>{const f=fixture();for(const p of[{url:"https://model.example"},{audience:"restricted"},{root_issue_id:"other"},{offset:-1}])await expect(f.invoke("context",p)).rejects.toThrow();expect(f.calls.length).toBe(0);});
});

it("does not return cached-looking context after mid-operation task/config/review revocation",async()=>{for(const review of[false,true]){const f=fixture(review);f.during(()=>review?f.card.payload.target.revisionId="new":f.revoke());await expect(f.invoke("context",{})).rejects.toThrow();expect(f.calls.length).toBe(1);}});

it("metadata exact equality tolerates transport object key ordering",async()=>{const f=fixture();const entries=Object.entries(f.metadata).reverse();for(const k of Object.keys(f.metadata))delete(f.metadata as any)[k];Object.assign(f.metadata,Object.fromEntries(entries));await f.invoke("context",{});expect(f.calls).toHaveLength(1);});
