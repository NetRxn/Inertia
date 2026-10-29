/** Read-only compiled-source qualification. No runtime, database, credentials, or default live paths. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const overlays=['native-review-paging','native-agent-permission-grants','native-source-review-contract','native-coordinator-continuation','native-scout-deadline','native-case-result-envelope','native-source-receipt-envelope','native-case-documents','native-current-track-owner','native-source-context-paging','native-coordinator-child-capacity','native-reconciliation-isolation'];
// This is one explicitly reviewed metadata supersession, not a general last-writer-wins rule.
const contractFile='dist/services/native-runtime/native-case-work-tools.mjs';
const predecessor='56a31978d149429f7c626374b31710c4fe906afb7daa9c92b83308fe27dc200f';
const candidate='fbc3eed06d3bc7402882a83d100c7bc5797c647ecaa9a6a90ae5f8cf19f18f53';
const continuationTransitions={"dist/routes/issues.js":{"base_sha256":"a1c7c8e580b1e0c47b199f0d4939992fdb119a0e845714d294f6b690b471e834","candidate_sha256":"78e9f242904553e2d1be5dae871b0aadbd643a808c7fd0ece3e079039b3b86fd"},"dist/services/heartbeat.js":{"base_sha256":"a6f3417cd561591837b1b161593565c5b0b007407262356b6543f2cef45f5645","candidate_sha256":"94dbece0357bb9f678f44fc3ef27a73a978d9ef64e3463acb57ce4807ef88432"},"dist/services/native-runtime/native-session-resume.js":{"base_sha256":"c09c22a6e92c0783d3bd95ed3ae8a86bf9cb1e0124612e0b3d490c46e119ff6b","candidate_sha256":"9df7909a3b9a6b1f732607ec1cf94446bcbb63c53a4467730c433831128f6734"},"dist/services/native-runtime/native-coordinator-policy.js":{"base_sha256":"c1e4e9d7b0f6199d3b0036f84092fa40706979f04001d7203197d7d6f442cb0a","candidate_sha256":"0c1096e1ba52b481dabca09ba2b19ce6de042ef812335b7f32ac769321dfd1c8"},"dist/services/native-runtime/paperclip-runner-tool-authority.js":{"base_sha256":"ebba6cd16be8d012f9a50798f49842d9c36594970e518fca2a8b1068db99e7d7","candidate_sha256":"95be76fc4e877b51a8acb3882a8dfa042780ebfe5c0ba7ac1cbc103da40cd3d9"}};
const continuationNewFiles={"dist/services/issue-resume-admission.mjs":"11f945429d4bd3b93ff56b71f0e36126db4e5db20181953df438b7d5e5a48048","dist/services/native-runtime/native-task-continuation.mjs":"c56fb516349569a0be52a04b50523d781574e1b80c20776ea470db66b1ca555d","dist/services/native-runtime/native-coordinator-continuation.mjs":"93b883ac290b25290dadbad52b85549a37071b160ce5ff0732467aecffb40391"};
const scoutTransitions={"dist/services/native-runtime/native-session-executor.js":{"base_sha256":"2fff957c75bb1bb63752d6570ee996b6917d95faec76b10eb4d8ba0220c2290f","candidate_sha256":"5f8d198cdeb56c77d81eeb645fa28debc7884a35d25c7862bda14a091ce989e4"},"dist/services/native-runtime/assigned-mcp-tools.js":{"base_sha256":"4c2197bbf17deaff347c266a060b2f766e79421b2b7ee59d1e9cf535c480a2cf","candidate_sha256":"2832429aacddcaddc9f0f6e21876da663c3af4ec5c4ac0957b5ca45f77f16514"},"dist/services/native-runtime/native-inertia-execution-policy.mjs":{"base_sha256":"0b567c98dc61e905191ee37ccd9793d2d4cffb4c7e5254bc1731565768ce1baa","candidate_sha256":"965ebbe90ee21a6b074e8a950bf7bf765453a2e28b21e01efc304b893b68f544"}};
const caseResultTransitions={"dist/services/native-runtime/native-case-work-tools.mjs":{"base_sha256":"fbc3eed06d3bc7402882a83d100c7bc5797c647ecaa9a6a90ae5f8cf19f18f53","candidate_sha256":"92ee5dc92268560162bb0d3eb7f5fcff8aca2b7a3a696a57b7a9782411f794cf"},"dist/services/native-runtime/paperclip-runner-tool-authority.js":{"base_sha256":"95be76fc4e877b51a8acb3882a8dfa042780ebfe5c0ba7ac1cbc103da40cd3d9","candidate_sha256":"f6883b87c340edddadb338f73359f5c867fee9515576a0cc66cdada5b4551016"}};
const sourceReceiptTransitions={"dist/services/native-runtime/native-source-review.mjs":{"base_sha256":"ab2f47dfcedff3d6ab91710e25962064b75f2367a230842c0386fddc533c2b57","candidate_sha256":"5d97fd8162580d68d34d5775a0fac3956314928bd28c146c3ef0c9e6a6ca4a98"}};
const caseDocumentTransitions={"dist/services/native-runtime/native-case-work-tools.mjs":{"base_sha256":"92ee5dc92268560162bb0d3eb7f5fcff8aca2b7a3a696a57b7a9782411f794cf","candidate_sha256":"c1b2f2ac05a2cecf131f64299b4fd41bc9ed1bf5f853e5a467df8239816efa20"},"dist/services/native-runtime/paperclip-runner-tool-authority.js":{"base_sha256":"f6883b87c340edddadb338f73359f5c867fee9515576a0cc66cdada5b4551016","candidate_sha256":"3855e3bb3d36907e15940a1e2f8920f7fdfd90299b111af321e6f5f42c9f48f4"},"dist/services/native-runtime/native-session-resume.js":{"base_sha256":"9df7909a3b9a6b1f732607ec1cf94446bcbb63c53a4467730c433831128f6734","candidate_sha256":"a39873e1af3ef8e244e7f8a4b1992bad968b9c5d3694b39c86eb63cc08860293"}};
const caseDocumentNewFiles={"dist/services/native-runtime/native-case-document-read.mjs":"d89ecdc6aa40b017dfd44fc3d000aa49e3b779cd7d7bd0651ab67895a3e5b9bf"};
const currentTrackTransitions={"dist/services/native-runtime/status-arbiter.js":{"base_sha256":"ff63007d6dbeafbdf119c63ed9dda626e70a7d1cf6efa20bec7700f49fffa79f","candidate_sha256":"0bf19c10255b56522ab160094355e46471010f8070e5e5ae61956ce5173ddba2"}};
const sourceContextPagingTransitions={"dist/services/native-runtime/native-case-work-tools.mjs":{"base_sha256":"c1b2f2ac05a2cecf131f64299b4fd41bc9ed1bf5f853e5a467df8239816efa20","candidate_sha256":"3ca335af6fe99c080b12168f04bb27c4d544e928da3300be979405873ebd2964"},"dist/services/native-runtime/native-session-resume.js":{"base_sha256":"a39873e1af3ef8e244e7f8a4b1992bad968b9c5d3694b39c86eb63cc08860293","candidate_sha256":"33ec66488d0331ffecaff5cf219f3e45c1d827e93c9b92f2c4566990b21d12f2"}};
const childCapacityTransitions={"dist/services/native-runtime/native-coordinator-policy.js":{"base_sha256":"0c1096e1ba52b481dabca09ba2b19ce6de042ef812335b7f32ac769321dfd1c8","candidate_sha256":"fde3c25c95835b1f0ab329ffc4e80fbc6bef4e98ccaaa940ac20032c8e916868"},"dist/services/native-runtime/paperclip-runner-tool-authority.js":{"base_sha256":"3855e3bb3d36907e15940a1e2f8920f7fdfd90299b111af321e6f5f42c9f48f4","candidate_sha256":"34e2981aca364586b692e001999b172965e18778e82d24c9630fcb3e1fcd1f63"},"dist/services/issues.js":{"base_sha256":"81f5a53a055d390b09ee22b43f7965151b8ead5878658d326a639f8eec476a25","candidate_sha256":"e7ee8b208c40c565320f2dc9dd81e9bea9e80e360b3c82faaa2971757eba9992"}};
const reconciliationTransitions={"dist/services/native-runtime/native-finalization-reconciler.js":{"base_sha256":"63090b2dc77151a0d31af0f839d88d95c9dadc3234bdcf5aed7fad45623a7f7a","candidate_sha256":"b404aad833657392ef5a7ab6d3aee7618f0a6afabc7dab15de3b24303a8374c9"}};
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
 const continuation=pins[3];
 if(JSON.stringify(Object.keys(continuation.files??{}).sort())!==JSON.stringify(Object.keys(continuationTransitions).sort())||JSON.stringify(Object.keys(continuation.newFiles??{}).sort())!==JSON.stringify(Object.keys(continuationNewFiles).sort())||Object.entries(continuationTransitions).some(([file,value])=>continuation.files[file]?.base_sha256!==value.base_sha256||continuation.files[file]?.candidate_sha256!==value.candidate_sha256)||Object.entries(continuationNewFiles).some(([file,digest])=>continuation.newFiles[file]?.candidate_sha256!==digest))throw Error('native_continuation_lineage_denied');
 const scout=pins[4];
 if(JSON.stringify(Object.keys(scout.files??{}).sort())!==JSON.stringify(Object.keys(scoutTransitions).sort())||Object.keys(scout.newFiles??{}).length||Object.entries(scoutTransitions).some(([file,value])=>scout.files[file]?.base_sha256!==value.base_sha256||scout.files[file]?.candidate_sha256!==value.candidate_sha256))throw Error('native_scout_deadline_lineage_denied');
 const caseResult=pins[5];
 if(JSON.stringify(Object.keys(caseResult.files??{}).sort())!==JSON.stringify(Object.keys(caseResultTransitions).sort())||Object.keys(caseResult.newFiles??{}).length||Object.entries(caseResultTransitions).some(([file,value])=>caseResult.files[file]?.base_sha256!==value.base_sha256||caseResult.files[file]?.candidate_sha256!==value.candidate_sha256))throw Error('native_case_result_lineage_denied');
 const sourceReceipt=pins[6];
 if(JSON.stringify(Object.keys(sourceReceipt.files??{}).sort())!==JSON.stringify(Object.keys(sourceReceiptTransitions).sort())||Object.keys(sourceReceipt.newFiles??{}).length||Object.entries(sourceReceiptTransitions).some(([file,value])=>sourceReceipt.files[file]?.base_sha256!==value.base_sha256||sourceReceipt.files[file]?.candidate_sha256!==value.candidate_sha256))throw Error('native_source_receipt_lineage_denied');
 const caseDocuments=pins[7];
 if(JSON.stringify(Object.keys(caseDocuments.files??{}).sort())!==JSON.stringify(Object.keys(caseDocumentTransitions).sort())||JSON.stringify(Object.keys(caseDocuments.newFiles??{}).sort())!==JSON.stringify(Object.keys(caseDocumentNewFiles).sort())||Object.entries(caseDocumentTransitions).some(([file,value])=>caseDocuments.files[file]?.base_sha256!==value.base_sha256||caseDocuments.files[file]?.candidate_sha256!==value.candidate_sha256)||Object.entries(caseDocumentNewFiles).some(([file,digest])=>caseDocuments.newFiles[file]?.candidate_sha256!==digest))throw Error('native_case_documents_lineage_denied');
 const currentTrack=pins[8];if(Object.keys(currentTrack.files).length!==1||Object.keys(currentTrack.newFiles).length!==0||Object.entries(currentTrackTransitions).some(([file,value])=>currentTrack.files[file]?.base_sha256!==value.base_sha256||currentTrack.files[file]?.candidate_sha256!==value.candidate_sha256))throw Error('native_current_track_owner_lineage_denied');
 const sourceContextPaging=pins[9];if(Object.keys(sourceContextPaging.files).length!==2||Object.keys(sourceContextPaging.newFiles).length||Object.entries(sourceContextPagingTransitions).some(([file,value])=>sourceContextPaging.files[file]?.base_sha256!==value.base_sha256||sourceContextPaging.files[file]?.candidate_sha256!==value.candidate_sha256))throw Error('native_source_context_paging_lineage_denied');
 const childCapacity=pins[10];if(Object.keys(childCapacity.files).length!==3||Object.keys(childCapacity.newFiles).length||Object.entries(childCapacityTransitions).some(([file,value])=>childCapacity.files[file]?.base_sha256!==value.base_sha256||childCapacity.files[file]?.candidate_sha256!==value.candidate_sha256))throw Error('native_child_capacity_lineage_denied');
 const isolation=pins[11];if(Object.keys(isolation.files).length!==1||Object.keys(isolation.newFiles).length||Object.entries(reconciliationTransitions).some(([file,value])=>isolation.files[file]?.base_sha256!==value.base_sha256||isolation.files[file]?.candidate_sha256!==value.candidate_sha256))throw Error('native_reconciliation_isolation_lineage_denied');
 const packageInfo=JSON.parse(await safeRead(server,'package.json')),build=JSON.parse(await safeRead(server,'dist/build-info.json'));
 const expected=new Map();let supersededFiles=0;
 for(let i=0;i<pins.length;i++){
  const pin=pins[i];
  if(i===11)for(const[file,value]of Object.entries(reconciliationTransitions))if(!expected.has(file))expected.set(file,value.base_sha256);
  if(i===8)for(const[file,value]of Object.entries(currentTrackTransitions))if(!expected.has(file))expected.set(file,value.base_sha256);
  if(i===3)for(const [file,value]of Object.entries(continuationTransitions))if(!expected.has(file))expected.set(file,value.base_sha256);
  if(pin.packageVersion!==pins[0].packageVersion||pin.buildCommit!==pins[0].buildCommit||packageInfo.version!==pin.packageVersion||build.commit!==pin.buildCommit)throw Error('native_build_lineage_denied');
  if(sha(await safeRead(patches,pin.patch))!==pin.patch_sha256)throw Error('native_patch_drift: '+overlays[i]);
  // Check entries individually: an overlay cannot silently shadow one of its own guards.
  const assertions=[...Object.entries(pin.unchangedGuards),[pin.unchangedAuthGuard.file,pin.unchangedAuthGuard.sha256],...Object.entries(pin.files).map(([file,value])=>[file,value.candidate_sha256]),...Object.entries(pin.newFiles).map(([file,value])=>[file,value.candidate_sha256])];
  for(const [file,digest] of assertions){
   if(!/^[a-f0-9]{64}$/.test(digest))throw Error('native_pin_digest_denied');
   const previous=expected.get(file);
   if(previous&&previous!==digest){
    const sourceContract=i===2&&file===contractFile&&previous===predecessor&&digest===candidate&&supersededFiles===0;
    const continuationContract=i===3&&continuationTransitions[file]?.base_sha256===previous&&continuationTransitions[file]?.candidate_sha256===digest;
    const scoutContract=i===4&&scoutTransitions[file]?.base_sha256===previous&&scoutTransitions[file]?.candidate_sha256===digest;
    const caseResultContract=i===5&&caseResultTransitions[file]?.base_sha256===previous&&caseResultTransitions[file]?.candidate_sha256===digest;
    const sourceReceiptContract=i===6&&sourceReceiptTransitions[file]?.base_sha256===previous&&sourceReceiptTransitions[file]?.candidate_sha256===digest;
    const caseDocumentContract=i===7&&caseDocumentTransitions[file]?.base_sha256===previous&&caseDocumentTransitions[file]?.candidate_sha256===digest;
    const currentTrackContract=i===8&&currentTrackTransitions[file]?.base_sha256===previous&&currentTrackTransitions[file]?.candidate_sha256===digest;
    const sourceContextPagingContract=i===9&&sourceContextPagingTransitions[file]?.base_sha256===previous&&sourceContextPagingTransitions[file]?.candidate_sha256===digest;
    const childCapacityContract=i===10&&childCapacityTransitions[file]?.base_sha256===previous&&childCapacityTransitions[file]?.candidate_sha256===digest;
    const reconciliationContract=i===11&&reconciliationTransitions[file]?.base_sha256===previous&&reconciliationTransitions[file]?.candidate_sha256===digest;
    if(!reconciliationContract&&!childCapacityContract&&!sourceContextPagingContract&&!currentTrackContract&&!sourceContract&&!continuationContract&&!scoutContract&&!caseResultContract&&!sourceReceiptContract&&!caseDocumentContract)throw Error('native_pin_lineage_conflict: '+file);
    supersededFiles++;
   }
   expected.set(file,digest);
  }
 }
 if(supersededFiles!==22)throw Error('native_contract_lineage_denied');
 for(const [file,digest] of expected)if(sha(await safeRead(server,file))!==digest)throw Error('native_pin_drift: '+file);
 return {overlays:[...overlays],verifiedFiles:expected.size,supersededFiles,providerStarted:false,databaseStarted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [serverRoot,patchesRoot,...extra]=process.argv.slice(2);if(extra.length)throw Error('expected_explicit_server_and_patches_roots');
 console.log(JSON.stringify(await verifyComposedNativePins({serverRoot,patchesRoot})));
}
