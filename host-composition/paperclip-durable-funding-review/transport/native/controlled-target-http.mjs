/** Host-only, default-off local preprod transport. Never grants arbitrary private egress. */
import {constants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {isAbsolute,normalize} from 'node:path';
import {isIP} from 'node:net';
import {request} from 'node:https';
import {checkServerIdentity} from 'node:tls';
import {createHash} from 'node:crypto';
const ENV='PAPERCLIP_INERTIA_CONTROLLED_HTTP_TARGETS_FILE';
const deny=()=>{throw Error('controlled_http_admission_denied');};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join() === [...keys].sort().join();
const sha=b=>createHash('sha256').update(b).digest('hex');
const privateAddress=v=>isIP(v)===4&&(v.startsWith('127.')||v.startsWith('10.')||v.startsWith('192.168.')||v.startsWith('172.')&&Number(v.split('.')[1])>=16&&Number(v.split('.')[1])<=31);
async function admission(){
 const file=process.env[ENV];if(file===undefined)return null;
 let handle;
 try{
  if(!isAbsolute(file)||normalize(file)!==file||/[\x00-\x1f\x7f]/.test(file)||file.length>4096||await realpath(file)!==file)deny();
  const before=await lstat(file);
  if(!before.isFile()||before.size<1||before.size>65536||(before.mode&0o077)!==0||before.uid!==process.getuid?.())deny();
  handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const initial=await handle.stat();
  if(initial.ino!==before.ino||initial.dev!==before.dev||initial.size!==before.size||!initial.isFile()||(initial.mode&0o077)!==0||initial.uid!==before.uid)deny();
  const bytes=Buffer.alloc(initial.size+1);let offset=0;
  while(offset<bytes.length){const r=await handle.read(bytes,offset,bytes.length-offset,offset);if(!r.bytesRead)break;offset+=r.bytesRead;}
  const after=await handle.stat(),pathAfter=await lstat(file);
  if(offset!==initial.size||after.size!==initial.size||after.mtimeMs!==initial.mtimeMs||after.ctimeMs!==initial.ctimeMs||pathAfter.ino!==initial.ino||pathAfter.dev!==initial.dev||!pathAfter.isFile()||(pathAfter.mode&0o077)!==0||await realpath(file)!==file)deny();
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,offset)));
  if(!exact(value,['version','environment','expiresAt','targets'])||value.version!==1||value.environment!=='controlled-local-preprod'||typeof value.expiresAt!=='string'||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<=Date.now()||!Array.isArray(value.targets)||value.targets.length<1||value.targets.length>2)deny();
  const seen=new Set();
  for(const t of value.targets){
   if(!exact(t,['pluginId','pluginKey','purpose','origin','connectAddress','caPem','timeoutMs'])||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t.pluginId)||t.pluginKey!=='netrxn.inertia'||!['roundtable-website','buzz-relay'].includes(t.purpose)||typeof t.origin!=='string'||!privateAddress(t.connectAddress)||typeof t.caPem!=='string'||t.caPem.length<64||t.caPem.length>16384||!t.caPem.includes('-----BEGIN CERTIFICATE-----')||!Number.isSafeInteger(t.timeoutMs)||t.timeoutMs<100||t.timeoutMs>15000)deny();
   const u=new URL(t.origin);
   if(u.protocol!=='https:'||u.origin!==t.origin||u.username||u.password||isIP(u.hostname)&&u.hostname!==t.connectAddress)deny();
   const key=t.pluginId+':'+t.purpose;if(seen.has(key))deny();seen.add(key);
  }
  return{value,digest:sha(bytes.subarray(0,offset))};
 }catch{deny();}finally{await handle?.close();}
}
function route(target,url,init){
 if(url.username||url.password||url.search||url.hash||url.pathname.includes('%')||url.pathname.includes('//'))deny();
 const method=init?.method??'GET';
 const website=target.purpose==='roundtable-website';
 if(website?!(method==='GET'&&/^\/api\/integrations\/v1\/roundtables\/operations\/[a-f0-9]{64}$/.test(url.pathname)||method==='POST'&&url.pathname==='/api/integrations/v1/roundtables/publications'):!(method==='POST'&&['/query','/events'].includes(url.pathname)))deny();
 const headers=new Headers(init?.headers),allowed=website?['authorization','content-type','idempotency-key','if-match','if-none-match']:['authorization','content-type'];
 for(const[k,v]of headers){if(!allowed.includes(k)||v.length>16384)deny();}
 const auth=headers.get('authorization');if(!auth||!(website?/^Bearer [A-Za-z0-9\-._~+/]+=*$/:/^Nostr [A-Za-z0-9+/]+=*$/).test(auth))deny();
 const body=init?.body;
 if(method==='GET'){if(body!==undefined&&body!==null)deny();}
 else if(typeof body!=='string'||!/^application\/json(?:; charset=utf-8)?$/i.test(headers.get('content-type')??'')||Buffer.byteLength(body)> (website?4*1024*1024:65536))deny();
 if(website&&method==='POST'&&(!/^[a-f0-9]{64}$/.test(headers.get('idempotency-key')??'')||!((headers.get('if-none-match')==='*'&&!headers.has('if-match'))||/^"[a-f0-9]{64}"$/.test(headers.get('if-match')??'')&&!headers.has('if-none-match'))))deny();
 headers.set('host',url.host);headers.set('connection','close');if(typeof body==='string')headers.set('content-length',String(Buffer.byteLength(body)));
 return{method,headers:Object.fromEntries(headers.entries()),body:typeof body==='string'?body:undefined,limit:website?4*1024*1024+65536:1024*1024};
}
/** Returns null only for an unconfigured target so the unchanged public validator still runs. */
export async function controlledTargetHttp({pluginId,pluginKey,url,init}){
 if(pluginKey!=='netrxn.inertia')return null;
 const config=await admission();if(!config)return null;
 let parsed;try{parsed=new URL(url);}catch{deny();}
 const targets=config.value.targets.filter(t=>t.pluginId===pluginId&&t.pluginKey===pluginKey&&t.origin===parsed.origin);
 if(!targets.length)return null;
 const matches=targets.filter(t=>t.purpose==='roundtable-website'?parsed.pathname.startsWith('/api/integrations/v1/roundtables/'):['/query','/events'].includes(parsed.pathname));
 if(matches.length!==1)deny();const target=matches[0],wire=route(target,parsed,init);
 const fresh=async()=>{const next=await admission();if(!next||next.digest!==config.digest)deny();};
 await fresh();
 try{
  const result=await new Promise((resolve,reject)=>{
   let settled=false;
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(Error('controlled_http_request_unconfirmed')):resolve(value);};
   const req=request({protocol:'https:',host:target.connectAddress,port:Number(parsed.port||443),path:parsed.pathname,method:wire.method,headers:wire.headers,ca:target.caPem,minVersion:'TLSv1.2',rejectUnauthorized:true,servername:isIP(parsed.hostname)?undefined:parsed.hostname,checkServerIdentity:(_hostname,certificate)=>checkServerIdentity(parsed.hostname,certificate),agent:false},response=>{
    if((response.statusCode??500)>=300&&(response.statusCode??500)<400||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity'){response.destroy();req.destroy();finish(Error());return;}
    const length=response.headers['content-length'];if(length&&(!/^\d+$/.test(length)||Number(length)>wire.limit)){response.destroy();req.destroy();finish(Error());return;}
    const chunks=[];let size=0;
    response.on('data',chunk=>{size+=chunk.length;if(size>wire.limit){chunks.length=0;response.destroy();req.destroy();finish(Error());}else chunks.push(Buffer.from(chunk));});
    response.on('error',()=>finish(Error()));response.on('aborted',()=>finish(Error()));
    response.on('end',()=>{try{const body=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));const headers={};for(const[k,v]of Object.entries(response.headers))if(v!==undefined)headers[k]=Array.isArray(v)?v.join(', '):v;finish(null,{status:response.statusCode??500,statusText:response.statusMessage??'',headers,body});}catch{finish(Error());}});
   });
   const timer=setTimeout(()=>{req.destroy();finish(Error());},target.timeoutMs);
   req.on('error',()=>finish(Error()));
   req.on('socket',socket=>socket.once('secureConnect',()=>{fresh().then(()=>{if(!settled)req.end(wire.body);},()=>{req.destroy();finish(Error());});}));
  });
  await fresh();return result;
 }catch{throw Error('controlled_http_request_unconfirmed');}
}
