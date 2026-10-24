import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ContributionActor, ContributionBinding } from './contracts.js';
import type { createContributionBoundary } from './service.js';
export const MAX_CONTRIBUTION_REQUEST_BYTES = 1024 * 1024;
export type ContributionAuthentication = {
    state: 'authenticated';
    actor: ContributionActor;
} | {
    state: 'denied' | 'unavailable';
};
export interface ContributionIngressOptions {
    enabled(): boolean;
    /** Trusted transport implementation, NOT an enrollment/current-epoch lookup.
     * It must authenticate the exact non-reusable attempt independently of JSON.
     * This interface alone does not implement production authentication. */
    authenticate?(request: IncomingMessage, response: ServerResponse): Promise<ContributionAuthentication>;
    boundary?: ReturnType<typeof createContributionBoundary>;
}
const bindingKeys = ['memberId', 'agentId', 'authorityEpoch', 'companyId', 'projectId', 'issueId', 'taskRevision', 'runId', 'checkoutRunId', 'providerLeaseId', 'lifecycleGeneration', 'lifecycleDisposition', 'enrollmentRevision', 'expiresAt', 'dataClass', 'artifactClass', 'inputHash'].sort();
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join(',') === keys.slice().sort().join(',');
const identifier = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v);
function validBinding(v: unknown): v is ContributionBinding {
    return record(v) && exact(v, bindingKeys) && bindingKeys.every(k => k === 'expiresAt' ? typeof v[k] === 'number' && Number.isFinite(v[k]) : identifier(v[k]));
}
class RequestFailure extends Error {
    constructor(readonly status: number, readonly code: string) { super(code); }
}
function reply(res: ServerResponse, status: number, value: unknown) {
    if (res.writableEnded || res.destroyed)
        return;
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(value));
}
function readBody(req: IncomingMessage): Promise<unknown> {
    // A preceding host parser defeats the pre-parse ceiling. Fail rather than
    // accepting already-parsed objects or attempting to reconstruct their bytes.
    if ('body' in req || req.readableEnded || req.destroyed)
        throw new RequestFailure(503, 'ingress_mount_invalid');
    const sensitive = new Set(['content-type', 'content-length', 'content-encoding', 'transfer-encoding', 'authorization']);
    const seen = new Set<string>();
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const key = req.rawHeaders[i]!.toLowerCase();
        if (sensitive.has(key) && seen.has(key))
            throw new RequestFailure(400, 'ambiguous_headers');
        seen.add(key);
    }
    if (req.headers['content-encoding'] !== undefined)
        throw new RequestFailure(415, 'unsupported_encoding');
    if (typeof req.headers['content-type'] !== 'string' || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']))
        throw new RequestFailure(415, 'unsupported_media_type');
    const length = req.headers['content-length'];
    if (length !== undefined && (!/^(0|[1-9][0-9]*)$/.test(length) || !Number.isSafeInteger(Number(length))))
        throw new RequestFailure(400, 'invalid_content_length');
    if (length !== undefined && Number(length) > MAX_CONTRIBUTION_REQUEST_BYTES)
        throw new RequestFailure(413, 'request_too_large');
    if (req.headers['transfer-encoding'] !== undefined && req.headers['transfer-encoding'] !== 'chunked')
        throw new RequestFailure(400, 'unsupported_transfer_encoding');
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks: Buffer[] = [];
        let settled = false;
        const cleanup = () => { clearTimeout(timer); req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', aborted); req.off('close', closed); };
        const fail = (status: number, code: string) => { if (settled)
            return; settled = true; cleanup(); req.pause(); reject(new RequestFailure(status, code)); };
        const data = (chunk: Buffer) => { size += chunk.length; if (size > MAX_CONTRIBUTION_REQUEST_BYTES) {
            fail(413, 'request_too_large');
            return;
        } chunks.push(chunk); };
        const aborted = () => fail(400, 'incomplete_request');
        const closed = () => { if (!req.complete)
            aborted(); };
        const end = () => { if (settled)
            return; settled = true; cleanup(); try {
            const bytes = Buffer.concat(chunks, size), text = bytes.toString('utf8');
            if (!bytes.equals(Buffer.from(text, 'utf8')))
                throw Error();
            resolve(JSON.parse(text));
        }
        catch {
            reject(new RequestFailure(400, 'invalid_json'));
        } };
        const timer = setTimeout(() => fail(408, 'request_timeout'), 10000);
        timer.unref();
        req.on('data', data);
        req.once('end', end);
        req.once('aborted', aborted);
        req.once('error', aborted);
        req.once('close', closed);
    });
}
/** Mount at an exact, dedicated prefix BEFORE any general body parser.
 * No member retrieval, native mutation, URL fetch or executable output exists. */
export function createContributionIngress(options: ContributionIngressOptions) {
    const authenticate = options.authenticate, boundary = options.boundary;
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        try {
            if (options.enabled() !== true || !authenticate || !boundary) {
                reply(res, 503, { error: 'ingress_unconfigured' });
                return;
            }
            if (!['/export', '/submit'].includes(req.url ?? '')) {
                const alias = /^\/(export|submit)(?:[/?]|$)/.test(req.url ?? '');
                reply(res, alias ? 400 : 404, { error: 'invalid_route' });
                return;
            }
            if (req.method !== 'POST') {
                res.setHeader('Allow', 'POST');
                reply(res, 405, { error: 'method_not_allowed' });
                return;
            }
            const body = await readBody(req);
            if (!record(body) || (req.url === '/export' ? !exact(body, ['issueId']) || !identifier(body.issueId) : !exact(body, ['binding', 'artifacts']) || !validBinding(body.binding) || !Array.isArray(body.artifacts))) {
                reply(res, 400, { error: 'invalid_request' });
                return;
            }
            if (options.enabled() !== true) {
                reply(res, 503, { error: 'ingress_unconfigured' });
                return;
            }
            const auth = await authenticate(req, res);
            if (res.writableEnded || res.destroyed)
                return;
            if (options.enabled() !== true) {
                reply(res, 503, { error: 'ingress_unconfigured' });
                return;
            }
            if (auth.state !== 'authenticated') {
                reply(res, auth.state === 'denied' ? 403 : 503, { error: auth.state === 'denied' ? 'access_denied' : 'authority_unavailable' });
                return;
            }
            const actor = structuredClone(auth.actor);
            if (!actor || !identifier(actor.memberId) || !identifier(actor.agentId) || !identifier(actor.authorityEpoch)) {
                reply(res, 403, { error: 'access_denied' });
                return;
            }
            const result = req.url === '/export' ? await boundary.exportInput(actor, body.issueId as string) : await boundary.submit(actor, body.binding as unknown as ContributionBinding, body.artifacts);
            if (options.enabled() !== true) {
                reply(res, 503, { error: 'ingress_unconfigured' });
                return;
            }
            const status = result.state === 'input' || result.state === 'candidate-for-review' ? 200 : result.state === 'denied' ? 403 : result.state === 'invalid-artifacts' ? 400 : result.state === 'conflict' ? 409 : 503;
            reply(res, status, result);
        }
        catch (error) {
            const status = error instanceof RequestFailure ? error.status : 503;
            if (!req.complete) {
                res.setHeader('Connection', 'close');
                res.once('finish', () => req.destroy());
            }
            reply(res, status, { error: error instanceof RequestFailure ? error.code : 'ingress_unavailable' });
        }
    };
}
