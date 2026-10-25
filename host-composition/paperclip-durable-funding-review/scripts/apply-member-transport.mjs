/** Temporary additive compatibility overlay for two exact supported source trees.
 * Run AFTER the original bootstrap (and Task2 bootstrap, when present). Never a
 * version updater: unknown, mixed or partially patched trees fail without writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),host=path.join(root,'node_modules/@paperclipai/server');
const pins=JSON.parse(await fs.readFile(path.join(root,'patches/member-transport-pins.json'),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
if(!(await fs.realpath(host)).startsWith(path.join(root,'node_modules')+path.sep))throw Error('Refusing external/symlinked host');
const pkg=JSON.parse(await fs.readFile(path.join(host,'package.json'),'utf8'));
const build=JSON.parse(await fs.readFile(path.join(host,'dist/build-info.json'),'utf8'));
if(pkg.version!==pins.packageVersion||build.commit!==pins.buildCommit)throw Error('Unqualified host version; requalify before overlay');
const actual=Object.fromEntries(await Promise.all(['dist/app.js','dist/app.d.ts'].map(async name=>[name,sha(await fs.readFile(path.join(host,name)))])));
let selected;
for(const [name,variant] of Object.entries(pins.variants)){
 if(Object.entries(variant.files).every(([file,pin])=>actual[file]===pin.candidate_sha256)){console.log('Member transport overlay already verified: '+name);process.exit(0);}
 if(Object.entries(variant.files).every(([file,pin])=>actual[file]===pin.base_sha256))selected={name,...variant};
}
if(!selected)throw Error('Unqualified or partial member transport host; no changes made');
const patch=path.join(root,'patches',selected.patch);
if(sha(await fs.readFile(patch))!==selected.patch_sha256)throw Error('Member overlay patch integrity failed');
for(const dry of [true,false]){
 const result=spawnSync('patch',[...(dry?['--dry-run']:[]),'--batch','--forward','--fuzz=0','-p1','-d',host,'-i',patch],{stdio:'inherit'});
 if(result.error||result.status!==0)throw Error('Member overlay failed; host must not start');
}
for(const [file,pin] of Object.entries(selected.files))if(sha(await fs.readFile(path.join(host,file)))!==pin.candidate_sha256)throw Error('Member overlay verification failed; host must not start');
console.log('Additive member transport overlay verified: '+selected.name+'. No activation or schedule.');
