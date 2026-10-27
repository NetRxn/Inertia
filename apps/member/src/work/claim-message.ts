import type { ClaimResult } from '../adapters/types';

export type ClaimMessage =
  | { ok: true; message: "It's yours." }
  | { ok: false; message: string };

/**
 * Pure function that maps a ClaimResult or Error to a ClaimMessage.
 * This is the core logic for translating adapter results into user-facing messages.
 */
export function toClaimMessage(result: ClaimResult | Error): ClaimMessage {
  if (result instanceof Error) {
    return {
      ok: false,
      message: "Couldn't reach the task system. Try again.",
    };
  }

  if (result.ok) {
    return {
      ok: true,
      message: "It's yours.",
    };
  }

  // Map failure reasons to user-facing messages
  switch (result.reason) {
    case 'already-claimed':
      return {
        ok: false,
        message: 'Someone already took this.',
      };
    case 'not-found':
      return {
        ok: false,
        message: 'This task is no longer available.',
      };
    case 'unavailable':
      return {
        ok: false,
        message: "Couldn't reach the task system. Try again.",
      };
  }
}
