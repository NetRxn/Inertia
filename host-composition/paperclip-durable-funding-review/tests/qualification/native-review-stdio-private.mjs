/** Explicit source-only cross-language qualification, not a default test skip.
 * Operator supplies private source and its existing Python environment. Only
 * synthetic SQLite/configuration in a fresh temporary folder is touched.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createNativeReviewStdio} from '../../transport/native/native-review-stdio.mjs';
const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--private-root'||args[2]!=='--python'||!path.isAbsolute(args[1])||!path.isAbsolute(args[3]))throw Error('Explicit absolute --private-root and --python are required');
const privateRoot=await fs.realpath(args[1]),python=args[3],entry=path.join(privateRoot,'src/dfw_incentives/native_review_stdio.py');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'native-review-python-js-'));
const seed=`
import json, sys
from dataclasses import asdict
from pathlib import Path
root, target = Path(sys.argv[1]), Path(sys.argv[2])
sys.path[:0] = [str(root / 'src'), str(root / 'tests')]
from test_native_review_stdio import setup
db, public, reviewer, config, assignment, artifact = setup(target)
config_path = target / 'protected-synthetic-scope.json'
config_path.write_text(json.dumps(config), encoding='utf-8')
config_path.chmod(0o600)
context = public.review_context(artifact.candidate_hash)
payload = context['requests'][0]['candidate']
print(json.dumps({'configurationPath':str(config_path), 'context':asdict(reviewer), 'assignment':assignment, 'artifact':artifact.model_dump(mode='json'), 'nestedPayloadProducerNull':payload.get('producer_id') is None and payload.get('producer_run_id') is None}))
db.engine.dispose()
`;
const wrapper="import runpy,sys,pathlib;entry=pathlib.Path(sys.argv[1]);sys.path.insert(0,str(entry.parents[1]));sys.argv=sys.argv[1:];runpy.run_path(str(entry),run_name='__main__')";
try{
 const result=spawnSync(python,['-c',seed,privateRoot,temp],{cwd:privateRoot,env:{PATH:'/usr/bin:/bin',HOME:temp,LANG:'C.UTF-8',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'},encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
 if(result.error||result.status!==0)throw Error('Synthetic Python seed failed: '+(result.error?.message??result.stderr.slice(-2000)));
 const metadata=JSON.parse(result.stdout.trim());assert.equal(metadata.nestedPayloadProducerNull,true);
 console.log(JSON.stringify({stage:'synthetic-source-seeded',nestedPayloadProducerNull:true}));
 const pinPaths=[entry,metadata.configurationPath,...['public_drafting.py','public_drafting_stdio.py','native_review_binding.py','native_review_fence.py','draft_candidates.py','hashing.py','db.py'].map(name=>path.join(privateRoot,'src/dfw_incentives',name))];
 const pins=await Promise.all(pinPaths.map(async file=>({path:file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')})));
 const bridge=createNativeReviewStdio({executable:python,args:['-c',wrapper,entry,'--config',metadata.configurationPath],cwd:privateRoot,entrypoint:entry,configurationPath:metadata.configurationPath,pins,timeoutMs:20000,maxOutputBytes:4*1024*1024});
 const callbacks={context:async()=>structuredClone(metadata.context),nativeAssignment:async()=>structuredClone(metadata.assignment)};
 const context=await bridge.call('context',{},callbacks);
 assert.equal(context.binding.candidate_hash,metadata.artifact.candidate_hash);
 assert.equal(context.binding.producer_principal_id,'producer');
 assert.equal(context.binding.producer_run_id,metadata.assignment.producer_run_id);
 const candidate=context.context.requests[0].candidate;
 assert.equal(candidate.producer_id,null);assert.equal(candidate.producer_run_id,null);
 const receipt=await bridge.call('admit',metadata.artifact,callbacks);
 const replay=await bridge.call('admit',metadata.artifact,callbacks);
 assert.deepEqual(receipt,replay);assert.deepEqual(receipt.binding,context.binding);
 assert.equal(receipt.state,'supported');
 console.log(JSON.stringify({stage:'actual-python-js-context-and-admit',nestedPayloadProducerNull:true,authoritativeBindingPreserved:true,duplicateAdmissionStable:true,authorityPins:pins.length,privateDatabase:'synthetic-sqlite-only',provider:false,network:false}));
}catch(error){console.error(JSON.stringify({qualification:'failed',code:error.code??'qualification_error',message:error.message}));process.exitCode=1;}
finally{await fs.rm(temp,{recursive:true,force:true});}
