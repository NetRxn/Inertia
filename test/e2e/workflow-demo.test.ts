import { describe, expect, it } from 'vitest';
import { runWorkflowDemo } from '../../examples/workflow.js';
describe('offline connected workflow contract', () => {
    it('carries source evidence and exact packet identity through the native work and decision', async () => {
        const r = await runWorkflowDemo();
        expect(r.mode).toBe('offline-synthetic-fixture');
        expect(r.work.sourceOutputHash).toBe(r.meeting.outputHash);
        expect(r.work.sourceRevision).toBe(r.meeting.revision);
        expect(r.work.packetHash).toBe(r.grant.packetHash);
        expect(r.work.packetVersion).toBe(r.grant.version);
        expect(r.decision.issueId).toBe(r.work.issueId);
        expect(r.decision.nativeId).toBe(r.decision.interactionId);
        expect(r.decision.nativeWrites).toBe(1);
        expect(r.decision.replay).toBe('replayed');
        expect(r.decision.receiptEventId).toMatch(/^[a-f0-9]{64}$/);
        expect(r.grant.authority.packetHash).toBe(r.grant.packetHash);
        expect(r.grant.authority.status).toBe('fixture_would_authorize_manual_handoff');
        expect(r.liveReady).toBe(false);
        expect(r.meeting.publication).toBe('pending');
        expect(r.work.creation).toBe('fixture-seeded');
        expect(r.work.candidateAction.verification).toBe('unverified');
    }, 60000);
    it('reproduces stable IDs and receipt manifest across fresh offline runs', async () => {
        expect(await runWorkflowDemo()).toEqual(await runWorkflowDemo());
    }, 60000);
    it('keeps unknown publication pending without claiming overall completion', async () => {
        const r = await runWorkflowDemo();
        expect(r.handoffs.every(x => x.status === 'pending')).toBe(true);
        expect(r.handoffs.map(x => x.id)).toEqual(expect.arrayContaining(['drive', 'publisher', 'grant-exporter', 'governance', 'y2', 'member-runner', 'native-work']));
    }, 60000);
});
