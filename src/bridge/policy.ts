import type { VerifiedBuzzEvent } from '../buzz/events.js';
import type { BridgeCommand, Rejection, TrustedBridgeConfig } from './types.js';
const reject = (code: string, message: string): Rejection => ({ kind: 'rejection', code, message });
/** Config is loaded from host-owned bindings at apply time, never event content. */
export function resolveCommand(input: VerifiedBuzzEvent, config: TrustedBridgeConfig): BridgeCommand | Rejection {
    const { event, channelId, rootId } = input;
    if (event.pubkey === config.bridgePubkey)
        return reject('echo', 'Bridge receipt ignored.');
    const bindings = config.bindings.filter(b => b.relay === config.relay && b.channelId === channelId && b.rootId === rootId);
    if (bindings.length !== 1)
        return reject('unbound_thread', 'This thread is not connected to a native issue.');
    const binding = bindings[0]!;
    const pairings = config.pairings.filter(p => p.relay === config.relay && p.companyId === binding.companyId && p.pubkey === event.pubkey);
    if (pairings.length !== 1 || !pairings[0]!.active || pairings[0]!.kind !== 'human')
        return reject('unpaired_identity', 'Pair an active member identity before replying.');
    const base = { binding: { ...binding }, actorUserId: pairings[0]!.actorUserId, sourceEventId: event.id, authorPubkey: event.pubkey };
    const body = event.content.trim();
    if (!body || Buffer.byteLength(body, 'utf8') > (config.maxCommentBytes ?? 16384))
        return reject('invalid_content', 'Send a nonempty reply within the configured message limit.');
    if (body.startsWith('/inertia')) {
        const match = /^\/inertia (accept|reject) ([a-zA-Z0-9_-]{32,128})$/.exec(body);
        if (!match)
            return reject('unsupported_command', 'Use /inertia accept <card-token> or /inertia reject <card-token>.');
        const cards = config.cards.filter(c => c.token === match[2] && c.companyId === binding.companyId && c.issueId === binding.issueId);
        if (cards.length !== 1)
            return reject('invalid_card', 'This decision card is unavailable; open the current card in Paperclip.');
        return { ...base, kind: 'interactionResponse', action: match[1] as 'accept' | 'reject', card: { ...cards[0]! } };
    }
    return { ...base, kind: 'comment', body };
}
