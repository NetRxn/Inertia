/** Fixed member v2 wire rules only. No credentials, grants, state or effects. */
export const MEMBER_MOUNT='/api/member-packet-transport';
export const MEMBER_DOMAIN_MOUNT='/member-packet-transport';
export const MAX_RESPONSE_BYTES=1024*1024, MAX_REQUEST_BYTES=8192, MAX_SOURCE_BYTES=32768, MAX_PAGE_SIZE=32;
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SCOPE_KEYS=['schema','purpose','sourceId','destinationId','companyId','applicantId','applicationId','opportunityNamespace','opportunityExternalId','sourceScope'];
export function need(value,message='Member transport unavailable'){if(!value)throw Error(message);}
export function exact(value,keys){need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)));return value;}
export function identifier(value){need(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value));return value;}
export function snapshotMemberScope(raw){const scope=exact(structuredClone(raw),SCOPE_KEYS);for(const key of SCOPE_KEYS)identifier(scope[key]);need(scope.schema==='inertia.member-packet-transport-scope.v2'&&scope.purpose==='member-packet-review'&&UUID.test(scope.companyId));return Object.freeze(scope);}
export function policyScope(scope){return Object.fromEntries(SCOPE_KEYS.slice(4).map(key=>[key,scope[key]]));}

export function snapshotMemberCursor(raw){
 const cursor=exact(structuredClone(raw),['createdAt','id']);need(typeof cursor.id==='string'&&UUID.test(cursor.id)&&typeof cursor.createdAt==='string'&&/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/.test(cursor.createdAt));
 need(new Date(cursor.createdAt).toISOString().slice(0,19)===cursor.createdAt.slice(0,19));return Object.freeze(cursor);
}
export function compareMemberCursor(a,b){return a.createdAt<b.createdAt?-1:a.createdAt>b.createdAt?1:a.id<b.id?-1:a.id>b.id?1:0;}

/** Scan the bounded wire before JSON.parse so duplicate keys cannot be hidden by
 * last-key-wins decoding. JSON.parse still owns JSON lexical/number validation. */
export function parseMemberTransportJson(text){
 need(typeof text==='string'&&text.isWellFormed()&&Buffer.byteLength(text,'utf8')<=MAX_RESPONSE_BYTES);
 let i=0;const white=()=>{while(/[\t\n\r ]/.test(text[i]??'!'))i++;};
 const string=()=>{need(text[i]==='"');const start=i++;while(i<text.length){const c=text[i++];if(c==='\\'){i++;continue;}if(c==='"'){const value=JSON.parse(text.slice(start,i));need(value.isWellFormed());return value;}}throw Error('Invalid member JSON');};
 function value(depth){
  need(depth<=16);white();const c=text[i];
  if(c==='"'){string();return;}
  if(c==='{'||c==='['){const object=c==='{',end=object?'}':']',keys=new Set();i++;white();if(text[i]===end){i++;return;}
   for(;;){white();if(object){const key=string();need(!keys.has(key));keys.add(key);white();need(text[i++]===':');}value(depth+1);white();if(text[i]===end){i++;return;}need(text[i++]===',');}
  }
  const start=i;while(i<text.length&&!/[\t\n\r ,\]}]/.test(text[i]))i++;need(i>start);const primitive=JSON.parse(text.slice(start,i));need(primitive===null||typeof primitive==='boolean'||typeof primitive==='number'&&Number.isSafeInteger(primitive));
 }
 value(0);white();need(i===text.length);return JSON.parse(text);
}
export function trustedEndpoint(raw,mount,fixtureLoopback){
 need(typeof raw==='string'&&Buffer.byteLength(raw,'utf8')<=2048);const url=new URL(raw);
 need(!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname.replace(/\/$/,'')===mount);
 need(url.protocol==='https:'||fixtureLoopback===true&&url.protocol==='http:'&&url.hostname==='127.0.0.1');return url.origin+mount;
}
export async function boundedMemberJson(response){
 need(response.status===200&&response.headers.get('content-type')?.toLowerCase().startsWith('application/json'));
 need(!response.headers.get('content-encoding')||response.headers.get('content-encoding')==='identity');
 const declared=response.headers.get('content-length');need(!declared||/^[0-9]+$/.test(declared)&&Number(declared)<=MAX_RESPONSE_BYTES);
 const reader=response.body?.getReader();need(reader);const chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;need(total<=MAX_RESPONSE_BYTES);chunks.push(Buffer.from(value));}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 return parseMemberTransportJson(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
}
