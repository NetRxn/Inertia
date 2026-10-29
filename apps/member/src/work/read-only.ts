import type { WorkSource } from '../adapters/types';

/** The work engine is connected read-only, so Inertia can't add work to it. */
export class ReadOnlyWorkError extends Error {}

/** Throws ReadOnlyWorkError, with what to change, when the engine can't create tasks. */
export function requireWritableEngine(engine: WorkSource): asserts engine is WorkSource & Required<Pick<WorkSource, 'createTask'>> {
  if (engine.createTask) return;
  const name = engine.engine?.name ?? 'The work engine';
  throw new ReadOnlyWorkError(
    name === 'Paperclip'
      ? 'Paperclip is connected read-only (PAPERCLIP_ACCESS=read), so Inertia can’t add tasks there. Set PAPERCLIP_ACCESS=write to turn this on.'
      : `${name} is connected read-only, so Inertia can’t add tasks there.`,
  );
}
