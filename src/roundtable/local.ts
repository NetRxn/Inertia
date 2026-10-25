import type { RuntimeState } from "../bridge/runtime.js";
import type { createRuntimeOwner } from "../bridge/ownership.js";
import { createWebsitePublisher, type WebsiteBinding, type WebsiteReceipt, type WebsiteOperation, type WebsiteOutcome } from "./website.js";
import { sha256 } from "./codec.js";
interface LocalState { current: WebsiteReceipt; previous: WebsiteReceipt | null }
/** Explicit preproduction sink. Private SQL readback is NOT live website/member authorization. */
export function createLocalWebsitePublisher(config: WebsiteBinding & {
  companyId: string;
  authorize: () => Promise<boolean>;
  store: Pick<RuntimeState,"get"|"set">;
  owner: Pick<ReturnType<typeof createRuntimeOwner>,"own">;
}): {publish(operation:WebsiteOperation):Promise<WebsiteOutcome>} {
  return {async publish(operation) {
    let meetingId:string;
    try {meetingId=JSON.parse(operation.body).publication.meetingId;if(typeof meetingId!=="string"||!meetingId)throw Error();}
    catch {return {state:"blocked",code:"invalid_operation"};}
    const key="local-meeting-publication:"+sha256(meetingId);
    const outcome=await config.owner.own({companyId:config.companyId,namespaceScope:"inertia:local-meeting-publication:"+config.origin,key},async()=>{
      const fetch:typeof globalThis.fetch=async(input,init)=>{
        if(!(await config.authorize()))throw Error("Local publication admission changed");
        const url=new URL(String(input));
        const json=(value:unknown,status=200,etag?:string)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json",...(etag?{etag:'"'+etag+'"'}:{})}});
        if(url.origin!==config.origin)throw Error("Local publication destination mismatch");
        const state=await config.store.get<LocalState>(key);
        if(!(await config.authorize()))throw Error("Local publication admission changed");
        if(init?.method==="GET") {
          const id=url.pathname.split("/").at(-1);
          const receipt=[state?.current,state?.previous].find(r=>r?.operationId===id);
          if(!receipt)return json({code:"operation_absent"},404);
          return json({...receipt,current:receipt.operationId===state!.current.operationId,currentOutputHash:state!.current.outputHash},200,receipt.outputHash);
        }
        if(init?.method!=="POST" || url.pathname!=="/api/integrations/v1/roundtables/publications" || typeof init.body!=="string")return json({},400);
        const envelope=JSON.parse(init.body),p=envelope.publication;
        const headers=new Headers(init.headers);
        if(p.meetingId!==meetingId || headers.get("idempotency-key")!==p.operationId)return json({},409);
        if(state?.current.operationId===p.operationId)return json({},201);
        if(p.expectedPreviousOutputHash!==(state?.current.outputHash??null))return json({},412);
        if((state?headers.get("if-match")!=='"'+state.current.outputHash+'"':headers.get("if-none-match")!=="*"))return json({},428);
        const receipt:WebsiteReceipt={state:"present",publicationId:"local-"+p.operationId,meetingNoteId:"local-"+sha256(meetingId),operationId:p.operationId,outputHash:p.outputHash,requestBodyHash:sha256(init.body),audience:"members",current:true,currentOutputHash:p.outputHash,readbackPath:"/api/integrations/v1/roundtables/operations/"+p.operationId,envelope};
        // One durable state write binds head/CAS and exact current/previous receipts together.
        if(!(await config.authorize()))throw Error("Local publication admission changed");
        await config.store.set(key,{current:receipt,previous:state?.current??null});
        return json({},201);
      };
      return createWebsitePublisher({...config,token:"local-no-credentials",fetch}).publish(operation);
    });
    return outcome??{state:"pending",code:"local_publication_owned"};
  }};
}
