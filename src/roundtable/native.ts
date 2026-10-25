import { MeetingExtractionPending } from "./extraction.js";
import { prepare, type Transformer } from "./ingestion.js";
import { sha256 } from "./codec.js";
import {
  prepareWebsiteOperation,
  WebsitePreparationError,
  type MeetingMetadata,
  type WebsiteBinding,
  type WebsiteOperation,
  type WebsiteOutcome,
} from "./website.js";
import {
  validDriveBinding,
  type DriveMeetingBinding,
  type SourceOutcome,
} from "./source.js";
export interface MeetingJobConfig extends DriveMeetingBinding, WebsiteBinding {
  enabled: boolean;
  publicationMode?: "local" | "website";
  admission: string;
  withdrawn: boolean;
  meeting: MeetingMetadata;
}
export interface MeetingScope {
  companyId: string;
  origin: string;
  meetingId: string;
}
export interface MeetingState {
  sourceReference?: {
    sourceId: string;
    meetingId: string;
    kind: "summary" | "transcript";
  };
  principalId?: string;
  bindingHash: string;
  admission: string;
  operation: WebsiteOperation | null;
  previous: WebsiteOperation | null;
  outcome: WebsiteOutcome | null;
  withdrawn: boolean;
}
export interface MeetingStore {
  own<T>(scope: MeetingScope, work: () => Promise<T>): Promise<T | null>;
  read(scope: MeetingScope): Promise<MeetingState | null>;
  save(scope: MeetingScope, state: MeetingState): Promise<void>;
}
export interface MeetingDependencies {
  store: MeetingStore;
  loadConfig: () => Promise<MeetingJobConfig>;
  readSource: (binding: DriveMeetingBinding) => Promise<SourceOutcome>;
  transform: Transformer;
  publish: (operation: WebsiteOperation) => Promise<WebsiteOutcome>;
  clock: () => number;
  onResult?: (
    result: MeetingJobResult,
    scope: MeetingScope,
  ) => Promise<string | undefined>;
}
export type MeetingJobResult = {
  state: string;
  code?: string;
  retryAt?: number;
  nativeIntake?: string;
  publicationMode?: "local" | "website";
};
function bindingHash(c: MeetingJobConfig) {
  return sha256(
    JSON.stringify([
      c.companyId,
      c.meetingId,
      c.origin,
      c.principalId,
      c.folderId,
      c.fileId,
      c.artifact,
      c.transcriptName ?? null,
      ...(c.publicationMode==="local"?["local-publication-v1"]:[]),
    ]),
  );
}
function valid(c: MeetingJobConfig) {
  try {
    const u = new URL(c.origin);
    return (
      validDriveBinding(c) &&
      (c.publicationMode===undefined || ["website","local"].includes(c.publicationMode)) &&
      u.protocol === "https:" &&
      u.origin === c.origin &&
      typeof c.principalId === "string" &&
      !!c.principalId.trim() &&
      typeof c.admission === "string" &&
      !!c.admission.trim() &&
      typeof c.enabled === "boolean" &&
      typeof c.withdrawn === "boolean"
    );
  } catch {
    return false;
  }
}
function result(outcome: WebsiteOutcome): MeetingJobResult {
  return outcome.state === "published" || outcome.state === "already-published"
    ? { state: outcome.state }
    : outcome.state === "deferred"
      ? { state: "deferred", code: outcome.code, retryAt: outcome.retryAt }
      : {
          state: outcome.state,
          code: "code" in outcome ? outcome.code : "publication_unconfirmed",
        };
}
const auth = (o: WebsiteOutcome | null) =>
  o?.state === "blocked" &&
  (o.code === "authentication_required" || o.code === "scope_denied");
const success = (o: WebsiteOutcome | null) =>
  o?.state === "published" || o?.state === "already-published";
/** A native invocation performs at most one website reconciliation, never creates a schedule. */
export async function runMeetingJob(
  initial: MeetingJobConfig,
  deps: MeetingDependencies,
): Promise<MeetingJobResult> {
  if (!valid(initial))
    return { state: "blocked", code: "invalid_configuration" };
  const scope: MeetingScope = {
    companyId: initial.companyId,
    origin: initial.origin,
    meetingId: initial.meetingId,
  };
  try {
    return (
      (await deps.store.own(scope, async () => {
        const perform = async (): Promise<MeetingJobResult> => {
          let cfg = structuredClone(await deps.loadConfig());
          if (!valid(cfg))
            return { state: "blocked", code: "invalid_configuration" };
          if (
            cfg.companyId !== scope.companyId ||
            cfg.origin !== scope.origin ||
            cfg.meetingId !== scope.meetingId
          )
            return { state: "blocked", code: "binding_changed" };
          const fingerprint = bindingHash(cfg);
          const admission = cfg.admission;
          let saved = await deps.store.read(scope);
          if (saved?.bindingHash && saved.bindingHash !== fingerprint) {
            const summaryReadmission =
              !saved.withdrawn &&
              !saved.operation &&
              saved.sourceReference?.kind === "summary" &&
              saved.principalId === cfg.principalId &&
              saved.admission !== cfg.admission;
            if (!summaryReadmission)
              return { state: "blocked", code: "binding_changed" };
            saved = {
              ...saved,
              bindingHash: fingerprint,
              admission: cfg.admission,
            };
            await deps.store.save(scope, saved);
          }
          if (saved?.withdrawn) return { state: "blocked", code: "withdrawn" };
          if (cfg.withdrawn) {
            saved = {
              principalId: cfg.principalId,
              bindingHash: fingerprint,
              admission: cfg.admission,
              operation: saved?.operation ?? null,
              previous: saved?.previous ?? null,
              outcome: { state: "blocked", code: "withdrawn" },
              withdrawn: true,
            };
            await deps.store.save(scope, saved);
            return { state: "blocked", code: "withdrawn" };
          }
          if (!cfg.enabled) return { state: "disabled" };
          if (saved?.outcome) {
            const o = saved.outcome;
            if (o.state === "conflict" || (o.state === "blocked" && !auth(o)))
              return result(o);
            if (auth(o) && saved.admission === cfg.admission) return result(o);
            if (o.state === "deferred" && o.retryAt > deps.clock())
              return result(o);
          }
          const input = await deps.readSource(cfg);
          if (input.state !== "ready") {
            if (input.state === "summary-only") {
              saved = {
                principalId: cfg.principalId,
                bindingHash: fingerprint,
                admission: cfg.admission,
                operation: saved?.operation ?? null,
                previous: saved?.previous ?? null,
                outcome: saved?.outcome ?? null,
                withdrawn: false,
                sourceReference: {
                  sourceId: "drive:" + cfg.fileId,
                  meetingId: cfg.meetingId,
                  kind: "summary",
                },
              };
              await deps.store.save(scope, saved);
              return { state: input.state, code: input.code };
            }
            if (
              input.state === "blocked" &&
              (input.code === "authentication_required" ||
                input.code === "scope_denied")
            ) {
              saved = {
                principalId: cfg.principalId,
                bindingHash: fingerprint,
                operation: saved?.operation ?? null,
                previous: saved?.previous ?? null,
                withdrawn: false,
                admission: cfg.admission,
                outcome: input,
              };
              await deps.store.save(scope, saved);
            }
            return input;
          }
          const source = input.source;
          if (
            source.meetingId !== cfg.meetingId ||
            source.sourceId !== "drive:" + cfg.fileId ||
            source.audience !== "members" ||
            source.kind !== "transcript" ||
            !source.ready ||
            !/^[1-9][0-9]{0,39}$/.test(source.revision)
          )
            return { state: "blocked", code: "source_scope_mismatch" };
          const old = saved?.operation
            ? JSON.parse(saved.operation.body)
            : null;
          if (old && BigInt(source.revision) < BigInt(old.publication.revision))
            return { state: "blocked", code: "stale_source_revision" };
          if (old && source.revision === old.publication.revision) {
            if (sha256(source.text) !== old.publication.sourceHash)
              return { state: "blocked", code: "source_revision_conflict" };
            if (JSON.stringify(cfg.meeting) !== JSON.stringify(old.meeting))
              return {
                state: "blocked",
                code: "metadata_only_correction_unsupported",
              };
            if (success(saved!.outcome)) return { state: "unchanged" };
          }
          // Unconfirmed bytes are always reconciled first, even if a newer source is visible.
          if (!saved?.operation || success(saved.outcome)) {
            if (
              saved?.outcome &&
              "receipt" in saved.outcome &&
              !saved.outcome.receipt.current
            )
              return { state: "conflict", code: "stale_publication" };
            const previous = saved?.operation ?? undefined;
            let prepared;
            try {
              prepared = await prepare(source,deps.transform,old?.publication.outputHash ?? null);
            } catch(error) {
              if(!(error instanceof MeetingExtractionPending))throw error;
              await deps.store.save(scope,{
                principalId:cfg.principalId,bindingHash:fingerprint,admission:cfg.admission,
                operation:saved?.operation??null,previous:saved?.previous??null,outcome:saved?.outcome??null,withdrawn:false,
                sourceReference:{sourceId:source.sourceId,meetingId:source.meetingId,kind:source.kind},
              });
              return {state:"pending",code:error.code};
            }
            // A native agent can take time. Revalidate the full source after classification,
            // before durable publication bytes are admitted. Pending old writes still reconcile unchanged.
            const confirmed = await deps.readSource(cfg);
            if(confirmed.state!=="ready" || confirmed.source.meetingId!==source.meetingId || confirmed.source.sourceId!==source.sourceId ||
              confirmed.source.revision!==source.revision || confirmed.source.audience!==source.audience || confirmed.source.kind!==source.kind ||
              confirmed.source.ready!==true || sha256(confirmed.source.text)!==sha256(source.text))
              return {state:"pending",code:"source_changed_during_extraction"};
            const operation = prepareWebsiteOperation(
              prepared,
              cfg.meeting,
              cfg,
              previous,
            );
            saved = {
              principalId: cfg.principalId,
              bindingHash: fingerprint,
              admission: cfg.admission,
              operation,
              previous: previous ?? null,
              outcome: null,
              withdrawn: false,
            };
            await deps.store.save(scope, saved);
          }
          // Configuration may be revoked while source/model work is in flight.
          cfg = structuredClone(await deps.loadConfig());
          if (!valid(cfg) || bindingHash(cfg) !== fingerprint)
            return { state: "blocked", code: "binding_changed" };
          if (cfg.withdrawn) {
            saved = {
              ...saved,
              withdrawn: true,
              outcome: { state: "blocked", code: "withdrawn" },
            };
            await deps.store.save(scope, saved);
            return { state: "blocked", code: "withdrawn" };
          }
          if (!cfg.enabled) return { state: "disabled" };
          if (cfg.admission !== admission)
            return { state: "blocked", code: "admission_changed" };
          let outcome: WebsiteOutcome;
          try {
            outcome = await deps.publish(saved.operation!);
          } catch {
            outcome = { state: "pending", code: "publication_unconfirmed" };
          }
          saved = {
            ...saved,
            admission: cfg.admission,
            outcome,
            withdrawn:
              outcome.state === "blocked" && outcome.code === "withdrawn",
          };
          await deps.store.save(scope, saved);
          return result(outcome);
        };
        const outcome = await perform();
        if (deps.onResult) {
          try {
            const nativeIntake = await deps.onResult(outcome, scope);
            if (nativeIntake) return { ...outcome, nativeIntake };
          } catch {
            return { ...outcome, nativeIntake: "pending" };
          }
        }
        return outcome;
      })) ?? { state: "blocked", code: "owner_busy_or_recovery_required" }
    );
  } catch (error) {
    if (error instanceof MeetingExtractionPending) return {state:"pending",code:error.code};
    return {
      state: "blocked",
      code:
        error instanceof WebsitePreparationError
          ? error.code
          : "native_state_unavailable",
    };
  }
}
