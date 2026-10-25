import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync}from'node:child_process';
import{createHash}from'node:crypto';
import{fileURLToPath}from'node:url';
const source=fileURLToPath(new URL('../',import.meta.url)),native=process.env.CODEX_COMMAND_NATIVE_ROOT??path.join(source,'node_modules');
const baseline=process.env.CODEX_COMMAND_BASELINE_ROOT??path.join(native,'@paperclipai/adapter-codex-local');
const pinsBytes=await fs.readFile(path.join(source,'patches/codex-command-tools-pins.json')),pins=JSON.parse(pinsBytes),files=Object.keys(pins.files);
const hash=b=>createHash('sha256').update(b).digest('hex');
async function put(p,b){await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,b);}
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'codex-overlay-')),adapter=path.join(root,'node_modules/@paperclipai/adapter-codex-local'),server=path.join(root,'node_modules/@paperclipai/server');
 for(const f of['package.json',...files])await put(path.join(adapter,f),await fs.readFile(path.join(baseline,f)));
 for(const f of['package.json','dist/build-info.json',pins.unchangedAuthGuard.file])await put(path.join(server,f),await fs.readFile(path.join(native,'@paperclipai/server',f)));
 const script=path.join(root,'scripts/apply-codex-command-tools.mjs');
 try{await put(script,await fs.readFile(path.join(source,'scripts/apply-codex-command-tools.mjs')));}catch(e){if(e.code!=='ENOENT')throw e;}
 await put(path.join(root,'patches/codex-command-tools-pins.json'),pinsBytes);await put(path.join(root,'patches',pins.patch),await fs.readFile(path.join(source,'patches',pins.patch)));await put(path.join(adapter,'unrelated.fixture'),'preserve');
 return{root,adapter,server,script};
}
const run=f=>spawnSync(process.execPath,[f.script],{encoding:'utf8',timeout:30000});
const text=r=>(r.stdout??'')+(r.stderr??'');
async function state(f){return Promise.all([...files.map(p=>path.join(f.adapter,p)),path.join(f.server,pins.unchangedAuthGuard.file),path.join(f.adapter,'unrelated.fixture')].map(async p=>hash(await fs.readFile(p))));}
async function clean(f){await fs.rm(f.root,{recursive:true,force:true});}
test('exact baseline installs idempotently while auth guard and unrelated data remain unchanged',async()=>{
 const f=await fixture();try{
  const auth=await fs.readFile(path.join(f.server,pins.unchangedAuthGuard.file));
  for(let n=0;n<2;n++){const result=run(f);assert.equal(result.status,0,text(result));for(const file of files)assert.equal(hash(await fs.readFile(path.join(f.adapter,file))),pins.files[file].candidate_sha256);}
  assert.deepEqual(await fs.readFile(path.join(f.server,pins.unchangedAuthGuard.file)),auth);assert.equal(await fs.readFile(path.join(f.adapter,'unrelated.fixture'),'utf8'),'preserve');
 }finally{await clean(f);}
});
for(const file of files)test(`drifted ${file} rejected before writes`,async()=>{
 const f=await fixture();try{await fs.appendFile(path.join(f.adapter,file),'\n//fixture drift\n');const before=await state(f),result=run(f);assert.notEqual(result.status,0);assert.match(text(result),/Unqualified or partial Codex command overlay/);assert.deepEqual(await state(f),before);}finally{await clean(f);}
});
for(const file of files)test(`partially patched ${file} rejected before writes`,async()=>{
 const f=await fixture();try{const patched=spawnSync('patch',['--batch','--forward','--fuzz=0','-p1','-d',f.adapter,'-i',path.join(f.root,'patches',pins.patch)],{encoding:'utf8'});assert.equal(patched.status,0,text(patched));for(const other of files.filter(v=>v!==file))await put(path.join(f.adapter,other),await fs.readFile(path.join(baseline,other)));const before=await state(f),result=run(f);assert.notEqual(result.status,0);assert.match(text(result),/Unqualified or partial Codex command overlay/);assert.deepEqual(await state(f),before);}finally{await clean(f);}
});
for(const which of['adapter-version','server-version','build','auth-guard','patch','adapter-symlink','server-symlink','file-symlink'])test(`rejects ${which} without pinned writes`,async()=>{
 const f=await fixture();try{
  if(which==='adapter-version'||which==='server-version'){const p=path.join(which==='adapter-version'?f.adapter:f.server,'package.json'),j=JSON.parse(await fs.readFile(p));j.version='unqualified-fixture';await put(p,JSON.stringify(j));}
  if(which==='build'){const p=path.join(f.server,'dist/build-info.json'),j=JSON.parse(await fs.readFile(p));j.commit='unqualified-fixture';await put(p,JSON.stringify(j));}
  if(which==='auth-guard')await fs.appendFile(path.join(f.server,pins.unchangedAuthGuard.file),'\n//fixture drift\n');
  if(which==='patch')await fs.appendFile(path.join(f.root,'patches',pins.patch),'\nfixture corruption\n');
  if(which==='adapter-symlink'||which==='server-symlink'){const p=which==='adapter-symlink'?f.adapter:f.server;await fs.rename(p,p+'-external');await fs.symlink(p+'-external',p);}
  if(which==='file-symlink'){const p=path.join(f.adapter,files[0]);await fs.rename(p,p+'.external');await fs.symlink(p+'.external',p);}
  const before=await state(f),result=run(f);assert.notEqual(result.status,0);assert.match(text(result),/Unqualified|integrity|Refusing|auth guard/);assert.deepEqual(await state(f),before);
 }finally{await clean(f);}
});
