import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const native=process.env.QUALIFICATION_NATIVE_ROOT??'/opt/host/node_modules';
const pins=JSON.parse(await fs.readFile(path.join(root,'patches/native-dependency-backstop-pins.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const targetRel=Object.keys(pins.files)[0];
async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dependency-backstop-install-'));
 for(const rel of ['scripts/apply-native-dependency-backstop.mjs','patches/native-dependency-backstop-pins.json','patches/'+pins.patch]){
  await fs.mkdir(path.dirname(path.join(dir,rel)),{recursive:true});await fs.copyFile(path.join(root,rel),path.join(dir,rel));
 }
 const files=new Set([...Object.keys(pins.unchangedGuards),targetRel,'@paperclipai/server/dist/build-info.json',...['server','shared','adapter-codex-local','plugin-sdk'].map(n=>'@paperclipai/'+n+'/package.json')]);
 for(const rel of files){const to=path.join(dir,'node_modules',rel);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(path.join(native,rel),to);}
 const target=path.join(dir,'node_modules',targetRel);
 if(sha(await fs.readFile(target))===pins.files[targetRel].candidate_sha256){
  const r=spawnSync('patch',['--batch','--reverse','--fuzz=0','-p1','-d',path.join(dir,'node_modules'),'-i',path.join(dir,'patches',pins.patch)],{encoding:'utf8'});
  assert.equal(r.status,0,r.stdout+r.stderr);
 }
 assert.equal(sha(await fs.readFile(target)),pins.files[targetRel].base_sha256);
 return dir;
}
const run=dir=>spawnSync(process.execPath,[path.join(dir,'scripts/apply-native-dependency-backstop.mjs')],{encoding:'utf8'});
test('pinned overlay installs idempotently and keeps native decision semantics unchanged',async()=>{
 const dir=await fixture();try{
  for(let n=0;n<2;n++){const r=run(dir);assert.equal(r.status,0,r.stdout+r.stderr);}
  assert.equal(sha(await fs.readFile(path.join(dir,'node_modules',targetRel))),pins.files[targetRel].candidate_sha256);
  for(const [rel,hash] of Object.entries(pins.unchangedGuards))assert.equal(sha(await fs.readFile(path.join(dir,'node_modules',rel))),hash);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
for(const kind of ['target-drift','arbiter-drift','committer-drift','package-version','build-commit','patch-integrity','target-symlink','directory-symlink'])test('installer refuses '+kind+' without changing target',async()=>{
 const dir=await fixture();try{
  const target=path.join(dir,'node_modules',targetRel);
  if(kind==='target-drift')await fs.appendFile(target,'\n/* drift */');
  if(kind==='arbiter-drift'||kind==='committer-drift')await fs.appendFile(path.join(dir,'node_modules','@paperclipai/server/dist/services/native-runtime',kind==='arbiter-drift'?'status-arbiter.js':'status-decision-committer.js'),'\n');
  if(kind==='package-version')await fs.writeFile(path.join(dir,'node_modules/@paperclipai/shared/package.json'),'{}');
  if(kind==='build-commit')await fs.writeFile(path.join(dir,'node_modules/@paperclipai/server/dist/build-info.json'),'{}');
  if(kind==='patch-integrity')await fs.appendFile(path.join(dir,'patches',pins.patch),'\n');
  if(kind==='target-symlink'){await fs.rename(target,target+'.real');await fs.symlink(target+'.real',target);}
  if(kind==='directory-symlink'){const d=path.dirname(target);await fs.rename(d,d+'.real');await fs.symlink(d+'.real',d);}
  const before=await fs.readFile(target),r=run(dir);assert.notEqual(r.status,0,r.stdout+r.stderr);assert.deepEqual(await fs.readFile(target),before);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
