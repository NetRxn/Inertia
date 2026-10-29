/** Read-only compiled-source qualification. No runtime, database, credentials, or default live paths. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const overlays=['native-review-paging','native-agent-permission-grants','native-source-review-contract'];
// This is one explicitly reviewed metadata supersession, not a general last-writer-wins rule.
const contractFile='dist/services/native-runtime/native-case-work-tools.mjs';
const predecessor='56a31978d149429f7c626374b31710c4fe906afb7daa9c92b83308fe27dc200f';
const candidate='fbc3eed06d3bc7402882a83d100c7bc5797c647ecaa9a6a90ae5f8cf19f18f53';
async function safeRead(root,file){
 if(typeof file!=='string'||path.isAbsolute(file)||file.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw Error('native_pin_path_denied');
 let current=root;const parts=file.split('/');
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);const info=await fs.lstat(current);
  if(info.isSymbolicLink()||await fs.realpath(current)!==current||(i===parts.length-1?!info.isFile():!info.isDirectory()))throw Error('native_pin_path_denied');
 }
 return fs.readFile(current);
}
export async function verifyComposedNativePins({serverRoot,patchesRoot}={}){
 if(![serverRoot,patchesRoot].every(value=>typeof value==='string'&&path.isAbsolute(value)))throw Error('explicit_native_source_roots_required');
 const server=await fs.realpath(serverRoot),patches=await fs.realpath(patchesRoot),pins=[];
 for(const name of overlays)pins.push(JSON.parse(await safeRead(patches,name+'-pins.json')));
 const latest=pins[2],change=latest.files?.[contractFile];
 if(Object.keys(latest.files??{}).join()!==contractFile||Object.keys(latest.newFiles??{}).length||change?.base_sha256!==predecessor||change?.candidate_sha256!==candidate||pins[0].unchangedGuards?.[contractFile]!==predecessor)throw Error('native_contract_lineage_denied');
 const packageInfo=JSON.parse(await safeRead(server,'package.json')),build=JSON.parse(await safeRead(server,'dist/build-info.json'));
 const expected=new Map();let supersededFiles=0;
 for(let i=0;i<pins.length;i++){
  const pin=pins[i];
  if(pin.packageVersion!==pins[0].packageVersion||pin.buildCommit!==pins[0].buildCommit||packageInfo.version!==pin.packageVersion||build.commit!==pin.buildCommit)throw Error('native_build_lineage_denied');
  if(sha(await safeRead(patches,pin.patch))!==pin.patch_sha256)throw Error('native_patch_drift: '+overlays[i]);
  // Check entries individually: an overlay cannot silently shadow one of its own guards.
  const assertions=[...Object.entries(pin.unchangedGuards),[pin.unchangedAuthGuard.file,pin.unchangedAuthGuard.sha256],...Object.entries(pin.files).map(([file,value])=>[file,value.candidate_sha256]),...Object.entries(pin.newFiles).map(([file,value])=>[file,value.candidate_sha256])];
  for(const [file,digest] of assertions){
   if(!/^[a-f0-9]{64}$/.test(digest))throw Error('native_pin_digest_denied');
   const previous=expected.get(file);
   if(previous&&previous!==digest){
    if(i!==2||file!==contractFile||previous!==predecessor||digest!==candidate||supersededFiles)throw Error('native_pin_lineage_conflict: '+file);
    supersededFiles++;
   }
   expected.set(file,digest);
  }
 }
 if(supersededFiles!==1)throw Error('native_contract_lineage_denied');
 for(const [file,digest] of expected)if(sha(await safeRead(server,file))!==digest)throw Error('native_pin_drift: '+file);
 return {overlays:[...overlays],verifiedFiles:expected.size,supersededFiles,providerStarted:false,databaseStarted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [serverRoot,patchesRoot,...extra]=process.argv.slice(2);if(extra.length)throw Error('expected_explicit_server_and_patches_roots');
 console.log(JSON.stringify(await verifyComposedNativePins({serverRoot,patchesRoot})));
}
