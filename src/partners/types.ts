/** Domain data is owned by the DAO evidence service, never the Paperclip plugin DB. */
export const PARTNER_CONTRACT = 'partner-graph-v1' as const;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type EntityType = 'Organization' | 'Person' | 'Program' | 'Project' | 'Event' | 'Opportunity' | 'Capability';
export interface EntityRef { entity_id: string; entity_type: EntityType }
export type Predicate = 'PROGRAM_OF' | 'AFFILIATED_WITH' | 'HAS_CAPABILITY' | 'PARTICIPATED_IN' | 'WORKED_WITH' | 'RELATIONSHIP_OWNER' | 'CONTACT_FOR' | 'INTRODUCED_TO' | 'RELEVANT_TO_OPPORTUNITY' | 'NAME' | 'ALIAS' | 'IDENTIFIER' | 'STATUS' | 'DELIVERY_STAGE' | 'RELATIONSHIP_KIND' | 'WORK_CONTACT' | 'ROLE_ELIGIBILITY' | 'EXTERNAL_BINDING';
export interface EvidenceRef {
  knowledge_id: string; knowledge_revision: number; audience: 'public' | 'internal' | 'restricted';
  scope_kind: 'organization' | 'project' | 'opportunity'; scope_id: string;
  source_id: string; source_revision: string; source_hash: string;
  source_locator: { [key: string]: Json }; observed_at: string;
  effective_from: string | null; effective_until: string | null;
  checked_at?: string | null; freshness_seconds?: number | null; knowledge_hash?: string;
}
export interface ProjectionSnapshot {
  contract_version: typeof PARTNER_CONTRACT; organization_id: string; assertion_id: string;
  revision: number; deleted: boolean; projection_omitted?: boolean; omission_reason?: 'evidence_limit'; evidence_count?: number; subject: EntityRef; object?: EntityRef | null;
  predicate: Predicate; value: Json; qualifiers: { [key: string]: Json }; evidence: EvidenceRef[];
}
export interface ProjectionEvent {
  contract_version: typeof PARTNER_CONTRACT; organization_id: string; sequence: number;
  assertion_id: string; revision: number; operation: 'refresh';
}
export interface ProjectionLease { organization_id: string; owner: string; epoch: number; expires_at: string }
export interface ProjectionReceipt { assertion_id: string; revision: number; snapshot_hash: string; deleted: boolean; projection_omitted?: boolean }
/** Obtained from authenticated server context, not deserialized from a member tool call. */
export interface PartnerScope {
  organization_id: string; principal_id: string;
  audiences: EvidenceRef['audience'][]; project_ids: string[]; opportunity_ids: string[]; as_of: string;
}
export interface Pointer { assertion_id: string; revision: number; subject_id: string; object_id: string; predicate: Predicate }
export interface CandidateQuery {
  predicate: Predicate; value?: Json; entity_id?: string; after?: string; limit: number;
}
export interface ProjectionTarget {
  advanceFence(lease: ProjectionLease): Promise<void>;
  apply(lease: ProjectionLease, snapshot: ProjectionSnapshot): Promise<ProjectionReceipt>;
  receipt(organizationId: string, assertionId: string): Promise<ProjectionReceipt | null>;
  candidates(scope: PartnerScope, query: CandidateQuery): Promise<Pointer[]>;
}
