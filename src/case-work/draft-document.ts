import {createHash} from 'node:crypto';
import type {PluginContext} from '@paperclipai/plugin-sdk';
import {readNativeDocument,writeNativeDocument} from '../discovery/documents.js';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const sha=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
export const EDITORIAL_DRAFT_LOGICAL_KEY='case-editorial-draft-v1';
const deny=():never=>{throw Error('Exact preliminary draft document unavailable');};
/** Publish only real current render bytes; this is editorial evidence, never packet admission. */
export async function publishEditorialDraft(
 api:PluginContext['issues']['documents'],
 value:Record<string,unknown>,
 scope:{companyId:string;issueId:string;caseBindingId:string},
 current:()=>Promise<unknown>,
){
 if(value.state!=='preliminary_rendered'||value.case_binding_id!==scope.caseBindingId||value.business_complete!==false||value.readiness_admitted!==false||Object.hasOwn(value,'native_draft_document')||typeof value.draft_markdown!=='string'||!value.draft_markdown.trim()||!Array.isArray(value.artifacts))return deny();
 const body=value.draft_markdown,bytes=Buffer.from(body,'utf8');
 if(bytes.length>524288||bytes.toString('utf8')!==body)return deny();
 const candidates=value.artifacts.filter(v=>object(v)&&(v.key==='preliminary_markdown'||v.type==='preliminary_markdown'));
 const artifact=candidates[0];
 if(candidates.length!==1||!object(artifact)||artifact.key!=='preliminary_markdown'||artifact.type!=='preliminary_markdown'||artifact.readiness_admitted!==false||artifact.hash!==sha(bytes)||artifact.size_bytes!==bytes.length||typeof artifact.base64!=='string'||artifact.base64.length!==4*Math.ceil(bytes.length/3)||Buffer.from(artifact.base64,'base64').toString('base64')!==artifact.base64||!Buffer.from(artifact.base64,'base64').equals(bytes))return deny();
 await current();
 // Reuse the existing case owner lock and numbered immutable native snapshots.
 // The SDK cannot CAS-update an existing document; no parallel pointer is created.
 const checked:typeof api={
  ...api,
  list:async(...args)=>{await current();const result=await api.list(...args);await current();return result;},
  get:async(...args)=>{await current();const result=await api.get(...args);await current();return result;},
  upsert:async(...args)=>{await current();const result=await api.upsert(...args);await current();return result;},
 };
 await writeNativeDocument(checked,{companyId:scope.companyId,issueId:scope.issueId,key:EDITORIAL_DRAFT_LOGICAL_KEY,title:'Unreviewed application draft — editorial snapshot',format:'markdown',body});
 const doc=await readNativeDocument(checked,scope.issueId,EDITORIAL_DRAFT_LOGICAL_KEY,scope.companyId);
 if(!doc||doc.companyId!==scope.companyId||doc.issueId!==scope.issueId||doc.body!==body||doc.format!=='markdown'||!uuid(doc.id)||!uuid(doc.latestRevisionId)||!Number.isSafeInteger(doc.latestRevisionNumber)||doc.latestRevisionNumber<1)return deny();
 await current();
 return {contract_version:'inertia-editorial-draft-v1' as const,document_id:doc.id,key:doc.key,revision_id:doc.latestRevisionId,revision_number:doc.latestRevisionNumber,body_sha256:sha(bytes),body_bytes:bytes.length,case_binding_id:scope.caseBindingId,producer_issue_id:scope.issueId};
}
