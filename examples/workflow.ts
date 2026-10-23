/** Offline rehearsal orchestration. External hosts and task creation are fixtures. */
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import type { PluginContext, PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { prepare, publish, pendingDaoPublisher } from '../src/roundtable/ingestion.js';
import { freezeReviewedPacket, sha256 } from '../src/grants/engine.js';
import { evaluateGrantVote } from '../src/grants/governance.js';
import { grantFixture, fixtureVerifier, NOW, REQUEST } from '../src/grants/fixtures.js';
import { createBridgeStore, BRIDGE_NAMESPACE } from '../src/store/postgres.js';
import { createPaperclipAdapter } from '../src/paperclip/adapter.js';
import { createBridge } from '../src/bridge/service.js';
import { runtimeState } from '../src/bridge/runtime.js';
import { makeBuzzHttpClient } from '../src/buzz/http.js';
export async function runWorkflowDemo() {
    const initiativeId = 'fixture-roundtable-grant-initiative';
    const line = 'Facilitator: Prepare a grant packet for the community workshop.';
    const meeting = await prepare({ meetingId: initiativeId + '-meeting', sourceId: 'fixture-drive-file', revision: 'fixture-v1', ready: true, kind: 'transcript', audience: 'members', text: line }, async () => ({ notes: [{ text: line, line: 1 }], decisions: [], actions: [{ text: line, line: 1, owner: null }] }));
    const source = grantFixture();
    // Fixture exporter establishes provenance in the content actually hashed by the core.
    source.record.packet.packet_data.project = { title: 'Synthetic community workshop', initiativeId, sourceOutputHash: meeting.outputHash, sourceRevision: meeting.revision };
    const packet = await freezeReviewedPacket(source, REQUEST, NOW);
    const work = { initiativeId, issueId: initiativeId + '-issue', creation: 'fixture-seeded', sourceOutputHash: meeting.outputHash, sourceRevision: meeting.revision, candidateAction: meeting.notes.actions[0]!, packetId: packet.packetId, packetVersion: packet.version, packetHash: packet.contentHash };
    const pg = new PGlite();
    try {
        await pg.exec(`CREATE SCHEMA ${BRIDGE_NAMESPACE}`);
        // Resolves from source in tests and from dist/examples after build.
        const migrations = new URL(import.meta.url.includes('/dist/') ? '../../migrations/' : '../migrations/', import.meta.url);
        for (const file of (await readdir(migrations)).filter(x => x.endsWith('.sql')).sort())
            await pg.exec(await readFile(new URL(file, migrations), 'utf8'));
        // Freeze only this ephemeral fixture database's receipt timestamp.
        await pg.exec(`ALTER TABLE ${BRIDGE_NAMESPACE}.bridge_inbox ALTER COLUMN created_at SET DEFAULT '2026-10-22T12:00:00Z'::timestamptz`);
        const db: PluginDatabaseClient = { namespace: BRIDGE_NAMESPACE, query: async <T>(s: string, p?: unknown[]) => (await pg.query<T>(s, p)).rows, execute: async (s, p) => ({ rowCount: (await pg.query(s, p)).affectedRows ?? 0 }) };
        const store = createBridgeStore(db);
        const human = new Uint8Array(32).fill(1), key = new Uint8Array(32).fill(2);
        const binding = { relay: 'https://fixture.invalid', companyId: 'fixture-company', issueId: work.issueId, channelId: '00000000-0000-4000-8000-000000000001', rootId: sha256(initiativeId) };
        await store.putBinding(binding);
        await store.putPairing({ relay: binding.relay, companyId: binding.companyId, pubkey: getPublicKey(human), actorUserId: 'fixture-member', kind: 'human', active: true });
        let nativeWrites = 0;
        const interaction = { id: initiativeId + '-confirmation', companyId: binding.companyId, issueId: work.issueId, kind: 'request_confirmation', title: 'Acknowledge the reviewed fixture packet', summary: null, payload: { version: 1, prompt: `Review packet ${packet.packetId} v${packet.version}, hash ${packet.contentHash}. This ordinary acknowledgment is separate from the grant governance vote.` }, status: 'pending' };
        const native = createPaperclipAdapter({ issues: {
                listInteractions: async () => [interaction],
                respondInteraction: async (issueId: string, id: string, response: {
                    actorUserId: string;
                    action: string;
                }, companyId: string) => {
                    if (issueId !== work.issueId || id !== interaction.id || companyId !== binding.companyId || response.actorUserId !== 'fixture-member' || response.action !== 'accept')
                        throw Error('Fixture host rejected inconsistent identity');
                    nativeWrites++;
                    interaction.status = 'accepted';
                    return { interaction, applied: true };
                },
            } } as unknown as Pick<PluginContext, 'issues'>);
        const publications: Array<{
            id: string;
            content: string;
        }> = [];
        const signer = (t: Parameters<typeof finalizeEvent>[0]) => finalizeEvent(t, key);
        const buzz = makeBuzzHttpClient({ relayUrl: binding.relay, signer, clock: () => 1000, fetch: (async (_url, init) => {
                const event = JSON.parse(String(init?.body));
                publications.push(event);
                return new Response(JSON.stringify({ accepted: true, event_id: event.id }), { status: 200 });
            }) as typeof fetch });
        const deps = { runtime: runtimeState(db, binding.companyId, binding.relay), store, native, buzz, signer, clock: () => 1000, loadConfig: () => store.loadConfig(binding.relay, getPublicKey(key)) };
        const bridge = createBridge(deps);
        const card = await bridge.renderInteraction(binding, interaction.id);
        const event = finalizeEvent({ kind: 9, created_at: 999, content: '/inertia accept ' + card.token, tags: [['h', binding.channelId], ['e', binding.rootId, '', 'root'], ['e', binding.rootId, '', 'reply']] }, human);
        const first = await bridge.ingest(event);
        const replay = await createBridge(deps).ingest(event);
        if (first.status !== 'applied' || replay.status !== 'replayed' || nativeWrites !== 1 || publications.length !== 2)
            throw Error('Fixture bridge contract failed');
        const authority = await evaluateGrantVote(source, packet, fixtureVerifier(), REQUEST, NOW);
        return {
            schema: 'inertia-offline-journey-v1', mode: 'offline-synthetic-fixture', liveReady: false, initiativeId,
            meeting: { meetingId: meeting.meetingId, sourceId: meeting.sourceId, revision: meeting.revision, sourceHash: meeting.sourceHash, outputHash: meeting.outputHash, operationId: meeting.operationId, publication: await publish(meeting, pendingDaoPublisher) },
            work,
            decision: { issueId: work.issueId, interactionId: interaction.id, nativeId: first.nativeId, sourceEventId: event.id, cardEventId: publications[0]!.id, receiptEventId: publications[1]!.id, nativeWrites, replay: replay.status, status: first.status },
            grant: { packetId: packet.packetId, version: packet.version, packetHash: packet.contentHash, authority, submission: 'not-submitted' },
            handoffs: ['drive', 'publisher', 'native-work', 'grant-exporter', 'governance', 'y2', 'member-runner'].map(id => ({ id, status: 'pending' })),
        };
    }
    finally {
        await pg.close();
    }
}
