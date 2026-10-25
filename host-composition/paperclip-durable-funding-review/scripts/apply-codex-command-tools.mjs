/** Exact-source restrictive adapter option. Never starts a runtime or changes auth/configuration. */
import fs from 'node:fs/promises';
import path from 'node:path';
import{fileURLToPath}from'node:url';
import{createHash}from'node:crypto';
import{spawnSync}from'node:child_process';
const root=await fs.realpath(fileURLToPath(new URL('../',import.meta.url)));
const native=path.join(root,'node_modules'),adapter=path.join(native,'@paperclipai/adapter-codex-local'),host=path.join(native,'@paperclipai/server');
const pins=JSON.parse(await fs.readFile(path.join(root,'patches/codex-command-tools-pins.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
if((await fs.realpath(native))!==native)throw Error('Refusing external/symlinked node_modules');
for(const dir of[adapter,host])if((await fs.lstat(dir)).isSymbolicLink()||!(await fs.realpath(dir)).startsWith(native+path.sep))throw Error('Refusing external/symlinked native package');
const pkg=JSON.parse(await fs.readFile(path.join(host,'package.json'))),build=JSON.parse(await fs.readFile(path.join(host,'dist/build-info.json'))),adapterPkg=JSON.parse(await fs.readFile(path.join(adapter,'package.json')));
if(pkg.version!==pins.packageVersion||build.commit!==pins.buildCommit||adapterPkg.version!==pins.adapterVersion)throw Error('Unqualified Paperclip/adapter build; no changes made');
const guard=path.join(host,pins.unchangedAuthGuard.file);
if((await fs.lstat(guard)).isSymbolicLink()||!(await fs.realpath(guard)).startsWith(host+path.sep)||sha(await fs.readFile(guard))!==pins.unchangedAuthGuard.sha256)throw Error('Unqualified managed auth guard; no changes made');
const states=[];
for(const[file,pin]of Object.entries(pins.files)){
 const p=path.join(adapter,file);
 if((await fs.lstat(p)).isSymbolicLink()||!(await fs.realpath(p)).startsWith(adapter+path.sep))throw Error('Refusing external/symlinked pinned adapter file');
 const hash=sha(await fs.readFile(p));states.push(hash===pin.base_sha256?'base':hash===pin.candidate_sha256?'patched':'drift');
}
if(states.includes('drift')||new Set(states).size!==1)throw Error('Unqualified or partial Codex command overlay; no changes made');
const patch=path.join(root,'patches',pins.patch);
if(sha(await fs.readFile(patch))!==pins.patch_sha256)throw Error('Codex command patch integrity failed; no changes made');
if(states[0]==='base')for(const dry of[true,false]){
 const result=spawnSync('patch',[...(dry?['--dry-run']:[]),'--batch','--forward','--fuzz=0','-p1','-d',adapter,'-i',patch],{stdio:'inherit'});
 if(result.error||result.status!==0)throw Error('Codex command overlay failed; do not start runtime');
}
for(const[file,pin]of Object.entries(pins.files))if(sha(await fs.readFile(path.join(adapter,file)))!==pin.candidate_sha256)throw Error('Codex command overlay verification failed; do not start runtime');
if(sha(await fs.readFile(guard))!==pins.unchangedAuthGuard.sha256)throw Error('Managed auth guard changed; do not start runtime');
console.log('Restrictive Codex command overlay verified; no deployment, authentication, configuration or inference.');
