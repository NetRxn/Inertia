/** Disposable installed-code proof only: no credentials, model, production state or network. */
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';
if(process.env.QUALIFY_DISPOSABLE!=='1')throw Error('Explicit disposable qualification required');
for(const key of Object.keys(process.env))if(/^PG|^DFW_DATABASE_URL$|^PAPERCLIP_API_KEY$|^OPENAI_API_KEY$|^ANTHROPIC_API_KEY$/.test(key))throw Error('Refusing credential/database routing environment');
const source=fileURLToPath(new URL('../',import.meta.url)),root='/work/native-funding-profile',host=root+'/node_modules/@paperclipai/server',origin='/opt/host/node_modules';
await fs.mkdir(host,{recursive:true});await fs.cp(origin+'/@paperclipai/server/dist',host+'/dist',{recursive:true});await fs.copyFile(origin+'/@paperclipai/server/package.json',host+'/package.json');
for(const dir of[origin+'/@paperclipai/server/node_modules',origin])for(const name of await fs.readdir(dir)){if(name==='@paperclipai'||name.startsWith('.'))continue;try{await fs.symlink(dir+'/'+name,root+'/node_modules/'+name);}catch(e){if(e.code!=='EEXIST')throw e;}}
for(const name of await fs.readdir(origin+'/@paperclipai'))if(name!=='server')try{await fs.symlink(origin+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);}catch(e){if(e.code!=='EEXIST')throw e;}
for(const rel of['scripts/apply-native-funding-profile.mjs','patches/native-funding-profile.patch','patches/native-funding-profile-pins.json','tests/native-funding-policy.test.mjs','tests/native-funding-roundtrip.test.mjs','tests/native-funding-installer.test.mjs']){await fs.mkdir(path.dirname(root+'/'+rel),{recursive:true});await fs.copyFile(source+rel,root+'/'+rel);}
const env={PATH:process.env.PATH,HOME:'/work',TMPDIR:'/tmp',NODE_ENV:'test',NATIVE_FUNDING_ROOT:host};
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});if(r.error||r.status!==0)throw Error('Qualification command failed: '+args[0]);}
run([root+'/scripts/apply-native-funding-profile.mjs']);
run(['--test',root+'/tests/native-funding-policy.test.mjs',root+'/tests/native-funding-roundtrip.test.mjs',root+'/tests/native-funding-installer.test.mjs']);
let vitest;
for(const candidate of['/opt/inertia-reviewed/node_modules/vitest','/qual/admission-source/node_modules/vitest']){try{await fs.access(candidate+'/vitest.mjs');vitest=candidate;break;}catch{}}
if(!vitest)throw Error('Disposable Vitest dependency absent');
try{await fs.symlink(vitest,root+'/node_modules/vitest');}catch(e){if(e.code!=='EEXIST')throw e;if(await fs.realpath(root+'/node_modules/vitest')!==await fs.realpath(vitest))throw Error('Unqualified disposable Vitest dependency');}
const fixture=host+'/dist/services/native-runtime/native-funding-authority.test.js';await fs.copyFile(source+'tests/fixtures/native-funding/authority.fixture.js',fixture);
const config=root+'/vitest.config.mjs';await fs.writeFile(config,`export default {root:${JSON.stringify(host)},resolve:{alias:{vitest:${JSON.stringify(vitest+'/dist/index.js')},'@paperclipai/paperclip-runner':${JSON.stringify(host+'/dist/vendor/paperclip-runner/index.js')}}},test:{include:['dist/services/native-runtime/native-funding-authority.test.js'],pool:'forks',maxWorkers:1,hookTimeout:180000,testTimeout:30000}};`);
run([vitest+'/vitest.mjs','run','--config',config]);
console.log('Restrictive native funding profile disposable qualification passed; no credentials, model or live state.');
