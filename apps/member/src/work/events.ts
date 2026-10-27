import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { workEvents } from '../db/schema';

export type WorkEventKind = (typeof workEvents.$inferSelect)['kind'];

/**
 * Records who did what on which task. Kept in Inertia, so the history
 * survives a change of work engine and can later become contribution credit.
 */
export async function recordWorkEvent(db: Db, event: { memberId: string | null; taskId: string; kind: WorkEventKind; detail?: string | null; at?: Date }): Promise<void> {
  await db.insert(workEvents).values({ memberId: event.memberId, taskId: event.taskId, kind: event.kind, detail: event.detail ?? null, ...(event.at ? { at: event.at } : {}) });
}

export async function eventsForTask(db: Db, taskId: string) {
  return db.select().from(workEvents).where(eq(workEvents.taskId, taskId)).orderBy(desc(workEvents.at));
}
