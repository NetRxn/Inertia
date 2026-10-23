import type { FrozenGrant, GovernanceVerifier, GrantAuthorityReceipt, GrantRequest, ReviewedGrantSource } from './contracts.js';
import { canonicalJson, freezeReviewedPacket, GrantBoundaryError, sha256, snapshotHash } from './engine.js';

/** Pure evaluation: never submits, writes approvals, persists a vote, or sends a transaction. */
export async function evaluateGrantVote(source: ReviewedGrantSource, frozen: FrozenGrant, verifier: GovernanceVerifier, request: GrantRequest, now: Date, previous?: GrantAuthorityReceipt): Promise<GrantAuthorityReceipt> {
  const at = new Date(now.getTime());
  const kind = verifier.kind;
  const verify = verifier.verify.bind(verifier);
  const sourcePort = Object.freeze({readReviewedExport:source.readReviewedExport.bind(source),readArtifact:source.readArtifact.bind(source)});
  const prior = previous === undefined ? undefined : canonicalJson(previous);
  const snapshot=Object.freeze({...frozen});
  const expected=Object.freeze({...request,packetHash:snapshot.contentHash});
  if(snapshot.schema!=='inertia-grant-v1' || snapshotHash(snapshot.canonicalContent)!==snapshot.contentHash) throw new GrantBoundaryError('Invalid frozen snapshot integrity');
  if(!request.network?.trim() || !request.proposalId?.trim() || request.action!=='authorize_manual_submission') throw new GrantBoundaryError('Governance target configuration required');
  if(request.packetId!==snapshot.packetId || request.applicantId!==snapshot.applicantId) throw new GrantBoundaryError('Packet binding identity mismatch');
  const current=await freezeReviewedPacket(sourcePort,expected,at);
  if(current.contentHash!==snapshot.contentHash || current.version!==snapshot.version) throw new GrantBoundaryError('Packet or review changed; renew the vote against the new snapshot');
  if(kind!=='fixture' && kind!=='chain') throw new GrantBoundaryError('Configure a governance verifier');
  const observation=JSON.parse(canonicalJson(await verify(expected)));
  for(const key of ['network','proposalId','action','packetHash'] as const) if(observation[key]!==expected[key]) throw new GrantBoundaryError('Governance binding mismatch: '+key);
  if(observation.finalized!==true || observation.outcome!=='passed') throw new GrantBoundaryError('Governance result must be final and passed');
  if(typeof observation.evidenceId!=='string' || !observation.evidenceId.trim()) throw new GrantBoundaryError('Governance evidence reference missing');
  const rechecked=await freezeReviewedPacket(sourcePort,expected,at);
  if(rechecked.contentHash!==snapshot.contentHash) throw new GrantBoundaryError('Packet or review changed during governance verification');
  const result: GrantAuthorityReceipt=Object.freeze({
    status:kind==='fixture'?'fixture_would_authorize_manual_handoff':'voted_authority_confirmed_for_manual_handoff',
    binding:sha256(canonicalJson(expected)),evidenceHash:sha256(canonicalJson({kind,observation})),packetHash:current.contentHash,
  });
  if(prior !== undefined && prior!==canonicalJson(result)) throw new GrantBoundaryError('Conflicting prior authority receipt; reconcile instead of overwriting');
  return result;
}
