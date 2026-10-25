import {expect,it} from "vitest";
import {createLocalWebsitePublisher} from "../../src/roundtable/local.js";
import {prepare} from "../../src/roundtable/ingestion.js";
import {prepareWebsiteOperation} from "../../src/roundtable/website.js";
const source={meetingId:"meeting",sourceId:"drive:owner-file",revision:"1",ready:true,kind:"transcript" as const,audience:"members",text:"Decision: Defer until testing completes."};
const binding={origin:"https://local.example",principalId:"local-principal"};
const metadata={title:"Owner-provided meeting",date:"2026-10-25",attendees:null,agenda:null,tags:[]};
const transformer=async({transcript}:{transcript:string})=>({notes:[],decisions:[{text:transcript,line:1}],actions:[]});
async function operation(revision="1",previous?:any) { const p=await prepare({...source,revision,text:revision==="1"?source.text:"Decision: Resume the limited pilot."},transformer,previous?JSON.parse(previous.body).publication.outputHash:null);return prepareWebsiteOperation(p,metadata,binding,previous); }
it("round-trips exact existing publisher contract through private durable local receipts, never network",async()=>{
  const rows=new Map<string,any>();const store={get:async<T>(k:string)=>structuredClone(rows.get(k)??null) as T|null,set:async(k:string,v:any)=>{rows.set(k,structuredClone(v));}};
  const owner:any={own:async(_:any,f:any)=>f()};
  const publisher=createLocalWebsitePublisher({...binding,companyId:"company",authorize:async()=>true,store,owner});
  const first=await operation(),result=await publisher.publish(first);
  expect(result).toMatchObject({state:"published",receipt:{requestBodyHash:first.bodyHash,audience:"members",current:true,envelope:{publication:{transcript:source.text}}}});
  const restarted=createLocalWebsitePublisher({...binding,companyId:"company",authorize:async()=>true,store,owner});
  expect(await restarted.publish(first)).toMatchObject({state:"already-published"});
  const corrected=await operation("2",first);
  expect(await restarted.publish(corrected)).toMatchObject({state:"published",receipt:{current:true,envelope:{publication:{revision:"2"}}}});
  expect(await restarted.publish(first)).toMatchObject({state:"already-published",receipt:{current:false,currentOutputHash:JSON.parse(corrected.body).publication.outputHash}});
});
it("does not allow a correction to bypass CAS, binding checks, or ownership",async()=>{
  const rows=new Map<string,any>();const store={get:async<T>(k:string)=>rows.get(k) as T??null,set:async(k:string,v:any)=>{rows.set(k,v);}};
  const owner:any={own:async(_:any,f:any)=>f()};
  const publisher=createLocalWebsitePublisher({...binding,companyId:"company",authorize:async()=>true,store,owner});
  const first=await operation();await publisher.publish(first);
  expect(await publisher.publish(await operation("2"))).toMatchObject({state:"conflict"});
  expect(await publisher.publish({...first,principalId:"other"})).toMatchObject({state:"blocked"});
  const busy=createLocalWebsitePublisher({...binding,companyId:"company",authorize:async()=>true,store,owner:{own:async()=>null}});
  expect(await busy.publish(first)).toMatchObject({state:"pending",code:"local_publication_owned"});
});
