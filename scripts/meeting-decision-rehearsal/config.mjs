/** Read-only qualification configuration. No installs or database arguments. */
import {readFile,realpath,stat,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isAbsolute,join,dirname,basename,relative} from 'node:path';
import {checkPrerequisites} from './owned-postgres.mjs';
const pins=JSON.parse(await readFile(new URL('./pins.json',import.meta.url),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyPinnedFiles(root,files){
 for(const [name,expected] of Object.entries(files)){
  if(isAbsolute(name)||name.split('/').includes('..'))throw Error('Invalid pinned relative path');
  let bytes;try{bytes=await readFile(join(root,name));}catch{throw Error('Pinned source unavailable: '+name);}
  if(hash(bytes)!==expected)throw Error('Pinned source hash mismatch: '+name);
 }
 return {count:Object.keys(files).length};
}
async function directory(env,key){
 const value=env[key];if(typeof value!=='string'||!value.trim())throw Error(key+' is required');
 if(!isAbsolute(value))throw Error(key+' must be absolute');
 try{const p=await realpath(value);if(!(await stat(p)).isDirectory())throw Error();return p;}catch{throw Error(key+' is unavailable or not a directory');}
}
export async function loadConfig(env){
 checkPrerequisites({version:'2026.1012.0',env,platform:process.platform,arch:process.arch});
 const inertiaRoot=await directory(env,'INERTIA_REPO_ROOT'),dfwRoot=await directory(env,'DFW_REPO_ROOT'),hostRoot=await directory(env,'PAPERCLIP_HOST_ROOT'),pgRoot=await directory(env,'POSTGRES_NATIVE_ROOT');
 if(typeof env.DFW_PYTHON!=='string'||!env.DFW_PYTHON.trim())throw Error('DFW_PYTHON is required');
 if(!isAbsolute(env.DFW_PYTHON))throw Error('DFW_PYTHON must be absolute');
 let python,pythonRealpath;
 try{
  // Preserve the final venv symlink when executing: realpath alone would bypass
  // its pyvenv.cfg and lose the already-installed dependency environment.
  python=join(await realpath(dirname(env.DFW_PYTHON)),basename(env.DFW_PYTHON));
  pythonRealpath=await realpath(python);await access(python,constants.X_OK);
 }catch{throw Error('DFW_PYTHON is unavailable or not executable');}
 if(hash(await readFile(python))!==pins.python.executableSha256)throw Error('Python executable hash mismatch');
 const outRoot=await directory(env,'MEETING_OUTPUT_ROOT');
 for(const root of [hostRoot,pgRoot]){const rel=relative(root,outRoot);if(rel===''||(rel!=='..'&&!rel.startsWith('../')&&!isAbsolute(rel)))throw Error('output must not modify an existing runtime dependency');}
 await verifyPinnedFiles(inertiaRoot,pins.inertia);await verifyPinnedFiles(dfwRoot,pins.dfw);await verifyPinnedFiles(hostRoot,pins.host);await verifyPinnedFiles(pgRoot,pins.pg);
 const version=JSON.parse(await readFile(join(hostRoot,'node_modules/paperclipai/package.json'),'utf8')).version;
 checkPrerequisites({version,env,platform:process.platform,arch:process.arch});
 const repositoryHeads={};
 for(const [name,root] of [['inertia',inertiaRoot],['dfw',dfwRoot]]){
  try{repositoryHeads[name]=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw Error(name+' source must be an existing git repository');}
 }
 return {inertiaRoot,dfwRoot,hostRoot,pgRoot,python,pythonRealpath,outRoot,version,sourcePins:pins.sourcePins,repositoryHeads,verifiedSourceFiles:{inertia:Object.keys(pins.inertia).length,dfw:Object.keys(pins.dfw).length}};
}
