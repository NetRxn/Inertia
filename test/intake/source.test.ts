import { afterEach, expect, it } from 'vitest';
import { mkdtemp, writeFile, chmod, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalObjectiveSourceAdapter } from '../../src/intake/source.js';
import { parseObjectiveIntakeConfiguration } from '../../src/intake/schema.js';
import { objectiveHash } from '../../src/intake/service.js';
import { fixture } from './support.js';
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'objective-source-')); directories.push(directory);
  const path = join(directory, 'source.json'), f = fixture();
  await writeFile(path, JSON.stringify(f.source), { mode: 0o600 });
  const settings = { enabled: true, sourceMode: 'owner-file', organizationId: 'dao', projectId: 'project', intakeAgentId: 'ceo', sources: [{ sourceSystem: 'dao-platform', sourceId: 'bounty-1', path, allowedAgentIds: ['ceo', 'researcher'], allowedAudiences: ['members'] }] };
  const configuration = parseObjectiveIntakeConfiguration(settings, 'co')!;
  let authorized = true;
  const adapter = createLocalObjectiveSourceAdapter(configuration, configuration.sources[0]!, async () => authorized);
  return { directory, path, f, settings, configuration, adapter, revoke() { authorized = false; } };
}
it('reads only the pinned owner file and preserves opaque revision, author, audience and original text', async () => {
  const f = await setup();
  expect(await f.adapter.read(f.f.ref)).toEqual(f.f.source);
  expect(await f.adapter.read({ ...f.f.ref, sourceId: '../other.json' })).toBeNull();
  f.f.revise({ revision: '0-earlier-lexically', withdrawn: true });
  await writeFile(f.path, JSON.stringify(f.f.source));
  expect(await f.adapter.read(f.f.ref)).toMatchObject({ revision: '0-earlier-lexically', withdrawn: true, expectedPreviousHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  f.revoke(); expect(await f.adapter.read(f.f.ref)).toBeNull();
});
it.each(['foreign-organization', 'foreign-source', 'forged-hash', 'extra-authority', 'bad-revision', 'denied-audience', 'oversized'])('withholds invalid or unauthorized source: %s', async change => {
  const f = await setup(); const source: any = structuredClone(f.f.source);
  if (change === 'foreign-organization') source.organizationId = 'other';
  if (change === 'foreign-source') source.sourceId = 'other';
  if (change === 'extra-authority') source.authority = 'admin';
  if (change === 'bad-revision') source.revision = '';
  if (change === 'denied-audience') source.audience = 'restricted';
  if (change === 'oversized') source.text = 'a'.repeat(1024 * 1024);
  source.sourceHash = objectiveHash(source);
  if (change === 'forged-hash') source.text += ' changed after hashing';
  await writeFile(f.path, JSON.stringify(source));
  expect(await f.adapter.read(f.f.ref)).toBeNull();
});
it('rejects malformed JSON, broad filesystem permissions, symlinks and non-regular files', async () => {
  const f = await setup();
  await writeFile(f.path, '{"invalid":'); expect(await f.adapter.read(f.f.ref)).toBeNull();
  await writeFile(f.path, JSON.stringify(f.f.source)); await chmod(f.path, 0o644); expect(await f.adapter.read(f.f.ref)).toBeNull();
  await chmod(f.path, 0o600); const other = join(f.directory, 'other.json'); await writeFile(other, JSON.stringify(f.f.source), { mode: 0o600 });
  await rm(f.path); await symlink(other, f.path); expect(await f.adapter.read(f.f.ref)).toBeNull();
  await rm(f.path); await mkdir(f.path); expect(await f.adapter.read(f.f.ref)).toBeNull();
});
it('default-disabled configuration cannot admit paths, identities or permissions implicitly', async () => {
  const f = await setup();
  expect(parseObjectiveIntakeConfiguration(undefined, 'co')).toBeNull();
  expect(parseObjectiveIntakeConfiguration({ enabled: false }, 'co')).toBeNull();
  for (const patch of [{ companyId: 'other' }, { sourceMode: 'remote-http' }, { organizationId: '' }, { sources: [] }, { enabled: 'true' }])
    expect(() => parseObjectiveIntakeConfiguration({ ...f.settings, ...patch }, 'co')).toThrow();
  for (const patch of [{ path: '../secret.json' }, { path: f.directory + '/../outside.json' }, { allowedAgentIds: [] }, { allowedAudiences: [] }, { allowedAgentIds: ['unknown'] }, { authority: 'admin' }])
    expect(() => parseObjectiveIntakeConfiguration({ ...f.settings, sources: [{ ...f.settings.sources[0], ...patch }] }, 'co')).toThrow();
});
it('provides a bounded reusable owner JSON reader without exposing paths in failures', async () => {
  const { readOwnerSourceJson } = await import('../../src/intake/source.js');
  const f = await setup();
  expect(await readOwnerSourceJson(f.path)).toEqual(f.f.source);
  await expect(readOwnerSourceJson(f.path, 1)).rejects.toThrow(/^Owner source file unavailable\.$/);
  await expect(readOwnerSourceJson('../private.json')).rejects.toThrow(/^Owner source file unavailable\.$/);
  await expect(readOwnerSourceJson(f.path, Number.POSITIVE_INFINITY)).rejects.toThrow();
});
it('withholds a read if configuration is revoked while the file is being read', async () => {
  const f = await setup(); let checks = 0;
  const source = createLocalObjectiveSourceAdapter(f.configuration, f.configuration.sources[0]!, async () => ++checks === 1);
  expect(await source.read(f.f.ref)).toBeNull(); expect(checks).toBe(2);
});
