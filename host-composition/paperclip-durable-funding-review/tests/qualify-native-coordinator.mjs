/** Run only in a clean disposable Docker image, network disabled, no mounts/credentials. */
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';
if(process.env.QUALIFY_DISPOSABLE!=='1')throw Error('Explicit disposable qualification required');
for(const key of Object.keys(process.env))if(/^PG|^DFW_DATABASE_URL$|^PAPERCLIP_API_KEY$|^OPENAI_API_KEY$|^ANTHROPIC_API_KEY$/.test(key))throw Error('Refusing credential/database routing environment');
const source=fileURLToPath(new URL('../',import.meta.url)),root='/work/native-coordinator',host=root+'/node_modules/@paperclipai/server',origin='/opt/host/node_modules';
await fs.mkdir(host,{recursive:true});await fs.cp(origin+'/@paperclipai/server/dist',host+'/dist',{recursive:true});await fs.copyFile(origin+'/@paperclipai/server/package.json',host+'/package.json');
for(const dir of[origin+'/@paperclipai/server/node_modules',origin])for(const name of await fs.readdir(dir)){if(name==='@paperclipai'||name.startsWith('.'))continue;try{await fs.symlink(dir+'/'+name,root+'/node_modules/'+name);}catch(e){if(e.code!=='EEXIST')throw e;}}
for(const name of await fs.readdir(origin+'/@paperclipai'))if(name!=='server')try{await fs.symlink(origin+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);}catch(e){if(e.code!=='EEXIST')throw e;}
for(const rel of['scripts/apply-native-coordinator.mjs','patches/native-coordinator.patch','patches/native-coordinator-pins.json','tests/native-coordinator.test.mjs','tests/native-coordinator-installer.test.mjs','tests/native-coordinator-human-input.test.mjs']){await fs.mkdir(path.dirname(root+'/'+rel),{recursive:true});await fs.copyFile(source+rel,root+'/'+rel);}
const env={PATH:process.env.PATH,HOME:'/work',TMPDIR:'/tmp',NODE_ENV:'test',QUALIFY_NATIVE_CODEX:'1',NATIVE_COORDINATOR_ROOT:root+'/node_modules'};
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});if(r.status!==0)throw Error('Qualification command failed: '+args[0]);}
run([root+'/scripts/apply-native-coordinator.mjs']);
run(['--test',root+'/tests/native-coordinator.test.mjs',root+'/tests/native-coordinator-installer.test.mjs',root+'/tests/native-coordinator-human-input.test.mjs']);
const dbRoot='/work/native-coordinator-db';await fs.mkdir(dbRoot,{recursive:true});await fs.cp(host+'/dist',dbRoot+'/dist',{recursive:true});await fs.symlink(root+'/node_modules',dbRoot+'/node_modules');await fs.writeFile(dbRoot+'/package.json','{"type":"module"}');
await fs.copyFile(source+'tests/fixtures/native-coordinator/authority.fixture.js',dbRoot+'/dist/services/native-runtime/native-coordinator-boundary.test.js');
await fs.copyFile(source+'tests/fixtures/native-coordinator/context.fixture.js',dbRoot+'/dist/services/native-runtime/native-coordinator-context.test.js');
const config=root+'/vitest.config.mjs';await fs.writeFile(config,`export default {root:${JSON.stringify(dbRoot)},resolve:{alias:{vitest:'/opt/inertia-reviewed/node_modules/vitest/dist/index.js','@paperclipai/paperclip-runner':${JSON.stringify(dbRoot+'/dist/vendor/paperclip-runner/index.js')}}},test:{include:['dist/services/native-runtime/paperclip-runner-tool-authority.test.js','dist/services/native-runtime/native-coordinator-boundary.test.js','dist/services/native-runtime/native-coordinator-context.test.js','dist/services/native-runtime/native-execution-input.test.js','dist/services/heartbeat-runner-provider-config.test.js'],pool:'forks',maxWorkers:1,hookTimeout:180000,testTimeout:30000}};`);
run(['/opt/inertia-reviewed/node_modules/vitest/vitest.mjs','run','--config',config]);
console.log('Disposable exact-source native coordinator qualification passed; no real models, credentials or live databases.');
