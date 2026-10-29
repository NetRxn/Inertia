/** Actual domain source pages through the unchanged real durable command journal. */
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import os from'node:os';import path from'node:path';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
const candidate=process.env.INERTIA_SOURCE_CONTEXT_NATIVE_CANDIDATE,fixture=process.env.INERTIA_SOURCE_CONTEXT_JOURNAL_FIXTURE;
assert(candidate&&fixture,'explicit source-only native fixture and actual domain pages required');
const {DurablePrpControlPlane}=await import(pathToFileURL(candidate+'/dist/vendor/paperclip-runner/control-plane/durable-prp-control-plane.js'));
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex'),pages=JSON.parse(await fs.readFile(fixture,'utf8'));
test('actual durable journal rejects former large response, accepts every real single-MB document page and cold-replays',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'source-journal-')),identity={companyId:'synthetic-company',agentId:'charlie',runId:'synthetic-review-run',normalizedSessionId:'synthetic-session',runnerInstanceId:'synthetic-runner',environmentLeaseId:'synthetic-lease',turnId:'synthetic-turn',itemId:'synthetic-item'},options={identity,stateDirectory:directory,expectedRunnerVersion:'synthetic-v1',expectedRunnerDigest:'sha256:'+'a'.repeat(64)};
 try{
  const journal=new DurablePrpControlPlane(options);
  assert.throws(()=>journal.queueCommand('semantic_tool.result',{result:{data:{source:'x'.repeat(548000)}}},'old-oversized'),/command_payload_too_large/);
  let index=0;
  for(const [kind,views]of Object.entries(pages)){
   assert(views.length>1);const parts=[];
   for(const view of views){assert.equal(Buffer.byteLength(view.text),view.text.length);assert(Buffer.byteLength(view.text)<=32000);const sdk={content:JSON.stringify(view),data:view},payload={callId:'call-'+index,operationId:'app_netrxn_inertia_funding_case_work_50d11bddad41',inputDigest:'sha256:'+'b'.repeat(64),result:sdk,isError:false};const command=journal.queueCommand('semantic_tool.result',payload,'page-'+index);assert.equal(journal.queueCommand('semantic_tool.result',payload,'page-'+index).commandId,command.commandId);parts.push(command.payload.result.data.text);index++;}
   const text=parts.join('');assert.equal(hash(text),views[0].context_hash);const value=JSON.parse(text);const documents=kind==='proposal'?value.proposal.snapshot.documents:value.documents;assert(Buffer.byteLength(documents[0].text)>1000000);
  }
  assert(index<500,'fixture explicitly stays within existing per-run command count');
  const restarted=new DurablePrpControlPlane(options);assert.equal(restarted.store.state.commands.length,index);assert.equal(restarted.store.state.commands[0].payload.result.data.text,pages.record[0].text);
  console.log(JSON.stringify({actualJournal:true,sourceDocumentBytesOverOneMillion:true,pages:index,journalCommands:index,oldOversizeRejected:true,everyPageReconstructed:true,providerStarted:false}));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
