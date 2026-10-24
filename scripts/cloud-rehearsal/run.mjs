/** Owns all database/process lifetime. Does not accept a database URL or deploy. */
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,cp,symlink,rm,realpath} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=fileURLToPath(new URL('./',import.meta.url));
const root=fileURLToPath(new URL('../../',import.meta.url));
export function checkPrerequisites({version,env,platform,arch}) {
  if(version!=='2026.1012.0') throw Error('Expected pinned Paperclip 2026.1012.0');
  if(platform!=='linux'||arch!=='x64') throw Error('This qualification profile requires Linux x64');
  if(['DATABASE_URL','QUALIFICATION_DATABASE_URL','PGHOST','PGSERVICE','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGPASSFILE','PGSERVICEFILE'].some(k=>env[k]))
    throw Error('Refusing external database overrides; this harness owns its disposable database');
}
async function port() {
  const server=createServer(); await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  const value=server.address().port; await new Promise((yes,no)=>server.close(e=>e?no(e):yes()));return value;
}
async function main() {
  if(process.argv.length>2) throw Error('Usage: node scripts/cloud-rehearsal/run.mjs (no arguments)');
  const host=join(here,'host'),hostPackage=JSON.parse(await readFile(join(host,'node_modules/paperclipai/package.json'),'utf8'));
  checkPrerequisites({version:hostPackage.version,env:process.env,platform:process.platform,arch:process.arch});
  const pg=join(here,'node_modules/@embedded-postgres/linux-x64/native');
  const work=await mkdtemp(join(tmpdir(),'inertia-cloud-rehearsal-'));
  const out=await mkdtemp(join(root,'runs-cloud-rehearsal-'));
  const password=randomBytes(32).toString('hex'),pgPort=await port();
  const env={PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',HOME:join(work,'home'),PAPERCLIP_HOME:join(work,'home/paperclip'),LD_LIBRARY_PATH:join(pg,'lib'),HEARTBEAT_SCHEDULER_ENABLED:'false',PAPERCLIP_ANNOUNCEMENTS_ENABLED:'false',PAPERCLIP_MIGRATION_AUTO_APPLY:'true'};
  const run=async(name,exe,args,cwd=work,extra={})=>{
    try {const text=execFileSync(exe,args,{cwd,env:{...env,...extra},stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024});return writeFile(join(out,name+'.log'),text.replaceAll(password,'[fixture-password]'));}
    catch(e){const text=String(e.stdout??'')+'\n'+String(e.stderr??'');await writeFile(join(out,name+'.log'),text.replaceAll(password,'[fixture-password]'));throw Error(`${name} failed; inspect sanitized log`);}
  };
  const receipt={scope:'disposable-native-services',result:'running',hostVersion:hostPackage.version,fullHttp:false,ppc2Container:false,liveMemberEnrollment:false,productionReady:false};
  let knownStopped=true;
  try {
    await mkdir(env.HOME,{recursive:true});
    await writeFile(join(work,'pw'),password,{mode:0o600});
    await run('initdb',join(pg,'bin/initdb'),['-D',join(work,'db'),'-U','fixture','--auth-local=reject','--auth-host=scram-sha-256','--pwfile='+join(work,'pw'),'--encoding=UTF8','--locale=C']);
    knownStopped=false;
    await run('start',join(pg,'bin/pg_ctl'),['-D',join(work,'db'),'-o',`-h 127.0.0.1 -p ${pgPort} -c unix_socket_directories=''`,'-l',join(work,'postgres.log'),'start']);
    const url=`postgres://fixture:${password}@127.0.0.1:${pgPort}/postgres`;
    const local=join(work,'host');await mkdir(join(local,'plugin'),{recursive:true});
    await symlink(join(host,'node_modules'),join(local,'node_modules'),'dir');
    for(const f of ['qualify-runtime.mjs','migration-inventory.mjs','check-host-binding.mjs','check-native-members.mjs','check-member-boundary.mjs','check-pg-recovery.mjs'])await cp(join(here,f),join(local,f));
    for(const f of ['package.json','README.md','LICENSE','migrations','docs','dist/src'])await cp(join(root,f),join(local,'plugin',f),{recursive:true});
    await symlink(join(root,'node_modules'),join(local,'plugin/node_modules'),'dir');
    const dbEnv={QUALIFICATION_DATABASE_URL:url};
    await run('migrations',process.execPath,['--input-type=module','-e',"import {applyPendingMigrations} from '@paperclipai/db'; await applyPendingMigrations(process.env.QUALIFICATION_DATABASE_URL)"],local,dbEnv);
    await run('native',process.execPath,['qualify-runtime.mjs'],local,dbEnv);
    await run('seed',process.execPath,['check-pg-recovery.mjs','seed'],local,dbEnv);
    await run('crash',join(pg,'bin/pg_ctl'),['-D',join(work,'db'),'-m','immediate','stop']);
    knownStopped=false;
    await run('restart',join(pg,'bin/pg_ctl'),['-D',join(work,'db'),'-o',`-h 127.0.0.1 -p ${pgPort} -c unix_socket_directories=''`,'-l',join(work,'postgres.log'),'start']);
    await run('recover',process.execPath,['check-pg-recovery.mjs','recover'],local,dbEnv);
    receipt.result='passed';receipt.scramFixture=true;receipt.crashRecovery=true;
  } catch(error) {
    receipt.result='failed'; throw error;
  } finally {
    await cleanupOwned({
      inspect:()=>inspectOwnedPostgres(work,pg,env,knownStopped),
      stop:async()=>{await run('stop',join(pg,'bin/pg_ctl'),['-D',join(work,'db'),'-m','fast','stop']);knownStopped=true;},
      remove:async()=>{
        const log=await readFile(join(work,'postgres.log'),'utf8').catch(()=> '');
        await writeFile(join(out,'postgres.log'),log.replaceAll(password,'[fixture-password]'));
        await rm(work,{recursive:true,force:true});
      },receipt});
    if(!receipt.cleaned) {
      receipt.retainedWorkspace=work;
      const log=await readFile(join(work,'postgres.log'),'utf8').catch(()=> '');
      await writeFile(join(out,'postgres.log'),log.replaceAll(password,'[fixture-password]'));
    }
    receipt.hostLockSha256=createHash('sha256').update(await readFile(join(host,'package-lock.json'))).digest('hex');
    await writeFile(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
    console.log(JSON.stringify({result:receipt.result,evidence:out}));
    if(receipt.result!=='passed') throw Error('Qualification or owned cleanup failed; inspect written receipt');
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error(e.message);process.exitCode=1;});

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
