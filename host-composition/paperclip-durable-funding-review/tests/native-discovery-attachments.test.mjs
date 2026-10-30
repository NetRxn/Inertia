/** Exact native entry boundary with real filesystem guards; admission is synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=process.env.NATIVE_DISCOVERY_CANDIDATE;
const options={skip:root?false:'Set NATIVE_DISCOVERY_CANDIDATE to the isolated patched source'};
let boundary,guard;
if(root){
 const source=await fs.readFile(path.join(root,'dist/services/native-runtime/native-session-executor.js'),'utf8');
 const entry=source.indexOf('export async function executePaperclipNativeSession(input)');
 const start=source.indexOf('        const targetKind =',entry);
 const end=source.indexOf('        const chatAttachmentReadScope =',start);
 assert(entry>=0&&start>entry&&end>start,'Actual pre-attachment entry boundary must exist');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 boundary=new AsyncFunction('input','readNativeDiscoveryAdmission','assertPublicScoutWorkspace','executePaperclipNativeSessionWithinScope',source.slice(start,end)+'\nreturn "stage-private-attachments";');
 ({assertPublicScoutWorkspace:guard}=await import(pathToFileURL(path.join(root,'dist/vendor/paperclip-runner/drivers/public-scout-projection.mjs'))));
}
async function workspace(operation){
 const directory=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'scout-attachment-boundary-')));
 try{return await operation(directory);}finally{await fs.rm(directory,{recursive:true,force:true});}
}
function input(cwd){return{db:{},execution:{binding:{runId:'synthetic'},provider:{nativeFundingPolicy:{role:'producer'}},workspace:{cwd}}};}

test('public scout reaches native execution without creating the generic inbound scaffold',options,()=>workspace(async cwd=>{
 let reached=false;
 const result=await boundary(input(cwd),async()=>({role:'scout'}),guard,async()=>{reached=true;return 'native-boundary';});
 if(result==='stage-private-attachments')await fs.mkdir(path.join(cwd,'.paperclip-inbound','process-7-100-00000000-0000-4000-8000-000000000001'),{recursive:true});
 assert.equal(result,'native-boundary');
 assert.equal(reached,true);
 assert.deepEqual(await fs.readdir(cwd),[]);
}));
test('public scout still rejects private files without reading or deleting them',options,()=>workspace(async cwd=>{
 await fs.writeFile(path.join(cwd,'private.txt'),'private sentinel');
 let reached=false;
 await assert.rejects(()=>boundary(input(cwd),async()=>({role:'scout'}),guard,async()=>{reached=true;}),/public_scout_fresh_workspace_required/);
 assert.equal(reached,false);
 assert.equal(await fs.readFile(path.join(cwd,'private.txt'),'utf8'),'private sentinel');
}));
test('public scout retains ancestor instruction denial',options,()=>workspace(async parent=>{
 const cwd=path.join(parent,'public');await fs.mkdir(cwd);await fs.writeFile(path.join(parent,'AGENTS.md'),'private instruction sentinel');
 await assert.rejects(()=>boundary(input(cwd),async()=>({role:'scout'}),guard,async()=>{}),/public_scout_ancestor_instructions_denied/);
}));
for(const admission of[null,{role:'diligence'}])test('ordinary and diligence retain generic attachment staging: '+JSON.stringify(admission),options,()=>workspace(async cwd=>{
 await fs.writeFile(path.join(cwd,'ordinary.txt'),'ordinary attachment context');
 assert.equal(await boundary(input(cwd),async()=>admission,guard,async()=>{throw Error('must use ordinary staging');}),'stage-private-attachments');
}));
test('revoked scout admission fails before provider or attachment staging',options,()=>workspace(async cwd=>{
 await assert.rejects(()=>boundary(input(cwd),async()=>{throw Error('native_discovery_admission_denied');},guard,async()=>{throw Error('provider must not be called');}),/native_discovery_admission_denied/);
 assert.deepEqual(await fs.readdir(cwd),[]);
}));
