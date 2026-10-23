export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const ENGINE_REVISION = '859a9f5a7b88bbbdd6eda3cb9c453fb15184a045';
export type ReviewRole = 'program' | 'fiscal' | 'legal_compliance' | 'partner' | 'authorized_representative';
export interface PacketIdentity { packetId: string; applicantId: string }
export interface GrantRequest extends PacketIdentity { network: string; proposalId: string; action: 'authorize_manual_submission' }
/** Export composition seam. Field names below match engine records; not a claimed HTTP response. */
export interface ReviewedGrantExport {
  packet: { id: string; applicant_id: string; opportunity_namespace: string; opportunity_external_id: string; version: number; status: string; packet_data: { [key: string]: Json } };
  artifacts: { packet_id: string; artifact_key: string; artifact_type: string; content_hash: string; placeholders: string[] }[];
  opportunity: { namespace: string; external_id: string; source_url: string; status: string; close_date: string | null; current_cycle_verified_at: string | null };
  lifecycle: { is_latest_version: boolean; availability: string; cycle_state: string; source_available: boolean; submission_mode: string; authorization_blockers: string[] };
  handoff: {
    version: number; submission_mode: string; state: string; technically_ready: boolean; approvals_complete: boolean; mutation_allowed: boolean;
    technical_blockers: string[]; placeholders: string[]; open_questions: string[]; unverified_forms: string[]; requirement_gates: string[]; missing_approvals: string[];
    required_approval_roles: ReviewRole[];
    approvals: Partial<Record<ReviewRole, { packet_version: number; reviewer_role: ReviewRole; decision: string; reviewer_name: string; note: string; recorded_at: string }>>;
    submission: Json;
  };
}
export interface ReviewedGrantSource {
  /** Trusted exporter must read engine records and authoritative review together. */
  readReviewedExport(identity: PacketIdentity): Promise<ReviewedGrantExport>;
  /** Authenticated bytes by packet identity and key; never resolve caller file paths. */
  readArtifact(identity: PacketIdentity, artifactKey: string): Promise<Uint8Array>;
}
export interface FrozenGrant extends PacketIdentity {
  readonly version: number;
  readonly schema: 'inertia-grant-v1';
  readonly contentHash: string;
  readonly canonicalContent: string;
}
export interface GovernanceObservation {
  network: string; proposalId: string; action: string; packetHash: string;
  finalized: boolean; outcome: 'passed' | 'rejected' | 'pending'; evidenceId: string;
}
/** Installed trusted provider validates on-chain proof and eligible result before returning. */
export interface GovernanceVerifier {
  readonly kind: 'fixture' | 'chain';
  verify(request: Readonly<GrantRequest & { packetHash: string }>): Promise<GovernanceObservation>;
}
export interface GrantAuthorityReceipt {
  readonly status: 'fixture_would_authorize_manual_handoff' | 'voted_authority_confirmed_for_manual_handoff';
  readonly binding: string;
  readonly evidenceHash: string;
  readonly packetHash: string;
}
