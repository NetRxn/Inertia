// Runs only the real filesystem installer against disposable /tmp host trees.
// PLUGIN_RUNTIME_BASELINE_ROOT may name an independently retained exact host.
// A local, fully patched host is also accepted after a verified reverse patch
// in the fixture. No host runtime, database, credentials, or providers are used.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const baselineRoot = process.env.PLUGIN_RUNTIME_BASELINE_ROOT
  ?? path.join(sourceRoot, 'node_modules/@paperclipai/server');
const installer = await fs.readFile(path.join(sourceRoot, 'scripts/apply-plugin-runtime.mjs'));
const pinsBytes = await fs.readFile(path.join(sourceRoot, 'patches/plugin-runtime-pins.json'));
const pins = JSON.parse(pinsBytes);
const patchBytes = await fs.readFile(path.join(sourceRoot, 'patches', pins.patch));
const pinnedFiles = Object.keys(pins.files);
const hostFiles = ['package.json', 'dist/build-info.json', ...pinnedFiles];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

assert.equal(pinnedFiles.length, 6, 'qualification must cover all six pinned host files');
assert.equal(hash(patchBytes), pins.patch_sha256, 'test input patch must match its manifest');

async function writeFile(file, bytes) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, bytes);
}

function runPatch(fixture, reverse = false) {
  return spawnSync('patch', [
    '--batch', '--fuzz=0', ...(reverse ? ['--reverse'] : ['--forward']),
    '-p1', '-d', fixture.host, '-i', fixture.patch,
  ], {encoding: 'utf8', timeout: 30_000});
}

function diagnostic(result) {
  return `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
}

function assertSuccess(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null, diagnostic(result));
  assert.equal(result.status, 0, diagnostic(result));
}

async function assertPinnedState(fixture, state) {
  for (const file of pinnedFiles) {
    assert.equal(hash(await fs.readFile(path.join(fixture.host, file))),
      pins.files[file][`${state}_sha256`], `${file} must be exact ${state} bytes`);
  }
}

async function fixture(t) {
  const sandbox = await fs.mkdtemp('/tmp/plugin-runtime-installer-');
  t.after(() => fs.rm(sandbox, {recursive: true, force: true}));
  const root = path.join(sandbox, 'composition');
  const host = path.join(root, 'node_modules/@paperclipai/server');
  const patch = path.join(root, 'patches', pins.patch);
  const result = {sandbox, root, host, patch};
  await writeFile(path.join(root, 'scripts/apply-plugin-runtime.mjs'), installer);
  await writeFile(path.join(root, 'patches/plugin-runtime-pins.json'), pinsBytes);
  await writeFile(patch, patchBytes);
  for (const file of hostFiles) {
    await writeFile(path.join(host, file), await fs.readFile(path.join(baselineRoot, file)));
  }
  await writeFile(path.join(host, 'fixture-unrelated.txt'), 'The installer must leave unrelated files untouched.\n');

  // The supplied source is never edited. Candidate bytes are reversed only in
  // this disposable fixture, then checked against independently pinned hashes.
  const states = await Promise.all(pinnedFiles.map(async file => {
    const actual = hash(await fs.readFile(path.join(host, file)));
    const pin = pins.files[file];
    return actual === pin.base_sha256 ? 'base' : actual === pin.candidate_sha256 ? 'candidate' : 'drift';
  }));
  assert.ok(!states.includes('drift') && new Set(states).size === 1,
    'Fixture input must contain a complete exact base or candidate host; set PLUGIN_RUNTIME_BASELINE_ROOT');
  if (states[0] === 'candidate') assertSuccess(runPatch(result, true));
  await assertPinnedState(result, 'base');
  assert.equal(JSON.parse(await fs.readFile(path.join(host, 'package.json'))).version, pins.packageVersion);
  assert.equal(JSON.parse(await fs.readFile(path.join(host, 'dist/build-info.json'))).commit, pins.buildCommit);
  return result;
}

function runInstaller(fixture) {
  // Keep the execution environment independent of inherited application or
  // authentication state. This script only needs Node, patch, and local files.
  return spawnSync(process.execPath, [path.join(fixture.root, 'scripts/apply-plugin-runtime.mjs')], {
    cwd: fixture.root,
    env: {PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: fixture.sandbox, TMPDIR: fixture.sandbox, LANG: 'C'},
    encoding: 'utf8',
    timeout: 30_000,
  });
}

async function snapshot(root) {
  const entries = {};
  async function visit(directory, prefix = '') {
    for (const name of (await fs.readdir(directory)).sort()) {
      const relative = prefix ? `${prefix}/${name}` : name;
      const absolute = path.join(directory, name);
      const stat = await fs.lstat(absolute, {bigint: true});
      if (stat.isDirectory()) {
        entries[relative] = {type: 'directory', mode: String(stat.mode)};
        await visit(absolute, relative);
      } else if (stat.isSymbolicLink()) {
        entries[relative] = {type: 'symlink', target: await fs.readlink(absolute),
          mode: String(stat.mode), inode: String(stat.ino), modified: String(stat.mtimeNs)};
      } else {
        assert.ok(stat.isFile(), `Unexpected fixture entry ${relative}`);
        entries[relative] = {type: 'file', sha256: hash(await fs.readFile(absolute)),
          mode: String(stat.mode), inode: String(stat.ino), modified: String(stat.mtimeNs)};
      }
    }
  }
  await visit(root);
  return entries;
}

async function assertRejectedWithoutChanges(fixture, reason) {
  const before = await snapshot(fixture.sandbox);
  const result = runInstaller(fixture);
  const after = await snapshot(fixture.sandbox);
  assert.ifError(result.error);
  assert.equal(result.signal, null, diagnostic(result));
  assert.notEqual(result.status, 0, `Installer unexpectedly accepted unsafe input.\n${diagnostic(result)}`);
  if (reason) assert.match(diagnostic(result), reason);
  assert.deepEqual(after, before, 'Rejected installation must not change bytes, modes, links, file identities, or add artifacts');
}

test('installer applies exactly the six pinned changes and leaves every other fixture file untouched', async t => {
  const f = await fixture(t);
  const before = await snapshot(f.sandbox);
  assertSuccess(runInstaller(f));
  await assertPinnedState(f, 'candidate');
  const after = await snapshot(f.sandbox);
  assert.deepEqual(Object.keys(after), Object.keys(before), 'No backup, reject, staging, or unexpected files may remain');
  const changedFiles = new Set(pinnedFiles.map(file => `composition/node_modules/@paperclipai/server/${file}`));
  for (const [file, entry] of Object.entries(before)) {
    if (changedFiles.has(file)) {
      assert.notEqual(after[file].sha256, entry.sha256, `${file} must actually change`);
      assert.equal(after[file].mode, entry.mode, `${file} permissions must be preserved`);
    } else {
      assert.deepEqual(after[file], entry, `${file} must remain untouched`);
    }
  }
});

test('installer is idempotent and does not rewrite an exact applied host', async t => {
  const f = await fixture(t);
  assertSuccess(runInstaller(f));
  const before = await snapshot(f.sandbox);
  assertSuccess(runInstaller(f));
  await assertPinnedState(f, 'candidate');
  assert.deepEqual(await snapshot(f.sandbox), before);
});

test('installer rejects source drift in each pinned file without modifying the fixture', async t => {
  for (const file of pinnedFiles) await t.test(file, async t => {
    const f = await fixture(t);
    await fs.appendFile(path.join(f.host, file), '\n// unexpected source drift\n');
    await assertRejectedWithoutChanges(f, /unqualified|drift/i);
  });
});

test('installer rejects each mixed base and candidate state without finishing a partial overlay', async t => {
  const applied = await fixture(t);
  assertSuccess(runInstaller(applied));
  const candidates = new Map(await Promise.all(pinnedFiles.map(async file =>
    [file, await fs.readFile(path.join(applied.host, file))])));
  for (const isolatedState of ['candidate', 'base']) {
    for (const file of pinnedFiles) await t.test(`${file}: only this file is ${isolatedState}`, async t => {
      const f = await fixture(t);
      for (const other of pinnedFiles) {
        if ((other === file) === (isolatedState === 'candidate')) {
          await fs.writeFile(path.join(f.host, other), candidates.get(other));
        }
      }
      await assertRejectedWithoutChanges(f, /partial|unqualified/i);
    });
  }
});

for (const state of ['base', 'candidate']) {
  test(`installer rejects a tampered patch even for an exact ${state} host`, async t => {
    const f = await fixture(t);
    if (state === 'candidate') assertSuccess(runInstaller(f));
    await fs.appendFile(f.patch, '\n# corrupted patch payload\n');
    await assertRejectedWithoutChanges(f, /integrity|patch.*hash/i);
  });
}

for (const {label, file, key, value} of [
  {label: 'package version', file: 'package.json', key: 'version', value: '0.0.0-unqualified'},
  {label: 'build commit', file: 'dist/build-info.json', key: 'commit', value: '0000000000000000000000000000000000000000'},
]) {
  test(`installer rejects ${label} drift before changing host files`, async t => {
    const f = await fixture(t);
    const target = path.join(f.host, file);
    const content = JSON.parse(await fs.readFile(target));
    content[key] = value;
    await fs.writeFile(target, `${JSON.stringify(content, null, 2)}\n`);
    await assertRejectedWithoutChanges(f, /unqualified|build|version/i);
  });
}

test('installer rejects a host root symlink outside the fixture composition without changing its target', async t => {
  const f = await fixture(t);
  const external = path.join(f.sandbox, 'external-host');
  await fs.rename(f.host, external);
  await fs.symlink(external, f.host, 'dir');
  await assertRejectedWithoutChanges(f, /external|symlink|unsafe/i);
});

for (const state of ['base', 'candidate']) {
  test(`installer rejects an external parent-directory symlink within an exact ${state} host`, async t => {
    const f = await fixture(t);
    if (state === 'candidate') assertSuccess(runInstaller(f));
    const target = path.join(f.host, 'dist/services/native-runtime');
    const external = path.join(f.sandbox, 'external-native-runtime');
    await fs.rename(target, external);
    await fs.symlink(external, target, 'dir');
    await assertRejectedWithoutChanges(f);
  });

  test(`installer rejects each pinned-file symlink to an external target in an exact ${state} host`, async t => {
    for (const file of pinnedFiles) await t.test(file, async t => {
      const f = await fixture(t);
      if (state === 'candidate') assertSuccess(runInstaller(f));
      const target = path.join(f.host, file);
      const external = path.join(f.sandbox, 'external-target');
      await fs.rename(target, external);
      await fs.symlink(external, target);
      await assertRejectedWithoutChanges(f);
    });
  });
}
