import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import type { DiligenceBridge } from "./diligence.js";
import type { DiscoveryBridge, DiscoveryBrief } from "./service.js";
/** Administrator-selected local executable and pinned module/config arguments. Never tool input. */
export interface DiscoveryProcessConfig {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  entrypoint: string;
  pins: Array<{ path: string; sha256: string }>;
}
export function createStdioDiscoveryBridge(
  configuration: DiscoveryProcessConfig,
  deadlineAt?: number,
): DiligenceBridge {
  const c = structuredClone(configuration);
  if (
    !isAbsolute(c.entrypoint) ||
    !c.args.includes(c.entrypoint) ||
    !Array.isArray(c.pins) ||
    !c.pins.length ||
    !c.pins.some((p) => p.path === c.entrypoint) ||
    c.pins.some((p) => !isAbsolute(p.path) || !/^[a-f0-9]{64}$/.test(p.sha256))
  )
    throw Error("Invalid DFW bridge pins");
  if (
    !isAbsolute(c.executable) ||
    !isAbsolute(c.cwd) ||
    !Array.isArray(c.args) ||
    c.args.length > 30 ||
    c.args.some((a) => typeof a !== "string" || a.length > 4096) ||
    !Number.isInteger(c.timeoutMs) ||
    c.timeoutMs < 100 ||
    c.timeoutMs > 120_000 ||
    !Number.isInteger(c.maxOutputBytes) ||
    c.maxOutputBytes < 1024 ||
    c.maxOutputBytes > 4 * 1024 * 1024
  )
    throw Error("Invalid DFW bridge process configuration");
  async function call<T>(request: unknown): Promise<T> {
    for (const pin of c.pins) {
      const bytes = await readFile(pin.path);
      if (createHash("sha256").update(bytes).digest("hex") !== pin.sha256)
        throw Error("DFW bridge pin mismatch");
    }
    const remaining =
      deadlineAt === undefined
        ? c.timeoutMs
        : Math.min(c.timeoutMs, deadlineAt - Date.now());
    if (remaining <= 0) throw Error("DFW bridge native run budget exhausted");
    const input = JSON.stringify(request) + "\n";
    if (Buffer.byteLength(input) > 128 * 1024)
      throw Error("DFW bridge request too large");
    return new Promise<T>((resolve, reject) => {
      const child = spawn(c.executable, c.args, {
        cwd: c.cwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let done = false,
        bytes = 0,
        diagnostics = 0;
      const chunks: Buffer[] = [];
      const fail = (message: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(Error(message));
      };
      const timer = setTimeout(
        () => fail("DFW bridge timed out; outcome unconfirmed"),
        remaining,
      );
      child.on("error", () => fail("DFW bridge process unavailable"));
      child.stdin.on("error", () =>
        fail("DFW bridge input failed; outcome unconfirmed"),
      );
      child.stdout.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > c.maxOutputBytes)
          return fail("DFW bridge response too large; outcome unconfirmed");
        chunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        diagnostics += chunk.length;
        if (diagnostics > 64 * 1024)
          fail("DFW bridge diagnostic limit exceeded; outcome unconfirmed");
      });
      child.on("close", (code) => {
        if (done) return;
        if (code !== 0) {
          // Only this pinned, pre-admission domain rejection has a confirmed
          // non-admission outcome. Other process failures remain uncertain.
          if (code === 2) {
            try {
              const lines = Buffer.concat(chunks).toString("utf8").trim().split("\n");
              const value = lines.length === 1 ? JSON.parse(lines[0]!) : null;
              if (value && Object.keys(value).sort().join() === "error,ok" && value.ok === false &&
                value.error && Object.keys(value.error).sort().join() === "code,outcome" &&
                value.error.code === "program_identity_evidence_required" && value.error.outcome === "not_admitted")
                return fail("DFW admission rejected: program_identity_evidence_required; no admission committed");
            } catch { /* Never forward unvalidated child output or diagnostics. */ }
          }
          return fail("DFW bridge process failed; outcome unconfirmed");
        }
        try {
          const lines = Buffer.concat(chunks)
            .toString("utf8")
            .trim()
            .split("\n");
          if (lines.length !== 1) throw Error();
          const value = JSON.parse(lines[0]!);
          if (
            !value ||
            typeof value !== "object" ||
            typeof value.ok !== "boolean"
          )
            throw Error();
          if (!value.ok) return fail("DFW bridge rejected request");
          if (!Object.hasOwn(value, "result")) throw Error();
          done = true;
          clearTimeout(timer);
          resolve(value.result as T);
        } catch {
          fail("DFW bridge returned invalid response; outcome unconfirmed");
        }
      });
      child.stdin.end(input);
    });
  }
  return {
    withDeadline: (deadline) => createStdioDiscoveryBridge(c, deadline),
    knowledge: {
      begin: (runId, query) => call({ op: "begin", runId, query }),
      commit: (input) => call({ op: "commit", input }),
    },
    inspect: (url, saved, identity) =>
      call({
        op: "inspect",
        url,
        runId: identity.runId,
        queryReceiptId: saved.query_receipt_id,
        idempotencyKey: identity.idempotencyKey,
      }),
    assessFundingFacts: (input) => call({ op: "assess_funding_facts", ...input }),
    sourceReview: (input) => call({ op: "source_review", ...input }),
    reviewCapture: (input) => call({ op: "review_capture", ...input }),
    readCapture: (captureId) => call({ op: "read_capture", captureId }),
    async readBrief(opportunityId) {
      const result = await call<DiscoveryBrief | null>({
        op: "brief",
        opportunityId,
      });
      if (!result) throw Error("No current admitted opportunity brief");
      // Plain canonical briefs carry no official urgency/recheck assessment. Do not invent one.
      if (!result.brief || !result.officialSourceHash || !result.nextRecheckAt)
        throw Error("No trusted discovery assessment");
      return result;
    },
  };
}
