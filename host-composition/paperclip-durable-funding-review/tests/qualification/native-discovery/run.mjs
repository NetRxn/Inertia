/** Offline disposable installed-source qualification; no runtime mounts or providers. */
import fs from 'node:fs/promises';import path from 'node:path';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
if(process.env.QUALIFY_DISPOSABLE!=='1'||process.getuid?.()!==1000)throw Error('Disposable uid1000 required');
for(const k of Object.keys(process.env))if(/^(PG|DFW_DATABASE_URL$|PAPERCLIP_API_KEY$|OPENAI_API_KEY$|ANTHROPIC_API_KEY$)/.test(k))throw Error('Refusing inherited credential/database routing');
const source='/qual/source/host-composition/paperclip-durable-funding-review',root='/work/native-discovery',host=root+'/node_modules/@paperclipai/server',origin='/opt/host/node_modules';
await fs.mkdir(host,{recursive:true});await fs.cp(origin+'/@paperclipai/server/dist',host+'/dist',{recursive:true});await fs.copyFile(origin+'/@paperclipai/server/package.json',host+'/package.json');
for(const dir of[origin+'/@paperclipai/server/node_modules',origin])for(const name of await fs.readdir(dir)){if(name==='@paperclipai'||name.startsWith('.'))continue;try{await fs.symlink(dir+'/'+name,root+'/node_modules/'+name);}catch(e){if(e.code!=='EEXIST')throw e;}}
for(const name of await fs.readdir(origin+'/@paperclipai'))if(name!=='server')await fs.symlink(origin+'/@paperclipai/'+name,root+'/node_modules/@paperclipai/'+name);
const pins=JSON.parse(await fs.readFile(source+'/patches/native-discovery-profile-pins.json'));
for(const file of Object.keys(pins.files)){const bytes=await fs.readFile('/qual/baseline/'+file),digest=createHash('sha256').update(bytes).digest('hex');if(digest!==pins.files[file].base_sha256)throw Error('Baseline source drift: '+file);await fs.writeFile(host+'/'+file,bytes);}
// Restore only exact copied discovery modules in this disposable scratch clone.
for(const[file,pin]of Object.entries(pins.newFiles)){const filePath=host+'/'+file;let bytes;try{bytes=await fs.readFile(filePath);}catch(e){if(e.code==='ENOENT')continue;throw e;}if(createHash('sha256').update(bytes).digest('hex')!==pin.candidate_sha256)throw Error('Qualification origin discovery module drift: '+file);await fs.rm(filePath);}
for(const[file,digest]of Object.entries(pins.unchangedGuards)){const bytes=await fs.readFile(host+'/'+file);if(createHash('sha256').update(bytes).digest('hex')!==digest)throw Error('Qualification image guard differs: '+file);}
const files=['tests/public-scout-completion.test.mjs','transport/native/public-scout-projection.mjs','scripts/apply-native-discovery-profile.mjs','patches/native-discovery-profile.patch','patches/native-discovery-profile-pins.json','tests/native-discovery-profile.test.mjs','tests/native-discovery-attachments.test.mjs','tests/native-discovery-installer.test.mjs','tests/native-discovery-native.test.mjs','tests/native-funding-policy.test.mjs','tests/native-funding-roundtrip.test.mjs'];
for(const f of files){await fs.mkdir(path.dirname(root+'/'+f),{recursive:true});await fs.copyFile(source+'/'+f,root+'/'+f);}
const env={PATH:process.env.PATH,HOME:'/work',TMPDIR:'/tmp',NODE_ENV:'test',LOG_LEVEL:'error',PAPERCLIP_API_URL:'http://127.0.0.1:3100',QUALIFY_DISPOSABLE:'1',NATIVE_DISCOVERY_CANDIDATE:host,NATIVE_DISCOVERY_BASE:host,NATIVE_FUNDING_ROOT:host,QUALIFICATION_NATIVE_ROOT:root+'/node_modules'};
function run(args){const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit',timeout:180000});if(result.error||result.status!==0)throw Error('Qualification failed: '+args.join(' '),{cause:result.error});}
run([root+'/scripts/apply-native-discovery-profile.mjs']);
run(['--test',...files.filter(f=>f.startsWith('tests/')&&!f.includes('native-discovery-native')).map(f=>root+'/'+f)]);
run(['--test',root+'/tests/native-discovery-native.test.mjs']);
console.log('Native discovery installed-source qualification passed; no credentials, provider inference or live state.');
