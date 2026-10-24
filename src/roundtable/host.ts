import {
  reconcileMeetingIntake,
  type MeetingIntakeAdmission,
} from "./intake.js";
import { randomUUID } from "node:crypto";
import type { PluginContext, JsonSchema } from "@paperclipai/plugin-sdk";
import { runtimeState } from "../bridge/runtime.js";
import { createRuntimeOwner } from "../bridge/ownership.js";
import { sha256 } from "./codec.js";
import { createDriveMeetingSource, validDriveBinding } from "./source.js";
import { createWebsitePublisher } from "./website.js";
import {
  runMeetingJob,
  type MeetingJobConfig,
  type MeetingJobResult,
  type MeetingScope,
  type MeetingState,
} from "./native.js";
export const roundtableJobDeclaration = {
  jobKey: "reconcile-roundtable-sources",
  displayName: "Reconcile meeting sources",
  description:
    "Manually reconcile admitted member transcript sources. Disabled until explicitly configured; no recurring schedule.",
};
const secretSchema = {
  type: "object",
  properties: {
    type: { const: "secret_ref" },
    secretId: { type: "string", minLength: 1 },
    version: { anyOf: [{ type: "integer", minimum: 1 }, { const: "latest" }] },
  },
  required: ["type", "secretId"],
  additionalProperties: false,
};
/** Optional setup surface. Secret values are never configuration fields. */
export const roundtableSchema: JsonSchema = {
  type: "object",
  properties: {
    nativeIntake: {
      type: "object",
      properties: {
        organizationId: { type: "string", minLength: 1 },
        intakeAgentId: { type: "string", minLength: 1 },
        referenceOnly: { const: true },
      },
      required: ["organizationId", "intakeAgentId", "referenceOnly"],
      additionalProperties: false,
    },
    enabled: { type: "boolean", default: false },
    admission: { type: "string", minLength: 1 },
    origin: { type: "string" },
    principalId: { type: "string", minLength: 1 },
    sourceTokenRef: secretSchema,
    websiteTokenRef: secretSchema,
    meetings: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        properties: {
          meetingId: { type: "string" },
          folderId: { type: "string" },
          fileId: { type: "string" },
          artifact: { enum: ["meet-transcript", "gemini-notes"] },
          transcriptName: { type: "string" },
          withdrawn: { type: "boolean" },
          meeting: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              attendees: { type: ["string", "null"] },
              agenda: { type: ["string", "null"] },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["title", "date", "attendees", "agenda", "tags"],
            additionalProperties: false,
          },
        },
        required: [
          "meetingId",
          "folderId",
          "fileId",
          "artifact",
          "withdrawn",
          "meeting",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["enabled"],
  additionalProperties: false,
};
type SecretRef = {
  type: "secret_ref";
  secretId: string;
  version?: number | "latest";
};
interface Settings {
  nativeIntake?: MeetingIntakeAdmission;
  enabled: true;
  admission: string;
  origin: string;
  principalId: string;
  sourceTokenRef: SecretRef;
  websiteTokenRef: SecretRef;
  meetings: Array<
    Omit<
      MeetingJobConfig,
      "enabled" | "admission" | "origin" | "principalId" | "companyId"
    >
  >;
}
function parse(value: unknown): Settings | null {
  if (
    !value ||
    typeof value !== "object" ||
    (
      value as {
        enabled?: unknown;
      }
    ).enabled !== true
  )
    return null;
  const s = value as Settings;
  const secret = (ref: SecretRef) =>
    ref &&
    ref.type === "secret_ref" &&
    typeof ref.secretId === "string" &&
    !!ref.secretId.trim() &&
    (ref.version === undefined ||
      ref.version === "latest" ||
      (Number.isSafeInteger(ref.version) && Number(ref.version) > 0));
  if (
    typeof s.admission !== "string" ||
    !s.admission.trim() ||
    typeof s.principalId !== "string" ||
    !s.principalId.trim() ||
    !secret(s.sourceTokenRef) ||
    !secret(s.websiteTokenRef) ||
    !Array.isArray(s.meetings) ||
    s.meetings.length > 100
  )
    throw Error("invalid_configuration");
  const u = new URL(s.origin);
  if (u.protocol !== "https:" || u.origin !== s.origin)
    throw Error("invalid_configuration");
  if (
    s.nativeIntake &&
    (s.nativeIntake.referenceOnly !== true ||
      typeof s.nativeIntake.organizationId !== "string" ||
      !s.nativeIntake.organizationId.trim() ||
      typeof s.nativeIntake.intakeAgentId !== "string" ||
      !s.nativeIntake.intakeAgentId.trim())
  )
    throw Error("invalid_configuration");
  const ids = new Set<string>();
  for (const m of s.meetings) {
    if (
      !validDriveBinding({ ...m, companyId: "validation" }) ||
      typeof m.withdrawn !== "boolean" ||
      !m.meeting ||
      typeof m.meeting.title !== "string" ||
      typeof m.meeting.date !== "string" ||
      ids.has(m.meetingId)
    )
      throw Error("invalid_configuration");
    ids.add(m.meetingId);
  }
  return structuredClone(s);
}
function jobConfig(
  s: Settings,
  m: Settings["meetings"][number],
  companyId: string,
): MeetingJobConfig {
  return {
    ...m,
    companyId,
    enabled: true,
    admission: s.admission,
    origin: s.origin,
    principalId: s.principalId,
  };
}
export interface RoundtableStatus {
  state: "disabled" | "complete" | "attention";
  results: MeetingJobResult[];
}
/** Actual pinned SDK composition; registration does not enable, provision credentials or schedule work. */
export function registerRoundtableJobs(
  ctx: Pick<
    PluginContext,
    "jobs" | "companies" | "config" | "db" | "secrets" | "http" | "issues"
  >,
): () => RoundtableStatus {
  const workerId = randomUUID();
  let status: RoundtableStatus = { state: "disabled", results: [] };
  ctx.jobs.register(roundtableJobDeclaration.jobKey, async (job) => {
    const results: MeetingJobResult[] = [];
    let enabled = false;
    try {
      for (const company of await ctx.companies.list({ limit: 1000 })) {
        try {
          const settings = parse((await ctx.config.get(company.id)).roundtable);
          if (!settings) continue;
          enabled = true;
          for (const meeting of settings.meetings) {
            const initial = jobConfig(settings, meeting, company.id);
            const owner = createRuntimeOwner(ctx.db, {
              workerId,
              runId: job.runId,
            });
            const key = (scope: MeetingScope) =>
              "roundtable:" + sha256(JSON.stringify([scope.meetingId]));
            const state = (scope: MeetingScope) =>
              runtimeState(ctx.db, scope.companyId, scope.origin);
            async function current() {
              return parse((await ctx.config.get(company.id)).roundtable);
            }
            const unchanged = (s: Settings | null) => {
              if (
                !s ||
                s.admission !== settings.admission ||
                s.origin !== settings.origin ||
                s.principalId !== settings.principalId
              )
                return false;
              const m = s.meetings.find(
                (x) => x.meetingId === meeting.meetingId,
              );
              if (!m || JSON.stringify(m) !== JSON.stringify(meeting))
                return false;
              return (
                JSON.stringify([
                  s.sourceTokenRef,
                  s.websiteTokenRef,
                  s.nativeIntake ?? null,
                ]) ===
                JSON.stringify([
                  settings.sourceTokenRef,
                  settings.websiteTokenRef,
                  settings.nativeIntake ?? null,
                ])
              );
            };
            const admittedFetch: typeof fetch = async (url, init) => {
              const s = await current();
              if (
                !unchanged(s) ||
                s?.meetings.find((x) => x.meetingId === meeting.meetingId)
                  ?.withdrawn
              )
                throw Error("Meeting admission changed.");
              return ctx.http.fetch(String(url), init);
            };
            const loadConfig = async () => {
              const s = await current();
              if (!s) return { ...initial, enabled: false };
              const m = s.meetings.find(
                (x) => x.meetingId === meeting.meetingId,
              );
              if (!m) return { ...initial, enabled: false };
              return jobConfig(s, m, company.id);
            };
            results.push(
              await runMeetingJob(initial, {
                store: {
                  own: (scope, work) =>
                    owner.own(
                      {
                        companyId: scope.companyId,
                        namespaceScope: scope.origin,
                        key: key(scope),
                      },
                      work,
                    ),
                  read: (scope) =>
                    state(scope).get<MeetingState>(
                      "roundtable:state:" + key(scope),
                    ),
                  save: (scope, value) =>
                    state(scope).set("roundtable:state:" + key(scope), value),
                },
                loadConfig,
                readSource: async (binding) => {
                  const s = await current();
                  if (!unchanged(s))
                    return { state: "pending", code: "configuration_changed" };
                  // A missing transcript is a useful source exception, not reason to resolve secrets.
                  if (binding.artifact === "gemini-notes")
                    return {
                      state: "summary-only",
                      code: "transcript_required",
                    };
                  try {
                    const token = await ctx.secrets.resolve(s!.sourceTokenRef, {
                      companyId: company.id,
                      configPath: "roundtable.sourceTokenRef",
                    });
                    if (!unchanged(await current()))
                      return {
                        state: "pending",
                        code: "configuration_changed",
                      };
                    return createDriveMeetingSource({
                      token,
                      fetch: admittedFetch,
                    })(binding);
                  } catch {
                    return {
                      state: "blocked",
                      code: "authentication_required",
                    };
                  }
                },
                // Extractive notes only. Source instructions can never select destinations or create tasks.
                transform: async ({ transcript }) => ({
                  notes: transcript
                    .split("\n")
                    .map((text, i) => ({ text, line: i + 1 }))
                    .filter(
                      (row) =>
                        !!row.text.trim() &&
                        row.text.length <= 10000 &&
                        !/[<>]/.test(row.text),
                    )
                    .slice(0, 1000),
                  decisions: [],
                  actions: [],
                }),
                publish: async (operation) => {
                  const s = await current();
                  if (
                    !unchanged(s) ||
                    !s ||
                    s.meetings.find((x) => x.meetingId === meeting.meetingId)
                      ?.withdrawn
                  )
                    return { state: "pending", code: "configuration_changed" };
                  let token: string;
                  try {
                    token = await ctx.secrets.resolve(s.websiteTokenRef, {
                      companyId: company.id,
                      configPath: "roundtable.websiteTokenRef",
                    });
                  } catch {
                    return {
                      state: "blocked",
                      code: "authentication_required",
                    };
                  }
                  if (!unchanged(await current()))
                    return { state: "pending", code: "configuration_changed" };
                  return createWebsitePublisher({
                    origin: s.origin,
                    principalId: s.principalId,
                    token,
                    fetch: admittedFetch,
                  }).publish(operation);
                },
                clock: Date.now,
                onResult: async (result, scope) => {
                  if (
                    !settings.nativeIntake ||
                    result.state === "disabled" ||
                    !unchanged(await current())
                  )
                    return undefined;
                  const persisted = await state(scope).get<MeetingState>(
                    "roundtable:state:" + key(scope),
                  );
                  const version =
                    persisted?.operation?.operationId ??
                    sha256(
                      JSON.stringify([
                        meeting.fileId,
                        meeting.artifact,
                        result.state,
                        result.code ?? null,
                      ]),
                    );
                  try {
                    const receipt = await reconcileMeetingIntake(
                      ctx,
                      {
                        companyId: company.id,
                        meetingId: meeting.meetingId,
                        origin: settings.origin,
                        principalId: settings.principalId,
                        nativeIntake: settings.nativeIntake,
                      },
                      result,
                      version,
                      async () => unchanged(await current()),
                    );
                    return receipt?.status;
                  } catch {
                    return "pending";
                  }
                },
              }),
            );
          }
        } catch {
          results.push({ state: "blocked", code: "invalid_configuration" });
        }
      }
    } catch {
      results.push({ state: "blocked", code: "native_state_unavailable" });
    }
    status = {
      state: results.some(
        (r) =>
          !["published", "already-published", "unchanged", "disabled"].includes(
            r.state,
          ) ||
          (r.nativeIntake !== undefined &&
            !["applied", "replayed"].includes(r.nativeIntake)),
      )
        ? "attention"
        : enabled
          ? "complete"
          : "disabled",
      results,
    };
  });
  return () => structuredClone(status);
}
