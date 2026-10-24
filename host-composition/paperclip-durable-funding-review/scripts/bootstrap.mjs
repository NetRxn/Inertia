// Operates only in this bundle's local node_modules, never a global/remote host.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(root,'patches/pinned-files.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(command,args,options={}){const result=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});if(result.error)throw result.error;if(result.status!==0)throw Error(`${command} failed; no server was started.`);}
for(const pkg of ['server','db','shared','plugin-sdk']){
 const data=JSON.parse(await fs.readFile(path.join(root,'node_modules/@paperclipai',pkg,'package.json'),'utf8'));
 if(data.version!==manifest.packageVersion)throw Error(`Upstream version drift in ${pkg}: ${data.version}; requalify before patching. This is a qualified baseline, not a permanent pin policy.`);
}
const host=path.join(root,'node_modules/@paperclipai/server');
const realHost=await fs.realpath(host);
if(!realHost.startsWith(path.join(root,'node_modules')+path.sep))throw Error('Refusing to patch a symlinked/external Paperclip host. Install a local copy with npm ci.');
const build=JSON.parse(await fs.readFile(path.join(host,'dist/build-info.json'),'utf8'));
if(build.commit!==manifest.buildCommit)throw Error('Upstream build fingerprint drift; requalify before patching.');
const states=[];
for(const [file,pin] of Object.entries(manifest.files)){
 let actual=null;try{actual=sha(await fs.readFile(path.join(host,file)));}catch(e){if(e.code!=='ENOENT')throw e;}
 states.push(actual===pin.candidate_sha256?'patched':actual===pin.original_sha256?'original':'drift');
}
if(states.includes('drift') || new Set(states).size>1)throw Error('Upstream source drift or partial patch detected. Refusing fuzzy/partial application; start from fresh qualified upstream and requalify.');
if(states.every(s=>s==='original')){
 const patch=path.join(root,'patches/paperclip-2026.1012.0-durable-capture.patch');
 run('patch',['--dry-run','--batch','--forward','--fuzz=0','-p1','-d',host,'-i',patch]);
 run('patch',['--batch','--forward','--fuzz=0','-p1','-d',host,'-i',patch]);
}
for(const [file,pin] of Object.entries(manifest.files))if(sha(await fs.readFile(path.join(host,file)))!==pin.candidate_sha256)throw Error(`Patched file verification failed: ${file}`);
const hydrate=path.join(root,'node_modules/@embedded-postgres/linux-x64/scripts/hydrate-symlinks.js');
if(sha(await fs.readFile(hydrate))!=='3596fdda55321a3672bd77bcaecf00d46462914409346ccfa1932a19c5977e11')throw Error('Native dependency hydration script drift; requalify before running it.');
const pgPackage=path.dirname(path.dirname(hydrate));
if(!(await fs.realpath(pgPackage)).startsWith(path.join(root,'node_modules')+path.sep))throw Error('Refusing to hydrate an external/symlinked PostgreSQL package. Install locally with npm ci.');
if(sha(await fs.readFile(path.join(pgPackage,'native/pg-symlinks.json')))!=='6df282b1c8c110b362de2f5f514716703ccd067bf16787a8282f0e06ac3e37d2')throw Error('Native symlink manifest drift; requalify before hydration.');
run(process.execPath,[hydrate],{cwd:pgPackage});
run(process.execPath,[path.join(root,'scripts/verify-pg.mjs')]);
console.log('Qualified baseline patch verified locally. No host started, route activated, retention policy approved, or production database modified. Check upstream regularly; upgrades require requalification.');
