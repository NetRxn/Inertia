'use server';

import { revalidatePath } from 'next/cache';
import { getAdapters } from '../adapters';
import { requireMember } from '../identity/session';
import { toClaimMessage, type ClaimMessage } from './claim-message';

export type { ClaimMessage };

/**
 * Server action to claim a task.
 * Does not write to the app database; claims go through WorkSource.
 */
export async function claimTask(taskId: string): Promise<ClaimMessage> {
  const member = await requireMember();

  try {
    const adapters = getAdapters();

    const result = await adapters.work.claim(taskId, member.externalId);
    const message = toClaimMessage(result);

    if (message.ok) {
      revalidatePath('/work');
      revalidatePath('/');
    }

    return message;
  } catch (error) {
    return toClaimMessage(error instanceof Error ? error : new Error('Unknown error'));
  }
}
