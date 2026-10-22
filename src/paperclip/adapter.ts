import { createHash } from 'node:crypto';
import type { PluginContext } from '@paperclipai/plugin-sdk';
import type { Binding, CommentCommand, InteractionCommand } from '../bridge/types.js';
type Issues = PluginContext['issues'];
export type NativeInteraction = Awaited<ReturnType<Issues['listInteractions']>>[number];
function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}
/** Bind all rendered and authority-relevant content, excluding only mutable resolution metadata. */
export function interactionDigest(interaction: NativeInteraction): string {
    const { status: _status, result: _result, updatedAt: _updatedAt, resolvedAt: _resolvedAt, ...content } = interaction;
    return createHash('sha256').update(canonical(content)).digest('hex');
}
export function sourceMarker(binding: Binding, eventId: string): string {
    return '<!-- inertia:' + createHash('sha256').update(JSON.stringify([binding.relay, eventId, binding.companyId, binding.issueId])).digest('hex') + ' -->';
}
/** Native API owns membership, authorization, atomic resolution and wakes. */
export function createPaperclipAdapter(ctx: Pick<PluginContext, 'issues'>) {
    const getInteraction = async (binding: Binding, id: string) => {
        const rows = await ctx.issues.listInteractions(binding.issueId, binding.companyId);
        const row = rows.find(r => r.id === id);
        if (!row || row.companyId !== binding.companyId || row.issueId !== binding.issueId)
            throw Error('Native decision unavailable in this issue.');
        return row;
    };
    return {
        comment(command: CommentCommand) { return ctx.issues.createComment(command.binding.issueId, command.body + '\n\n' + sourceMarker(command.binding, command.sourceEventId), command.binding.companyId, { actorUserId: command.actorUserId }); },
        listComments(binding: Binding) { return ctx.issues.listComments(binding.issueId, binding.companyId); },
        getInteraction,
        async respond(command: InteractionCommand) {
            const { binding, card } = command;
            if (card.companyId !== binding.companyId || card.issueId !== binding.issueId)
                throw Error('Decision binding mismatch.');
            const current = await getInteraction(binding, card.interactionId);
            // The audited pin replaces simple confirmation cards rather than editing them.
            // Other kinds and executable/target-bound cards require their richer native UI.
            if (current.kind !== 'request_confirmation' || current.payload.target || current.payload.toolAction || current.payload.secretProposal)
                throw Error('Open this decision in Paperclip.');
            if (current.status === 'pending' && interactionDigest(current) !== card.digest)
                throw Error('Decision card is stale; open the current Paperclip card.');
            return ctx.issues.respondInteraction(binding.issueId, card.interactionId, { action: command.action, actorUserId: command.actorUserId }, binding.companyId);
        }
    };
}
export type PaperclipAdapter = ReturnType<typeof createPaperclipAdapter>;
