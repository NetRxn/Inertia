import type { ProjectionEvent, ProjectionLease, ProjectionReceipt, ProjectionSnapshot, ProjectionTarget } from './types.js';
export interface ProjectionSource {
  pending(lease: ProjectionLease, limit: number): Promise<ProjectionEvent[]>;
  hydrate(lease: ProjectionLease, event: ProjectionEvent): Promise<ProjectionSnapshot>;
  acknowledge(lease: ProjectionLease, sequence: number, receipt: ProjectionReceipt): Promise<void>;
}
/** Called by the existing Paperclip job lifecycle; this creates no scheduler/tasks. */
export async function projectPending(source: ProjectionSource, target: ProjectionTarget, lease: ProjectionLease, limit = 100): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('Invalid projection batch limit');
  await target.advanceFence(lease);
  const events = await source.pending(lease, limit);
  if (events.length > limit) throw Error('Unbounded source event batch');
  for (const [i, event] of events.entries()) {
    if (event.contract_version !== 'partner-graph-v1' || event.organization_id !== lease.organization_id || event.operation !== 'refresh') throw Error('Invalid projection event tenant/contract');
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1 || (i > 0 && event.sequence !== events[i-1]!.sequence + 1)) throw Error('Projection sequence gap');
  }
  let count = 0;
  for (const event of events) {
    const current = await source.hydrate(lease, event);
    if (current.organization_id !== event.organization_id || current.assertion_id !== event.assertion_id || current.revision < event.revision) throw Error('Invalid authoritative snapshot');
    const applied = await target.apply(lease, current);
    const readback = await target.receipt(event.organization_id, event.assertion_id);
    if (!readback || readback.assertion_id !== applied.assertion_id || readback.revision !== applied.revision || readback.snapshot_hash !== applied.snapshot_hash || readback.deleted !== applied.deleted || Boolean(readback.projection_omitted) !== Boolean(applied.projection_omitted)) throw Error('Projection readback mismatch');
    await source.acknowledge(lease, event.sequence, readback);
    count++;
  }
  return count;
}
