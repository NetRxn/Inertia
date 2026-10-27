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
      revalidatePath('/work');
      revalidatePath('/');
    }

    return message;
  } catch (error) {
    return toClaimMessage(error instanceof Error ? error : new Error('Unknown error'));
  }
}
