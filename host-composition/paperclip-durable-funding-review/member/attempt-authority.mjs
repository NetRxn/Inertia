/** Small owning-native-host fencing record. Not an enrollment/provider platform. */
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { agents, authUsers, companyMemberships, environmentLeases, heartbeatRuns, issues } from '@paperclipai/db';
import { legacyControllerBootId } from '../node_modules/@paperclipai/server/dist/services/legacy-controller-lease.js';
import { forbidden } from '../node_modules/@paperclipai/server/dist/errors.js';
import { agentRunWritesRevoked } from '../node_modules/@paperclipai/server/dist/agent-run-cancellation.js';
const namespace = 'inertia:member-attempt:v1';
const table = sql.raw('"plugin_netrxn_inertia_e936d62b87".bridge_runtime');
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const key = scope => createHash('sha256').update(JSON.stringify([namespace, scope.companyId, scope.issueId])).digest('hex');
const sameScope = (record, scope) => ['companyId', 'projectId', 'issueId', 'agentId', 'memberId'].every(k => record[k] === scope[k]);
export function createMemberAttemptAuthority({ db, scopes = [] } = {}) {
    if (!db || !Array.isArray(scopes) || scopes.length > 1000)
        throw Error('Invalid native member authority configuration');
    const approved = scopes.map(s => {
        if (!s || !['companyId', 'projectId', 'issueId', 'agentId'].every(k => uuid(s[k])) || typeof s.memberId !== 'string' || !s.memberId || s.memberId.length > 256)
            throw Error('Invalid approved native member scope');
        return Object.freeze({ companyId: s.companyId, projectId: s.projectId, issueId: s.issueId, agentId: s.agentId, memberId: s.memberId });
    });
    if (new Set(approved.map(s => `${s.companyId}:${s.issueId}`)).size !== approved.length)
        throw Error('Duplicate native member task scope');
    const find = (memberId, agentId, issueId) => approved.find(s => s.memberId === memberId && s.agentId === agentId && s.issueId === issueId);
    async function nativeCurrent(tx, scope, runId, environmentLeaseId = null, requireCheckout = true, lockMode = 'share') {
        const [issue] = await tx.select().from(issues).where(and(eq(issues.id, scope.issueId), eq(issues.companyId, scope.companyId))).for(lockMode);
        if (!issue || issue.projectId !== scope.projectId || issue.assigneeAgentId !== scope.agentId || issue.executionRunId !== runId ||
            (requireCheckout ? (issue.status !== 'in_progress' || issue.checkoutRunId !== runId) : (!['todo', 'in_progress'].includes(issue.status) || (issue.checkoutRunId !== null && issue.checkoutRunId !== runId))))
            return false;
        const [run] = await tx.select().from(heartbeatRuns).where(and(eq(heartbeatRuns.id, runId), eq(heartbeatRuns.companyId, scope.companyId), eq(heartbeatRuns.agentId, scope.agentId), eq(heartbeatRuns.controllerBootId, legacyControllerBootId), gt(heartbeatRuns.controllerLeaseExpiresAt, sql `clock_timestamp()`))).for(lockMode);
        if (!run || run.runtimeMode !== 'legacy' || run.status !== 'running' || run.finishedAt || run.responsibleUserId !== scope.memberId || agentRunWritesRevoked(run) || run.contextSnapshot?.issueId !== scope.issueId)
            return false;
        const [agent] = await tx.select({ id: agents.id, status: agents.status }).from(agents).where(and(eq(agents.id, scope.agentId), eq(agents.companyId, scope.companyId))).for('share');
        if (!agent || !['idle', 'running'].includes(agent.status))
            return false;
        const [member] = await tx.select({ id: companyMemberships.id, role: companyMemberships.membershipRole }).from(companyMemberships).where(and(eq(companyMemberships.companyId, scope.companyId), eq(companyMemberships.principalType, 'user'), eq(companyMemberships.principalId, scope.memberId), eq(companyMemberships.status, 'active'))).for('share');
        const [user] = await tx.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, scope.memberId));
        if (!member || !user || !['owner', 'admin', 'member'].includes(member.role))
            return false;
        if (environmentLeaseId !== null) {
            const [lease] = await tx.select().from(environmentLeases).where(and(eq(environmentLeases.id, environmentLeaseId), eq(environmentLeases.companyId, scope.companyId), eq(environmentLeases.heartbeatRunId, runId), eq(environmentLeases.issueId, scope.issueId))).for('share');
            if (!lease || lease.status !== 'active' || lease.releasedAt || (lease.expiresAt && lease.expiresAt <= new Date()))
                return false;
        }
        return true;
    }
    async function read(tx, scope, lockMode = 'share') { const query = sql `SELECT value FROM ${table} WHERE company_id=${scope.companyId} AND relay=${namespace} AND state_key=${key(scope)}`; const rows = await tx.execute(lockMode === 'update' ? sql `${query} FOR UPDATE` : sql `${query} FOR SHARE`); return rows[0]?.value ?? null; }
    async function readAttempt(actor, issueId, requireCheckout) {
        const scope = find(actor?.memberId, actor?.agentId, issueId);
        if (!scope || !uuid(actor?.authorityEpoch))
            return null;
        return db.transaction(async (tx) => {
            const record = await read(tx, scope);
            if (!record || !sameScope(record, scope) || record.state !== 'active' || record.ownerBootId !== legacyControllerBootId || record.authorityEpoch !== actor.authorityEpoch || !uuid(record.runId))
                return null;
            return await nativeCurrent(tx, scope, record.runId, record.environmentLeaseId, requireCheckout) ? structuredClone(record) : null;
        });
    }
    const readCurrent = (actor, issueId) => readAttempt(actor, issueId, true);
    return {
        async begin(input) {
            const scope = approved.find(s => s.companyId === input?.companyId && s.agentId === input.agentId && s.issueId === input.issueId);
            if (!scope)
                return null; // Native default/un-enrolled execution stays unchanged.
            if (!uuid(input.runId) || (input.environmentLeaseId != null && !uuid(input.environmentLeaseId)))
                throw Error('Invalid native member attempt binding');
            const attempt = Object.freeze({ ...scope, runId: input.runId, environmentLeaseId: input.environmentLeaseId ?? null, authorityEpoch: randomUUID(), ownerBootId: legacyControllerBootId, state: 'active' });
            try {
                await db.transaction(async (tx) => {
                    await tx.execute(sql `SET LOCAL lock_timeout='3s'`);
                    await tx.execute(sql `SET LOCAL statement_timeout='10s'`);
                    await tx.execute(sql `INSERT INTO ${table} (company_id,relay,state_key,value) VALUES (${scope.companyId},${namespace},${key(scope)},${JSON.stringify({ ...attempt, state: 'pending' })}::jsonb) ON CONFLICT DO NOTHING`);
                    await tx.execute(sql `SELECT value FROM ${table} WHERE company_id=${scope.companyId} AND relay=${namespace} AND state_key=${key(scope)} FOR UPDATE`);
                    if (!await nativeCurrent(tx, scope, input.runId, attempt.environmentLeaseId, false))
                        throw Error('Native member execution ownership unavailable');
                    await tx.execute(sql `UPDATE ${table} SET value=${JSON.stringify(attempt)}::jsonb WHERE company_id=${scope.companyId} AND relay=${namespace} AND state_key=${key(scope)}`);
                });
            }
            catch {
                // Never retry the write: its response may be lost after COMMIT. Reconcile
                // this exact immutable invocation; a successor must not be resurrected.
                const stored = await readAttempt(attempt, scope.issueId, false).catch(() => null);
                if (!stored)
                    throw Error('Native member attempt issuance unavailable');
                return Object.freeze(stored);
            }
            if (!await readAttempt(attempt, scope.issueId, false))
                throw Error('Native member attempt superseded');
            return attempt;
        },
        readCurrent,
        async withNativeCheckout({ claims, issueId, agentId, runId }, operation) {
            const scope = find(claims?.responsible_user_id, claims?.sub, issueId);
            if (!scope || claims?.inertia_member_attempt !== true || !uuid(claims.jti) || claims.company_id !== scope.companyId || claims.run_id !== runId || claims.sub !== agentId || typeof operation !== 'function')
                throw forbidden('Member checkout authority unavailable');
            return db.transaction(async (tx) => {
                await tx.execute(sql `SET LOCAL lock_timeout='3s'`);
                await tx.execute(sql `SET LOCAL statement_timeout='10s'`);
                const current = await read(tx, scope, 'update');
                if (!current || !sameScope(current, scope) || current.state !== 'active' || current.ownerBootId !== legacyControllerBootId || current.authorityEpoch !== claims.jti || current.runId !== runId || !await nativeCurrent(tx, scope, runId, current.environmentLeaseId, false, 'update'))
                    throw forbidden('Member checkout authority unavailable');
                // The owning route invokes the existing native issueService(tx).checkout.
                // An exclusive fence serializes checkouts before native lock upgrades.
                // Native issue then run locks match the existing clearing helpers.
                // Epoch supersession, cancellation and membership changes serialize with
                // this same transaction. No stale adoption is possible under these binds.
                return operation(tx);
            });
        },
        async authorizeNativeRequest({ claims, method, path }) {
            if (claims?.inertia_member_attempt !== true || !uuid(claims.jti) || method !== 'POST' || typeof path !== 'string')
                return false;
            const [run] = await db.select({ context: heartbeatRuns.contextSnapshot }).from(heartbeatRuns).where(and(eq(heartbeatRuns.id, claims.run_id), eq(heartbeatRuns.companyId, claims.company_id), eq(heartbeatRuns.agentId, claims.sub)));
            const issueId = run?.context?.issueId;
            if (!uuid(issueId))
                return false;
            const checkout = path === `/api/issues/${issueId}/checkout`;
            if (!checkout && !['/api/member-contributions/export', '/api/member-contributions/submit'].includes(path))
                return false;
            const current = await readAttempt({ memberId: claims.responsible_user_id, agentId: claims.sub, authorityEpoch: claims.jti }, issueId, !checkout);
            return !!current && current.companyId === claims.company_id && current.runId === claims.run_id;
        },
        async authenticate(principal) {
            if (!uuid(principal?.runId) || !uuid(principal?.authorityEpoch))
                return null;
            const [run] = await db.select({ context: heartbeatRuns.contextSnapshot }).from(heartbeatRuns).where(and(eq(heartbeatRuns.id, principal.runId), eq(heartbeatRuns.companyId, principal.companyId), eq(heartbeatRuns.agentId, principal.agentId)));
            const current = await readCurrent(principal, run?.context?.issueId);
            return current && current.companyId === principal.companyId && current.runId === principal.runId ? { memberId: current.memberId, agentId: current.agentId, authorityEpoch: current.authorityEpoch } : null;
        },
        async assertCurrent(attempt) {
            if (!attempt || !await readAttempt(attempt, attempt.issueId, false))
                throw Error('Native member attempt is no longer current');
        },
        async finish(attempt) {
            const scope = find(attempt?.memberId, attempt?.agentId, attempt?.issueId);
            if (!scope || !uuid(attempt.authorityEpoch))
                return;
            await db.execute(sql `UPDATE ${table} SET value=jsonb_set(value,'{state}','"retired"'::jsonb) WHERE company_id=${scope.companyId} AND relay=${namespace} AND state_key=${key(scope)} AND value->>'authorityEpoch'=${attempt.authorityEpoch} AND value->>'ownerBootId'=${legacyControllerBootId}`);
        },
    };
}
