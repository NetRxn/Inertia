import type { HumanTask, Initiative, TaskKind } from '../adapters/types';

/**
 * Most important first. Initiatives without a priority come after ranked ones
 * and keep the source's order (Array.prototype.sort is stable).
 */
export function byPriority(a: Initiative, b: Initiative): number {
  if (a.priority == null || b.priority == null) {
    return (a.priority == null ? 1 : 0) - (b.priority == null ? 1 : 0);
  }
  return a.priority - b.priority;
}

/** A task whose source doesn't say what kind it is reads as a review. */
export function taskKind(task: HumanTask): TaskKind {
  return task.kind ?? 'review';
}
