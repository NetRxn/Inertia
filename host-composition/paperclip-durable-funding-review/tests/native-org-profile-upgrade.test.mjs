/** Actual installed host capability boundary, no operational state or providers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const native=process.env.NATIVE_HOST_ROOT??'/opt/host/node_modules/@paperclipai/server';
const plugin=process.env.PROFILE_PLUGIN_ROOT??'/qual/plugin';
const {pluginCapabilityValidator}=await import(pathToFileURL(native+'/dist/services/plugin-capability-validator.js'));
const {default:manifest}=await import(pathToFileURL(plugin+'/dist/src/manifest.js'));
const installedImage=process.env.PROFILE_INSTALLED_IMAGE==='1';
if(installedImage){
 assert.equal(native,'/opt/host/node_modules/@paperclipai/server');assert.equal(plugin,'/opt/inertia-reviewed');
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 assert.match(process.env.PROFILE_EXPECTED_MANIFEST_SHA??'',/^[a-f0-9]{64}$/);
 assert.equal(createHash('sha256').update(await readFile(plugin+'/dist/src/manifest.js')).digest('hex'),process.env.PROFILE_EXPECTED_MANIFEST_SHA);
 assert.equal(manifest.version,process.env.PROFILE_EXPECTED_PACKAGE_VERSION);
}
test('the coherent profile UI manifest satisfies actual host capability gates',()=>{
 assert.deepEqual(pluginCapabilityValidator().validateManifestCapabilities(manifest),{allowed:true,missing:[],pluginId:'netrxn.inertia'});
});

// The full boundary is opt-in only for the disposable installed-source fixture.
if(process.env.PROFILE_FULL_UPGRADE==='1'){
 const fs=await import('node:fs/promises'),{randomUUID,createHash}=await import('node:crypto'),{fork}=await import('node:child_process'),{once}=await import('node:events');
 const host='/opt/host/node_modules',root='/tmp/profile-native',server=root+'/node_modules/@paperclipai/server',installed='/tmp/profile-installed-plugin';
 await fs.mkdir(server,{recursive:true});await fs.cp(host+'/@paperclipai/server/dist',server+'/dist',{recursive:true});await fs.copyFile(host+'/@paperclipai/server/package.json',server+'/package.json');if(!installedImage)await fs.cp('/qual/native/dist',server+'/dist',{recursive:true,force:true});
 for(const from of [host+'/@paperclipai/server/node_modules',host])for(const name of await fs.readdir(from).catch(()=>[])){if(name==='@paperclipai'||name.startsWith('.'))continue;await fs.symlink(from+'/'+name,root+'/node_modules/'+name).catch(e=>{if(e.code!=='EEXIST')throw e;});}
 for(const name of await fs.readdir(host+'/@paperclipai'))if(name!=='server')await fs.symlink(host+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);
 await fs.symlink(await fs.realpath('/opt/inertia-reviewed/node_modules/nostr-tools'),root+'/node_modules/nostr-tools').catch(e=>{if(e.code!=='EEXIST')throw e;});
 const load=p=>import(pathToFileURL(host+'/'+p)),{startEmbeddedPostgresTestDatabase,createDb}=await load('@paperclipai/db/dist/index.js'),s=await load('@paperclipai/db/dist/schema/index.js'),{eq,sql}=await load('drizzle-orm/index.js');
 const pg=await startEmbeddedPostgresTestDatabase('org-profile-upgrade-'),db=createDb(pg.connectionString);let child,base;
 const stop=async()=>{if(child){const c=child;child=null;c.send('shutdown');await once(c,'exit');}};
 test.after(async()=>{await stop();await pg.cleanup();});
 const logs=[];
 const boot=async()=>{child=fork('/qual/tests/org-profile-bootstrap.mjs',[pg.connectionString,server],{stdio:['ignore','pipe','pipe','ipc']});child.stdout.on('data',b=>logs.push(b.toString()));child.stderr.on('data',b=>logs.push(b.toString()));const started=await Promise.race([once(child,'message').then(([v])=>v),once(child,'exit').then(([code])=>{throw Error('bootstrap_exit_'+code+' '+logs.join('').slice(-3000));}),new Promise((_,reject)=>setTimeout(()=>reject(Error('bootstrap_timeout '+logs.join('').slice(-3000))),45000).unref())]);assert.equal(started.ready,true);base='http://127.0.0.1:'+started.port;assert.equal((await fetch(base+'/api/health')).status,200);};
 const request=async(path,method='GET',body)=>{const response=await fetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});let data;try{data=await response.json();}catch{data=null;}return{status:response.status,data};};
 const stage=async(from)=>{for(const p of ['package.json','dist','migrations'])await fs.cp(from+'/'+p,installed+'/'+p,{recursive:true,force:true});};
 await fs.mkdir(installed,{recursive:true});await stage('/qual/base-plugin');await fs.symlink(root+'/node_modules',installed+'/node_modules');
 const companyId=randomUUID(),agentId=randomUUID();await db.insert(s.companies).values({id:companyId,name:'Synthetic profile upgrade',issuePrefix:'ORG'+companyId.slice(0,5),status:'paused'});await db.insert(s.agents).values({id:agentId,companyId,name:'Preserved actor',role:'general',status:'idle',adapterType:'paperclip_runner',adapterConfig:{provider:'codex',engine:'cli'}});await db.insert(s.principalPermissionGrants).values({companyId,principalType:'agent',principalId:agentId,permissionKey:'tools:use',scope:{allow:[{toolId:'netrxn.inertia:funding_case_work'}]}});
 test('normal administrator activation preserves an old install and applies org009 before READY; failed migration never starts its worker',async()=>{
  await boot();const installedResponse=await request('/plugins/install','POST',{packageName:installed,isLocalPath:true});
  // The existing multi-company worker needs its stored company config before first setup.
  assert([200,400].includes(installedResponse.status),JSON.stringify(installedResponse.data));
  if(installedResponse.status===400)assert.match(installedResponse.data.error,/config.get.*company context is required/);
  const id=(await db.select().from(s.plugins))[0].id;
  const config={enabled:false,bindings:[],pairings:[],cards:[],nativeCaseWork:{enabled:false,preservation_probe:{actor:agentId,contract:'unchanged'}},organizationKnowledge:{enabled:false}};
  const configured=await request('/plugins/'+id+'/config','POST',{companyId,configJson:config});assert.equal(configured.status,200,JSON.stringify(configured.data));
  if(installedResponse.status===400){const activated=await request('/plugins/'+id+'/enable','POST',{});assert.equal(activated.status,200,JSON.stringify(activated.data));}
  assert.equal((await db.select().from(s.plugins).where(eq(s.plugins.id,id)))[0].status,'ready');
  const beforeConfig=await db.select().from(s.pluginConfig),beforeGrants=await db.select().from(s.principalPermissionGrants),beforeMigrations=await db.select().from(s.pluginMigrations),beforeTools=(await request('/plugins/tools')).data.map(t=>t.name).sort();assert.equal(beforeMigrations.length,8);assert.equal(beforeTools.length,26);assert(beforeTools.includes('netrxn.inertia:funding_case_work'));assert(beforeTools.includes('netrxn.inertia:organization_search'));assert.equal((await request('/plugins/ui-contributions')).data[0].slots.length,1);
  assert.equal((await request('/plugins/'+id+'/disable','POST',{})).status,200);await stage(plugin);
  // A deliberately invalid disposable copy proves ordering/fail-closed behavior.
  const migration=installed+'/migrations/009_org_profile.sql',correct=await fs.readFile(migration);await fs.writeFile(migration,'DROP TABLE plugin_netrxn_inertia_e936d62b87.org_profile;');
  await stop();await boot();
  const held=(await db.select().from(s.plugins).where(eq(s.plugins.id,id)))[0];assert.equal(held.status,'disabled');assert(!held.manifestJson.capabilities.includes('ui.page.register'));assert(!held.manifestJson.capabilities.includes('instance.settings.register'));assert.equal((await request('/plugins/ui-contributions')).data.length,0);assert.equal((await db.select().from(s.pluginMigrations)).length,8);
  const failure=await request('/plugins/'+id+'/enable','POST',{});assert.equal(failure.status,400);assert.equal((await db.select().from(s.plugins).where(eq(s.plugins.id,id)))[0].status,'error');assert.equal((await request('/plugins/ui-contributions')).data.length,0);assert.equal((await db.select().from(s.pluginMigrations)).filter(r=>r.status==='applied').length,8);
  const unavailable=await request('/plugins/'+id+'/bridge/action','POST',{companyId,key:'org.overview',params:{}});assert.equal(unavailable.status,502);
  await fs.writeFile(migration,correct);const enabled=await request('/plugins/'+id+'/enable','POST',{});assert.equal(enabled.status,200,JSON.stringify(enabled.data));
  const current=(await db.select().from(s.plugins).where(eq(s.plugins.id,id)))[0];assert.equal(current.status,'ready');assert.equal(current.id,id);assert.equal(current.packagePath,installed);
  assert(current.manifestJson.capabilities.includes('ui.page.register'));assert(current.manifestJson.capabilities.includes('instance.settings.register'));
  const migrations=await db.select().from(s.pluginMigrations);assert.equal(migrations.length,9);assert.equal(migrations.find(r=>r.migrationKey==='009_org_profile.sql').status,'applied');assert.equal(migrations.find(r=>r.migrationKey==='009_org_profile.sql').pluginVersion,manifest.version);for(const old of beforeMigrations)assert.deepEqual(migrations.find(r=>r.id===old.id),old);
  assert.deepEqual(await db.select().from(s.pluginConfig),beforeConfig);assert.deepEqual(await db.select().from(s.principalPermissionGrants),beforeGrants);assert.deepEqual((await request('/plugins/tools')).data.map(t=>t.name).sort(),beforeTools);
  const ui=(await request('/plugins/ui-contributions')).data.find(p=>p.pluginId===id);assert.deepEqual(ui.slots.map(s=>s.id),['dao','task-trail','member-packet','integrations']);
  const overview=await request('/plugins/'+id+'/bridge/action','POST',{companyId,key:'org.overview',params:{}});assert.equal(overview.status,200,JSON.stringify(overview.data));assert.equal(overview.data.data.ok,true);
  assert.equal((await request('/plugins/'+id+'/disable','POST',{})).status,200);assert.equal((await request('/plugins/'+id+'/enable','POST',{})).status,200);assert.equal((await db.select().from(s.pluginMigrations)).length,9);
  await stop();await boot();assert.equal((await db.select().from(s.plugins).where(eq(s.plugins.id,id)))[0].status,'ready');assert.equal((await request('/plugins/ui-contributions')).data[0].slots.length,4);assert.equal((await db.select().from(s.pluginMigrations)).length,9);assert.deepEqual(await db.select().from(s.pluginConfig),beforeConfig);assert.deepEqual(await db.select().from(s.principalPermissionGrants),beforeGrants);
  console.log(JSON.stringify({actualFullServerBootstrap:true,installedImageWithoutNewPackageOrNativeOverlay:installedImage,normalAdminDisableEnable:true,newPackageBootRemainedDisabledUntilAdminEnable:true,explicitNamedCapabilityDelta:['ui.page.register','instance.settings.register'],oldInstallIdentityPreserved:true,migration009AppliedOnce:true,migrationFailureHeldWorker:true,uiSlots:4,toolsUnchanged:beforeTools.length,configurationAndGrantsPreserved:true,providerStarted:false}));
 });
}
