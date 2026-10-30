import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = path.join(root, 'node_modules/@paperclipai/server');
const { resolvePaperclipRunnerBinary } = await import(pathToFileURL(path.join(host,
  'dist/services/native-runtime/native-codex-runner.js')));

async function fixture(t, { machine = 62, elfClass = 2, endian = 1, mode = 0o755, bytes } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'native-runner-elf-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const binary = path.join(dir, 'paperclip-runnerd');
  const header = Buffer.alloc(64);
  header.set([0x7f, 0x45, 0x4c, 0x46, elfClass, endian, 1]);
  header.writeUInt16LE(3, 16); // ET_DYN, as in the packaged PIE executable.
  header.writeUInt16LE(machine, 18);
  header.writeUInt32LE(1, 20);
  await fs.writeFile(binary, bytes ?? header, { mode });
  return { dir, binary };
}

function platform(t, arch) {
  for (const [key, value] of Object.entries({ platform: 'linux', arch })) {
    const previous = Object.getOwnPropertyDescriptor(process, key);
    Object.defineProperty(process, key, { ...previous, value });
    t.after(() => Object.defineProperty(process, key, previous));
  }
}

test('missing explicit runner fails closed instead of using the packaged fallback', async t => {
  platform(t, 'x64');
  const { dir } = await fixture(t);
  assert.throws(() => resolvePaperclipRunnerBinary(path.join(dir, 'missing')),
    /paperclip_runner_binary_missing/);
});

test('wrong-architecture explicit runner is refused even when executable', async t => {
  platform(t, 'arm64');
  const { binary } = await fixture(t, { machine: 62 });
  assert.throws(() => resolvePaperclipRunnerBinary(binary), /paperclip_runner_binary_architecture_mismatch/);
});

for (const [arch, machine] of [['x64', 62], ['arm64', 183]]) {
  test(`Linux ${arch} honors the correct explicit ELF executable`, async t => {
    platform(t, arch);
    const { binary } = await fixture(t, { machine });
    assert.equal(resolvePaperclipRunnerBinary(binary), binary);
  });
}

test('environment override is authoritative and validated identically', async t => {
  platform(t, 'arm64');
  const { binary } = await fixture(t, { machine: 183 });
  const before = process.env.PAPERCLIP_RUNNER_BINARY;
  t.after(() => before === undefined ? delete process.env.PAPERCLIP_RUNNER_BINARY : process.env.PAPERCLIP_RUNNER_BINARY = before);
  process.env.PAPERCLIP_RUNNER_BINARY = binary;
  assert.equal(resolvePaperclipRunnerBinary(), binary);
  process.env.PAPERCLIP_RUNNER_BINARY = binary + '-missing';
  assert.throws(() => resolvePaperclipRunnerBinary(), /paperclip_runner_binary_missing/);
});

for (const [name, options] of [
  ['non-ELF script', { bytes: Buffer.from('#!/bin/sh\nexit 0\n') }],
  ['truncated ELF', { bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46]) }],
  ['32-bit ELF', { elfClass: 1 }],
  ['big-endian ELF', { endian: 2 }],
]) {
  test(`Linux refuses ${name} before execution`, async t => {
    platform(t, 'x64');
    const { binary } = await fixture(t, options);
    assert.throws(() => resolvePaperclipRunnerBinary(binary), /paperclip_runner_binary_(invalid|architecture_mismatch)/);
  });
}

test('explicit directory and non-executable file cannot pass admission', async t => {
  platform(t, 'x64');
  const { binary, dir } = await fixture(t, { mode: 0o644 });
  for (const value of [binary, dir]) assert.throws(() => resolvePaperclipRunnerBinary(value), /paperclip_runner_binary_(missing|invalid)/);
});

test('relative explicit path is refused', () => {
  assert.throws(() => resolvePaperclipRunnerBinary('./paperclip-runnerd'), /absolute path/);
});

test('unsupported Linux architecture fails rather than selecting another machine', async t => {
  platform(t, 'riscv64');
  const { binary } = await fixture(t);
  assert.throws(() => resolvePaperclipRunnerBinary(binary), /paperclip_runner_binary_unsupported_platform/);
});

test('default packaged fallback is also architecture-checked', async t => {
  const packaged = path.join(host, 'dist/vendor/paperclip-runner/bin/paperclip-runnerd');
  const header = await fs.readFile(packaged);
  platform(t, header.readUInt16LE(18) === 62 ? 'arm64' : 'x64');
  assert.throws(() => resolvePaperclipRunnerBinary(''), /paperclip_runner_binary_architecture_mismatch/);
});

test('executable FIFO is refused without blocking the resolver process', async t => {
  const { dir } = await fixture(t);
  const fifo = path.join(dir, 'runner-fifo');
  const make = spawnSync('mkfifo', [fifo], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(make.status, 0, make.stderr);
  await fs.chmod(fifo, 0o755);
  const moduleUrl = pathToFileURL(path.join(host, 'dist/services/native-runtime/native-codex-runner.js')).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval',
    `const {resolvePaperclipRunnerBinary}=await import(${JSON.stringify(moduleUrl)});resolvePaperclipRunnerBinary(process.argv[1]);`, fifo],
    { encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 });
  assert.notEqual(child.error?.code, 'ETIMEDOUT', 'non-regular executables must not block before validation');
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /paperclip_runner_binary_invalid/);
});
