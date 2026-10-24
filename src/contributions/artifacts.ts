import { createHash } from 'node:crypto';
import type { Artifact } from './contracts.js';
export const contributionHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
/** Inline UTF-8 inert evidence only. No paths, URL fetching, archives or execution. */
export function validateArtifacts(value: unknown): Artifact[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw Error('Invalid artifacts');
  let bytes = 0;
  const names = new Set<string>();
  const artifacts = value.map((v: unknown): Artifact => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid artifact');
    const a = v as Record<string, unknown>;
    if (Object.keys(a).sort().join(',') !== 'mediaType,name,sha256,text' ||
      typeof a.name !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}\.(txt|json)$/.test(a.name) ||
      names.has(a.name) || typeof a.text !== 'string' || typeof a.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(a.sha256)) throw Error('Invalid artifact');
    if ((a.mediaType === 'text/plain' && !a.name.endsWith('.txt')) ||
      (a.mediaType === 'application/json' && !a.name.endsWith('.json')) ||
      !['text/plain','application/json'].includes(String(a.mediaType))) throw Error('Invalid artifact type');
    const size = Buffer.byteLength(a.text, 'utf8'); bytes += size;
    if (size > 65536 || bytes > 131072 || a.text !== Buffer.from(a.text).toString('utf8') ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(a.text) ||
      /^\s*(#!|<|MZ|PK\x03\x04)/.test(a.text) || a.sha256 !== contributionHash(a.text)) throw Error('Invalid artifact content');
    if (a.mediaType === 'application/json') {
      try { JSON.parse(a.text); } catch { throw Error('Invalid JSON artifact'); }
    }
    names.add(a.name);
    return {name:a.name, mediaType:a.mediaType as Artifact['mediaType'], text:a.text, sha256:a.sha256};
  });
  return artifacts.sort((a,b)=>a.name.localeCompare(b.name, 'en'));
}
