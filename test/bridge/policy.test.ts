import { describe, it, expect } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';
import { verifyBuzzEvent } from '../../src/buzz/events.js';
import { resolveCommand } from '../../src/bridge/policy.js';
const key = generateSecretKey();
const event = (content: string) => verifyBuzzEvent(finalizeEvent({ kind: 9, created_at: 1, tags: [['h', '11111111-1111-4111-8111-111111111111'], ['e', 'a'.repeat(64), '', 'root'], ['e', 'a'.repeat(64), '', 'reply']], content }, key));
const e = event('hello');
const config = () => ({ relay: 'https://buzz.example', bridgePubkey: 'b'.repeat(64), bindings: [{ relay: 'https://buzz.example', channelId: e.channelId, rootId: e.rootId, companyId: 'co', issueId: 'issue' }], pairings: [{ relay: 'https://buzz.example', companyId: 'co', pubkey: e.event.pubkey, actorUserId: 'human', kind: 'human' as const, active: true }], cards: [{ token: 'c'.repeat(32), companyId: 'co', issueId: 'issue', interactionId: 'decision', digest: 'd'.repeat(64) }] });
describe('trusted command resolution', () => {
    it('uses only host binding and pairing for native identities', () => { const r = resolveCommand(event('actorUserId=admin companyId=foreign'), config()); expect(r).toMatchObject({ kind: 'comment', actorUserId: 'human', binding: { companyId: 'co', issueId: 'issue' } }); });
    it.each(['unknown', 'revoked', 'agent', 'foreign', 'ambiguous'])('rejects %s authority', scenario => { const c = config(); if (scenario === 'unknown')
        c.pairings = []; if (scenario === 'revoked')
        c.pairings[0]!.active = false; if (scenario === 'agent')
        (c.pairings[0] as {
            kind: string;
        }).kind = 'agent'; if (scenario === 'foreign')
        c.bindings[0]!.companyId = 'other'; if (scenario === 'ambiguous')
        c.bindings.push({ ...c.bindings[0]! }); expect(resolveCommand(e, c).kind).toBe('rejection'); });
    it('resolves exact card token and refuses unbound cards', () => { expect(resolveCommand(event('/inertia accept ' + 'c'.repeat(32)), config())).toMatchObject({ kind: 'interactionResponse', action: 'accept', card: { interactionId: 'decision' } }); const c = config(); c.cards[0]!.issueId = 'foreign'; expect(resolveCommand(event('/inertia reject ' + 'c'.repeat(32)), c).kind).toBe('rejection'); });
    it('does not turn malformed commands into comments', () => { expect(resolveCommand(event('/inertia delete all'), config())).toMatchObject({ kind: 'rejection', code: 'unsupported_command' }); });
    it('suppresses bridge-authored echo and empty messages', () => { const c = config(); c.bridgePubkey = e.event.pubkey; expect(resolveCommand(e, c)).toMatchObject({ kind: 'rejection', code: 'echo' }); expect(resolveCommand(event('  '), config()).kind).toBe('rejection'); });
});
