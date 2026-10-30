'use server';

import { revalidatePath } from 'next/cache';
import { getAdapters } from '../adapters';
import { getDb } from '../db/client';
import { recordWorkEvent } from './events';
import { requireMember } from '../identity/session';
import { toClaimMessage, type ClaimMessage } from './claim-message';

export type { ClaimMessage };

/**
 * Server action to claim a task.
 * The claim itself goes through WorkSource; Inertia only records who claimed what.
 */
export async function claimTask(taskId: string): Promise<ClaimMessage> {
  const member = await requireMember();

  try {
    const adapters = getAdapters();

    const result = await adapters.work.claim(taskId, member.externalId);
    const message = toClaimMessage(result);

    if (message.ok) {
      await recordWorkEvent(getDb(), { memberId: member.id, taskId, kind: 'claimed' }).catch((error) => console.error('[work] Could not record claim:', error));
      revalidatePath('/agents');
      revalidatePath('/');
    }

    return message;
  } catch (error) {
    return toClaimMessage(error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * Finishes a claimed task with the member's answer. The answer goes back to
 * the work engine for agents, and into what Inertia knows, so it isn't lost.
 */
export async function completeTask(taskId: string, answer: string): Promise<{ ok: boolean; message: string }> {
  const member = await requireMember();
  const text = answer.trim().slice(0, 4000);
  if (!text) return { ok: false, message: 'Add your answer or a short note on what you did.' };
  try {
    const work = getAdapters().work;
    if (!work.complete) return { ok: false, message: "This task system doesn't take answers here yet." };
    const tasks = await work.listHumanTasks();
    const task = tasks.find((t) => t.id === taskId);
    const result = await work.complete(taskId, member.externalId, text);
    if (!result.ok) return toClaimMessage(result);
    const db = getDb();
    await recordWorkEvent(db, { memberId: member.id, taskId, kind: 'completed', detail: text.slice(0, 500) });
    const { addSource } = await import('../org/ingest');
    await addSource(db, { kind: 'note', title: `${member.displayName}: ${task?.title ?? 'task answer'}`, content: text, addedBy: member.id }).catch(() => undefined);
    revalidatePath('/agents');
    revalidatePath('/');
    return { ok: true, message: 'Done. Thank you! Agents will pick up your answer.' };
  } catch (error) {
    return toClaimMessage(error instanceof Error ? error : new Error('Unknown error'));
  }
}
