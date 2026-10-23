import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolveCandidate, validatePackage } from '../paperclip-upgrade.mjs';
const pkg = name => ({ name, version: '2026.1012.0', dist: { integrity: 'sha512-' + 'A'.repeat(86) + '==', tarball: `https://registry.npmjs.org/${name}/-/fixture.tgz` } });
test('resolves published registry versions and release independently', async () => {
  const calls = [];
  const fetcher = async url => { calls.push(url); return { ok: true, json: async () => url.includes('api.github') ? {tag_name:'v2026.1012.0',html_url:'https://github.com/paperclipai/paperclip/releases/tag/v2026.1012.0',published_at:'2026-10-12T21:06:53Z'} : pkg(url.includes('plugin-sdk') ? '@paperclipai/plugin-sdk' : 'paperclipai') }; };
  const r = await resolveCandidate(fetcher);
  assert.equal(r.host.version, '2026.1012.0'); assert.equal(r.releaseMatchesHost, true); assert.equal(calls.length, 3);
});
test('rejects missing integrity, wrong package, and off-registry tarballs', () => {
 for (const p of [{...pkg('paperclipai'),dist:{}},pkg('other'),{...pkg('paperclipai'),dist:{integrity:'sha512-' + 'A'.repeat(86) + '==',tarball:'https://evil.invalid/x'}}]) assert.throws(() => validatePackage(p,'paperclipai'));
});
test('fails closed on registry failure', async () => {
 await assert.rejects(resolveCandidate(async()=>({ok:false,status:503})), /503/);
});
test('reports differing host and SDK versions without silently aligning them', async () => {
 const r=await resolveCandidate(async url=>({ok:true,json:async()=>url.includes('api.github')?{tag_name:'v2026.1012.0'}:{...pkg(url.includes('plugin-sdk')?'@paperclipai/plugin-sdk':'paperclipai'),version:url.includes('plugin-sdk')?'2026.1022.0':'2026.1012.0'}}));
 assert.equal(r.versionsAligned,false);
});
test('lock qualification rejects version or integrity substitution', async () => {
 const { verifyLock } = await import('../paperclip-upgrade.mjs');
 const c={...pkg('paperclipai'),tarball:pkg('paperclipai').dist.tarball,integrity:'sha512-' + 'A'.repeat(86) + '=='};
 assert.doesNotThrow(()=>verifyLock({packages:{'node_modules/paperclipai':{version:c.version,integrity:c.integrity,resolved:c.tarball}}},c));
 assert.throws(()=>verifyLock({packages:{'node_modules/paperclipai':{version:c.version,integrity:'sha512-other'}}},c));
 assert.throws(()=>verifyLock({packages:{}},c));
});

test('invalid CLI options fail before metadata lookup or changes', () => {
 assert.throws(()=>execFileSync(process.execPath, ['scripts/paperclip-upgrade.mjs','--deploy'], {stdio:'pipe'}), error => /Usage:/.test(error.stderr.toString()));
});
test('registry latest prerelease cannot silently become stable target', () => {
 assert.throws(()=>validatePackage({...pkg('paperclipai'),version:'2026.1012.0-beta.1'},'paperclipai'));
});
test('rejects external or credentialed selected and transitive lock sources', async () => {
 const {verifyLock}=await import('../paperclip-upgrade.mjs');
 const candidate={name:'paperclipai',version:'2026.1012.0',integrity:'sha512-' + 'A'.repeat(86) + '==',tarball:pkg('paperclipai').dist.tarball};
 const entry={version:candidate.version,integrity:candidate.integrity,resolved:candidate.tarball};
 for(const resolved of ['https://evil.invalid/x','https://user:secret@registry.npmjs.org/x.tgz','https://registry.npmjs.org/x.tgz?secret=x','https://registry.npmjs.org/x.tgz#x',' https://registry.npmjs.org/x.tgz','file:../local.tgz']) {
  assert.throws(()=>verifyLock({packages:{'node_modules/paperclipai':{...entry,resolved}}},candidate));
  assert.throws(()=>verifyLock({packages:{'node_modules/paperclipai':entry,'node_modules/other':{...entry,resolved}}},candidate));
 }
});
test('qualification setup failure reports failed and writes a receipt', async () => {
 const {qualify}=await import('../paperclip-upgrade.mjs');
 const {mkdtemp,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os'); const {join}=await import('node:path');
 const workspace=await mkdtemp(join(tmpdir(),'inertia-failure-test-'));
 const report={result:'report-only'};
 try {
  await assert.rejects(qualify({},report,{makeWorkspace:async()=>workspace,copySource:async()=>{throw Error('synthetic copy failure')}}),/synthetic copy failure/);
  assert.equal(report.result,'failed'); assert.equal(JSON.parse(await readFile(join(workspace,'upgrade-receipt.json'),'utf8')).result,'failed');
 } finally {await rm(workspace,{recursive:true,force:true});}
});
test('rejects malformed SHA512 digest and metadata redirect', async () => {
 assert.throws(()=>validatePackage({...pkg('paperclipai'),dist:{...pkg('paperclipai').dist,integrity:'sha512-'}},'paperclipai'));
 await assert.rejects(resolveCandidate(async(url,options)=>{assert.equal(options.redirect,'error');throw Error('redirect rejected')}),/redirect rejected/);
});
test('workspace creation failure cannot report dry-run success', async () => {
 const {qualify}=await import('../paperclip-upgrade.mjs');const report={result:'report-only'};
 await assert.rejects(qualify({},report,{makeWorkspace:async()=>{throw Error('synthetic mkdir failure')}}),/synthetic mkdir failure/);
 assert.equal(report.result,'failed');assert.match(report.failure,/mkdir/);
});
test('bundled dependencies require an integrity-bound registry ancestor', async () => {
 const {verifyLockOrigins}=await import('../paperclip-upgrade.mjs');
 const container={resolved:pkg('paperclipai').dist.tarball,integrity:pkg('paperclipai').dist.integrity};
 assert.doesNotThrow(()=>verifyLockOrigins({packages:{'node_modules/paperclipai':container,'node_modules/paperclipai/node_modules/bundled':{inBundle:true}}}));
 assert.throws(()=>verifyLockOrigins({packages:{'node_modules/orphan':{inBundle:true}}}));
 assert.throws(()=>verifyLockOrigins({packages:{'node_modules/paperclipai':container,'node_modules/paperclipai/node_modules/bundled':{inBundle:true,resolved:'https://evil.invalid/x.tgz'}}}));
});
