import {spawnSync} from 'node:child_process';
const baseline='2026.1012.0';
const result=spawnSync('npm',['view','@paperclipai/server','version','--json','--registry=https://registry.npmjs.org'],{encoding:'utf8'});
if(result.status!==0){console.error('Unable to verify the latest official upstream release; no freshness claim or version change was made.');process.exit(1);}
const latest=JSON.parse(result.stdout.trim());
console.log(JSON.stringify({qualifiedBaseline:baseline,latestOfficialRelease:latest,requalificationRequired:latest!==baseline},null,2));
if(latest!==baseline)console.log('New upstream available: refresh the exact source/lock/fingerprints, review native hooks, rerun native tests and all3 DFW scenarios, then obtain independent review. Never apply this patch fuzzily or silently keep using a stale baseline.');
