// Explicit deployment composition. Never edits the default source manifest or host admission.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=await fs.realpath(process.argv[2]??'');
const sha=b=>createHash('sha256').update(b).digest('hex');
const descriptorPath=path.join(root,'package.json'),descriptorBytes=await fs.readFile(descriptorPath),pkg=JSON.parse(descriptorBytes);
assert.equal(pkg.name,'@inertia/dao-helper');assert.equal(pkg.version,'0.1.0');
const output='./dist/src/manifest.funding-only.js',receiptPath=path.join(root,'funding-only-composition.json');
if(pkg.paperclipPlugin?.manifest===output){
 const receipt=JSON.parse(await fs.readFile(receiptPath));
 assert.equal(sha(descriptorBytes),receipt.composedDescriptorSha256);
 assert.equal(sha(await fs.readFile(path.join(root,output))),receipt.composedManifestSha256);
 assert.equal(sha(await fs.readFile(path.join(root,'dist/src/manifest.js'))),receipt.defaultManifestFileSha256);
 console.log(JSON.stringify({composition:'funding-only',verifiedExisting:true}));
}else{
 assert.equal(pkg.paperclipPlugin?.manifest,'./dist/src/manifest.js');assert.equal(pkg.paperclipPlugin?.worker,'./dist/src/worker.js');
 const sourcePath=path.join(root,pkg.paperclipPlugin.manifest),sourceBytes=await fs.readFile(sourcePath);
 const manifest=(await import(pathToFileURL(sourcePath))).default;
 assert.equal(manifest.id,'netrxn.inertia');assert.equal(manifest.version,pkg.version);
 assert.equal(manifest.entrypoints.worker,'dist/src/worker.js');assert.equal(manifest.entrypoints.ui,'dist/ui');
 assert.deepEqual(manifest.ui,{slots:[{type:'detailTab',id:'member-packet',displayName:'Packet',exportName:'MemberPacketTab',entityTypes:['issue']}]});
 assert.deepEqual(manifest.capabilities.filter(c=>c.startsWith('ui.')),['ui.detailTab.register']);
 assert.equal(pkg.files.filter(p=>p.startsWith('dist/ui')).length,1);assert(pkg.files.includes('dist/ui/'));
 const composed=structuredClone(manifest);delete composed.ui;delete composed.entrypoints.ui;composed.capabilities=composed.capabilities.filter(c=>c!=='ui.detailTab.register');
 const generated='// Explicit funding-only composition; default manifest remains unchanged.\nconst manifest = '+JSON.stringify(composed,null,2)+';\nexport { manifest };\nexport default manifest;\n';
 const descriptor=structuredClone(pkg);descriptor.paperclipPlugin.manifest=output;descriptor.files=descriptor.files.filter(p=>p!=='dist/ui/');descriptor.files.push('funding-only-composition.json');
 const nextDescriptor=JSON.stringify(descriptor,null,2)+'\n';
 const receipt={version:1,composition:'funding-only',omittedCapabilities:['ui.detailTab.register'],omittedUiSlots:['member-packet'],omittedFiles:['dist/ui/'],defaultDescriptorSha256:sha(descriptorBytes),defaultManifestFileSha256:sha(sourceBytes),composedManifestSha256:sha(generated),composedDescriptorSha256:sha(nextDescriptor),preserved:['worker','tools','jobs','database','instanceConfigSchema','remaining capabilities']};
 await fs.writeFile(path.join(root,output),generated,{flag:'wx'});
 await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 await fs.writeFile(descriptorPath+'.funding-only.tmp',nextDescriptor,{flag:'wx'});await fs.rename(descriptorPath+'.funding-only.tmp',descriptorPath);
 console.log(JSON.stringify({composition:'funding-only',manifestSha256:receipt.composedManifestSha256,capabilityCount:composed.capabilities.length}));
}
