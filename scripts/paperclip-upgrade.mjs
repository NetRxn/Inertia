import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const registry = 'https://registry.npmjs.org';
export function validateTarball(value) {
  const url = new URL(value);
  if (url.href !== value || url.origin !== registry || url.username || url.password ||
      url.search || url.hash || !url.pathname.endsWith('.tgz'))
    throw new Error('Package tarball must be a canonical official HTTPS registry URL');
  return value;
}
export function validatePackage(data, name) {
  if (data.name !== name || !/^\d+\.\d+\.\d+$/.test(data.version ?? '') ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(data.dist?.integrity ?? ''))
    throw new Error(`Invalid official registry metadata for ${name}`);
  validateTarball(data.dist.tarball);
  return { name, version: data.version, integrity: data.dist.integrity, tarball: data.dist.tarball };
}
export async function resolveCandidate(fetcher = fetch) {
  async function get(url) {
    const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'inertia-upgrade-check' }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Metadata request failed (${response.status}): ${url}`);
    return response.json();
  }
  const [host, sdk, release] = await Promise.all([
    get(`${registry}/paperclipai/latest`).then(p => validatePackage(p, 'paperclipai')),
    get(`${registry}/@paperclipai%2fplugin-sdk/latest`).then(p => validatePackage(p, '@paperclipai/plugin-sdk')),
    get('https://api.github.com/repos/paperclipai/paperclip/releases/latest'),
  ]);
  return { observedAt: new Date().toISOString(), host, sdk,
    release: { tag: release.tag_name, url: release.html_url, publishedAt: release.published_at },
    releaseMatchesHost: release.tag_name === `v${host.version}`,
    versionsAligned: host.version === sdk.version };
}
export function verifyLockOrigins(lock) {
  if (!lock.packages) throw new Error('Missing lock package inventory');
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '') continue;
    if (entry.link) throw new Error('Linked dependencies are not supported for upgrade qualification');
    if (entry.inBundle && !entry.resolved) {
      let parent = path;
      let container;
      while (parent.includes('/node_modules/')) {
        parent = parent.slice(0, parent.lastIndexOf('/node_modules/'));
        if (lock.packages[parent]?.resolved) { container = lock.packages[parent]; break; }
      }
      if (!container?.integrity) throw new Error('Bundled dependency has no integrity-bound registry container');
      validateTarball(container.resolved);
    } else validateTarball(entry.resolved);
  }
}
export function verifyLock(lock, candidate) {
  verifyLockOrigins(lock);
  const installed = lock.packages?.[`node_modules/${candidate.name}`];
  if (installed?.version !== candidate.version || installed?.integrity !== candidate.integrity || installed?.resolved !== candidate.tarball)
    throw new Error('Resolved package lock differs from observed candidate version/integrity');
}
async function copyTrackedSource(workspace) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of files) {
    if (file.endsWith('.npmrc')) throw new Error('Repository npm configuration requires separate review');
    await mkdir(dirname(join(workspace, file)), { recursive: true });
    await cp(join(root, file), join(workspace, file));
  }
}
export async function qualify(candidate, report, hooks = {}) {
  let workspace;
  report.result = 'qualifying';
  report.gates = {};
  try {
    workspace = await (hooks.makeWorkspace ?? (() => mkdtemp(join(tmpdir(), 'inertia-paperclip-upgrade-'))))();
    report.workspace = workspace;
    await (hooks.copySource ?? copyTrackedSource)(workspace);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)));
    env.npm_config_cache = join(tmpdir(), 'inertia-npm-cache');
    const configDir = await mkdtemp(join(tmpdir(), 'inertia-npm-config-'));
    report.npmConfigWorkspace = configDir;
    env.npm_config_userconfig = join(configDir, 'user.npmrc');
    env.npm_config_globalconfig = join(configDir, 'global.npmrc');
    env.npm_config_registry = registry;
    await writeFile(env.npm_config_userconfig, '');
    await writeFile(env.npm_config_globalconfig, '');
    const run = (command, args, cwd = workspace) => execFileSync(command,
      command === 'npm' ? [...args, '--registry=https://registry.npmjs.org', `--userconfig=${env.npm_config_userconfig}`, `--globalconfig=${env.npm_config_globalconfig}`] : args,
      { cwd, timeout: 600_000, stdio: ['ignore', 2, 2], env });
    const pkg = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'));
    verifyLockOrigins(JSON.parse(await readFile(join(workspace, 'package-lock.json'), 'utf8')));
    pkg.dependencies['@paperclipai/plugin-sdk'] = candidate.sdk.version;
    await writeFile(join(workspace, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    const hostDir = await mkdtemp(join(tmpdir(), 'inertia-paperclip-host-'));
    report.hostWorkspace = hostDir;
    await writeFile(join(hostDir, 'package.json'), JSON.stringify({private:true,type:'module',dependencies:{paperclipai:candidate.host.version}}, null, 2) + '\n');
    run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
    verifyLock(JSON.parse(await readFile(join(workspace, 'package-lock.json'), 'utf8')), candidate.sdk);
    run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], hostDir);
    verifyLock(JSON.parse(await readFile(join(hostDir, 'package-lock.json'), 'utf8')), candidate.host);
    run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
    run('git', ['init', '--quiet']); run('git', ['add', '--all']);
    for (const gate of ['typecheck', 'test', 'test:package']) {
      report.gates[gate] = 'running'; run('npm', ['run', gate]); report.gates[gate] = 'passed';
    }
    report.result = 'sdk-and-package-qualified';
  } catch (error) { report.result = 'failed'; report.failure = error.message; throw error; }
  finally {
    report.nativeHost = 'Separate native-services and full HTTP qualification required for this exact host candidate before promotion.';
    if (workspace) {
      try { await writeFile(join(workspace, 'upgrade-receipt.json'), JSON.stringify(report, null, 2) + '\n'); }
      catch (error) { report.result = 'failed'; report.receiptWriteFailure = error.message; throw error; }
    }
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => !['--qualify', '--dry-run'].includes(a)) || (args.includes('--qualify') && args.includes('--dry-run')))
    throw new Error('Usage: node scripts/paperclip-upgrade.mjs [--dry-run | --qualify]');
  const report = { result: args.includes('--qualify') ? 'qualifying' : 'report-only', rootLockPolicy: 'read-only' };
  try {
    const profile = JSON.parse(await readFile(join(root, 'docs/qualification/paperclip-versions.json'), 'utf8'));
    report.baseline = profile.baseline;
    report.sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root,encoding:'utf8'}).trim();
    report.workingTreeDirty = !!execFileSync('git', ['status','--porcelain','--untracked-files=no'], {cwd:root,encoding:'utf8'}).trim();
    report.candidate = await resolveCandidate();
    if (args.includes('--qualify')) await qualify(report.candidate, report);
  } catch (error) { report.result = 'failed'; report.failure = error.message; throw error; }
  finally { console.log(JSON.stringify(report, null, 2)); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
