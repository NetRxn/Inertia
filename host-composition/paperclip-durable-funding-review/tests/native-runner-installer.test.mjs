import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));
const baseline = path.join(source, 'node_modules/@paperclipai/server');
const pins = JSON.parse(await fs.readFile(path.join(source, 'patches/native-runner-resolution-pins.json')));
const [changedFile, changedPin] = Object.entries(pins.files)[0];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const output = r => (r.stdout ?? '') + (r.stderr ?? '');
async function put(file, bytes) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes); }
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-installer-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const host = path.join(root, 'node_modules/@paperclipai/server');
  for (const file of ['package.json', 'dist/build-info.json', pins.unchangedAuthGuard.file, changedFile])
    await put(path.join(host, file), await fs.readFile(path.join(baseline, file)));
  for (const file of ['patches/native-runner-resolution-pins.json', 'patches/' + pins.patch])
    await put(path.join(root, file), await fs.readFile(path.join(source, file)));
  try { await put(path.join(root, 'scripts/apply-native-runner-resolution.mjs'), await fs.readFile(path.join(source, 'scripts/apply-native-runner-resolution.mjs'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (sha(await fs.readFile(path.join(host, changedFile))) === changedPin.candidate_sha256) {
    const reverse = spawnSync('patch', ['--batch', '--fuzz=0', '-R', '-p1', '-d', host, '-i', path.join(root, 'patches', pins.patch)], { encoding: 'utf8' });
    assert.equal(reverse.status, 0, output(reverse));
  }
  return { root, host };
}
const run = (f, env = {}) => spawnSync(process.execPath, [path.join(f.root, 'scripts/apply-native-runner-resolution.mjs')],
  { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });

test('pinned runner resolver installs idempotently without changing the managed auth guard', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 2; i++) {
    const result = run(f);
    assert.equal(result.status, 0, output(result));
    assert.equal(sha(await fs.readFile(path.join(f.host, changedFile))), changedPin.candidate_sha256);
    assert.equal(sha(await fs.readFile(path.join(f.host, pins.unchangedAuthGuard.file))), pins.unchangedAuthGuard.sha256);
  }
});

for (const kind of ['source-drift', 'patch-drift', 'auth-drift', 'build-drift', 'symlink-parent']) {
  test(`installer refuses ${kind} before changing the resolver`, async t => {
    const f = await fixture(t);
    if (kind === 'source-drift') await fs.appendFile(path.join(f.host, changedFile), '\n// drift');
    if (kind === 'patch-drift') await fs.appendFile(path.join(f.root, 'patches', pins.patch), '\ncorrupt');
    if (kind === 'auth-drift') await fs.appendFile(path.join(f.host, pins.unchangedAuthGuard.file), '\n// drift');
    if (kind === 'build-drift') await put(path.join(f.host, 'dist/build-info.json'), JSON.stringify({ commit: '0'.repeat(40) }));
    if (kind === 'symlink-parent') {
      const dir = path.join(f.host, 'dist/services/native-runtime');
      await fs.rename(dir, dir + '-outside'); await fs.symlink(dir + '-outside', dir);
    }
    const before = sha(await fs.readFile(path.join(f.host, changedFile)));
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(output(result), /Unqualified|integrity|Refusing/);
    assert.equal(sha(await fs.readFile(path.join(f.host, changedFile))), before);
  });
}

test('image composition honors an explicit absolute package root and refuses a relative one', async t => {
  const f = await fixture(t);
  const moved = path.join(f.root, 'image-package');
  await fs.rename(f.host, moved);
  const result = run(f, { PAPERCLIP_NATIVE_PACKAGE_ROOT: moved });
  assert.equal(result.status, 0, output(result));
  assert.equal(sha(await fs.readFile(path.join(moved, changedFile))), changedPin.candidate_sha256);
  const relative = run(f, { PAPERCLIP_NATIVE_PACKAGE_ROOT: './image-package' });
  assert.notEqual(relative.status, 0);
  assert.match(output(relative), /must be absolute/);
});
