import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const comp=path.dirname(path.dirname(fileURLToPath(import.meta.url))),fixtureSource=process.env.INERTIA_COMPOSED_NATIVE_FIXTURE;
const overlays=['native-review-paging','native-agent-permission-grants','native-source-review-contract','native-coordinator-continuation','native-scout-deadline','native-case-result-envelope','native-source-receipt-envelope','native-case-documents'];
async function fixture(){
 assert(fixtureSource,'explicit isolated compiled-source fixture required');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'composed-native-pins-')),serverRoot=root+'/server',patchesRoot=root+'/patches';
 await fs.cp(fixtureSource,serverRoot,{recursive:true});await fs.mkdir(patchesRoot);
 for(const name of overlays){const pins=JSON.parse(await fs.readFile(comp+'/patches/'+name+'-pins.json'));for(const file of[name+'-pins.json',pins.patch])await fs.copyFile(comp+'/patches/'+file,patchesRoot+'/'+file);}
 return {root,serverRoot,patchesRoot};
}
async function verify(f){const api=await import('../scripts/verify-composed-native-pins.mjs');return api.verifyComposedNativePins(f);}
test('composed native pins accept only the reviewed source-review, continuation, scout deadline and case-result supersessions',async()=>{const f=await fixture();try{const result=await verify(f);assert.equal(result.supersededFiles,15);assert.ok(result.verifiedFiles>30);assert.deepEqual(result.overlays,overlays);}finally{await fs.rm(f.root,{recursive:true,force:true});}});
test('composed verification rejects the historical file after the new overlay',async()=>{const f=await fixture();try{await fs.writeFile(f.serverRoot+'/dist/services/native-runtime/native-case-work-tools.mjs','stale predecessor');await assert.rejects(()=>verify(f),/native_pin_drift/);}finally{await fs.rm(f.root,{recursive:true,force:true});}});
test('composition rejects a changed predecessor lineage and expanded override',async()=>{for(const expanded of[false,true]){const f=await fixture();try{const p=f.patchesRoot+'/native-source-review-contract-pins.json',pins=JSON.parse(await fs.readFile(p));if(expanded)pins.files['dist/extra.js']={base_sha256:'a'.repeat(64),candidate_sha256:'b'.repeat(64)};else pins.files['dist/services/native-runtime/native-case-work-tools.mjs'].base_sha256='a'.repeat(64);await fs.writeFile(p,JSON.stringify(pins));await assert.rejects(()=>verify(f),/native_contract_lineage_denied/);}finally{await fs.rm(f.root,{recursive:true,force:true});}}});
test('all other historical guards and patch integrity remain enforced',async()=>{for(const patch of[false,true]){const f=await fixture();try{const target=patch?f.patchesRoot+'/native-source-review-contract.patch':f.serverRoot+'/dist/services/native-runtime/native-source-review.mjs';await fs.appendFile(target,'drift');await assert.rejects(()=>verify(f),patch?/native_patch_drift/:/native_pin_drift/);}finally{await fs.rm(f.root,{recursive:true,force:true});}}});

test('scout overlay rejects expanded or changed predecessor lineage',async()=>{for(const expanded of[false,true]){const f=await fixture();try{const name=f.patchesRoot+'/native-scout-deadline-pins.json',pins=JSON.parse(await fs.readFile(name));if(expanded)pins.files['dist/extra.js']={base_sha256:'a'.repeat(64),candidate_sha256:'b'.repeat(64)};else pins.files[Object.keys(pins.files)[0]].base_sha256='a'.repeat(64);await fs.writeFile(name,JSON.stringify(pins));await assert.rejects(()=>verify(f),/native_scout_deadline_lineage_denied/);}finally{await fs.rm(f.root,{recursive:true,force:true});}}});

test('case result overlay rejects expanded or changed predecessor lineage',async()=>{for(const expanded of[false,true]){const f=await fixture();try{const name=f.patchesRoot+'/native-case-result-envelope-pins.json',pins=JSON.parse(await fs.readFile(name));if(expanded)pins.files['dist/extra.js']={base_sha256:'a'.repeat(64),candidate_sha256:'b'.repeat(64)};else pins.files[Object.keys(pins.files)[0]].base_sha256='a'.repeat(64);await fs.writeFile(name,JSON.stringify(pins));await assert.rejects(()=>verify(f),/native_case_result_lineage_denied/);}finally{await fs.rm(f.root,{recursive:true,force:true});}}});

test('source receipt overlay rejects expanded or changed predecessor lineage',async()=>{for(const expanded of[false,true]){const f=await fixture();try{const name=f.patchesRoot+'/native-source-receipt-envelope-pins.json',pins=JSON.parse(await fs.readFile(name));if(expanded)pins.files['dist/extra.js']={base_sha256:'a'.repeat(64),candidate_sha256:'b'.repeat(64)};else pins.files[Object.keys(pins.files)[0]].base_sha256='a'.repeat(64);await fs.writeFile(name,JSON.stringify(pins));await assert.rejects(()=>verify(f),/native_source_receipt_lineage_denied/);}finally{await fs.rm(f.root,{recursive:true,force:true});}}});

test('case document overlay rejects expanded or changed predecessor lineage',async()=>{for(const expanded of[false,true]){const f=await fixture();try{const name=f.patchesRoot+'/native-case-documents-pins.json',pins=JSON.parse(await fs.readFile(name));if(expanded)pins.files['dist/extra.js']={base_sha256:'a'.repeat(64),candidate_sha256:'b'.repeat(64)};else pins.files[Object.keys(pins.files)[0]].base_sha256='a'.repeat(64);await fs.writeFile(name,JSON.stringify(pins));await assert.rejects(()=>verify(f),/native_case_documents_lineage_denied/);}finally{await fs.rm(f.root,{recursive:true,force:true});}}});
