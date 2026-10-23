import type { PluginContext } from '@paperclipai/plugin-sdk';
import type { IntakeDependencies, NativeObjective } from './contracts.js';
const originKind = 'plugin:netrxn.inertia:objective' as const;
const hex = /^[a-f0-9]{64}$/;
/** Real pinned SDK, deliberately reference-only: company issue visibility is NOT website member ACL. */
export function createNativeObjectiveAdapter(ctx: Pick<PluginContext, 'issues'>, companyId: string): IntakeDependencies['native'] {
    function read(row: Awaited<ReturnType<PluginContext['issues']['get']>>, key: string): NativeObjective {
        if (!row || row.companyId !== companyId || row.originKind !== originKind || row.originId !== key || !row.id)
            throw Error('Native objective binding mismatch.');
        const marker = /^Objective source revision: ([a-f0-9]{64})$/m.exec(row.description ?? '')?.[1];
        if (!marker)
            throw Error('Native objective revision unavailable.');
        return { id: row.id, companyId, originId: key, marker, status: row.status, priority: row.priority, goalId: row.goalId, assigneeAgentId: row.assigneeAgentId };
    }
    return {
        async find(key) {
            if (!hex.test(key))
                throw Error('Invalid objective key.');
            // Two matches suffice to prove conflict. A failed lookup never proves absence.
            const rows = await ctx.issues.list({ companyId, originKind, originId: key, limit: 2, includePluginOperations: true });
            return rows.map(row => read(row, key));
        },
        async apply(op) {
            if (op.companyId !== companyId || !hex.test(op.key) || !hex.test(op.marker) || !op.intakeAgentId)
                throw Error('Invalid objective binding.');
            const description = `Objective source revision: ${op.marker}\n\nOriginal submission and attribution remain in the permission-checked website source.\n${op.withdrawn ? 'Source withdrawn.' : 'CEO intake mandate: prioritize and decompose this objective in the existing native backlog.'}`;
            if (op.nativeIssueId) {
                read(await ctx.issues.get(op.nativeIssueId, companyId), op.key);
                return read(await ctx.issues.update(op.nativeIssueId, { description, ...(op.withdrawn ? { status: 'cancelled' as const } : {}) }, companyId), op.key);
            }
            return read(await ctx.issues.create({ companyId, originKind, originId: op.key, title: 'Website objective intake', description, status: op.withdrawn ? 'cancelled' : 'backlog', assigneeAgentId: op.intakeAgentId }), op.key);
        }
    };
}
