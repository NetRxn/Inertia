// Exact qualified helper bodies copied from cloud-rehearsal/run.mjs.
import {execFileSync} from 'node:child_process';
import {readFile,realpath} from 'node:fs/promises';
import {join} from 'node:path';
export function checkPrerequisites({version,env,platform,arch}) {
  if(version!=='2026.1012.0') throw Error('Expected pinned Paperclip 2026.1012.0');
  if(platform!=='linux'||arch!=='x64') throw Error('This qualification profile requires Linux x64');
  if(['DATABASE_URL','QUALIFICATION_DATABASE_URL','PGHOST','PGSERVICE','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGPASSFILE','PGSERVICEFILE'].some(k=>env[k]))
    throw Error('Refusing external database overrides; this harness owns its disposable database');
}
export async function inspectOwnedPostgres(work,pg,env,missingIsStopped=false) {
  const data=join(work,'db');
  let lines;
  try {lines=(await readFile(join(data,'postmaster.pid'),'utf8')).split('\n');}
  catch(e){return e.code==='ENOENT'&&missingIsStopped?'stopped':'unknown';}
  if(lines[1]!==data||!/^\d+$/.test(lines[0]))return 'unknown';
  const pid=Number(lines[0]);
  let args;
  try {args=(await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0');}
  catch(e){return e.code==='ENOENT'?'stopped':'unknown';}
  try {
    if(await realpath(args[0])!==await realpath(join(pg,'bin/postgres'))||args.indexOf('-D')<0||args[args.indexOf('-D')+1]!==data)return 'unknown';
    // pg_ctl must agree with the owned PID/datadir inspection.
    execFileSync(join(pg,'bin/pg_ctl'),['-D',data,'status'],{env,stdio:'pipe',timeout:10000});
    return 'running';
  } catch {return 'unknown';}
}
export async function cleanupOwned({inspect,stop,remove,receipt}) {
  receipt.cleaned=false;
  try {
    let state=await inspect();
    if(state==='running') {
      try {await stop();} catch {receipt.cleanupError='Owned server stop failed';}
      state=await inspect();
    }
    if(state!=='stopped') {
      receipt.cleanupError ??= 'Owned server state or identity is uncertain';
      receipt.result='failed'; return;
    }
    await remove();receipt.cleaned=true;
    if(receipt.cleanupError)receipt.result='failed';
  } catch {
    receipt.cleanupError='Owned workspace cleanup failed';receipt.result='failed';
  }
}
