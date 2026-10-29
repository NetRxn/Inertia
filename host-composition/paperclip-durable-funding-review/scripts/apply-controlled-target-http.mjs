/** Exact-image additive transport overlay; never configures admission or starts a target. */
import fs from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';import{spawnSync}from'node:child_process';
const root=await fs.realpath(fileURLToPath(new URL('../',import.meta.url))),native=path.join(root,'node_modules'),host=path.join(native,'@paperclipai/server');
const pins=JSON.parse(await fs.readFile(path.join(root,'patches/controlled-target-http-pins.json'))),sha=b=>createHash('sha256').update(b).digest('hex');
if(await fs.realpath(native)!==native||await fs.realpath(host)!==host)throw Error('Refusing external/symlinked native package');
async function safe(file,missing=false){
 if(typeof file!=='string'||path.isAbsolute(file)||file.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw Error('Refusing invalid pinned path');
 let current=host;const parts=file.split('/');
 for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);let stat;try{stat=await fs.lstat(current);}catch(e){if(missing&&i===parts.length-1&&e.code==='ENOENT')return null;throw e;}
  if(stat.isSymbolicLink()||await fs.realpath(current)!==current||(i<parts.length-1?!stat.isDirectory():!stat.isFile()))throw Error('Refusing external/symlinked pinned file');
 }return fs.readFile(current);
}
const pkg=JSON.parse(await safe('package.json')),build=JSON.parse(await safe('dist/build-info.json'));
if(pkg.version!==pins.packageVersion||build.commit!==pins.buildCommit)throw Error('Unqualified controlled transport host; no changes made');
const patch=path.join(root,'patches',pins.patch);
if(sha(await fs.readFile(patch))!==pins.patch_sha256)throw Error('Controlled transport patch integrity failed; no changes made');
const states=[];
for(const[file,pin]of Object.entries(pins.files)){const hash=sha(await safe(file));states.push(hash===pin.base_sha256?'base':hash===pin.candidate_sha256?'patched':'drift');}
for(const[file,pin]of Object.entries(pins.newFiles)){
 const source=path.join(root,pin.source);if(await fs.realpath(source)!==source||sha(await fs.readFile(source))!==pin.candidate_sha256)throw Error('Controlled transport module integrity failed; no changes made');
 const current=await safe(file,true);states.push(current===null?'base':sha(current)===pin.candidate_sha256?'patched':'drift');
}
if(states.includes('drift')||new Set(states).size!==1)throw Error('Unqualified or partial controlled transport overlay; no changes made');
if(states[0]==='base'){
 const check=spawnSync('patch',['--dry-run','--batch','--forward','--fuzz=0','-p1','-d',host,'-i',patch],{stdio:'inherit'});if(check.error||check.status!==0)throw Error('Controlled transport patch preflight failed');
 for(const[file,pin]of Object.entries(pins.newFiles))await fs.copyFile(path.join(root,pin.source),path.join(host,file));
 const apply=spawnSync('patch',['--batch','--forward','--fuzz=0','-p1','-d',host,'-i',patch],{stdio:'inherit'});if(apply.error||apply.status!==0)throw Error('Controlled transport patch failed; do not start host');
}
for(const[file,pin]of Object.entries({...pins.files,...pins.newFiles}))if(sha(await safe(file))!==pin.candidate_sha256)throw Error('Controlled transport verification failed; do not start host');
console.log('Exact controlled-target HTTP overlay verified; admission remains off without its host-owned file.');
