import {afterEach,expect,it} from "vitest";
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
const dirs:string[]=[];
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
const context={company_id:"company",user_id:"member"};
const page={schema:"inertia.member-funding-opportunities.v1",opportunities:[],nextCursor:null};
const setup=`const rl=require('readline').createInterface({input:process.stdin});let n=0;rl.on('line',line=>{const q=JSON.parse(line);n++;`;
async function fixture(script:string,changes:Record<string,unknown>={}) {
 const cwd=mkdtempSync(join(tmpdir(),"member-funding-stdio-"));dirs.push(cwd);
 const entrypoint=join(cwd,"read.cjs"),configurationPath=join(cwd,"config.json");
 writeFileSync(entrypoint,script);writeFileSync(configurationPath,"{}");
 const config={executable:process.execPath,args:[entrypoint,"--config",configurationPath],entrypoint,configurationPath,cwd,timeoutMs:500,maxOutputBytes:4096,pins:[entrypoint,configurationPath].map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")})),...changes};
 const mod=await import("../../src/member-funding/stdio.js").catch(()=>null);expect(mod,"member read bridge exists").not.toBeNull();
 return mod!.createMemberFundingReadBridge(config);
}
it("uses the existing bounded context protocol for one read operation with native user identity",async()=>{
 const bridge=await fixture(setup+`if(n===1){if(q.version!=='dfw-member-funding-read-v1'||q.op!=='opportunities'||q.params.limit!==5)process.exit(9);console.log(JSON.stringify({type:'context',id:1}));}else{if(q.context.user_id!=='member'||q.context.company_id!=='company')process.exit(9);console.log(JSON.stringify({type:'result',ok:true,result:${JSON.stringify(page)}}));rl.close();}});`);
 expect(await bridge.readOpportunities({limit:5,cursor:null},{context:async()=>context})).toEqual(page);
});
it("does not offer review, write or agent impersonation callbacks",async()=>{
 const bridge=await fixture(setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));else console.log(JSON.stringify({type:'review',id:2,request:{request_id:'fake'}}));});`);
 await expect(bridge.readOpportunities({limit:5,cursor:null},{context:async()=>context})).rejects.toThrow();
 const forged=await fixture(setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));});`);
 await expect(forged.readOpportunities({limit:5,cursor:null},{context:async()=>({...context,role:"producer"})})).rejects.toThrow();
});
it("denies oversized time budgets, private response extras and actor changes",async()=>{
 await expect(fixture("",{timeoutMs:5001})).rejects.toThrow();
 const invalid=await fixture(setup+`if(n===1)console.log(JSON.stringify({type:'context',id:1}));else {console.log(JSON.stringify({type:'result',ok:true,result:{...${JSON.stringify(page)},privateArtifacts:[]}}));rl.close();}});`);
 await expect(invalid.readOpportunities({limit:5,cursor:null},{context:async()=>context})).rejects.toThrow();
 let calls=0;
 const changed=await fixture(setup+`if(n<=2)console.log(JSON.stringify({type:'context',id:n}));});`);
 await expect(changed.readOpportunities({limit:5,cursor:null},{context:async()=>({...context,user_id:++calls===1?"member":"other"})})).rejects.toThrow();
});
