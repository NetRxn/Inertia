/** Composition preparation only. No Docker, mkdir, symlink creation, migration or API writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function absolute(value) {
  if (typeof value !== 'string' || !path.posix.isAbsolute(value) || value === '/' ||
      path.posix.normalize(value) !== value || value.endsWith('/') || /[\\\x00-\x1f\x7f]/.test(value)) {
    throw Error('Expected normalized absolute non-root path');
  }
  return value;
}
const within = (a, b) => a === b || a.startsWith(`${b}/`);
export function sharedHomeMounts(config) {
  const { hostHome, hostData, paperclipHome, instanceId, transientInstanceSecrets = false } = config;
  for (const value of [hostHome, hostData, paperclipHome]) absolute(value);
  if (within(hostHome, hostData) || within(hostData, hostHome)) throw Error('Host home/data overlap risks recursive data link');
  if (typeof instanceId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(instanceId)) throw Error('Invalid instanceId');
  if (typeof transientInstanceSecrets !== 'boolean') throw Error('transientInstanceSecrets must be boolean');
  const mounts = [{ type: 'bind', source: hostHome, target: paperclipHome, readOnly: false }];
  if (transientInstanceSecrets) mounts.push({ type: 'tmpfs', target: path.posix.join(paperclipHome, 'instances', instanceId, 'secrets') });
  return mounts;
}

async function directories(directory, allowMissing = false) {
  let current = '/';
  for (const segment of directory.split('/').filter(Boolean)) {
    current = path.posix.join(current, segment);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) { if (allowMissing && error.code === 'ENOENT') return false; throw error; }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('Refusing symlink or non-directory component');
  }
  return true;
}

export async function preflightSharedHome(config) {
  const mounts = sharedHomeMounts(config);
  await directories(config.hostHome);
  await directories(config.hostData);
  if (config.transientInstanceSecrets) {
    const secrets = path.posix.join(config.hostHome, 'instances', config.instanceId, 'secrets');
    if (await directories(secrets, true) && (await fs.readdir(secrets)).length !== 0) {
      throw Error('Underlying durable secrets directory is not empty; tmpfs would merely hide retained material');
    }
  }
  return { kind: 'shared-home-source-path-preflight', mounts, deploymentReady: false, runtimeQualified: false };
}

/** For reviewed fixed boot links only. Inspection is not an idempotent boot implementation. */
export async function inspectFixedLink(link, expectedTarget) {
  absolute(link); absolute(expectedTarget);
  await directories(path.posix.dirname(link));
  let stat;
  try { stat = await fs.lstat(link); }
  catch (error) { if (error.code === 'ENOENT') return 'absent'; throw error; }
  if (!stat.isSymbolicLink() || await fs.readlink(link) !== expectedTarget) throw Error('Existing fixed link conflict');
  return 'matching';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw Error('Usage: preflight-shared-home.mjs CONFIG_JSON');
  const config = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  console.log(JSON.stringify(await preflightSharedHome(config), null, 2));
}
