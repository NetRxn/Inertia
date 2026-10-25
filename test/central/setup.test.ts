import {expect,it} from "vitest";
import {registerConfiguredTrustedCentral,centralConfigSchema} from "../../src/central/setup.js";
import {BRIDGE_NAMESPACE} from "../../src/store/postgres.js";
const processConfig={executable:"/usr/bin/python3",args:["/opt/dfw/bridge.py","--config","/opt/dfw/config.json"],entrypoint:"/opt/dfw/bridge.py",configurationPath:"/opt/dfw/config.json",cwd:"/opt/dfw",timeoutMs:1000,maxOutputBytes:2048,pins:["/opt/dfw/bridge.py","/opt/dfw/config.json"].map(path=>({path,sha256:"a".repeat(64)}))};
const config=()=>({enabled:true,projectId:"project",applicantSlug:"dao",matchId:"match",agents:[{issueId:"p",agentId:"a",principalId:"p",role:"central"},{issueId:"r",agentId:"b",principalId:"r",role:"reviewer"}],process:processConfig});
function host(value:any,companies=["company"]){const tools=new Map();return {tools,ctx:{companies:{list:async()=>companies.map(id=>({id}))},config:{get:async()=>({trustedCentral:value})},tools:{register:(name:string,_:any,fn:any)=>tools.set(name,fn)},issues:{},db:{namespace:BRIDGE_NAMESPACE}} as any};}
it("central configuration defaults disabled without starting a process or granting a member tool",async()=>{
 const f=host(undefined);await registerConfiguredTrustedCentral(f.ctx);expect(f.tools.size).toBe(5);
 expect((centralConfigSchema as any).properties.enabled.default).toBe(false);
 await expect(f.tools.get("central_funding_workspace")({},{companyId:"company",agentId:"member",runId:"run",projectId:"project"})).rejects.toThrow(/disabled/);
});
it("requires independent unique mappings and rejects scope in unexpected config fields",async()=>{
 for(const mutate of [(c:any)=>{c.agents[1].principalId=c.agents[0].principalId;},(c:any)=>{c.agents[1].agentId=c.agents[0].agentId;},(c:any)=>{c.audiences=["restricted"];},(c:any)=>{c.agents[0].role="admin";},(c:any)=>{c.process.pins=[];}]){
  const c=structuredClone(config());mutate(c);await expect(registerConfiguredTrustedCentral(host(c).ctx)).rejects.toThrow();
 }
});
