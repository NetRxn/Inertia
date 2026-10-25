import { expect,it } from "vitest";
import { registerConfiguredPublicDrafting } from "../../src/drafting/setup.js";
import manifest from "../../src/manifest.js";
import { BRIDGE_NAMESPACE } from "../../src/store/postgres.js";
const processConfig={executable:"/usr/bin/python3",args:["/opt/dfw/bridge.py","--config","/opt/dfw/config.json"],entrypoint:"/opt/dfw/bridge.py",configurationPath:"/opt/dfw/config.json",cwd:"/opt/dfw",timeoutMs:1000,maxOutputBytes:2048,pins:["/opt/dfw/bridge.py","/opt/dfw/config.json"].map(path=>({path,sha256:"a".repeat(64)}))};
const config=()=>({enabled:true,projectId:"project",applicantSlug:"dao",matchId:"match",producer:{issueId:"p",agentId:"a",principalId:"p"},reviewer:{issueId:"r",agentId:"b",principalId:"r"},process:processConfig});
function host(value:any,companies=["company"]){const tools=new Map();return {tools,ctx:{companies:{list:async()=>companies.map(id=>({id}))},config:{get:async()=>({publicDrafting:value})},tools:{register:(name:string,_:any,fn:any)=>tools.set(name,fn)},issues:{},db:{namespace:BRIDGE_NAMESPACE}} as any};}
it("is disabled by default and starts no process or native actions",async()=>{
 const f=host(undefined);await registerConfiguredPublicDrafting(f.ctx);expect(f.tools.size).toBe(6);
 await expect(f.tools.get("funding_drafting_workspace")({},{companyId:"company",agentId:"a",runId:"r",projectId:"project"})).rejects.toThrow(/disabled/);
 expect((manifest.instanceConfigSchema as any).properties.publicDrafting.properties.enabled.default).toBe(false);
 expect(manifest.capabilities).toContain("issue.subtree.read");
 expect(manifest.tools?.some(t=>t.name==="review_funding_candidate")).toBe(true);
});
it("requires exactly separated native roles, server scope and pinned admin configuration",async()=>{
 for(const modify of [(c:any)=>{c.principalId="forged";},(c:any)=>{c.reviewer.agentId=c.producer.agentId;},(c:any)=>{c.reviewer.principalId=c.producer.principalId;},(c:any)=>{c.process={...c.process,pins:[c.process.pins[0]]};},(c:any)=>{c.producer.role="admin";}]){
  const c=config();modify(c);await expect(registerConfiguredPublicDrafting(host(c).ctx)).rejects.toThrow();
 }
 await expect(registerConfiguredPublicDrafting(host(config(),["one","two"]).ctx)).rejects.toThrow(/one DFW/);
});
it("admits only an explicit boolean administrator progression opt-in",async()=>{
 for(const nativeCaseProgression of [true,false]) {
  const f=host({...config(),nativeCaseProgression});
  await registerConfiguredPublicDrafting(f.ctx); expect(f.tools.size).toBe(6);
 }
 await expect(registerConfiguredPublicDrafting(host({...config(),nativeCaseProgression:"true"}).ctx)).rejects.toThrow();
 expect((manifest.instanceConfigSchema as any).properties.publicDrafting.properties.nativeCaseProgression).toMatchObject({type:"boolean",default:false});
});
it("dependency handoff is separately default-off and requires private case progression",async()=>{
 for(const nativeDependencyHandoff of [true,false]) {
  const f=host({...config(),nativeCaseProgression:true,nativeDependencyHandoff});
  await registerConfiguredPublicDrafting(f.ctx);expect(f.tools.size).toBe(6);
 }
 for(const extra of [{nativeDependencyHandoff:"true"},{nativeDependencyHandoff:true},{nativeCaseProgression:false,nativeDependencyHandoff:true}])
  await expect(registerConfiguredPublicDrafting(host({...config(),...extra}).ctx)).rejects.toThrow();
 expect((manifest.instanceConfigSchema as any).properties.publicDrafting.properties.nativeDependencyHandoff).toMatchObject({type:"boolean",default:false});
});
it("gap review is a default-off seventh tool requiring both native protocols",async()=>{
 const schema=(manifest.instanceConfigSchema as any).properties.publicDrafting.properties;
 expect(schema.nativeGapPlanReview).toMatchObject({type:"boolean",default:false});
 for(const extra of [{nativeGapPlanReview:true},{nativeCaseProgression:true,nativeGapPlanReview:true},{nativeGapPlanReview:"true"}])
  await expect(registerConfiguredPublicDrafting(host({...config(),...extra}).ctx)).rejects.toThrow();
 const f=host({...config(),nativeCaseProgression:true,nativeDependencyHandoff:true,nativeGapPlanReview:true});
 await registerConfiguredPublicDrafting(f.ctx);expect(f.tools.size).toBe(7);expect(f.tools.has("review_funding_gap_plan")).toBe(true);
 const disabled=host({...config(),nativeGapPlanReview:false});await registerConfiguredPublicDrafting(disabled.ctx);expect(disabled.tools.size).toBe(6);
});
it("explicit false gap flag retains the legacy authorization fingerprint",async()=>{
 for(const initial of [false,undefined]) {
  const value:any={...config(),...(initial===false?{nativeGapPlanReview:false}:{})};
  const f=host(value);await registerConfiguredPublicDrafting(f.ctx);
  if(initial===false)delete value.nativeGapPlanReview;else value.nativeGapPlanReview=false;
  f.ctx.issues.get=async()=>{throw Error("authorization accepted");};
  await expect(f.tools.get("funding_review_context")({},{companyId:"company",projectId:"project",agentId:"b",runId:"run"})).rejects.toThrow("authorization accepted");
 }
});
