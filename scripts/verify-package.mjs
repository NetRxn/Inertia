import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "inertia-package-"));
const run = (args, cwd) =>
  execFileSync("npm", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_cache:
        process.env.npm_config_cache ?? join(tmpdir(), "inertia-npm-cache"),
    },
  });
try {
  const source = join(temporary, "source"),
    consumer = join(temporary, "consumer"),
    artifacts = join(temporary, "artifacts");
  await Promise.all([mkdir(source), mkdir(consumer), mkdir(artifacts)]);
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  for (const file of tracked) {
    await mkdir(dirname(join(source, file)), { recursive: true });
    await cp(join(root, file), join(source, file));
  }
  // Synthetic leakage probes: neither development sources nor private material belong in the runtime artifact.
  await mkdir(join(source, "private"), { recursive: true });
  await writeFile(
    join(source, "private", "do-not-package.txt"),
    "fixture-only private sentinel",
  );
  await writeFile(join(source, ".env"), "FIXTURE_ONLY=true");
  await assert.rejects(access(join(source, "dist")));
  run(["ci", "--ignore-scripts", "--no-audit", "--no-fund"], source);
  const packed = JSON.parse(
    run(["pack", "--json", "--pack-destination", artifacts], source),
  )[0];
  const files = packed.files.map((x) => x.path);
  for (const required of [
    "dist/src/manifest.js",
    "dist/src/worker.js",
    "migrations/001_bridge.sql",
    "migrations/004_runtime_state.sql",
    "migrations/005_outbound_comments.sql",
    "migrations/006_publication_claim.sql",
    "docs/native-comment-mirroring.md",
  ])
    assert(files.includes(required), `Missing runtime artifact: ${required}`);
  for (const file of files)
    assert(
      /^(package\.json|README\.md|LICENSE|dist\/src\/.+\.(js|d\.ts)|migrations\/[^/]+\.sql|docs\/(operations|bridge-state-contract|native-comment-mirroring|native-public-drafting)\.md)$/.test(
        file,
      ),
      `Unexpected packaged file: ${file}`,
    );
  const archive = join(artifacts, packed.filename);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "inertia-install-smoke",
      private: true,
      type: "module",
    }),
  );
  run(
    [
      "install",
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      archive,
    ],
    consumer,
  );
  const installed = join(consumer, "node_modules", "@inertia", "dao-helper");
  const pkg = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  for (const entry of Object.values(pkg.paperclipPlugin))
    await access(resolve(installed, entry));
  const manifest = (
    await import(
      pathToFileURL(resolve(installed, pkg.paperclipPlugin.manifest)).href
    )
  ).default;
  const worker = (
    await import(
      pathToFileURL(resolve(installed, pkg.paperclipPlugin.worker)).href
    )
  ).default;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {pluginManifestV1Schema} from '@paperclipai/shared'; import manifest from ${JSON.stringify(pathToFileURL(resolve(installed, pkg.paperclipPlugin.manifest)).href)}; if(!pluginManifestV1Schema.safeParse(manifest).success)throw Error('Installed manifest rejected by pinned native schema');`,
    ],
    { cwd: consumer, stdio: "pipe" },
  );
  assert.equal(manifest.id, "netrxn.inertia");
  assert.equal(typeof worker.definition.setup, "function");
  await access(resolve(installed, manifest.entrypoints.worker));
  const migrations = await readdir(
    resolve(installed, manifest.database.migrationsDir),
  );
  assert(
    migrations.includes("001_bridge.sql") &&
      migrations.includes("004_runtime_state.sql"),
  );
  console.log(
    JSON.stringify(
      {
        result: "passed",
        files: files.length,
        manifest: manifest.id,
        worker: manifest.entrypoints.worker,
        migrations: migrations.length,
        installedRuntime: "production dependencies only",
        privateFiles: "excluded",
      },
      null,
      2,
    ),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
