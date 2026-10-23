import { describe, expect, it } from 'vitest';
import { canonicalJson, freezeReviewedPacket } from '../../src/grants/engine.js';
import { evaluateGrantVote } from '../../src/grants/governance.js';
import { grantFixture, NOW, fixtureVerifier, REQUEST } from '../../src/grants/fixtures.js';

async function setup() { const source = grantFixture(); const frozen = await freezeReviewedPacket(source, REQUEST, NOW); return { source, frozen }; }
describe('grant packet authority boundary', () => {
  it('freezes a reviewed fixture and labels simulated authority honestly', async () => {
    const {source, frozen} = await setup();
    const result = await evaluateGrantVote(source, frozen, fixtureVerifier(), REQUEST, NOW);
    expect(result.status).toBe('fixture_would_authorize_manual_handoff');
    expect(Object.isFrozen(frozen)).toBe(true);
  });
  it('canonicalizes object key order but preserves array order', () => {
    expect(canonicalJson({b:2,a:1})).toBe(canonicalJson({a:1,b:2}));
    expect(canonicalJson([1,2])).not.toBe(canonicalJson([2,1]));
    expect(() => canonicalJson({a:undefined})).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
  });
  it.each(['version','content','approval'] as const)('invalidates the vote after %s changes', async kind => {
    const {source,frozen}=await setup();
    if(kind==='version') { source.record.packet.version++; source.record.handoff.version++; }
    if(kind==='content') source.record.packet.packet_data.project={title:'Changed'};
    if(kind==='approval') source.record.handoff.approvals.program!.note='Changed review';
    await expect(evaluateGrantVote(source,frozen,fixtureVerifier(),REQUEST,NOW)).rejects.toThrow(/changed|version/i);
  });
  it.each(['network','proposalId','action','packetHash'] as const)('rejects wrong %s', async field => {
    const {source,frozen}=await setup();
    await expect(evaluateGrantVote(source,frozen,fixtureVerifier({[field]:'wrong'}),REQUEST,NOW)).rejects.toThrow(/binding/i);
  });
  it.each([{finalized:false},{outcome:'rejected' as const}])('rejects incomplete governance %j', async change=>{
    const {source,frozen}=await setup();
    await expect(evaluateGrantVote(source,frozen,fixtureVerifier(change),REQUEST,NOW)).rejects.toThrow(/passed|final/i);
  });
  it('returns the same receipt on replay and rejects conflicting evidence', async ()=>{
    const {source,frozen}=await setup();
    const first=await evaluateGrantVote(source,frozen,fixtureVerifier(),REQUEST,NOW);
    expect(await evaluateGrantVote(source,frozen,fixtureVerifier(),REQUEST,NOW,first)).toEqual(first);
    await expect(evaluateGrantVote(source,frozen,fixtureVerifier({evidenceId:'different'}),REQUEST,NOW,first)).rejects.toThrow(/conflict/i);
  });
  it.each(['signoff','unknown','expired','unknownDeadline','stale','historical','integrity','noRoles'] as const)('never admits %s', async failure=>{
    const source=grantFixture();
    if(failure==='signoff') delete source.record.handoff.approvals.fiscal;
    if(failure==='unknown') source.record.packet.packet_data.match={unknowns:['eligibility unknown'],disqualifiers:[]};
    if(failure==='expired') source.record.opportunity.close_date='2026-10-21';
    if(failure==='unknownDeadline') source.record.opportunity.close_date=null;
    if(failure==='stale') source.record.opportunity.current_cycle_verified_at='2026-10-01T00:00:00Z';
    if(failure==='historical') source.record.lifecycle.is_latest_version=false;
    if(failure==='integrity') source.bodies.application_packet_markdown=new TextEncoder().encode('tampered');
    if(failure==='noRoles') source.record.handoff.required_approval_roles=[];
    await expect(freezeReviewedPacket(source,REQUEST,NOW)).rejects.toThrow();
  });
  it('refreshing unchanged source evidence does not invalidate the content vote', async ()=>{
    const {source,frozen}=await setup();
    source.record.opportunity.current_cycle_verified_at='2026-10-22T11:30:00Z';
    expect((await evaluateGrantVote(source,frozen,fixtureVerifier(),REQUEST,NOW)).status).toBe('fixture_would_authorize_manual_handoff');
  });
  it('rechecks source changes while governance verification is in flight', async ()=>{
    const {source,frozen}=await setup();
    const verifier=fixtureVerifier();
    const original=verifier.verify;
    verifier.verify=async request=>{ source.record.handoff.approvals.program!.note='Changed during verification'; return original(request); };
    await expect(evaluateGrantVote(source,frozen,verifier,REQUEST,NOW)).rejects.toThrow(/changed/i);
  });
  it('rejects a forged frozen object rather than trusting caller hash', async ()=>{
    const {source,frozen}=await setup();
    await expect(evaluateGrantVote(source,{...frozen,canonicalContent:'{}'},fixtureVerifier(),REQUEST,NOW)).rejects.toThrow(/snapshot/i);
  });
});


describe('asynchronous policy and clock snapshots', () => {
  it.each(['freeze','evaluate'])('keeps the original expired clock during %s', async operation => {
    const {source,frozen}=await setup();
    const now=new Date('2026-11-01T12:00:00Z');
    source.readReviewedExport=async()=>{ now.setTime(NOW.getTime()); return source.record; };
    const result=operation==='freeze'?freezeReviewedPacket(source,REQUEST,now):evaluateGrantVote(source,frozen,fixtureVerifier(),REQUEST,now);
    await expect(result).rejects.toThrow(/expired/);
  });
  it('does not upgrade a fixture verifier mutated during source reads', async()=>{
    const {source,frozen}=await setup();
    const verifier=fixtureVerifier();
    source.readReviewedExport=async()=>{ Object.assign(verifier,{kind:'chain'}); return source.record; };
    expect((await evaluateGrantVote(source,frozen,verifier,REQUEST,NOW)).status).toBe('fixture_would_authorize_manual_handoff');
  });
  it('keeps conflicting prior evidence even if caller mutates it during the read', async()=>{
    const {source,frozen}=await setup();
    const accepted=await evaluateGrantVote(source,frozen,fixtureVerifier(),REQUEST,NOW);
    const prior={...accepted,evidenceHash:'conflicting'};
    source.readReviewedExport=async()=>{ Object.assign(prior,accepted); return source.record; };
    await expect(evaluateGrantVote(source,frozen,fixtureVerifier(),REQUEST,NOW,prior)).rejects.toThrow(/conflict/i);
  });
  it('pins the verifier function before source awaits', async()=>{
    const {source,frozen}=await setup();
    const verifier=fixtureVerifier({outcome:'rejected'});
    source.readReviewedExport=async()=>{ verifier.verify=fixtureVerifier().verify; return source.record; };
    await expect(evaluateGrantVote(source,frozen,verifier,REQUEST,NOW)).rejects.toThrow(/passed/);
  });
  it.each(['2026-09-31T11:00:00Z','2026-02-29T11:00:00Z','2026-10-22T24:00:00Z','2026-10-22T11:60:00Z','2026-10-22T11:00:60Z','2026-10-22T11:00:00+24:00','2026-10-22T11:00:00'])('rejects invalid timestamp %s', async value=>{
    const source=grantFixture(); source.record.handoff.approvals.program!.recorded_at=value;
    await expect(freezeReviewedPacket(source,REQUEST,NOW)).rejects.toThrow(/timestamp/i);
  });
  it('accepts a valid offset and microsecond timestamp', async()=>{
    const source=grantFixture(); source.record.handoff.approvals.program!.recorded_at='2026-10-22T06:00:00.123456-05:00';
    await expect(freezeReviewedPacket(source,REQUEST,NOW)).resolves.toHaveProperty('contentHash');
  });
  it('rejects a valid but future offset timestamp', async()=>{
    const source=grantFixture(); source.record.handoff.approvals.program!.recorded_at='2026-10-22T08:00:00-05:00';
    await expect(freezeReviewedPacket(source,REQUEST,NOW)).rejects.toThrow(/future/);
  });
});
