import {PassThrough} from 'node:stream';
import {createInterface} from 'node:readline';
import {loadNative} from './native-fixture.mjs';

const {definePlugin,startWorkerRpcHost,createHostClientHandlers}=await loadNative('@paperclipai/plugin-sdk/dist/index.js');
const {createPluginToolDispatcher}=await loadNative('@paperclipai/server/dist/services/plugin-tool-dispatcher.js');
const {buildHostServices}=await loadNative('@paperclipai/server/dist/services/plugin-host-services.js');
const {createPluginEventBus}=await loadNative('@paperclipai/server/dist/services/plugin-event-bus.js');

// Real SDK JSON-RPC codec, dispatcher and host services. Only wake execution is
// replaced: this harness never starts an LLM, production runner or network flow.
export async function sdkWire({db,pluginId,manifest,companyId,setup}) {
  const input=new PassThrough(),output=new PassThrough();
  const pending=new Map(),messages=[],wakeups=[];
  let sequence=1000;
  const eventBus=createPluginEventBus();
  const services=buildHostServices(db,pluginId,manifest.id,eventBus,undefined,{manifest});
  services.issues.requestWakeup=async params=>{
    const existing=wakeups.find(x=>x.issueId===params.issueId&&x.idempotencyKey===params.idempotencyKey);
    if(!existing)wakeups.push(structuredClone(params));
    return {issueId:params.issueId,queued:true,runId:null};
  };
  const handlers=createHostClientHandlers({pluginId,capabilities:manifest.capabilities,services});
  const lines=createInterface({input:output});
  lines.on('line',async line=>{
    const message=JSON.parse(line);messages.push({direction:'worker',message});
    if(message.method){
      let response;
      try{
        const handler=handlers[message.method];
        if(!handler)throw Error(`Unexpected worker host method: ${message.method}`);
        response={jsonrpc:'2.0',id:message.id,result:await handler(message.params,{invocationScope:{companyId}})??null};
      }catch(error){response={jsonrpc:'2.0',id:message.id,error:{code:-32000,message:error.message}};}
      messages.push({direction:'host',message:response});input.write(JSON.stringify(response)+'\n');
    }else{
      const deferred=pending.get(message.id);pending.delete(message.id);
      if(!deferred)throw Error('Unmatched SDK response');
      if(message.error)deferred.reject(Error(message.error.message));else deferred.resolve(message.result);
    }
  });
  const worker=startWorkerRpcHost({plugin:definePlugin({setup}),stdin:input,stdout:output});
  const call=(method,params)=>new Promise((resolve,reject)=>{
    const id=++sequence;pending.set(id,{resolve,reject});
    const message={jsonrpc:'2.0',id,method,params};messages.push({direction:'host',message});input.write(JSON.stringify(message)+'\n');
  });
  const workerManager={isRunning:id=>id===pluginId,call:async(id,method,params)=>{
    if(id!==pluginId)throw Error('Unknown fixture worker');
    return call(method,params);
  }};
  const dispatcher=createPluginToolDispatcher({workerManager});
  dispatcher.registerPluginTools(manifest.id,manifest,pluginId);
  await call('initialize',{manifest,config:{}});
  return {dispatcher,messages,wakeups,services,close(){services.dispose();worker.stop();lines.close();input.destroy();output.destroy();}};
}
