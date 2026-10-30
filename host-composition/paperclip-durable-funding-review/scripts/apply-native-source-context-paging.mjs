/** Exact-source restrictive native overlay. Does not configure, start or authenticate a service. */
import fs from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';import{spawnSync}from'node:child_process';
const root=await fs.realpath(fileURLToPath(new URL('../',import.meta.url))),native=path.join(root,'node_modules'),host=path.join(native,'@paperclipai/server');
const pins=JSON.parse(await fs.readFile(path.join(root,'patches/native-source-context-paging-pins.json'))),sha=b=>createHash('sha256').update(b).digest('hex');
if(await fs.realpath(native)!==native||await fs.realpath(host)!==host)throw Error('Refusing external/symlinked native package');
async function safe(file,allowMissing=false){
 if(typeof file!=='string'||path.isAbsolute(file)||file.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw Error('Refusing invalid pinned path');
 let p=host;const parts=file.split('/');
 for(let i=0;i<parts.length;i++){p=path.join(p,parts[i]);let s;try{s=await fs.lstat(p);}catch(e){if(allowMissing&&i===parts.length-1&&e.code==='ENOENT')return null;throw e;}
  if(s.isSymbolicLink()||await fs.realpath(p)!==p||(i<parts.length-1?!s.isDirectory():!s.isFile()))throw Error('Refusing external/symlinked pinned file');
 }
 return fs.readFile(p);
}
const pkg=JSON.parse(await safe('package.json')),build=JSON.parse(await safe('dist/build-info.json'));
if(pkg.version!==pins.packageVersion||build.commit!==pins.buildCommit)throw Error('Unqualified native build; no changes made');
if(sha(await safe(pins.unchangedAuthGuard.file))!==pins.unchangedAuthGuard.sha256)throw Error('Unqualified managed auth guard; no changes made');
for(const [file,digest] of Object.entries(pins.unchangedGuards))if(sha(await safe(file))!==digest)throw Error('Unqualified attention deadline security guard; no changes made');
const states=[];
for(const[file,p]of Object.entries(pins.files)){const hash=sha(await safe(file));states.push(hash===p.base_sha256?'base':hash===p.candidate_sha256?'patched':'drift');}
for(const[file,p]of Object.entries(pins.newFiles)){const bytes=await safe(file,true);states.push(bytes===null?'base':sha(bytes)===p.candidate_sha256?'patched':'drift');}
if(states.includes('drift')||new Set(states).size!==1)throw Error('Unqualified or partial source context paging overlay; no changes made');
const patch=path.join(root,'patches',pins.patch);
if(sha(await fs.readFile(patch))!==pins.patch_sha256)throw Error('Source context paging patch integrity failed; no changes made');
if(states[0]==='base')for(const dry of[true,false]){const r=spawnSync('patch',[...(dry?['--dry-run']:[]),'--batch','--forward','--fuzz=0','-p1','-d',host,'-i',patch],{stdio:'inherit'});if(r.error||r.status!==0)throw Error('Source context paging overlay failed; do not start runtime');}
for(const[file,p]of Object.entries({...pins.files,...pins.newFiles}))if(sha(await safe(file))!==p.candidate_sha256)throw Error('Source context paging overlay verification failed; do not start runtime');
if(sha(await safe(pins.unchangedAuthGuard.file))!==pins.unchangedAuthGuard.sha256)throw Error('Managed auth guard changed; do not start runtime');
for(const [file,digest] of Object.entries(pins.unchangedGuards))if(sha(await safe(file))!==digest)throw Error('Permission security guard changed; do not start runtime');
console.log('Restrictive Source context paging overlay verified; no deployment, configuration, credentials or inference.');
