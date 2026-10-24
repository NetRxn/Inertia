import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,writeFile,rm,realpath,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {loadConfig,verifyPinnedFiles} from './config.mjs';
const keys=['INERTIA_REPO_ROOT','DFW_REPO_ROOT','PAPERCLIP_HOST_ROOT','POSTGRES_NATIVE_ROOT','DFW_PYTHON','MEETING_OUTPUT_ROOT'];
const base=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
test('explicit existing pinned paths load and record source pins',async()=>{
 const c=await loadConfig(base);assert.equal(c.inertiaRoot,await realpath(base.INERTIA_REPO_ROOT));assert.equal(c.sourcePins.inertia,'7b6f0692842cc5939a73fb1310fbef4db6afbdde');assert.equal(c.sourcePins.dfw,'88b855d3bc3cef805319ef087c86ff48bb6465ae');assert.ok(c.python.endsWith('/python'));assert.ok(c.pythonRealpath);
});
for(const key of keys)test('missing '+key+' fails before launch',async()=>{const env={...base};delete env[key];await assert.rejects(()=>loadConfig(env),/required/);});
for(const key of ['DATABASE_URL','QUALIFICATION_DATABASE_URL','PGHOST','PGSERVICE','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGPASSFILE','PGSERVICEFILE'])test('incoming '+key+' is rejected',async()=>{await assert.rejects(()=>loadConfig({...base,[key]:'external'}),/external database/);});
test('relative paths are rejected',async()=>{await assert.rejects(()=>loadConfig({...base,INERTIA_REPO_ROOT:'relative'}),/absolute/);});
test('missing source tree rejected',async()=>{await assert.rejects(()=>loadConfig({...base,DFW_REPO_ROOT:join(tmpdir(),'nonexistent-meeting-source-938409')}),/unavailable/);});
test('wrong interpreter rejected without execution',async()=>{await assert.rejects(()=>loadConfig({...base,DFW_PYTHON:'/bin/true'}),/hash/);});
test('output may not modify existing host runtime',async()=>{await assert.rejects(()=>loadConfig({...base,MEETING_OUTPUT_ROOT:base.PAPERCLIP_HOST_ROOT}),/output/);});
test('source verification detects changed bytes at same path',async()=>{const root=await mkdtemp(join(tmpdir(),'meeting-pins-test-'));try{const p=join(root,'source');await writeFile(p,'original');const hashes={source:createHash('sha256').update('original').digest('hex')};await verifyPinnedFiles(root,hashes);await writeFile(p,'changed');await assert.rejects(()=>verifyPinnedFiles(root,hashes),/hash/);}finally{await rm(root,{recursive:true,force:true});}});

test('dot-dot-prefixed descendant remains inside runtime root',async()=>{const root=await mkdtemp(join(tmpdir(),'meeting-runtime-test-'));try{const output=join(root,'..receipts');await mkdir(output);await assert.rejects(()=>loadConfig({...base,PAPERCLIP_HOST_ROOT:root,MEETING_OUTPUT_ROOT:output}),/output/);}finally{await rm(root,{recursive:true,force:true});}});
