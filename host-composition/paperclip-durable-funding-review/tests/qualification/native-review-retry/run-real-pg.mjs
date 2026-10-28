// Own one synthetic cluster and test process. No shell, TCP listener, passwords, provider or production state.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
if(process.env.QUALIFY_DISPOSABLE!=='1'||process.getuid?.()!==1000)throw Error('Disposable uid1000 required');
const run=promisify(execFile),bin='/opt/host/node_modules/@embedded-postgres/linux-arm64/native/bin';
const base=await fs.mkdtemp('/tmp/native-parent-parity-pg-'),data=path.join(base,'data'),socket=path.join(base,'socket');
await fs.chmod(base,0o700);await fs.mkdir(socket,{mode:0o700});
const username=os.userInfo().username;
if(!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(username))throw Error('Unexpected disposable OS username');
const env={PATH:'/usr/bin:/bin',HOME:base,LANG:'C',LC_ALL:'C'};
let pg,tests,pgExit,testsExit;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const completion=p=>new Promise((resolve,reject)=>{p.once('exit',(code,signal)=>resolve({code,signal}));p.once('error',reject);});
async function stop(child,done,label){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}
  const first=await Promise.race([done.then(()=>true,()=>true),sleep(5000).then(()=>false)]);
  if(!first){console.error('[synthetic-real-pg] force-stop '+label);try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}await done;}
}
let cancelled=false;
const cancel=()=>{cancelled=true;for(const child of [tests,pg])if(child?.pid){try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}}};
process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
let result=1;
try{
  await run(path.join(bin,'initdb'),['-D',data,'--username='+username,'--auth-local=peer','--auth-host=reject','--encoding=UTF8','--no-locale'],{env,timeout:30000,maxBuffer:1024*1024});
  if(cancelled)throw Error('Cancelled before synthetic server start');
  pg=spawn(path.join(bin,'postgres'),['-D',data,'-h','','-k',socket,'-p','55432'],{env,detached:true,stdio:['ignore','inherit','inherit']});pgExit=completion(pg);pgExit.catch(()=>{});
  // initdb writes peer-local / reject-host HBA; empty listen_addresses disables TCP entirely.
  const ready=path.join(socket,'.s.PGSQL.55432');
  for(let n=0;;n++){
    if(cancelled||pg.exitCode!==null||pg.signalCode!==null)throw Error('Synthetic server stopped before readiness');
    try{await fs.stat(ready);break;}catch{}
    if(n>=200)throw Error('Synthetic server readiness deadline');
    await sleep(50);
  }
  const here=path.dirname(fileURLToPath(import.meta.url));
  const testEnv={...env,QUALIFY_DISPOSABLE:'1',QUALIFICATION_PUBLIC_ROOT:process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/admission-source',QUALIFICATION_NATIVE_ROOT:'/opt/host/node_modules',PARITY_PG_SOCKET:socket,REVIEW_RETRY_FIXTURE_MODULE:path.join(here,'native-fixture-real-pg.mjs')};
  console.error('[synthetic-real-pg] '+JSON.stringify({uid:process.getuid(),transport:'private-unix-socket',localAuth:'peer',hostAuth:'reject',tcp:false,testFileSha256:createHash('sha256').update(await fs.readFile(path.resolve(here,process.env.REVIEW_RETRY_ROUTE_TEST==='1'?'../../native-review-retry-route.test.mjs':'../../native-review-retry.test.mjs'))).digest('hex')}));
  tests=spawn(process.execPath,['--test','--test-force-exit','--test-concurrency=1','--test-timeout=90000',...(process.argv[2]?['--test-name-pattern='+process.argv[2]]:[]),path.resolve(here,process.env.REVIEW_RETRY_ROUTE_TEST==='1'?'../../native-review-retry-route.test.mjs':'../../native-review-retry.test.mjs')],{env:testEnv,detached:true,stdio:'inherit'});testsExit=completion(tests);
  const terminal=await testsExit;result=terminal.code??1;
}finally{
  // Attempt both owned-process teardowns and removal even after partial startup failure.
  const errors=[];
  try{await stop(tests,testsExit,'tests');}catch(e){errors.push(e);}
  try{await stop(pg,pgExit,'postgres');}catch(e){errors.push(e);}
  try{await fs.rm(base,{recursive:true,force:true});}catch(e){errors.push(e);}
  process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);
  console.error('[synthetic-real-pg] cluster removed');
  if(errors.length)throw new AggregateError(errors,'Synthetic launcher teardown failed');
}
process.exitCode=cancelled?130:result;
