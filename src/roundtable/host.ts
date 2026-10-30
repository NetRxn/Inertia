import { resolveNativeDescendantTask } from "../paperclip/context.js";
import { createIntakeStore } from "../intake/store.js";
import { objectiveKey } from "../intake/service.js";
import { createNativeObjectiveAdapter } from "../intake/native.js";
import type { ToolRunContext } from "@paperclipai/plugin-sdk";
import { readOwnerSourceJson } from "../intake/source.js";
import { isAbsolute, normalize } from "node:path";
import { createLocalWebsitePublisher } from "./local.js";
import { registerMeetingExtraction, MeetingExtractionPending, type MeetingExtractionBinding } from "./extraction.js";
import type { Source } from "./ingestion.js";
import type { SourceOutcome } from "./source.js";
import {
  reconcileMeetingIntake,
  meetingIntakeReference,
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
        projectId: {type:"string",minLength:1},
        sourceAccess: {const:true},
        autoStart: {type:"boolean",default:false},
        allowedAgentIds: {type:"array",items:{type:"string",minLength:1,maxLength:128},minItems:1,maxItems:32,uniqueItems:true},
      },
      required: ["organizationId", "intakeAgentId", "referenceOnly"],
      additionalProperties: false,
    },
    enabled: { type: "boolean", default: false },
    publicationMode: {enum:["website","local"],default:"website"},
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
          ownerFile: {type:"string",minLength:1,maxLength:4096,description:"Administrator-pinned owner-only JSON source export. Not a live Drive read."},
          nativeExtraction: {type:"object",properties:{projectId:{type:"string",minLength:1},issueId:{type:"string",minLength:1},agentId:{type:"string",minLength:1}},required:["projectId","issueId","agentId"],additionalProperties:false},
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
  publicationMode?: "website" | "local";
  sourceTokenRef?: SecretRef;
  websiteTokenRef?: SecretRef;
  meetings: Array<
    Omit<
      MeetingJobConfig,
      "enabled" | "admission" | "origin" | "principalId" | "companyId"
    > & {ownerFile?:string; nativeExtraction?:{projectId:string;issueId:string;agentId:string}}
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
  const secret = (ref: SecretRef | undefined) =>
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
    (s.publicationMode !== undefined && !["website","local"].includes(s.publicationMode)) ||
    (s.publicationMode !== "local" && !secret(s.websiteTokenRef)) ||
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
      !s.nativeIntake.intakeAgentId.trim() ||
      (s.nativeIntake.projectId!==undefined && (typeof s.nativeIntake.projectId!=="string" || !s.nativeIntake.projectId.trim())) ||
      (s.nativeIntake.autoStart!==undefined && typeof s.nativeIntake.autoStart!=="boolean") ||
      (s.nativeIntake.autoStart===true && (s.nativeIntake.sourceAccess!==true || !s.nativeIntake.projectId)) ||
      (s.nativeIntake.sourceAccess!==undefined && (s.nativeIntake.sourceAccess!==true || !s.nativeIntake.projectId)) ||
      (s.nativeIntake.allowedAgentIds!==undefined && (!Array.isArray(s.nativeIntake.allowedAgentIds) || !s.nativeIntake.allowedAgentIds.length || s.nativeIntake.allowedAgentIds.length>32 || s.nativeIntake.allowedAgentIds.some(v=>typeof v!=="string" || !v.trim() || v.length>128) || new Set(s.nativeIntake.allowedAgentIds).size!==s.nativeIntake.allowedAgentIds.length)))
  )
    throw Error("invalid_configuration");
  const ids = new Set<string>();
  for (const m of s.meetings) {
    if (
      !validDriveBinding({ ...m, companyId: "validation" }) ||
      (!m.ownerFile && !secret(s.sourceTokenRef)) ||
      (m.ownerFile !== undefined && (typeof m.ownerFile!=="string" || !isAbsolute(m.ownerFile) || normalize(m.ownerFile)!==m.ownerFile || m.ownerFile.length>4096)) ||
      (m.nativeExtraction !== undefined && (Object.keys(m.nativeExtraction).sort().join(",")!=="agentId,issueId,projectId" || Object.values(m.nativeExtraction).some(v=>typeof v!=="string" || !v.trim() || v.length>128))) ||
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
    publicationMode: s.publicationMode??"website",
  };
}
async function configuredSource(
  ctx: Pick<PluginContext,"config"|"secrets"|"http">,
  settings: Settings, meeting: Settings["meetings"][number], companyId: string,
  admitted: () => Promise<boolean>,
): Promise<SourceOutcome> {
  if(!(await admitted()))return {state:"pending",code:"configuration_changed"};
  if(meeting.artifact==="gemini-notes")return {state:"summary-only",code:"transcript_required"};
  if(meeting.ownerFile) {
    try {
      const value=await readOwnerSourceJson(meeting.ownerFile,4*1024*1024);
      const source=value as Source;
      if(!source || typeof source!=="object" || Object.keys(source).sort().join(",")!=="audience,kind,meetingId,ready,revision,sourceId,text" ||
        source.meetingId!==meeting.meetingId || source.sourceId!=="drive:"+meeting.fileId || source.kind!=="transcript" || source.audience!=="members" || source.ready!==true ||
        typeof source.revision!=="string" || !/^[1-9][0-9]{0,39}$/.test(source.revision) || typeof source.text!=="string" || !source.text.trim() || Buffer.byteLength(source.text)>2000000)
        return {state:"blocked",code:"invalid_owner_source"};
      if(!(await admitted()))return {state:"pending",code:"configuration_changed"};
      return {state:"ready",source};
    } catch {return {state:"blocked",code:"owner_source_unavailable"};}
  }
  try {
    const token=await ctx.secrets.resolve(settings.sourceTokenRef!,{companyId,configPath:"roundtable.sourceTokenRef"});
    if(!(await admitted()))return {state:"pending",code:"configuration_changed"};
    return createDriveMeetingSource({token,fetch:async(url,init)=>{
      if(!(await admitted()))throw Error("Meeting admission changed");
      return ctx.http.fetch(String(url),init);
    }})(jobConfig(settings,meeting,companyId));
  } catch {return {state:"blocked",code:"authentication_required"};}
}
export interface RoundtableStatus {
  state: "disabled" | "complete" | "attention";
  results: MeetingJobResult[];
}
/** Actual pinned SDK composition; registration does not enable, provision credentials or schedule work. */
export async function registerRoundtableJobs(
  ctx: Pick<
    PluginContext,
    "jobs" | "companies" | "config" | "db" | "secrets" | "http" | "issues" | "tools"
  >,
): Promise<() => RoundtableStatus> {
  // Jobs are unscoped SDK invocations. Resolve the finite configured inventory
  // before concurrent tool calls start; every job still rechecks live admission.
  const companyIds: string[] = [];
  const seen = new Set<string>();
  for(let offset=0;;offset+=1000){
    const page=await ctx.companies.list({limit:1000,offset});
    for(const company of page){
      if(seen.has(company.id))throw Error("Duplicate company inventory");
      seen.add(company.id);
      let config:Record<string,unknown>;
      try{config=await ctx.config.get(company.id);}
      catch(error){if(error instanceof Error&&error.message.includes("company context is required"))continue;throw error;}
      const candidate=config.roundtable;
      if(candidate&&typeof candidate==="object"&&(candidate as {enabled?:unknown}).enabled===true)companyIds.push(company.id);
    }
    if(page.length<1000)break;
  }
  const workerId = randomUUID();
  let status: RoundtableStatus = { state: "disabled", results: [] };
  const extractionOwner=createRuntimeOwner(ctx.db,{workerId,runId:"meeting-extraction"});
  async function resolveExtraction(companyId:string,meetingId:string,run?:ToolRunContext,purpose?:"context"|"submit"):Promise<MeetingExtractionBinding|null> {
    const settings=parse((await ctx.config.get(companyId)).roundtable);
    const matches=settings?.meetings.filter(m=>m.meetingId===meetingId || meetingIntakeReference({companyId,meetingId:m.meetingId,origin:settings.origin,principalId:settings.principalId}).sourceId===meetingId);
    const meeting=matches?.length===1?matches[0]:undefined;
    if(!settings || !meeting?.nativeExtraction || meeting.withdrawn)return null;
    meetingId=meeting.meetingId;
    const fingerprint=sha256(JSON.stringify(settings));
    const authorize=async()=>{
      const current=parse((await ctx.config.get(companyId)).roundtable);
      return !!current && sha256(JSON.stringify(current))===fingerprint;
    };
    let actor=meeting.nativeExtraction,canSubmit=true,checkMapping=async()=>true;
    if(run && purpose==="context" && settings.nativeIntake?.sourceAccess===true && [settings.nativeIntake.intakeAgentId,...(settings.nativeIntake.allowedAgentIds??[])].includes(run.agentId) && run.projectId===settings.nativeIntake.projectId) {
      const ref=meetingIntakeReference({companyId,meetingId,origin:settings.origin,principalId:settings.principalId});
      const key=objectiveKey(settings.nativeIntake.organizationId,ref),store=createIntakeStore(ctx.db),mapping=await store.read(key);
      if(mapping && !mapping.pending && !mapping.snapshot.withdrawn && mapping.companyId===companyId && mapping.nativeIssueId) {
        const readers=[settings.nativeIntake.intakeAgentId,...(settings.nativeIntake.allowedAgentIds??[])];
        const descendant={companyId,projectId:settings.nativeIntake.projectId!,rootIssueId:mapping.nativeIssueId,allowedAgentIds:readers,authorize};
        const taskIssueId=await resolveNativeDescendantTask(ctx,descendant,run);
        if(taskIssueId) {
          actor={projectId:settings.nativeIntake.projectId!,issueId:taskIssueId,agentId:run.agentId};canSubmit=false;
          checkMapping=async()=>{
            const m=await store.read(key);
            if(!m || m.pending || m.snapshot.withdrawn || m.companyId!==companyId || m.nativeIssueId!==mapping.nativeIssueId || m.marker!==mapping.marker || m.snapshot.sourceHash!==mapping.snapshot.sourceHash)return false;
            const rows=await createNativeObjectiveAdapter(ctx,companyId).find(key);
            return rows.length===1 && rows[0]!.id===mapping.nativeIssueId && rows[0]!.marker===mapping.marker && !["cancelled","done"].includes(rows[0]!.status) && await resolveNativeDescendantTask(ctx,descendant,run)===taskIssueId;
          };
        }
      }
    }
    const admitted=async()=>await authorize() && await checkMapping();
    return {...actor,companyId,meetingId,origin:settings.origin,configurationHash:fingerprint,authorize:admitted,canSubmit,sourceEvidence:meeting.ownerFile?"owner-file":"drive",
      readSource:()=>configuredSource(ctx,settings,meeting,companyId,authorize),
      resume:async()=>{const results=await reconcile({runId:"meeting-resume:"+randomUUID()},{companyId,meetingId});return results[0]??{state:"blocked",code:"meeting_binding_unavailable"};},
    };
  }
  const extraction=registerMeetingExtraction(ctx,{
    resolve:resolveExtraction,owner:extractionOwner,
    store:{
      read:(key,b)=>runtimeState(ctx.db,b.companyId,b.origin).get("meeting-extraction:"+key),
      save:(key,value,b)=>runtimeState(ctx.db,b.companyId,b.origin).set("meeting-extraction:"+key,value),
    },
  });
  async function reconcile(job:{runId:string}, only?:{companyId:string;meetingId:string}) {
    const results: MeetingJobResult[] = [];
    let enabled = false;
    try {
      for (const companyId of companyIds) {
        const company={id:companyId};
        if(only && company.id!==only.companyId)continue;
        try {
          const settings = parse((await ctx.config.get(company.id)).roundtable);
          if (!settings) continue;
          enabled = true;
          for (const meeting of settings.meetings) {
            if(only && meeting.meetingId!==only.meetingId)continue;
            let observedSource:Source|null=null;
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
                  s.publicationMode ?? "website",
                ]) ===
                JSON.stringify([
                  settings.sourceTokenRef,
                  settings.websiteTokenRef,
                  settings.nativeIntake ?? null,
                  settings.publicationMode ?? "website",
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
            const outcome = await runMeetingJob(initial, {
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
                readSource: async () => {
                  const result=await configuredSource(ctx,settings,meeting,company.id,async()=>unchanged(await current()) && !(await current())?.meetings.find(m=>m.meetingId===meeting.meetingId)?.withdrawn);
                  if(result.state==="ready")observedSource=result.source;
                  return result;
                },
                transform: async () => {
                  if(meeting.nativeExtraction) {
                    const binding=await resolveExtraction(company.id,meeting.meetingId);
                    if(!binding || !observedSource)throw Error("Native extraction binding unavailable");
                    return extraction.transform(binding,observedSource);
                  }
                  // v1.1 has no partial-extraction representation. Keep source pending, not an empty-success publication.
                  throw new MeetingExtractionPending("native_extraction_binding_required");
                },
                publish: async (operation) => {
                  const s = await current();
                  if (
                    !unchanged(s) ||
                    !s ||
                    s.meetings.find((x) => x.meetingId === meeting.meetingId)
                      ?.withdrawn
                  )
                    return { state: "pending", code: "configuration_changed" };
                  if(s.publicationMode==="local")return createLocalWebsitePublisher({origin:s.origin,principalId:s.principalId,companyId:company.id,store:runtimeState(ctx.db,company.id,s.origin),owner,authorize:async()=>{const latest=await current();return unchanged(latest) && !latest?.meetings.find(m=>m.meetingId===meeting.meetingId)?.withdrawn;}}).publish(operation);
                  let token: string;
                  try {
                    token = await ctx.secrets.resolve(s.websiteTokenRef!, {
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
              });
            results.push({...outcome,publicationMode:settings.publicationMode??"website"});
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
    return results;
  }
  ctx.jobs.register(roundtableJobDeclaration.jobKey,async job=>{await reconcile(job);});
  return () => structuredClone(status);
}
