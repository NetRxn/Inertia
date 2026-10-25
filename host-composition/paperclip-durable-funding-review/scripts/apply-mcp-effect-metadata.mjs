/** Exact-source additive repair for plugin-only runtime delivery. No host, grant,
 * credential, gateway or provider is activated by this filesystem operation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const host=path.join(root,'node_modules/@paperclipai/server');
const pins=JSON.parse(await fs.readFile(path.join(root,'patches/mcp-effect-metadata-pins.json'),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const realHost=await fs.realpath(host);
if(!realHost.startsWith(path.join(root,'node_modules')+path.sep))throw Error('Refusing external/symlinked host');
const pkg=JSON.parse(await fs.readFile(path.join(host,'package.json'),'utf8'));
const build=JSON.parse(await fs.readFile(path.join(host,'dist/build-info.json'),'utf8'));
if(pkg.version!==pins.packageVersion||build.commit!==pins.buildCommit)throw Error('Unqualified Paperclip build; requalify before overlay');
const states=[];
for(const [file,pin] of Object.entries(pins.files)){
 const target=path.join(host,file);
 if((await fs.lstat(target)).isSymbolicLink()||!(await fs.realpath(target)).startsWith(realHost+path.sep))throw Error('Refusing external/symlinked pinned file');
 const actual=sha(await fs.readFile(target));
 states.push(actual===pin.candidate_sha256?'patched':actual===pin.base_sha256?'base':'drift');
}
if(states.includes('drift')||new Set(states).size!==1)throw Error('Unqualified or partial MCP effect metadata overlay; no changes made');
const patch=path.join(root,'patches',pins.patch);
if(sha(await fs.readFile(patch))!==pins.patch_sha256)throw Error('MCP effect metadata patch integrity failed; no changes made');
if(states[0]==='base')for(const dry of [true,false]){
 const result=spawnSync('patch',[...(dry?['--dry-run']:[]),'--batch','--forward','--fuzz=0','-p1','-d',host,'-i',patch],{stdio:'inherit'});
 if(result.error||result.status!==0)throw Error('MCP effect metadata overlay failed; do not start host');
}
for(const [file,pin] of Object.entries(pins.files))if(sha(await fs.readFile(path.join(host,file)))!==pin.candidate_sha256)throw Error('MCP effect metadata verification failed; do not start host');
console.log('MCP effect metadata delivery overlay verified. No live activation, grants, credentials or provider calls.');
