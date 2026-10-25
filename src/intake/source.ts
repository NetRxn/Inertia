import { constants } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import { open, lstat, realpath } from 'node:fs/promises';
import type { IntakeDependencies, ObjectiveSubmission } from './contracts.js';
import type { ObjectiveIntakeConfiguration, ObjectiveSourceConfiguration } from './schema.js';
import { objectiveHash } from './service.js';
const maximumBytes = 1024 * 1024;
const hex = /^[a-f0-9]{64}$/;
function valid(value: unknown): value is ObjectiveSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as ObjectiveSubmission;
  if (Object.keys(s).sort().join(',') !== ['sourceSystem', 'sourceId', 'organizationId', 'revision', 'sourceHash', 'expectedPreviousHash', 'authorRef', 'audience', 'title', 'text', 'withdrawn'].sort().join(',')) return false;
  return [s.sourceSystem, s.sourceId, s.organizationId, s.revision, s.authorRef, s.title, s.text].every(v =>
    typeof v === 'string' && !!v.trim() && v.length <= 100000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) &&
    ['public', 'members', 'restricted'].includes(s.audience) && typeof s.withdrawn === 'boolean' &&
    typeof s.sourceHash === 'string' && hex.test(s.sourceHash) &&
    (s.expectedPreviousHash === null || (typeof s.expectedPreviousHash === 'string' && hex.test(s.expectedPreviousHash))) && objectiveHash(s) === s.sourceHash;
}
/** Read a trusted administrator-pinned path only. The caller must enforce current scope and schema. */
export async function readOwnerSourceJson(path: string, limit = maximumBytes): Promise<unknown> {
  const unavailable = () => Error('Owner source file unavailable.');
  try {
    if (typeof path !== 'string' || !isAbsolute(path) || normalize(path) !== path || path.length > 4096 || /[\x00-\x1f\x7f]/.test(path) ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 8 * maximumBytes || await realpath(path) !== path) throw unavailable();
    const before = await lstat(path);
    if (!before.isFile() || before.size < 1 || before.size > limit || (before.mode & 0o077) !== 0 ||
        typeof process.getuid !== 'function' || before.uid !== process.getuid()) throw unavailable();
    // NONBLOCK prevents special-file replacement from hanging between lstat and open.
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const initial = await handle.stat();
      if (!initial.isFile() || initial.ino !== before.ino || initial.dev !== before.dev || initial.size !== before.size ||
          (initial.mode & 0o077) !== 0 || initial.uid !== before.uid) throw unavailable();
      const bytes = Buffer.alloc(initial.size + 1);
      let offset = 0;
      while (offset < bytes.length) {
        const result = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!result.bytesRead) break;
        offset += result.bytesRead;
      }
      const after = await handle.stat(), pathAfter = await lstat(path);
      if (offset !== initial.size || after.size !== initial.size || after.mtimeMs !== initial.mtimeMs || after.ctimeMs !== initial.ctimeMs ||
          !pathAfter.isFile() || pathAfter.ino !== initial.ino || pathAfter.dev !== initial.dev || (pathAfter.mode & 0o077) !== 0 ||
          await realpath(path) !== path) throw unavailable();
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset)));
    } finally { await handle.close(); }
  } catch { throw unavailable(); }
}
/** Offline owner export only. Re-read and reauthorize each call; never turn source prose into authority. */
export function createLocalObjectiveSourceAdapter(configuration: ObjectiveIntakeConfiguration, source: ObjectiveSourceConfiguration, authorize: () => Promise<boolean>): IntakeDependencies['source'] {
  const c = structuredClone(configuration), pinned = structuredClone(source);
  if (!c.sources.some(s => JSON.stringify(s) === JSON.stringify(pinned))) throw Error('Objective source not configured.');
  return {
    async read(ref) {
      if (!ref || ref.sourceSystem !== pinned.sourceSystem || ref.sourceId !== pinned.sourceId) return null;
      try {
        if (!await authorize()) return null;
        const parsed = await readOwnerSourceJson(pinned.path);
        if (!await authorize() || !valid(parsed) || parsed.organizationId !== c.organizationId || parsed.sourceSystem !== pinned.sourceSystem || parsed.sourceId !== pinned.sourceId ||
            !pinned.allowedAudiences.includes(parsed.audience)) return null;
        return parsed;
      } catch { return null; }
    },
  };
}
