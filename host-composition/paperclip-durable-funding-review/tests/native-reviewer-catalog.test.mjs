import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const host=process.env.NATIVE_REVIEW_NATIVE_ROOT??'/opt/host/node_modules/@paperclipai/server';
const source=await fs.readFile(path.join(host,'dist/services/native-runtime/native-session-executor.js'),'utf8');
const start=source.indexOf('    if (relayAssignedMcp',source.indexOf('    let effectiveRunnerEnvironmentBase ='));
const end=source.indexOf('    // This authority bit',start);
assert(start>=0&&end>start,'actual executor environment boundary must exist');
const strip=new Function('relayAssignedMcp','funding','effectiveRunnerEnvironmentBase',source.slice(start,end)+'\nreturn effectiveRunnerEnvironmentBase;');
const binding={PAPERCLIP_NATIVE_MCP_NAME:'synthetic-assigned',PAPERCLIP_NATIVE_MCP_URL:'http://127.0.0.1:3100/mcp/gateways/synthetic',PAPERCLIP_NATIVE_MCP_TOKEN:'synthetic-token-not-a-credential-000000',SAFE_OTHER:'retained'};
function environment(relay,funding){return strip(relay,funding,{...binding});}
test('native funding reviewer receives no duplicate assigned MCP endpoint or bearer',()=>{
 const result=environment(false,{role:'reviewer'});assert.deepEqual(result,{SAFE_OTHER:'retained'});assert.equal(Object.keys(binding).length,4);
});
for(const [name,relay,funding,removed]of[
 ['producer relay',true,{role:'producer'},true],['remote relay',true,undefined,true],
 ['stock local',false,undefined,false],['nonrelayed producer',false,{role:'producer'},false],
])test(name+' preserves existing environment behavior',()=>assert.deepEqual(environment(relay,funding),removed?{SAFE_OTHER:'retained'}:binding));
test('reviewer removes partial stale assigned endpoint fields too',()=>{
 for(const key of Object.keys(binding).filter(k=>k.startsWith('PAPERCLIP_NATIVE_MCP_'))){const input={[key]:binding[key],SAFE_OTHER:'retained'};assert.deepEqual(strip(false,{role:'reviewer'},input),{SAFE_OTHER:'retained'});}
});
test('actual provider materializer removes stale managed MCP configuration for reviewer',async()=>{
 const {prepareIsolatedCodexHome}=await import(pathToFileURL(path.join(host,'dist/vendor/paperclip-runner/drivers/runtime-context-materializer.js')));
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'reviewer-catalog-'));try{
  const config=path.join(root,'config.toml');await fs.writeFile(config,'[mcp_servers.old]\nurl="http://127.0.0.1:1/obsolete"\nhttp_headers={Authorization="synthetic-obsolete"}\n');
  const result=environment(false,{role:'reviewer'});const nativeMcp=result.PAPERCLIP_NATIVE_MCP_NAME?{name:result.PAPERCLIP_NATIVE_MCP_NAME,url:result.PAPERCLIP_NATIVE_MCP_URL,token:result.PAPERCLIP_NATIVE_MCP_TOKEN}:null;
  await prepareIsolatedCodexHome({context:null,codexHome:root,nativeMcp});const written=await fs.readFile(config,'utf8');assert(!written.includes('mcp_servers'));assert(!written.includes('synthetic-token'));assert(!written.includes('synthetic-obsolete'));assert.match(written,/shell_snapshot = false/);assert.equal((await fs.stat(config)).mode&0o777,0o600);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
