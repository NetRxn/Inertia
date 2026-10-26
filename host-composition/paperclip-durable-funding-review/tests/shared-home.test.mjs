import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sharedHomeMounts, preflightSharedHome, inspectFixedLink } from '../scripts/preflight-shared-home.mjs';
const config = { hostHome: '/volume/home', hostData: '/volume/data', paperclipHome: '/work/paperclip', instanceId: 'default', transientInstanceSecrets: true };
test('one home bind and optional exact instance secrets tmpfs; input unchanged', () => {
  const before = JSON.stringify(config);
  assert.deepEqual(sharedHomeMounts(config), [
    { type: 'bind', source: '/volume/home', target: '/work/paperclip', readOnly: false },
    { type: 'tmpfs', target: '/work/paperclip/instances/default/secrets' },
  ]);
  assert.equal(JSON.stringify(config), before);
  assert.equal(sharedHomeMounts({ ...config, transientInstanceSecrets: false }).length, 1);
});
test('fixed mapping count is independent of future agents', () => {
  assert.deepEqual(sharedHomeMounts({ ...config, agentIds: ['synthetic-a', 'synthetic-b'] }), sharedHomeMounts(config));
});
for (const [key, value] of [['hostHome', 'relative'], ['hostHome', '/'], ['hostHome', '/a/../b'], ['hostHome', '/a/'], ['hostData', '/a//b'], ['paperclipHome', '/work\u0000'], ['instanceId', '..'], ['instanceId', 'a/b'], ['instanceId', 'a\\b'], ['instanceId', ''], ['transientInstanceSecrets', 'true']]) {
  test(`rejects invalid ${key} ${JSON.stringify(value)}`, () => assert.throws(() => sharedHomeMounts({ ...config, [key]: value })));
}
test('rejects host home/data nesting in either direction and equality', () => {
  for (const hostHome of ['/volume', '/volume/data', '/volume/data/nested']) assert.throws(() => sharedHomeMounts({ ...config, hostHome }), /overlap/);
});
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-home-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const cfg = { ...config, hostHome: path.join(root, 'home'), hostData: path.join(root, 'data') };
  await fs.mkdir(cfg.hostHome); await fs.mkdir(cfg.hostData);
  return { root, cfg, secrets: path.join(cfg.hostHome, 'instances/default/secrets') };
}
test('source preflight is read-only and always unqualified', async t => {
  const { cfg } = await fixture(t);
  await fs.writeFile(path.join(cfg.hostHome, 'synthetic.txt'), 'unchanged');
  const result = await preflightSharedHome(cfg);
  assert.equal(result.deploymentReady, false);
  assert.equal(result.runtimeQualified, false);
  assert.equal(await fs.readFile(path.join(cfg.hostHome, 'synthetic.txt'), 'utf8'), 'unchanged');
  assert.deepEqual(await fs.readdir(cfg.hostHome), ['synthetic.txt']);
});
test('missing source path is rejected without creating it', async t => {
  const { cfg } = await fixture(t); await fs.rmdir(cfg.hostData);
  await assert.rejects(preflightSharedHome(cfg), { code: 'ENOENT' });
});
test('symlink source ancestor is rejected', async t => {
  const { cfg, root } = await fixture(t); const alias = path.join(root, 'alias');
  await fs.symlink(root, alias);
  await assert.rejects(preflightSharedHome({ ...cfg, hostHome: path.join(alias, 'home') }), /symlink|directory/);
});
test('regular file source is rejected', async t => {
  const { cfg } = await fixture(t); await fs.rmdir(cfg.hostData); await fs.writeFile(cfg.hostData, 'synthetic');
  await assert.rejects(preflightSharedHome(cfg), /directory/);
});
test('secrets exclusion accepts empty but rejects any underlying entry without reading it', async t => {
  const { cfg, secrets } = await fixture(t); await fs.mkdir(secrets, { recursive: true });
  await preflightSharedHome(cfg);
  await fs.writeFile(path.join(secrets, 'synthetic-key-placeholder'), 'NOT A KEY');
  await assert.rejects(preflightSharedHome(cfg), /not empty/);
  assert.equal(await fs.readFile(path.join(secrets, 'synthetic-key-placeholder'), 'utf8'), 'NOT A KEY');
});
test('secrets ancestor symlink is rejected rather than followed', async t => {
  const { cfg } = await fixture(t); await fs.symlink(cfg.hostData, path.join(cfg.hostHome, 'instances'));
  await assert.rejects(preflightSharedHome(cfg), /symlink|directory/);
});
test('fixed link inspection absent, matching and repeat are nonmutating', async t => {
  const { cfg } = await fixture(t); const link = path.join(cfg.hostHome, 'data');
  assert.equal(await inspectFixedLink(link, cfg.hostData), 'absent');
  await assert.rejects(fs.lstat(link), { code: 'ENOENT' });
  await fs.symlink(cfg.hostData, link);
  assert.equal(await inspectFixedLink(link, cfg.hostData), 'matching');
  assert.equal(await inspectFixedLink(link, cfg.hostData), 'matching');
  assert.equal(await fs.readlink(link), cfg.hostData);
});
test('fixed link conflicting symlink and directory are rejected unchanged', async t => {
  const { cfg } = await fixture(t); const link = path.join(cfg.hostHome, 'data');
  await fs.symlink('/synthetic-wrong', link);
  await assert.rejects(inspectFixedLink(link, cfg.hostData), /conflict/);
  assert.equal(await fs.readlink(link), '/synthetic-wrong');
  await fs.unlink(link); await fs.mkdir(link);
  await assert.rejects(inspectFixedLink(link, cfg.hostData), /conflict/);
  assert.equal((await fs.lstat(link)).isDirectory(), true);
});
