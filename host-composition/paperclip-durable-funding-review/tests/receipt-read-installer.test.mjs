/** Source-only pin/version checks. Does not install, hydrate or start a host/DB. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const pins=JSON.parse(await fs.readFile(path.join(root,'patches/pinned-files.json'),'utf8'));
const patch=await fs.readFile(path.join(root,'patches/paperclip-2026.1012.0-durable-capture.patch'),'utf8');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('all added receipt reader modules and declarations match exact candidate fingerprints',()=>{
 for(const name of ['activity-receipt-read.js','funding-review-capture.js','funding-review-capture.d.ts','member-packet-capture.js','member-packet-capture.d.ts']){
  const file='dist/services/'+name,part=patch.split('--- a/').find(part=>part.startsWith(file+'\n'));assert.ok(part,file);
  const lines=part.split('\n');const header=/^@@ -0,0 \+1,(\d+) @@$/.exec(lines[2]);assert.ok(header,file);
  const added=lines.slice(3).filter(line=>line.startsWith('+'));assert.equal(added.length,Number(header[1]),file);
  assert.equal(pins.files[file].original_sha256,null);assert.equal(hash(added.map(line=>line.slice(1)).join('\n')+'\n'),pins.files[file].candidate_sha256,file);
 }
 assert.equal(pins.packageVersion,'2026.1012.0');assert.equal(pins.buildCommit,'bba6a45f0d364cfd962ac59b3bdf2426a8222adb');
});
test('unchanged bootstrap refuses a Paperclip version drift before patching or hydration',async t=>{
 const fixture=await fs.mkdtemp(path.join(process.env.TMPDIR??root,'receipt-version-'));
 t.after(()=>fs.rm(fixture,{recursive:true,force:true}));
 for(const directory of ['scripts','patches','node_modules/@paperclipai/server'])await fs.mkdir(path.join(fixture,directory),{recursive:true});
 await fs.copyFile(path.join(root,'scripts/bootstrap.mjs'),path.join(fixture,'scripts/bootstrap.mjs'));
 await fs.writeFile(path.join(fixture,'patches/pinned-files.json'),JSON.stringify(pins));
 const packageFile=path.join(fixture,'node_modules/@paperclipai/server/package.json'),bytes=JSON.stringify({version:'2026.1012.1'});await fs.writeFile(packageFile,bytes);
 const result=spawnSync(process.execPath,[path.join(fixture,'scripts/bootstrap.mjs')],{cwd:fixture,encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,TMPDIR:fixture}});
 assert.equal(result.status,1);assert.match(result.stderr,/Upstream version drift in server/);assert.equal(await fs.readFile(packageFile,'utf8'),bytes);
 assert.deepEqual(await fs.readdir(path.dirname(packageFile)),['package.json'],'no source or native hydration operation ran');
});
test('exact receipt patch round-trips every pinned original and candidate without fuzzy application',async t=>{
 const fixture=await fs.mkdtemp(path.join(process.env.TMPDIR??root,'receipt-patch-'));t.after(()=>fs.rm(fixture,{recursive:true,force:true}));
 const host=path.join(fixture,'host');await fs.mkdir(host);const patchPath=path.join(fixture,'capture.patch');await fs.writeFile(patchPath,patch);
 for(const file of Object.keys(pins.files)){const dest=path.join(host,file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,'node_modules/@paperclipai/server',file),dest);}
 const run=(file,reverse=false,dry=false)=>{
  const result=spawnSync('patch',['--batch','--fuzz=0','--remove-empty-files',...(reverse?['--reverse']:['--forward']),...(dry?['--dry-run']:[]),'-p1','-d',host,'-i',file],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.doesNotMatch(result.stdout,/fuzz|offset/i);
 };
 // A reviewed additive member-route layer may be installed. Remove that layer
 // only inside the synthetic copy and only after matching both pinned hashes.
 const memberPins=JSON.parse(await fs.readFile(path.join(root,'patches/member-transport-pins.json'),'utf8'));
 for(const variant of Object.values(memberPins.variants)){
  if((await Promise.all(Object.entries(variant.files).map(async([file,pin])=>hash(await fs.readFile(path.join(host,file)))===pin.candidate_sha256))).every(Boolean)){
   run(path.join(root,'patches',variant.patch),true);break;
  }
 }
 for(const [file,pin] of Object.entries(pins.files))assert.equal(hash(await fs.readFile(path.join(host,file))),pin.candidate_sha256,file+' candidate');
 run(patchPath,true);
 for(const [file,pin] of Object.entries(pins.files)){
  if(pin.original_sha256===null)await assert.rejects(()=>fs.access(path.join(host,file)),{code:'ENOENT'});
  else assert.equal(hash(await fs.readFile(path.join(host,file))),pin.original_sha256,file+' original');
 }
 run(patchPath,false,true);run(patchPath);
 for(const [file,pin] of Object.entries(pins.files))assert.equal(hash(await fs.readFile(path.join(host,file))),pin.candidate_sha256,file+' patched');
});
