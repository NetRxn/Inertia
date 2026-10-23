/** Trusted website export seam; no deployed bounty API is implied. */
export interface ObjectiveRef {
    sourceSystem: string;
    sourceId: string;
}
export interface ObjectiveSubmission extends ObjectiveRef {
    organizationId: string;
    revision: string;
    sourceHash: string;
    expectedPreviousHash: string | null;
    authorRef: string;
    audience: 'public' | 'members' | 'restricted';
    title: string;
    text: string;
    withdrawn: boolean;
}
export interface IntakeMapping {
    key: string;
    companyId: string;
    version: number;
    snapshot: ObjectiveSubmission;
    nativeIssueId: string | null;
    pending: boolean;
    marker: string;
}
export interface NativeObjective {
    id: string;
    companyId: string;
    originId: string;
    marker: string;
    status: string;
    priority: string;
    goalId: string | null;
    assigneeAgentId: string | null;
}
export interface NativeObjectiveOperation {
    key: string;
    marker: string;
    companyId: string;
    intakeAgentId: string;
    nativeIssueId: string | null;
    withdrawn: boolean;
}
export interface IntakeDependencies {
    /** Server configuration, never supplied by an event or source text. */
    organizationId: string;
    companyId: string;
    intakeAgentId: string;
    source: {
        read(ref: ObjectiveRef): Promise<ObjectiveSubmission | null>;
    };
    store: {
        read(key: string): Promise<IntakeMapping | null>;
        /** Durable unique key + version CAS; cannot replace an unresolved operation. */
        claim(next: IntakeMapping, expectedVersion: number): Promise<boolean>;
        finish(key: string, version: number, nativeIssueId: string): Promise<boolean>;
        /** Only before any native I/O; preserve history while restoring prior mapping. */
        abort(key: string, version: number, previous: IntakeMapping | null): Promise<boolean>;
    };
    native: {
        /** Exact origin lookup, scoped company, including cancelled issues; unknown throws. */
        find(key: string): Promise<NativeObjective[]>;
        /** Called once per durable claim. Does not execute source text as instructions. */
        apply(operation: NativeObjectiveOperation): Promise<NativeObjective>;
    };
}
export interface IntakeReceipt {
    status: 'applied' | 'replayed' | 'stale' | 'conflict' | 'pending' | 'blocked';
    sourceId: string;
    revision: string;
    nativeIssueId: string | null;
}
