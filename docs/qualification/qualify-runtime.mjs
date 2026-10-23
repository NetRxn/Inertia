import {readFile} from 'node:fs/promises';
import {createDb} from '@paperclipai/db';
import postgres from 'postgres';
import {createHostClientHandlers} from '@paperclipai/plugin-sdk';
const base='./node_modules/@paperclipai/server/dist/services/';
const names=['plugin-loader','plugin-worker-manager','plugin-job-scheduler','plugin-job-store','plugin-tool-dispatcher','plugin-lifecycle','plugin-host-services','plugin-event-bus','plugin-registry','plugin-database','companies'];
const m=Object.assign({},...await Promise.all(names.map(n=>import(base+n+'.js'))));
const url=process.env.QUALIFICATION_DATABASE_URL;
if(!url)throw new Error('Set QUALIFICATION_DATABASE_URL to a disposable database.');
const root=process.cwd();
const hostPackage=JSON.parse(await readFile(root+'/node_modules/paperclipai/package.json','utf8'));
if(hostPackage.name!=='paperclipai'||typeof hostPackage.version!=='string'||!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(hostPackage.version))throw new Error('Installed official Paperclip package metadata is invalid.');
const hostVersion=hostPackage.version,db=createDb(url),sql=postgres(url);
const wm=m.createPluginWorkerManager(),eb=m.createPluginEventBus(),js=m.pluginJobStore(db),lc=m.pluginLifecycleManager(db,{workerManager:wm});
const scheduler=m.createPluginJobScheduler({db,jobStore:js,workerManager:wm,isBackgroundWorkEnabled:()=>false});
const td=m.createPluginToolDispatcher({workerManager:wm,lifecycleManager:lc,db});
const disposers=[];
const loader=m.pluginLoader(db,{localPluginDir:root+'/plugin',enableNpmDiscovery:false},{workerManager:wm,eventBus:eb,jobScheduler:scheduler,jobStore:js,toolDispatcher:td,lifecycleManager:lc,instanceInfo:{instanceId:'inertia-cloud-synthetic',hostVersion,deploymentMode:'local_trusted',deploymentExposure:'private'},buildHostHandlers:(id,manifest)=>{const services=m.buildHostServices(db,id,manifest.id,eb,(method,params)=>wm.getWorker(id)?.notify(method,params),{pluginWorkerManager:wm,manifest});disposers.push(()=>services.dispose());return createHostClientHandlers({pluginId:id,capabilities:manifest.capabilities,services})}});
try{
 const registry=m.pluginRegistryService(db);
 let p=await registry.getByKey('netrxn.inertia');
 if(!p){await loader.installPlugin({localPath:root+'/plugin'});p=await registry.getByKey('netrxn.inertia');}
 if(p.status==='installed')await lc.load(p.id);
 const company=await m.companyService(db).create({name:'Inertia synthetic native qualification',description:'Disposable test data only'});
 await registry.upsertConfig(p.id,company.id,{companyId:company.id,configJson:{enabled:false}});
 const loaded=await loader.loadSingle(p.id);console.log('ACTIVATION',JSON.stringify(loaded));if(!loaded.success)throw new Error(loaded.error);
 console.log('CONFIG_VALIDATION',JSON.stringify(await wm.call(p.id,'validateConfig',{config:{enabled:false},companyId:company.id})));
 console.log('HEALTH',JSON.stringify(await wm.call(p.id,'health',{})));
 console.log('REGISTRY',JSON.stringify(await sql`select plugin_key,version,status from plugins`));
 console.log('MIGRATIONS',JSON.stringify(await sql`select migration_key,status from plugin_migrations`));
 console.log('JOBS',JSON.stringify(await sql`select job_key from plugin_jobs`));
 console.log('CONFIG',JSON.stringify(await sql`select config_json from plugin_config`));
}catch(e){console.error(e);process.exitCode=1}finally{await loader.shutdownAll();scheduler.stop();for(const d of disposers)await d();await sql.end();await db.$client.end();}
