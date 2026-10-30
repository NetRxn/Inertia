/** Read-only service access to this app's organization-shared corpus. */
import {timingSafeEqual} from 'node:crypto';
import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import type {Db} from '../db/client';
import {orgSources} from '../db/schema';
import {getSource,searchPassages,type OrgSource} from './ingest';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const query=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('search'),query:z.string().trim().min(1).max(200)}).strict(),
 z.object({operation:z.literal('read'),sourceId:z.uuid(),contentHash:hash.optional(),offset:z.number().int().min(0).optional(),limit:z.number().int().min(1).max(32000).optional()}).strict().refine(v=>(v.offset??0)===0||v.contentHash!==undefined),
 z.object({operation:z.literal('find_by_hash'),contentHash:hash}).strict(),
]);
type Dependencies={db:()=>Db;readToken:()=>string|undefined};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
const identity=(s:OrgSource)=>({id:s.id,kind:s.kind,title:s.title,contentHash:s.contentHash,status:s.status});
function admitted(request:Request,configured:string|undefined){
 const token=configured?.trim(),match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')??'');
 if(!token||!match)return false;
 const given=Buffer.from(match[1]),expected=Buffer.from(token);
 return given.length===expected.length&&timingSafeEqual(given,expected);
}
async function body(request:Request):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_body');
 const parts:Uint8Array[]=[];let length=0;
 try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>4096){await reader.cancel();throw Error('body_too_large');}parts.push(item.value);}}
 finally{reader.releaseLock();}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
}
/** Authentication is deliberately independent of member cookies and ingest authority.
 * The deployed app serves one organization; neither a caller-selected company nor a
 * SQL/URL selector can widen that fixed organization-shared audience. */
export function createOrganizationKnowledgeHandler(deps:Dependencies){
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);
  if(!admitted(request,deps.readToken()))return json({error:'Not authorized.'},401);
  let parsed:z.infer<typeof query>;
  try{parsed=query.parse(await body(request));}catch(error){return json({error:error instanceof Error&&error.message==='body_too_large'?'Too large.':'Invalid read request.'},error instanceof Error&&error.message==='body_too_large'?413:400);}
  const db=deps.db(),common={version:'member-organization-read-v1',audience:'organization_shared',evidenceStatus:'unverified_source_context'};
  if(parsed.operation==='search'){
   const hits=await searchPassages(db,parsed.query,8),results=[];
   for(const hit of hits){const source=await getSource(db,hit.sourceId);if(source?.status==='active')results.push({...hit,contentHash:source.contentHash,status:source.status});}
   return json({...common,results});
  }
  if(parsed.operation==='find_by_hash'){
   const[source]=await db.select().from(orgSources).where(and(eq(orgSources.contentHash,parsed.contentHash),eq(orgSources.status,'active'))).limit(1);
   return json({...common,source:source?identity(source):null});
  }
  const source=await getSource(db,parsed.sourceId);if(!source||source.status!=='active')return json({...common,source:null});
  if(parsed.contentHash!==undefined&&parsed.contentHash!==source.contentHash)return json({error:'Source changed; reload its current identity.'},409);
  const chars=Array.from(source.content),offset=parsed.offset??0;if(offset>chars.length)return json({error:'Invalid read offset.'},400);
  const end=Math.min(offset+(parsed.limit??8000),chars.length);
  return json({...common,source:identity(source),page:{offset,end,nextOffset:end<chars.length?end:null,textLength:chars.length,text:chars.slice(offset,end).join('')}});
 };
}
