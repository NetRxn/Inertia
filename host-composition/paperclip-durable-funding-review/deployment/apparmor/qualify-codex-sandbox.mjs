// Offline only: no provider, credentials, application data, or network needed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import {
  createIsolatedCodexAppServerArgs,
  codexExecutableReadOnlyRoots,
  createSecuredCodexThreadParams,
} from "/opt/host/node_modules/@paperclipai/server/dist/vendor/paperclip-runner/drivers/codex/codex-security-config.js";

const expect = process.argv[2];
assert.ok(["denied", "ready"].includes(expect));
assert.equal(process.getuid(), 1000);
const parentStatus = () => fs.readFileSync("/proc/self/status", "utf8");
const expectedNodeName = parentStatus().match(/^Name:\s+(.+)$/m)?.[1].trim();
assert.ok(expectedNodeName);
assert.match(parentStatus(), /^CapEff:\s+0+$/m);
assert.match(parentStatus(), /^NoNewPrivs:\s+1$/m);
const attachedProfile = fs.readFileSync("/proc/self/attr/current", "utf8").trim();
assert.equal(attachedProfile, expect === "ready"
  ? "inertia-codex-nested-20261029 (enforce)" : "docker-default (enforce)");
console.log(JSON.stringify({ attachedProfile, parentUid: process.getuid(),
  parentEffectiveCapabilities: "none", noNewPrivileges: true }));
for (const path of ["/work/home", "/work/codex", "/work/qualification"])
  fs.mkdirSync(path, { recursive: true });
for (const path of ["/work/operator-private-sentinel", "/work/home/sentinel", "/work/codex/sentinel"])
  fs.writeFileSync(path, "OFFLINE-SYNTHETIC-NONSECRET", { mode: 0o600 });
const env = {
  HOME: "/work/home", CODEX_HOME: "/work/codex", PATH: process.env.PATH,
  PAPERCLIP_RUNNER_NETWORK_ACCESS: "enabled",
  PAPERCLIP_RUNNER_DISABLE_COMMAND_EXECUTION: "1",
};
const args = createIsolatedCodexAppServerArgs(env, codexExecutableReadOnlyRoots(env));
assert.equal(args.pop(), "app-server");
const permission = createSecuredCodexThreadParams("/work/qualification", "default", true, false, env).permissions;
assert.equal(permission, "paperclip-runner-workspace-only");
const inner = `
import fs from 'node:fs';import assert from 'node:assert/strict';
for(const path of ['/work/operator-private-sentinel','/work/home/sentinel','/work/codex/sentinel']) {
 let denied=false;try{fs.readFileSync(path)}catch(e){denied=['EACCES','EPERM','ENOENT'].includes(e.code)}assert.ok(denied);
}
let denied=false;try{fs.writeFileSync('/etc/inertia-offline-write-negative','x')}catch(e){denied=['EACCES','EPERM','ENOENT','EROFS'].includes(e.code)}assert.ok(denied);
// This /work ancestor belongs to the new private root tmpfs, not the outer mount.
fs.writeFileSync('/work/outside-write','private-ephemeral');
fs.writeFileSync('/work/qualification/positive-write','ok');
fs.writeFileSync('/work/qualification/inner-ready.tmp',JSON.stringify({pid:process.pid,fixture:'inertia-offline-fixed-inner'}));
fs.renameSync('/work/qualification/inner-ready.tmp','/work/qualification/inner-ready.json');
const deadline=Date.now()+5000;
while(!fs.existsSync('/work/qualification/release-inner')&&Date.now()<deadline) await new Promise(r=>setTimeout(r,20));
console.log(JSON.stringify({innerComputation:6*7,protectedSyntheticReadsDenied:3,readonlySystemWriteDenied:true,privateScratchWrite:true,workspaceWrite:true}));
`;
const child = spawn("codex", [...args, "sandbox", "-C", "/work/qualification", "-P", permission,
  "--", process.execPath, "--input-type=module", "-e", inner],
  { env, cwd: "/work/qualification", stdio: ["ignore", "pipe", "pipe"] });
let done = false, stdout = "", stderr = "";
child.stdout.on("data", x => { stdout += x; assert.ok(stdout.length <= 65536); });
child.stderr.on("data", x => { stderr += x; assert.ok(stderr.length <= 65536); });
const exited = new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (status, signal) => { done = true; resolve({ status, signal }); });
});
const timeout = setTimeout(() => child.kill("SIGTERM"), 20000);
function ownedDescendants(pid) {
  const found = new Set();
  function walk(parent) {
    if (found.has(parent)) return;
    assert.ok(found.size < 128, "unexpectedly large owned process tree");
    found.add(parent);
    let tids;
    try { tids = fs.readdirSync(`/proc/${parent}/task`).filter(x => /^\d+$/.test(x)); }
    catch { return; }
    assert.ok(tids.length <= 128, "unexpectedly large owned thread set");
    // Codex spawns Bubblewrap from a Tokio worker, not necessarily its main TID.
    for (const tid of tids) {
      let children;
      try { children = fs.readFileSync(`/proc/${parent}/task/${tid}/children`, "utf8").trim(); }
      catch { continue; }
      for (const value of children.split(/\s+/).filter(Boolean)) walk(Number(value));
    }
  }
  walk(pid); return [...found];
}
let innerObserved = false;
if (expect === "ready") {
  const deadline = Date.now() + 15000;
  while (!done && !innerObserved && Date.now() < deadline) {
    try {
      const ready = JSON.parse(fs.readFileSync("/work/qualification/inner-ready.json", "utf8"));
      assert.equal(ready.fixture, "inertia-offline-fixed-inner");
      for (const pid of ownedDescendants(child.pid)) {
        const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
        const nspid = status.match(/^NSpid:\s+(.+)$/m)?.[1].trim().split(/\s+/).map(Number);
        if (status.match(/^Name:\s+(.+)$/m)?.[1].trim() !== expectedNodeName || nspid?.at(-1) !== ready.pid) continue;
        assert.match(status, /^CapEff:\s+0+$/m);
        assert.match(status, /^CapBnd:\s+0+$/m);
        assert.match(status, /^NoNewPrivs:\s+1$/m);
        innerObserved = true;
        fs.writeFileSync("/work/qualification/release-inner", "release");
        break;
      }
    } catch (error) {
      if (!["ENOENT", "ESRCH"].includes(error.code)) { child.kill("SIGTERM"); throw error; }
    }
    if (!innerObserved) await new Promise(r => setTimeout(r, 20));
  }
}
const r = await exited;
clearTimeout(timeout);
if (expect === "denied") {
  assert.notEqual(r.status, 0);
  assert.match(stderr, /bwrap: Failed to make \/ slave: Permission denied/);
  console.log(JSON.stringify({ expectedBaselineDenied: true, commandExecuted: false }));
} else {
  if (r.status !== 0) process.stderr.write(stderr);
  assert.equal(r.status, 0);
  assert.ok(innerObserved, "inner CapEff/NoNewPrivs could not be observed from the owned process tree");
  const result = JSON.parse(stdout.trim());
  assert.equal(result.innerComputation, 42);
  assert.equal(fs.readFileSync("/work/qualification/positive-write", "utf8"), "ok");
  assert.equal(fs.existsSync("/work/outside-write"), false);
  assert.equal(fs.existsSync("/etc/inertia-offline-write-negative"), false);
  for (const path of ["/work/operator-private-sentinel", "/work/home/sentinel", "/work/codex/sentinel"])
    assert.equal(fs.readFileSync(path, "utf8"), "OFFLINE-SYNTHETIC-NONSECRET");
  result.privateScratchNotPersisted = true;
  result.outerSentinelsUnchanged = true;
  result.innerEffectiveCapabilities = "none";
  result.innerBoundingCapabilities = "none";
  result.innerNodeName = expectedNodeName;
  result.innerNoNewPrivileges = true;
  console.log(JSON.stringify(result));
}
assert.match(parentStatus(), /^CapEff:\s+0+$/m);
assert.match(parentStatus(), /^NoNewPrivs:\s+1$/m);
console.log(JSON.stringify({ parentEffectiveCapabilities: "none", permission,
  appArmor: fs.readFileSync("/proc/self/attr/current", "utf8").trim(),
  provider: false, operationalState: false, secrets: false }));
