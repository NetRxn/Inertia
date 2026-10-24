/** Owns fresh SCRAM PostgreSQL start/use/stop in one command namespace. */
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanupOwned,inspectOwnedPostgres} from './owned-postgres.mjs';
import {loadConfig} from './config.mjs';
const here=dirname(fileURLToPath(import.meta.url));
if(process.argv.length!==2)throw Error('No arguments allowed; configure explicit existing paths with environment variables');
const config=await loadConfig(process.env);
const root=config.inertiaRoot,host=config.hostRoot,pg=config.pgRoot,version=config.version;
const work=await mkdtemp(join(tmpdir(),'meeting-decision-owned-')),out=await mkdtemp(join(config.outRoot,'run-'));
await writeFile(join(work,'config.json'),JSON.stringify(config));
await writeFile(join(out,'configuration.json'),JSON.stringify(config,null,2)+'\n');
const server=createServer();await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});const port=server.address().port;await new Promise(ok=>server.close(ok));
const password=randomBytes(32).toString('hex');
const env={PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',HOME:join(work,'home'),PAPERCLIP_HOME:join(work,'home/paperclip'),LD_LIBRARY_PATH:join(pg,'lib'),HEARTBEAT_SCHEDULER_ENABLED:'false',PAPERCLIP_ANNOUNCEMENTS_ENABLED:'false',PAPERCLIP_MIGRATION_AUTO_APPLY:'true',MEETING_WORK:work,MEETING_OUT:out,MEETING_CONFIG_PATH:join(work,'config.json')};
const receipt={result:'running',hostVersion:version,fullHttp:false,syntheticOnly:true};let stopped=true;
async function run(name,exe,args,cwd=root,extra={}){try{const value=execFileSync(exe,args,{cwd,env:{...env,...extra},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:240000,maxBuffer:20*1024*1024});await writeFile(join(out,name+'.log'),value.replaceAll(password,'[fixture-password]'));}catch(e){await writeFile(join(out,name+'.log'),(String(e.stdout??'')+'\n'+String(e.stderr??'')).replaceAll(password,'[fixture-password]'));throw Error(name+' failed; inspect '+join(out,name+'.log'));}}
try{
 await run('inertia-build',process.execPath,[join(root,'node_modules/typescript/bin/tsc')],root);
 await mkdir(env.HOME,{recursive:true});await writeFile(join(work,'pw'),password,{mode:0o600});
 await run('initdb',join(pg,'bin/initdb'),['-D',join(work,'db'),'-U','fixture','--auth-local=reject','--auth-host=scram-sha-256','--pwfile='+join(work,'pw'),'--encoding=UTF8','--locale=C']);
 stopped=false;await run('start',join(pg,'bin/pg_ctl'),['-D',join(work,'db'),'-o',`-h 127.0.0.1 -p ${port} -c unix_socket_directories=''`,'-l',join(work,'postgres.log'),'start']);
 const dbEnv={QUALIFICATION_DATABASE_URL:`postgres://fixture:${password}@127.0.0.1:${port}/postgres`};
 await run('migrations',process.execPath,['--input-type=module','-e',"import {applyPendingMigrations} from '@paperclipai/db'; await applyPendingMigrations(process.env.QUALIFICATION_DATABASE_URL)"],host,dbEnv);
 await run('integration',process.execPath,[join(here,'runtime.mjs')],root,dbEnv);
 receipt.result='passed';
}catch(e){receipt.result='failed';receipt.error=e.message;console.error(e.message);}
finally{
 await cleanupOwned({inspect:()=>inspectOwnedPostgres(work,pg,env,stopped),stop:async()=>{await run('stop',join(pg,'bin/pg_ctl'),['-D',join(work,'db'),'-m','fast','stop']);stopped=true;},remove:async()=>{await writeFile(join(out,'postgres.log'),(await readFile(join(work,'postgres.log'),'utf8').catch(()=>'' )).replaceAll(password,'[fixture-password]'));await rm(work,{recursive:true,force:true});},receipt});
 if(!receipt.cleaned)receipt.retainedWorkspace=work;
 await writeFile(join(out,'lifecycle.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:receipt.result,evidence:out}));if(receipt.result!=='passed')process.exitCode=1;
}
