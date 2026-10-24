/** Server-owned, authenticated identity. Never construct from member request fields. */
export interface ContributionActor { memberId: string; agentId: string;
  /** Non-reusable authenticated holder/attempt epoch; never a provider generation. */
  authorityEpoch: string }
/** Enrollment/source authority is not supplied by the plugin's company-wide reads. */
export interface Enrollment extends ContributionActor {
  enabled: boolean; active: boolean; companyId: string; projectId: string;
  issueId: string; taskRevision: string; runId: string; checkoutRunId: string;
  providerLeaseId: string; lifecycleGeneration: string;
  lifecycleDisposition: 'active' | 'lost' | 'fenced' | 'superseded' | 'unknown'; enrollmentRevision: string; expiresAt: number;
  dataClass: 'approved-public'; artifactClass: 'text-evidence'; input: string;
}
export type ContributionBinding = Omit<Enrollment, 'enabled' | 'active' | 'input'> & { inputHash: string };
export interface NativeObservation {
  companyId: string; projectId: string | null; issueId: string; taskRevision: string;
  agentId: string | null; runId: string | null; checkoutRunId: string | null; running: boolean;
}
export interface Artifact { name: string; mediaType: 'text/plain' | 'application/json'; text: string; sha256: string }
export interface Candidate {
  operationId: string; binding: ContributionBinding; digest: string; artifacts: Artifact[];
  disposition: 'untrusted-candidate';
}
export interface CandidateJournal {
  get(operationId: string, companyId: string): Promise<Candidate | null>;
  /** Immutable insert-if-absent. No update, issue completion or authority acceptance. */
  put(candidate: Candidate): Promise<void>;
}
export interface ContributionDependencies {
  enabled(): boolean;
  clock(): number;
  loadEnrollment(actor: ContributionActor, issueId: string): Promise<Enrollment | null>;
  readNative(binding: ContributionBinding): Promise<NativeObservation | null>;
  journal: CandidateJournal;
}
