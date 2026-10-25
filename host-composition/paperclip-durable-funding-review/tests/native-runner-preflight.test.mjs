import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = path.join(root, 'node_modules/@paperclipai/server');
const packaged = path.join(host, 'dist/vendor/paperclip-runner/bin/paperclip-runnerd');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const output = result => (result.stdout ?? '') + (result.stderr ?? '');
const run = (binary, stamp, cwd = root) => spawnSync(process.execPath,
  [path.join(root, 'scripts/preflight-native-runner.mjs'), ...(stamp ? [stamp] : [])],
  { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, PAPERCLIP_RUNNER_BINARY: binary } });

for (const kind of ['missing', 'wrong-machine']) test(`image preflight rejects ${kind} before artifact replacement`, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-preflight-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const binary = path.join(dir, 'runnerd');
  if (kind === 'wrong-machine') {
    const header = Buffer.alloc(64);
    header.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
    header.writeUInt16LE(3, 16);
    header.writeUInt16LE(process.arch === 'x64' ? 183 : 62, 18);
    header.writeUInt32LE(1, 20);
    await fs.writeFile(binary, header, { mode: 0o755 });
  }
  const before = sha(await fs.readFile(packaged));
  const result = run(binary, undefined, dir);
  assert.notEqual(result.status, 0);
  assert.match(output(result), kind === 'missing' ? /paperclip_runner_binary_missing/ : /paperclip_runner_binary_architecture_mismatch/);
  assert.equal(sha(await fs.readFile(packaged)), before);
});

test('image preflight verifies source build identity and emits read-only artifact evidence', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-preflight-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const stamp = path.join(dir, 'build-info.json');
  await fs.writeFile(stamp, JSON.stringify({ commit: 'bba6a45f0d364cfd962ac59b3bdf2426a8222adb' }));
  const result = run(packaged, stamp);
  assert.equal(result.status, 0, output(result));
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.binary, packaged);
  assert.equal(receipt.sha256, sha(await fs.readFile(packaged)));
  assert.equal(receipt.platform, 'linux');
  assert.equal(receipt.arch, process.arch);
  assert.equal(receipt.executed, 'build-metadata-only');
  assert.equal(receipt.metadata.binaryName, 'paperclip-runnerd');
  assert.equal(receipt.metadata.binaryContractVersion, 2);
  assert.equal(receipt.deploymentReady, false);
  await fs.writeFile(stamp, JSON.stringify({ commit: '0'.repeat(40) }));
  const mismatch = run(packaged, stamp);
  assert.notEqual(mismatch.status, 0);
  assert.match(output(mismatch), /Unqualified source runner build/);
});

test('matching ELF header alone cannot pass image preflight when the loader cannot execute it', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-preflight-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const binary = path.join(dir, 'truncated-program');
  const header = Buffer.alloc(64);
  header.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  header.writeUInt16LE(3, 16);
  header.writeUInt16LE(process.arch === 'x64' ? 62 : 183, 18);
  header.writeUInt32LE(1, 20);
  await fs.writeFile(binary, header, { mode: 0o755 });
  const result = run(binary, undefined, dir);
  assert.notEqual(result.status, 0);
  assert.match(output(result), /paperclip_runner_binary_probe_failed/);
  assert.deepEqual(await fs.readdir(dir), ['truncated-program'], 'ENOEXEC must not fall back to a shell');
});

test('another executable cannot impersonate the runner protocol', () => {
  const result = run(process.execPath);
  assert.notEqual(result.status, 0);
  assert.match(output(result), /paperclip_runner_binary_probe_failed/);
});
