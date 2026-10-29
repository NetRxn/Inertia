import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const hooks=vi.hoisted(()=>({afterRead:undefined as undefined|((path:string)=>void|Promise<void>),beforeStat:undefined as undefined|((path:string)=>void|Promise<void>),handles:[] as {fd:number}[]}));
// Coordinate real filesystem changes at an I/O boundary, without replacing
// file contents, metadata or reads with fabricated results.
vi.mock("node:fs/promises",async importOriginal=>{
  const real=await importOriginal<typeof import("node:fs/promises")>();
  return {...real,stat:async(...args:Parameters<typeof real.stat>)=>{await hooks.beforeStat?.(String(args[0]));return real.stat(...args);},
    open:async(...args:Parameters<typeof real.open>)=>{
      const file=await real.open(...args),read=file.read.bind(file);hooks.handles.push(file);
      file.read=(async(...readArgs:any[])=>{const result=await (read as any)(...readArgs);await hooks.afterRead?.(String(args[0]));return result;}) as typeof file.read;
      return file;
    }};
});
import { createBoundedContextBridge } from "../../src/bridge/duplex.js";

const directories: string[] = [];
afterEach(() => {
  hooks.afterRead=undefined;hooks.beforeStat=undefined;
  try { expect(hooks.handles.every(file=>file.fd===-1)).toBe(true); }
  finally { hooks.handles=[];for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); }
});
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "duplex-pin-stream-")); directories.push(cwd);
  const entrypoint = join(cwd, "bridge.cjs"), configurationPath = join(cwd, "config.json");
  writeFileSync(entrypoint, `const fs=require('node:fs');fs.writeFileSync('spawned','yes');
const rl=require('node:readline').createInterface({input:process.stdin});let n=0;
rl.on('line',line=>{JSON.parse(line);if(n++===0)console.log(JSON.stringify({type:'context',id:1}));
else{console.log(JSON.stringify({type:'result',ok:true,result:{admitted:true}}));rl.close();}});`);
  writeFileSync(configurationPath, "{}");
  const config = { executable: process.execPath, cwd, entrypoint, configurationPath,
    args: [entrypoint, "--config", configurationPath], timeoutMs: 3000, maxOutputBytes: 4096,
    pins: [entrypoint, configurationPath].map(path => ({ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") })) };
  const callbacks = { context: async () => ({ fixture: "authenticated-host-context" }) };
  return { cwd, config, callbacks, bridge: () => createBoundedContextBridge(config, "dfw-native-case-work-v1") };
}
function largePin(cwd: string, size: number) {
  const path = join(cwd, "pinned-runtime.bin"); writeFileSync(path, ""); truncateSync(path, size);
  const chunk = Buffer.alloc(64 * 1024), hash = createHash("sha256");
  for (let left = size; left > 0; left -= Math.min(left, chunk.length)) hash.update(chunk.subarray(0, Math.min(left, chunk.length)));
  return { path, sha256: hash.digest("hex") };
}

it("admits an exact runtime pin above 16MiB through the actual duplex context/result protocol", async () => {
  const f = fixture(); f.config.pins.push(largePin(f.cwd, 33 * 1024 * 1024 + 17));
  await expect(f.bridge().call("workspace", {}, f.callbacks)).resolves.toEqual({ admitted: true });
  expect(existsSync(join(f.cwd, "spawned"))).toBe(true);
});

it("rejects a changed large pin before launching the protocol child", async () => {
  const f = fixture(), pin = largePin(f.cwd, 33 * 1024 * 1024 + 17); f.config.pins.push(pin);
  writeFileSync(pin.path, Buffer.from([1]), { flag: "r+" });
  await expect(f.bridge().call("workspace", {}, f.callbacks)).rejects.toThrow("DFW drafting pin mismatch");
  expect(existsSync(join(f.cwd, "spawned"))).toBe(false);
});

it("keeps the existing operation deadline while verifying a large regular pin", async () => {
  const f = fixture(); f.config.pins.push(largePin(f.cwd, 256 * 1024 * 1024));
  await expect(f.bridge().call("workspace", {}, { ...f.callbacks, operationDeadlineAt: Date.now() + 20 }))
    .rejects.toThrow("DFW drafting deadline exhausted");
  expect(existsSync(join(f.cwd, "spawned"))).toBe(false);
});

it("preserves configured symlinks to regular pinned targets", async () => {
  const f = fixture(), pin = largePin(f.cwd, 4096), link = join(f.cwd, "configured-runtime-link");
  symlinkSync(pin.path, link); f.config.pins.push({ ...pin, path: link });
  await expect(f.bridge().call("workspace", {}, f.callbacks)).resolves.toEqual({ admitted: true });
});

it.skipIf(process.platform === "win32")("rejects a FIFO pin without waiting for a writer or launching the child", async () => {
  const f = fixture(), fifo = join(f.cwd, "not-a-runtime-file");
  expect(spawnSync("mkfifo", [fifo]).status).toBe(0);
  f.config.pins.push({ path: fifo, sha256: "a".repeat(64) });
  await expect(f.bridge().call("workspace", {}, f.callbacks)).rejects.toThrow(/regular files/);
  expect(existsSync(join(f.cwd, "spawned"))).toBe(false);
});

it("rejects a real in-place mutation during incremental verification before spawning", async()=>{
  const f=fixture(),pin=largePin(f.cwd,1024*1024);f.config.pins.push(pin);let changed=false;
  hooks.afterRead=path=>{if(path===pin.path&&!changed){changed=true;writeFileSync(pin.path,"changed",{flag:"r+"});}};
  await expect(f.bridge().call("workspace",{},f.callbacks)).rejects.toThrow("DFW drafting pin changed while verifying");
  expect(changed).toBe(true);expect(existsSync(join(f.cwd,"spawned"))).toBe(false);
});

it("rejects an atomic pinned-path replacement while the original descriptor is being hashed",async()=>{
  const f=fixture(),pin=largePin(f.cwd,1024*1024),replacement=join(f.cwd,"replacement");f.config.pins.push(pin);let replaced=false;
  writeFileSync(replacement,"different-runtime");
  hooks.afterRead=path=>{if(path===pin.path&&!replaced){replaced=true;renameSync(replacement,pin.path);}};
  await expect(f.bridge().call("workspace",{},f.callbacks)).rejects.toThrow("DFW drafting pin changed while verifying");
  expect(replaced).toBe(true);expect(existsSync(join(f.cwd,"spawned"))).toBe(false);
});

it("closes the pinned descriptor after an actual read rejects without spawning",async()=>{
  const f=fixture(),pin=largePin(f.cwd,4096);f.config.pins.push(pin);
  hooks.afterRead=path=>{if(path===pin.path)throw Error("fixture_read_failure");};
  await expect(f.bridge().call("workspace",{},f.callbacks)).rejects.toThrow("fixture_read_failure");
  expect(existsSync(join(f.cwd,"spawned"))).toBe(false);
});

it("charges a delayed read completion to the same operation deadline and closes its descriptor",async()=>{
  const f=fixture(),pin=largePin(f.cwd,4096);f.config.pins.push(pin);
  hooks.afterRead=async path=>{if(path===pin.path)await new Promise(resolve=>setTimeout(resolve,120));};
  await expect(f.bridge().call("workspace",{},{...f.callbacks,operationDeadlineAt:Date.now()+80})).rejects.toThrow("DFW drafting deadline exhausted");
  expect(existsSync(join(f.cwd,"spawned"))).toBe(false);
});

it("rejects deadline expiry after EOF during final path metadata verification",async()=>{
  const f=fixture();let stats=0;
  hooks.beforeStat=async path=>{if(path===f.config.entrypoint&&++stats===2)await new Promise(resolve=>setTimeout(resolve,120));};
  await expect(f.bridge().call("workspace",{},{...f.callbacks,operationDeadlineAt:Date.now()+80})).rejects.toThrow("DFW drafting deadline exhausted");
  expect(stats).toBe(2);expect(existsSync(join(f.cwd,"spawned"))).toBe(false);
});
