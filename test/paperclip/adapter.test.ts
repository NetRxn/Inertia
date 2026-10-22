import { it, expect } from 'vitest';
import type { PluginContext } from '@paperclipai/plugin-sdk';
import { createPaperclipAdapter, interactionDigest } from '../../src/paperclip/adapter.js';
import type { InteractionCommand } from '../../src/bridge/types.js';
const binding = { relay: 'https://buzz.example', channelId: 'chan', rootId: 'root', companyId: 'co', issueId: 'issue' };
const row = () => ({ id: 'decision', companyId: 'co', issueId: 'issue', kind: 'request_confirmation', title: 'Approve draft', summary: null, payload: { version: 1, prompt: 'Proceed?' }, status: 'pending' });
function fixture() { let current: any = row(); const writes: unknown[] = []; let deny = false; let lose = false; const host = { issues: { async createComment(...args: unknown[]) { if (deny)
            throw Error('membership denied'); writes.push(args); return { id: 'comment' }; }, async listComments() { return [{ id: 'comment', body: 'existing' }]; }, async listInteractions() { return [current]; }, async respondInteraction(...args: unknown[]) { if (deny)
            throw Error('membership denied'); writes.push(args); if (lose)
            return { interaction: { ...current, status: 'rejected' }, applied: false }; return { interaction: { ...current, status: 'accepted' }, applied: true }; } } } as unknown as Pick<PluginContext, 'issues'>; return { adapter: createPaperclipAdapter(host), writes, setCurrent: (r: any) => current = r, setDeny: () => deny = true, setLose: () => lose = true }; }
function command(): InteractionCommand { return { kind: 'interactionResponse', binding, actorUserId: 'human', authorPubkey: 'pub', sourceEventId: 'event', action: 'accept', card: { token: 'x'.repeat(32), companyId: 'co', issueId: 'issue', interactionId: 'decision', digest: interactionDigest(row() as any) } }; }
it('attributes native comments to paired human, with correlation marker and no extra wake', async () => { const f = fixture(); const result = await f.adapter.comment({ ...command(), kind: 'comment', body: 'hello' }); expect(result.id).toBe('comment'); expect(f.writes).toEqual([['issue', expect.stringContaining('hello\n\n<!-- inertia:'), 'co', { actorUserId: 'human' }]]); });
it('rejects changed content before response and preserves host membership denial', async () => { const f = fixture(); f.setCurrent({ ...row(), summary: 'changed' }); await expect(f.adapter.respond(command())).rejects.toThrow('stale'); expect(f.writes).toHaveLength(0); const g = fixture(); g.setDeny(); await expect(g.adapter.respond(command())).rejects.toThrow('membership denied'); });
it('returns host winning resolution rather than requested opposite outcome', async () => { const f = fixture(); f.setLose(); expect(await f.adapter.respond(command())).toMatchObject({ applied: false, interaction: { status: 'rejected' } }); expect(f.writes).toEqual([['issue', 'decision', { action: 'accept', actorUserId: 'human' }, 'co']]); });
it('rejects foreign native object and complex decisions without mutation', async () => { for (const change of [{ companyId: 'foreign' }, { kind: 'ask_user_questions' }, { payload: { version: 1, toolAction: {} } }, { payload: { version: 1, target: {} } }]) {
    const f = fixture();
    const r = { ...row(), ...change };
    f.setCurrent(r);
    const cmd = command();
    cmd.card.digest = interactionDigest(r as any);
    await expect(f.adapter.respond(cmd)).rejects.toThrow();
    expect(f.writes).toHaveLength(0);
} });
it('uses canonical digest for payload key ordering but binds exact content', () => { const a = row(); const b = { ...a, payload: { prompt: 'Proceed?', version: 1 } }; expect(interactionDigest(a as any)).toBe(interactionDigest(b as any)); expect(interactionDigest({ ...a, title: 'different' } as any)).not.toBe(interactionDigest(a as any)); });
it('rechecks host membership even when decision was already resolved', async () => { const f = fixture(); f.setCurrent({ ...row(), status: 'accepted' }); f.setDeny(); await expect(f.adapter.respond(command())).rejects.toThrow('membership denied'); });
