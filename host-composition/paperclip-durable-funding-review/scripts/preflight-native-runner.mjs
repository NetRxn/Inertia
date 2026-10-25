/** Read-only image admission. Never starts a session, listener, database or provider. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = process.env.PAPERCLIP_NATIVE_PACKAGE_ROOT ?? path.join(root, 'node_modules/@paperclipai/server');
if (!path.isAbsolute(host) || await fs.realpath(host) !== host) throw Error('Refusing relative or symlinked native package');
const pins = JSON.parse(await fs.readFile(path.join(root, 'patches/native-runner-resolution-pins.json')));
const coordinator = JSON.parse(await fs.readFile(path.join(root, 'patches/native-coordinator-pins.json')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pkg = JSON.parse(await fs.readFile(path.join(host, 'package.json')));
const build = JSON.parse(await fs.readFile(path.join(host, 'dist/build-info.json')));
if (pkg.version !== pins.packageVersion || build.commit !== pins.buildCommit) throw Error('Unqualified native build');
if (process.argv.length > 3) throw Error('Usage: preflight-native-runner.mjs [source-build-info.json]');
if (process.argv[2]) {
  const source = JSON.parse(await fs.readFile(process.argv[2]));
  if (source.commit !== pins.buildCommit) throw Error('Unqualified source runner build');
}
for (const [file, pin] of Object.entries({ ...pins.files, ...coordinator.files, ...coordinator.newFiles })) {
  if (sha(await fs.readFile(path.join(host, file))) !== pin.candidate_sha256) throw Error(`Unqualified runner or coordinator source: ${file}`);
}
if (sha(await fs.readFile(path.join(host, pins.unchangedAuthGuard.file))) !== pins.unchangedAuthGuard.sha256) throw Error('Unqualified managed auth guard');
const { resolvePaperclipRunnerBinary } = await import(pathToFileURL(path.join(host, 'dist/services/native-runtime/native-codex-runner.js')));
const binary = resolvePaperclipRunnerBinary();
// Upstream run() returns metadata before durable/local runner initialization.
// Empty environment: no inherited credentials, tickets, HOME, or provider route.
// execvp-style spawning may interpret ENOEXEC bytes through /bin/sh even with
// shell:false. The existing Node24 execve API performs the direct system call;
// malformed ELF therefore fails rather than becoming shell input.
const probe = spawnSync(process.execPath, ['--input-type=module', '--eval',
  'process.execve(process.argv[1], [process.argv[1], "--build-metadata"], {});', binary], {
  encoding: 'utf8', env: {}, shell: false, timeout: 5000,
  killSignal: 'SIGKILL', maxBuffer: 64 * 1024,
});
if (probe.error || probe.status !== 0) throw Error('paperclip_runner_binary_probe_failed: executable or loader unavailable');
let metadata;
try { metadata = JSON.parse(probe.stdout); }
catch { throw Error('paperclip_runner_binary_probe_failed: invalid build metadata'); }
if (metadata?.schema !== 'paperclip-runner/runnerd-build-metadata/v1' ||
    metadata.binaryName !== 'paperclip-runnerd' || metadata.packageName !== '@paperclipai/paperclip-runner' ||
    metadata.binaryContractVersion !== 2 || metadata.nativeExecutionVersion !== 1 || metadata.harnessDriverVersion !== 1) {
  throw Error('paperclip_runner_binary_probe_failed: incompatible native protocol');
}
console.log(JSON.stringify({
  kind: 'native-runner-image-preflight',
  buildCommit: build.commit,
  platform: process.platform,
  arch: process.arch,
  binary,
  sha256: sha(await fs.readFile(binary)),
  executed: 'build-metadata-only',
  metadata,
  deploymentReady: false,
}));
