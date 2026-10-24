/** Patches only an explicitly selected, pinned local qualification installation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const here=fileURLToPath(new URL('./',import.meta.url));
if(process.argv.length>3)throw Error('Usage: node member/bootstrap.mjs [local @paperclipai/server directory]');
const host=path.resolve(process.argv[2]??path.join(here,'../node_modules/@paperclipai/server'));
if(await fs.realpath(host)!==host||!host.endsWith('/node_modules/@paperclipai/server'))throw Error('Refusing a symlinked or non-local native host installation');
const pins=JSON.parse(await fs.readFile(path.join(here,'patches/pins.json'),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const metadata=JSON.parse(await fs.readFile(path.join(host,'package.json'),'utf8'));const build=JSON.parse(await fs.readFile(path.join(host,'dist/build-info.json'),'utf8'));
if(metadata.version!==pins.packageVersion||build.commit!==pins.buildCommit)throw Error('Native source/build drift; requalify before patching');
const patch=path.join(here,'patches/native-attempt.patch');if(digest(await fs.readFile(patch))!==pins.patchSha256)throw Error('Native attempt patch fingerprint mismatch');
const states=[];for(const [file,pin] of Object.entries(pins.files)){const actual=digest(await fs.readFile(path.join(host,file)));states.push(actual===pin.originalSha256?'original':actual===pin.candidateSha256?'candidate':'unknown');}
if(states.some(s=>s==='unknown')||new Set(states).size!==1)throw Error('Mixed or unknown native attempt source; no files patched');
if(states[0]==='original'){const result=spawnSync('patch',['--batch','--forward','-p1','-i',patch],{cwd:host,stdio:'inherit'});if(result.status!==0)throw Error('Local native attempt patch failed');}
for(const [file,pin] of Object.entries(pins.files))if(digest(await fs.readFile(path.join(host,file)))!==pin.candidateSha256)throw Error('Native attempt candidate verification failed');
console.log('PINNED_MEMBER_ATTEMPT_SOURCE_VERIFIED (source only, no activation)');
