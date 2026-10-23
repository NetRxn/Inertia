import { createHash } from 'node:crypto';
import type { Publication } from './ingestion.js';

/** extractive-v1 wire compatibility: JS serialization/property order is significant. */
export function publicationOutputHash(p: Omit<Publication, 'outputHash' | 'operationId'>): string {
  return sha256(JSON.stringify([p.meetingId, p.sourceId, p.revision, p.sourceHash, p.audience,
    p.transcript, p.notes, p.outputVersion, p.expectedPreviousOutputHash]));
}
export function publicationOperationId(p: Pick<Publication, 'meetingId' | 'sourceId' | 'revision' | 'sourceHash' | 'outputHash'>): string {
  return sha256(JSON.stringify([p.meetingId, p.sourceId, p.revision, p.sourceHash, p.outputHash]));
}
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
