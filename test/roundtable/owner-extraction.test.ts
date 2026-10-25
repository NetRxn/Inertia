import {afterEach,expect,it} from "vitest";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PGlite} from "@electric-sql/pglite";
import {createTestHarness} from "@paperclipai/plugin-sdk/testing";
import {manifest} from "../../src/manifest.js";
import {registerRoundtableJobs} from "../../src/roundtable/host.js";
import {meetingExtractionTools} from "../../src/roundtable/extraction.js";
import {BRIDGE_NAMESPACE} from "../../src/store/postgres.js";
import {createHash} from "node:crypto";
const cleanup:Array<()=>Promise<unknown>>=[];afterEach(async()=>{for(const clean of cleanup.splice(0))await clean();});
const source={meetingId:"meeting",sourceId:"drive:doc",revision:"1",ready:true,kind:"transcript",audience:"members",text:"We discussed timing without reaching agreement.\nWe decided to defer the launch until testing is complete.\nPlease investigate the missing accessibility tests."};
async function fixture(){
 const directory=await mkdtemp(join(tmpdir(),"inertia-owner-meeting-"));cleanup.push(()=>rm(directory,{recursive:true,force:true}));
 const ownerFile=join(directory,"source.json");await writeFile(ownerFile,JSON.stringify(source),{mode:0o600});
 const pg=new PGlite();cleanup.push(()=>pg.close());await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);await pg.exec(await readFile(new URL("../../migrations/004_runtime_state.sql",import.meta.url),"utf8"));
 const config:any={roundtable:{enabled:true,admission:"admission-1",origin:"https://local.example",principalId:"owner",publicationMode:"local",meetings:[{meetingId:"meeting",folderId:"folder",fileId:"doc",artifact:"meet-transcript",transcriptName:"conferenceRecords/conf/transcripts/t",ownerFile,withdrawn:false,nativeExtraction:{issueId:"task",projectId:"project",agentId:"agent"},meeting:{title:"Roundtable",date:"2026-10-25",attendees:null,agenda:null,tags:[]}}]}};
 const h=createTestHarness({manifest,config});
 h.ctx.companies.list=async()=>[{id:"company"}] as any;
 Object.assign(h.ctx.db,{namespace:BRIDGE_NAMESPACE,query:async(q:string,p:any[])=>(await pg.query(q,p)).rows,execute:async(q:string,p:any[])=>({rowCount:(await pg.query(q,p)).affectedRows??0})});
 h.ctx.secrets.resolve=async()=>{throw Error("Local mode must not resolve credentials");};h.ctx.http.fetch=async()=>{throw Error("Local mode must not use network");};
 const issue:any={id:"task",companyId:"company",projectId:"project",assigneeAgentId:"agent",status:"in_progress"};
 const originalGet=h.ctx.issues.get.bind(h.ctx.issues);
 h.ctx.issues.get=async(id,companyId)=>id==="task"?issue:originalGet(id,companyId);
 h.ctx.issues.getSubtree=async(id,companyId)=>{
   const row=await h.ctx.issues.get(id,companyId);
   return {rootIssueId:id,companyId,issueIds:[id],issues:[row],activeRuns:{[id]:[{id:id==="task"?"run":"intake-run",issueId:id,agentId:row!.assigneeAgentId,status:"running",finishedAt:null}]},assignees:{[row!.assigneeAgentId!]:{id:row!.assigneeAgentId,status:"running"}}} as any;
 };
 h.ctx.issues.assertCheckoutOwner=async()=>({}) as any;
 const wakes:any[]=[];h.ctx.issues.requestWakeup=async(id,companyId,options)=>{wakes.push({id,companyId,options});return {queued:true} as any;};
 const run={companyId:"company",projectId:"project",agentId:"agent",runId:"run"};
 return {h,pg,config,ownerFile,wakes,run};
}
it("registered job and native tools complete owner-file extraction through durable local SQL publication/readback",async()=>{
 const f=await fixture(),status=registerRoundtableJobs(f.h.ctx);
 await f.h.runJob("reconcile-roundtable-sources");
 expect(status()).toMatchObject({state:"attention",results:[{state:"pending",code:"extraction_pending",publicationMode:"local"}]});
 expect(f.wakes).toHaveLength(1);
 const context:any=(await f.h.executeTool("meeting_source_context",{meetingId:"meeting"},f.run)).data;
 expect(context.source.text).toBe(source.text);
 const notes={notes:[{text:source.text.split("\n")[0],line:1}],decisions:[{text:source.text.split("\n")[1],line:2}],actions:[{text:source.text.split("\n")[2],line:3,owner:null}]};
 const result:any=(await f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes},f.run)).data;
 expect(result).toMatchObject({state:"recorded",candidateCount:3,publication:{state:"published",publicationMode:"local"}});
 const rows=await f.pg.query<any>(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'local-meeting-publication:%'`);
 expect(rows.rows).toHaveLength(1);const receipt=rows.rows[0].value.current;
 expect(receipt.envelope.publication).toMatchObject({transcript:source.text,audience:"members",notes:{decisions:[{line:2,verification:"unverified"}],actions:[{line:3,owner:null,verification:"unverified"}]}});
 const restarted=registerRoundtableJobs(f.h.ctx);await f.h.runJob("reconcile-roundtable-sources");expect(restarted()).toMatchObject({state:"complete",results:[{state:"unchanged",publicationMode:"local"}]});
});
it("rejects corrected or revoked owner sources before protected context or candidate continuation",async()=>{
 const f=await fixture();registerRoundtableJobs(f.h.ctx);await f.h.runJob("reconcile-roundtable-sources");
 const context:any=(await f.h.executeTool("meeting_source_context",{meetingId:"meeting"},f.run)).data;
 await writeFile(f.ownerFile,JSON.stringify({...source,revision:"2",text:"Corrected source"}),{mode:0o600});
 await expect(f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes:{notes:[],decisions:[],actions:[]}},f.run)).rejects.toThrow();
 const rows=await f.pg.query<any>(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'local-meeting-publication:%'`);expect(rows.rows).toHaveLength(0);
});
it("missing native extraction binding retains an unpublished pending source and later enriches the same revision",async()=>{
 const f=await fixture(),actor=f.config.roundtable.meetings[0].nativeExtraction;
 delete f.config.roundtable.meetings[0].nativeExtraction;f.h.ctx.config.get=async()=>f.config;
 const status=registerRoundtableJobs(f.h.ctx);await f.h.runJob("reconcile-roundtable-sources");
 expect(status()).toMatchObject({state:"attention",results:[{state:"pending",code:"native_extraction_binding_required"}]});
 expect((await f.pg.query(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'local-meeting-publication:%'`)).rows).toHaveLength(0);
 f.config.roundtable.meetings[0].nativeExtraction=actor;
 await f.h.runJob("reconcile-roundtable-sources");
 const context:any=(await f.h.executeTool("meeting_source_context",{meetingId:"meeting"},f.run)).data;
 const result:any=(await f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes:{notes:[{text:source.text.split("\n")[0],line:1}],decisions:[{text:source.text.split("\n")[1],line:2}],actions:[]}},f.run)).data;
 expect(result.publication).toMatchObject({state:"published",publicationMode:"local"});
});
it("the explicitly admitted native follow-up agent resolves protected meeting evidence but cannot submit extraction",async()=>{
 const f=await fixture();await f.pg.exec(await readFile(new URL("../../migrations/007_objective_intake.sql",import.meta.url),"utf8"));
 f.config.roundtable.nativeIntake={organizationId:"org",intakeAgentId:"triage",projectId:"project",referenceOnly:true,sourceAccess:true};f.h.ctx.config.get=async()=>f.config;
 const status=registerRoundtableJobs(f.h.ctx);await f.h.runJob("reconcile-roundtable-sources");
 expect(status().results[0]).toMatchObject({nativeIntake:"applied",code:"extraction_pending"});
 const rows=await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true});expect(rows).toHaveLength(1);
 const followup=rows[0]!;expect(followup.projectId).toBe("project");expect(followup.description).not.toContain(source.text);
 const meetingRef=/meeting_source_context\(\{"meetingRef":"([a-f0-9]{64})"\}\)/.exec(followup.description??"")?.[1];expect(meetingRef).toBeTruthy();
 const run={companyId:"company",projectId:"project",agentId:"triage",runId:"intake-run"};
 await expect(f.h.executeTool("meeting_source_context",{meetingRef},run)).rejects.toThrow();
 await f.h.ctx.issues.update(followup.id,{status:"in_progress"},"company");
 const context:any=(await f.h.executeTool("meeting_source_context",{meetingRef},run)).data;
 expect(context.source.text).toBe(source.text);expect(context.sourceEvidence).toBe("owner-file");
 await expect(f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes:{notes:[],decisions:[],actions:[]}},run)).rejects.toThrow();
 delete f.config.roundtable.nativeIntake.sourceAccess;
 await expect(f.h.executeTool("meeting_source_context",{meetingRef},run)).rejects.toThrow();
});
async function complete(f:Awaited<ReturnType<typeof fixture>>) {
 const status=registerRoundtableJobs(f.h.ctx);await f.h.runJob("reconcile-roundtable-sources");
 const context:any=(await f.h.executeTool("meeting_source_context",{meetingId:"meeting"},f.run)).data;
 const result:any=(await f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes:{notes:[{text:source.text.split("\n")[0],line:1}],decisions:[],actions:[]}},f.run)).data;
 expect(result.publication).toMatchObject({state:"published",publicationMode:"local"});return status;
}
it("cannot relabel a local successful receipt as live website completion by changing publication mode",async()=>{
 const f=await fixture(),status=await complete(f);let calls=0;
 f.config.roundtable.publicationMode="website";f.config.roundtable.websiteTokenRef={type:"secret_ref",secretId:"website"};f.h.ctx.config.get=async()=>f.config;
 f.h.ctx.secrets.resolve=async()=>{calls++;return "token";};f.h.ctx.http.fetch=async()=>{calls++;throw Error("No live site");};
 await f.h.runJob("reconcile-roundtable-sources");
 expect(status()).toMatchObject({state:"attention",results:[{state:"blocked",code:"binding_changed",publicationMode:"website"}]});expect(calls).toBe(0);
});
it("withdrawal during a local receipt absence read prevents the subsequent SQL publication write",async()=>{
 const f=await fixture();f.h.ctx.config.get=async()=>f.config;registerRoundtableJobs(f.h.ctx);await f.h.runJob("reconcile-roundtable-sources");
 const context:any=(await f.h.executeTool("meeting_source_context",{meetingId:"meeting"},f.run)).data;
 const query=f.h.ctx.db.query.bind(f.h.ctx.db);let changed=false;
 f.h.ctx.db.query=async(q:any,p:any)=>{const out=await query(q,p);if(p?.[2]?.startsWith("local-meeting-publication:")){changed=true;f.config.roundtable.meetings[0].withdrawn=true;}return out as any;};
 const result:any=(await f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes:{notes:[{text:source.text.split("\n")[0],line:1}],decisions:[],actions:[]}},f.run)).data;
 expect(changed).toBe(true);expect(result.publication.state).not.toBe("published");
 expect((await f.pg.query<any>(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'local-meeting-publication:%'`)).rows).toHaveLength(0);
});
it("explicit reader admission permits only verified active descendants of the exact meeting follow-up",async()=>{
 const f=await fixture();await f.pg.exec(await readFile(new URL("../../migrations/007_objective_intake.sql",import.meta.url),"utf8"));
 f.config.roundtable.nativeIntake={organizationId:"org",intakeAgentId:"triage",projectId:"project",referenceOnly:true,sourceAccess:true,allowedAgentIds:["triage","reader"]};f.h.ctx.config.get=async()=>f.config;
 registerRoundtableJobs(f.h.ctx);await f.h.runJob("reconcile-roundtable-sources");
 const root=(await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true}))[0]!;
 await f.h.ctx.issues.update(root.id,{status:"in_progress"},"company");
 const child=await f.h.ctx.issues.create({companyId:"company",projectId:"project",parentId:root.id,title:"Review source evidence",status:"in_progress",assigneeAgentId:"reader"});
 let detached=false;
 const base=f.h.ctx.issues.getSubtree.bind(f.h.ctx.issues);
 f.h.ctx.issues.getSubtree=async(id,companyId,options)=>{
   if(id!==root.id && id!==child.id)return base(id,companyId,options);
   const rows=id===root.id?[await f.h.ctx.issues.get(root.id,companyId),await f.h.ctx.issues.get(child.id,companyId)]:[await f.h.ctx.issues.get(child.id,companyId)];
   if(detached)for(const row of rows)if(row?.id===child.id)row.parentId=null;
   return {rootIssueId:id,companyId,issueIds:rows.map(r=>r!.id),issues:rows,activeRuns:{[child.id]:[{id:"reader-run",issueId:child.id,agentId:"reader",status:"running",finishedAt:null}]},assignees:{reader:{id:"reader",status:"running"},triage:{id:"triage",status:"running"}}} as any;
 };
 const meetingRef=/meeting_source_context\(\{"meetingRef":"([a-f0-9]{64})"\}\)/.exec(root.description??"")?.[1];expect(meetingRef).toBeTruthy();
 const run={companyId:"company",projectId:"project",agentId:"reader",runId:"reader-run"};
 expect(((await f.h.executeTool("meeting_source_context",{meetingRef},run)).data as any).source.text).toBe(source.text);
 await expect(f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:"a".repeat(64),notes:{notes:[],decisions:[],actions:[]}},run)).rejects.toThrow();
 detached=true;
 await expect(f.h.executeTool("meeting_source_context",{meetingRef},run)).rejects.toThrow();
});

it("preserves website publication while accepted actions reach one native coordinator issue across correction and restart",async()=>{
 const f=await fixture();
 await f.pg.exec(await readFile(new URL("../../migrations/007_objective_intake.sql",import.meta.url),"utf8"));
 delete f.config.roundtable.publicationMode;
 delete f.config.roundtable.meetings[0].ownerFile;
 f.config.roundtable.sourceTokenRef={type:"secret_ref",secretId:"source"};
 f.config.roundtable.websiteTokenRef={type:"secret_ref",secretId:"website"};
 f.config.roundtable.nativeIntake={organizationId:"org",intakeAgentId:"triage",projectId:"project",referenceOnly:true,sourceAccess:true,allowedAgentIds:["reader"]};
 f.h.ctx.config.get=async()=>f.config;
 // Controlled composition: HTTP/native issue boundaries use doubles, SQL uses PGlite,
 // and candidates are test-supplied; this is not native-runtime/model/live-website/Buzz proof.
 // Production source validation, extraction, SQL state, website codec/readback and mapping run unchanged.
 let currentSource={...source};
 const receipts=new Map<string,any>(),requests:string[]=[];
 let head:any=null;
 f.h.ctx.secrets.resolve=async()=>"synthetic-token";
 f.h.ctx.http.fetch=async(url,init)=>{
  const json=(value:unknown,status=200,etag?:string)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json",...(etag?{etag:'"'+etag+'"'}:{})}});
  if(url.startsWith("https://meet.googleapis.com/"))return json({name:f.config.roundtable.meetings[0].transcriptName,state:"FILE_GENERATED",docsDestination:{document:"doc"}});
  if(url.includes("/files/doc?"))return json({id:"doc",version:currentSource.revision,mimeType:"application/vnd.google-apps.document",parents:["folder"],trashed:false});
  if(url.includes("/export?"))return new Response(currentSource.text,{headers:{"content-type":"text/plain"}});
  if(url.startsWith("https://local.example/api/integrations/v1/roundtables/operations/") && init?.method==="GET"){
   const receipt=receipts.get(url.split("/").at(-1)!);
   return receipt?json({...receipt,current:receipt.operationId===head.operationId,currentOutputHash:head.outputHash},200,receipt.outputHash):json({code:"operation_absent"},404);
  }
  if(url==="https://local.example/api/integrations/v1/roundtables/publications" && init?.method==="POST"){
   const body=String(init.body),envelope=JSON.parse(body),p=envelope.publication,headers=new Headers(init.headers);
   if(p.expectedPreviousOutputHash!==(head?.outputHash??null))return json({},412);
   if(headers.get("idempotency-key")!==p.operationId)return json({},409);
   if(head?headers.get("if-match")!=='"'+head.outputHash+'"':headers.get("if-none-match")!=="*")return json({},428);
   const saved=await f.pg.query<any>(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'roundtable:state:%'`);
   expect(saved.rows[0].value.operation.body).toBe(body);
   head={state:"present",publicationId:"synthetic-"+p.operationId,meetingNoteId:"synthetic-note",operationId:p.operationId,outputHash:p.outputHash,requestBodyHash:createHash("sha256").update(body).digest("hex"),audience:"members",current:true,currentOutputHash:p.outputHash,readbackPath:"/api/integrations/v1/roundtables/operations/"+p.operationId,envelope};
   receipts.set(p.operationId,head);requests.push(body);
   return json({},201);
  }
  throw Error("Unexpected integration request "+url);
 };
 const status=registerRoundtableJobs(f.h.ctx);
 const submit=async()=>{
  await f.h.runJob("reconcile-roundtable-sources");
  const context:any=(await f.h.executeTool("meeting_source_context",{meetingId:"meeting"},f.run)).data;
  const lines=context.source.text.split("\n");
  return (await f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes:{notes:[{text:lines[0],line:1}],decisions:[{text:lines[1],line:2}],actions:[{text:lines[2],line:3,owner:null}]}},f.run)).data as any;
 };
 expect(await submit()).toMatchObject({state:"recorded",publication:{state:"published",nativeIntake:"applied",publicationMode:"website"}});
 const followups=await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true});
 expect(followups).toHaveLength(1);
 const root=followups[0]!;
 expect(root).toMatchObject({assigneeAgentId:"triage",projectId:"project",status:"backlog"});
 expect(root.description).not.toContain("missing accessibility tests");
 const meetingRef=/meeting_source_context\(\{"meetingRef":"([a-f0-9]{64})"\}\)/.exec(root.description??"")?.[1];
 expect(meetingRef).toBeTruthy();
 await f.h.ctx.issues.update(root.id,{status:"in_progress",priority:"high"},"company");
 const triageRun={companyId:"company",projectId:"project",agentId:"triage",runId:"intake-run"};
 const triage:any=(await f.h.executeTool("meeting_source_context",{meetingRef},triageRun)).data;
 expect(triage.sourceEvidence).toBe("drive");
 expect(triage.candidates).toContainEqual(expect.objectContaining({kind:"commitment",value:"Please investigate the missing accessibility tests.",source_id:"drive:doc",source_revision:"1",source_locator:{meeting_id:"meeting",line_start:3,line_end:3},source_hash:createHash("sha256").update(source.text).digest("hex"),owner:null,status:"candidate",verification:"unverified"}));
 expect(head.envelope.publication).toMatchObject({transcript:source.text,audience:"members",notes:{actions:[{text:"Please investigate the missing accessibility tests.",line:3,owner:null,verification:"unverified"}]}});
 const priorHash=head.outputHash;
 // Corrections must update the existing mapped issue without taking native priorities/assignment back.
 currentSource={...source,revision:"2",text:source.text.replace("missing accessibility tests","remaining accessibility tests")};
 expect(await submit()).toMatchObject({publication:{state:"published",nativeIntake:"applied"}});
 expect(requests).toHaveLength(2);
 expect(head.envelope.publication).toMatchObject({revision:"2",expectedPreviousOutputHash:priorHash,transcript:currentSource.text});
 expect((await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true})).map(row=>row.id)).toEqual([root.id]);
 expect(await f.h.ctx.issues.get(root.id,"company")).toMatchObject({assigneeAgentId:"triage",status:"in_progress",priority:"high"});
 const corrected:any=(await f.h.executeTool("meeting_source_context",{meetingRef},triageRun)).data;
 expect(corrected.candidates.filter((candidate:any)=>candidate.kind==="commitment")).toMatchObject([{source_revision:"2",value:"Please investigate the remaining accessibility tests."}]);
 const restarted=registerRoundtableJobs(f.h.ctx);
 await f.h.runJob("reconcile-roundtable-sources");
 expect(restarted()).toMatchObject({state:"complete",results:[{state:"unchanged",nativeIntake:"replayed",publicationMode:"website"}]});
 expect(requests).toHaveLength(2);
 const durable=await f.pg.query<any>(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'roundtable:state:%'`);
 expect(durable.rows[0].value.outcome.receipt.envelope.publication.revision).toBe("2");
 expect(JSON.parse(durable.rows[0].value.previous.body).publication.revision).toBe("1");
 expect(status().results[0]?.state).toBe("published");
});

it.each(["done","reassigned","missing"])("routes a %s extraction task into the existing native exception issue without publishing",async failure=>{
 const f=await fixture();
 await f.pg.exec(await readFile(new URL("../../migrations/007_objective_intake.sql",import.meta.url),"utf8"));
 f.config.roundtable.nativeIntake={organizationId:"org",intakeAgentId:"triage",projectId:"project",referenceOnly:true};
 f.h.ctx.config.get=async()=>f.config;
 const update=f.h.ctx.issues.update.bind(f.h.ctx.issues),updatedIssues:string[]=[];
 f.h.ctx.issues.update=async(...args)=>{updatedIssues.push(args[0]);return update(...args);};
 const get=f.h.ctx.issues.get.bind(f.h.ctx.issues);
 let unavailable=true;
 f.h.ctx.issues.get=async(id,companyId)=>{
  const row=await get(id,companyId);
  if(id!=="task" || !unavailable)return row;
  return failure==="missing"?null:{...row,...(failure==="done"?{status:"done" as const}:{assigneeAgentId:"other-agent"})} as typeof row;
 };
 const status=registerRoundtableJobs(f.h.ctx);
 await f.h.runJob("reconcile-roundtable-sources");
 expect(status()).toMatchObject({state:"attention",results:[{state:"pending",code:"native_extraction_assignment_required",nativeIntake:"applied"}]});
 const issues=await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true});
 expect(issues).toHaveLength(1);
 expect(issues[0]).toMatchObject({assigneeAgentId:"triage",projectId:"project",status:"backlog"});
 expect(issues[0]!.description).toContain("Restore the admitted native extraction task");
 expect(issues[0]!.description).not.toContain(source.text);
 expect(f.wakes).toHaveLength(0);
 expect((await f.pg.query(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'local-meeting-publication:%'`)).rows).toHaveLength(0);
 await f.h.runJob("reconcile-roundtable-sources");
 expect(status().results[0]).toMatchObject({code:"native_extraction_assignment_required",nativeIntake:"replayed"});
 expect((await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true})).map(row=>row.id)).toEqual([issues[0]!.id]);
 // Only the native owner restores assignment; intake must neither reopen nor reassign the task.
 unavailable=false;
 await f.h.runJob("reconcile-roundtable-sources");
 expect(status()).toMatchObject({state:"attention",results:[{state:"pending",code:"extraction_pending",nativeIntake:"applied"}]});
 expect((await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true})).map(row=>row.id)).toEqual([issues[0]!.id]);
 expect(f.wakes).toHaveLength(1);
 const context:any=(await f.h.executeTool("meeting_source_context",{meetingId:"meeting"},f.run)).data;
 expect(context.source).toMatchObject({sourceId:"drive:doc",revision:"1",text:source.text});
 const completed:any=(await f.h.executeTool("submit_meeting_candidates",{meetingId:"meeting",requestHash:context.requestHash,notes:{notes:[],decisions:[],actions:[{text:"Please investigate the missing accessibility tests.",line:3,owner:null}]}},f.run)).data;
 expect(completed.publication).toMatchObject({state:"published",publicationMode:"local",nativeIntake:"applied"});
 const published=await f.pg.query<any>(`SELECT value FROM ${BRIDGE_NAMESPACE}.bridge_runtime WHERE state_key LIKE 'local-meeting-publication:%'`);
 expect(published.rows[0].value.current.envelope.publication).toMatchObject({revision:"1",transcript:source.text,notes:{actions:[{text:"Please investigate the missing accessibility tests.",line:3,owner:null,verification:"unverified"}]}});
 expect((await f.h.ctx.issues.list({companyId:"company",includePluginOperations:true})).map(row=>row.id)).toEqual([issues[0]!.id]);
 expect(updatedIssues).not.toContain("task");
 expect(f.wakes).toHaveLength(1);
});
