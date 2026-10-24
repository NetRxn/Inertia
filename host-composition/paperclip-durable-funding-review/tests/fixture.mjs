import {randomUUID,createHash} from 'node:crypto';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import * as schema from '@paperclipai/db';
import {eq} from 'drizzle-orm';
import {requestItemVerdictsPayloadSchema} from '@paperclipai/shared';
const fixtureUrl=process.env.NATIVE_CAPTURE_DATABASE_URL;
if(!fixtureUrl || !process.env.NATIVE_CAPTURE_FIXTURE_ROOT?.split('/').at(-1)?.startsWith('native-pg-qualification.'))throw Error('Use the disposable native PostgreSQL launcher');
const parsedUrl=new URL(fixtureUrl);
if(parsedUrl.hostname!=='127.0.0.1'||!parsedUrl.port||parsedUrl.username!=='fixture'||!parsedUrl.password||parsedUrl.pathname!=='/postgres')throw Error('Invalid launcher fixture database');
export const client=postgres(fixtureUrl,{max:10,onnotice:()=>{}});
export const db=drizzle(client,{schema});
export async function fixture(count=1) {
 const companyId=randomUUID(),issueId=randomUUID(),documentId=randomUUID(),revisionId=randomUUID(),interactionId=randomUUID(), userId=randomUUID();
 await db.insert(schema.companies).values({id:companyId,name:'Synthetic funding review',issuePrefix:companyId});
 await db.insert(schema.issues).values({id:issueId,companyId,title:'Synthetic funding review',status:'in_progress'});
 await db.insert(schema.documents).values({id:documentId,companyId,latestBody:'Synthetic exact evidence',latestRevisionId:revisionId});
 await db.insert(schema.issueDocuments).values({companyId,issueId,documentId,key:'funding-review'});
 await db.insert(schema.companyMemberships).values({companyId,principalType:'user',principalId:userId,status:'active',membershipRole:'member'});
 await db.insert(schema.principalPermissionGrants).values({companyId,principalType:'user',principalId:userId,permissionKey:'funding.review.program',scope:{applicantIds:['applicant-1'],sourceScopes:['source-1']}});
 const payload=requestItemVerdictsPayloadSchema.parse({version:1,prompt:'Review the exact funding evidence',items:Array.from({length:count},(_,i)=>({id:`item-${i+1}`,label:`Proposal ${i+1}`})),verdicts:['approve','reject','defer'],target:{type:'issue_document',key:'funding-review',issueId,documentId,revisionId}});
 const [card]=await db.insert(schema.issueThreadInteractions).values({id:interactionId,companyId,issueId,kind:'request_item_verdicts',status:'pending',requestedResolverPolicy:'human_only',effectiveResolverPolicy:'human_only',resolverPolicyProvenance:'explicit',title:'Funding review',summary:null,addresseeUserId:userId,payload}).returning();
 const [issue]=await db.select().from(schema.issues).where(eq(schema.issues.id,issueId));
 return {companyId,issueId,documentId,revisionId,interactionId,userId,card,issue,actor:{userId},input:{verdicts:[{id:'item-1',verdict:'approve',reason:'Exact version reviewed'}]}};
}
export const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)??'null':Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
export const digest=c=>createHash('sha256').update(canonical({id:c.id,companyId:c.companyId,issueId:c.issueId,kind:c.kind,title:c.title,summary:c.summary,payload:c.payload,addresseeUserId:c.addresseeUserId,addresseeAgentId:c.addresseeAgentId,requestedResolverPolicy:c.requestedResolverPolicy,effectiveResolverPolicy:c.effectiveResolverPolicy})).digest('hex');
export function binding(f,itemId='item-1') {return {companyId:f.companyId,issueId:f.issueId,interactionId:f.interactionId,itemId,applicantId:'applicant-1',targetId:'target-'+itemId,targetVersion:1,kind:'proposal',reviewerUserId:f.userId,reviewerRole:'program',expectedHead:'a'.repeat(64),expectedWorkspaceHash:'b'.repeat(64),sourceScope:'source-1',allowedEvidenceIds:['evidence-1'],allowedTargets:['target-'+itemId],documentId:f.documentId,documentKey:'funding-review',documentRevisionId:f.revisionId,interactionDigest:digest(f.card)};}
