import type { Source } from "./ingestion.js";
/** Trusted configuration, never derived from document text or filenames. */
export interface DriveMeetingBinding {
  companyId: string;
  meetingId: string;
  folderId: string;
  fileId: string;
  artifact: "meet-transcript" | "gemini-notes";
  transcriptName?: string;
}
export type SourceOutcome =
  | {
      state: "ready";
      source: Source;
    }
  | {
      state: "summary-only";
      code: "transcript_required";
    }
  | {
      state: "pending" | "blocked";
      code: string;
    };
const id = /^[A-Za-z0-9_-]{1,200}$/;
export function validDriveBinding(b: DriveMeetingBinding): boolean {
  return (
    !!b &&
    [b.companyId, b.meetingId, b.folderId, b.fileId].every(
      (v) => typeof v === "string" && id.test(v),
    ) &&
    (b.artifact === "gemini-notes" ||
      (b.artifact === "meet-transcript" &&
        typeof b.transcriptName === "string" &&
        /^conferenceRecords\/[A-Za-z0-9_-]+\/transcripts\/[A-Za-z0-9_-]+$/.test(
          b.transcriptName,
        )))
  );
}
class ReadFailure extends Error {
  constructor(
    readonly state: "pending" | "blocked",
    readonly code: string,
  ) {
    super(code);
  }
}
const fail = (state: "pending" | "blocked", code: string): never => {
  throw new ReadFailure(state, code);
};
/** Fixed API reader. Bracketed Drive versions bind text export to one stable file version. */
export function createDriveMeetingSource(config: {
  token: string;
  fetch: typeof globalThis.fetch;
}) {
  const token = config.token;
  async function read(url: string, kind: "json" | "text"): Promise<unknown> {
    const response = await config.fetch(url, {
      headers: { Authorization: "Bearer " + token },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) fail("blocked", "authentication_required");
    if (response.status === 403) fail("blocked", "scope_denied");
    if (response.status !== 200 || response.redirected)
      fail("pending", "source_unavailable");
    const type = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (
      type !== (kind === "json" ? "application/json" : "text/plain") ||
      !response.body
    )
      fail("blocked", "invalid_source_response");
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > (kind === "json" ? 100000 : 2000000)) {
          await reader.cancel();
          fail("blocked", "source_too_large");
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, size),
    );
    return kind === "json" ? JSON.parse(text) : text;
  }
  return async (input: DriveMeetingBinding): Promise<SourceOutcome> => {
    if (!validDriveBinding(input))
      return { state: "blocked", code: "invalid_source_binding" };
    const b = structuredClone(input);
    if (b.artifact === "gemini-notes")
      return { state: "summary-only", code: "transcript_required" };
    if (typeof token !== "string" || !token.trim() || /[\r\n]/.test(token))
      return { state: "blocked", code: "authentication_required" };
    try {
      const transcript = (await read(
        "https://meet.googleapis.com/v2/" + b.transcriptName,
        "json",
      )) as Record<string, unknown>;
      if (transcript.name !== b.transcriptName)
        fail("blocked", "source_scope_mismatch");
      if (transcript.state !== "FILE_GENERATED")
        return { state: "pending", code: "source_not_ready" };
      if (
        (
          transcript.docsDestination as
            | {
                document?: unknown;
              }
            | undefined
        )?.document !== b.fileId
      )
        fail("blocked", "source_scope_mismatch");
      const metadataUrl =
        "https://www.googleapis.com/drive/v3/files/" +
        b.fileId +
        "?fields=id%2Cversion%2CmimeType%2Cparents%2Ctrashed&supportsAllDrives=true";
      function metadata(value: unknown): string {
        const m = value as Record<string, unknown>;
        if (
          !m ||
          m.id !== b.fileId ||
          m.mimeType !== "application/vnd.google-apps.document" ||
          m.trashed !== false ||
          !Array.isArray(m.parents) ||
          !m.parents.includes(b.folderId)
        )
          fail("blocked", "source_scope_mismatch");
        if (
          typeof m.version !== "string" ||
          !/^[1-9][0-9]{0,39}$/.test(m.version)
        )
          fail("blocked", "invalid_source_revision");
        return m.version as string;
      }
      const version = metadata(await read(metadataUrl, "json"));
      const text = (await read(
        "https://www.googleapis.com/drive/v3/files/" +
          b.fileId +
          "/export?mimeType=text%2Fplain",
        "text",
      )) as string;
      if (metadata(await read(metadataUrl, "json")) !== version)
        return { state: "pending", code: "source_changed" };
      if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))
        return { state: "blocked", code: "invalid_source_text" };
      return {
        state: "ready",
        source: {
          meetingId: b.meetingId,
          sourceId: "drive:" + b.fileId,
          revision: version,
          ready: true,
          kind: "transcript",
          audience: "members",
          text,
        },
      };
    } catch (error) {
      return error instanceof ReadFailure
        ? { state: error.state, code: error.code }
        : { state: "pending", code: "source_unavailable" };
    }
  };
}
