# Native runner architecture repair (source only)

## Cause and exact baseline

This repairs Paperclip `2026.1012.0`, build
`bba6a45f0d364cfd962ac59b3bdf2426a8222adb`, after the restricted Coordinator
overlay. It does not upgrade Paperclip or Codex.

The upstream [native resolver](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/server/src/services/native-runtime/native-codex-runner.ts)
checks `PAPERCLIP_RUNNER_BINARY`, the packaged
`dist/vendor/paperclip-runner/bin/paperclip-runnerd`, then two source-workspace
locations. It checks read/execute access, not machine architecture; an invalid
explicit path silently falls back. The npm package's runner inspected here is
Linux x86-64, even when the package is installed into an ARM64 image.

Upstream [staging](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/packages/paperclip-runner/scripts/stage-runner-binary.mjs)
copies the build-machine binary into a single architecture-neutral pathname.
The official [Dockerfile](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/Dockerfile)
instead builds the runner for the image architecture, and its
[workflow](https://github.com/paperclipai/paperclip/blob/bba6a45f0d364cfd962ac59b3bdf2426a8222adb/.github/workflows/docker.yml)
publishes native `linux/amd64` and `linux/arm64` images.

This is **not** the Codex binary. The pinned official
[Codex0.156.1 launcher](https://github.com/openai/codex/blob/rust-v0.156.1/codex-cli/bin/codex.js)
already maps Linux x64 and ARM64 to `@openai/codex-linux-x64` and
`@openai/codex-linux-arm64`. Leave that launcher, version and connection intact.
The failed runtime's exact missing override path was not available; this
source diagnosis does not invent it.

## Small correction

`apply-native-runner-resolution.mjs` verifies the exact package/build, resolver,
patch and unchanged managed-auth guard, then applies a zero-fuzz overlay.
Repeat installation is idempotent. Drift and symlinked targets fail before writes.
An explicit absolute package root may be supplied with
`PAPERCLIP_NATIVE_PACKAGE_ROOT` during image composition; otherwise the bundle's
own `node_modules/@paperclipai/server` is used.

The resolver keeps the same fixed locations but makes an explicit override
authoritative. On Linux it requires a regular readable executable, ELF64
little-endian format and machine `62` for x64 or `183` for ARM64. Missing or
incompatible selections fail before runner launch; no shell wrapper, PATH search,
new backend, credential or authentication fallback is added.

`Dockerfile.native-runner` is an additive image layer on the already qualified
Coordinator candidate. Its default source is the verified official release index:

```
ghcr.io/paperclipai/paperclip@sha256:1661b3dd3fdf7a9b59542d1ced464c3faf9dc8309798b4d15a9923ed32795307
```

Both platform manifests/configs and their hash-bound BuildKit provenance identify
build `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`, release `2026.1012.0`.
[The official release build](https://github.com/paperclipai/paperclip/actions/runs/38308573238)
completed successfully at that exact commit. Raw registry bytes were checked
against every index/manifest/config/provenance digest; this is not a claim of
separately verified signing identity. The full-SHA image alias was absent, so
the official release tag was resolved and then frozen by immutable digest.
See `evidence/native-runner-image.json` for the platform-specific chain.

Supply the **two candidate-specific** build arguments:

- `PAPERCLIP_CANDIDATE_IMAGE`: the reviewed candidate image, pinned by digest.
- `PAPERCLIP_NATIVE_PACKAGE_ROOT`: the existing absolute package directory
  inside that candidate, established from its build, not guessed from a home.

`PAPERCLIP_RUNNER_IMAGE_DIGEST` already defaults to the verified index above;
overriding it requires separate artifact qualification. No mutable tag is used
by the Dockerfile.

Build with `--platform=linux/arm64` or `--platform=linux/amd64` and this directory
as the context. The official artifact stage selects the same `TARGETPLATFORM`.
Only `paperclip-runnerd` and its public source build stamp are copied. The final
image sets `PAPERCLIP_RUNNER_BINARY` to the new image-owned executable and retains
the base USER, ENTRYPOINT and CMD. It does not alter Codex, connection storage,
encryption keys, data, runtime mounts, agents or recipients.

Container-launch or Compose environment overrides the image's `ENV`. Before
replacement, preflight the candidate with the **intended effective runner
override**, without personal mounts or credentials. A stale external
`PAPERCLIP_RUNNER_BINARY` must be corrected to the image-owned path or removed so
the image value applies. The unavailable old path is not guessed or rewritten
by this source repair; authentication and state settings remain unchanged.

The build runs the exact-source installer and preflight before any image can
be substituted for a healthy runtime. Preflight verifies the source stamp,
the coordinator/tool/security hashes and auth guard, then resolves the actual
selected binary. It also checks the loader and native protocol via the upstream
`--build-metadata` early-return path, with an empty child environment, no shell,
a bounded timeout and bounded output. This path opens no listener and starts no
provider. The receipt records binary SHA256, platform/architecture and metadata;
it explicitly does **not** grant deployment readiness.

## Verification and remaining gate

Run `npm run test:native-runner` for focused resolver, installer, preflight and
unchanged coordinator-boundary checks. The resolver tests use synthetic ELF
headers for both Linux machine mappings; this proves selection/refusal, not
execution of an ARM64 program on x64. Tests invoke the installed x64 binary's
metadata mode only. No personal home, credentials, database, provider, listener
or connected computer is used.

The optional CLI feature check was also completed separately with locally
materialized, integrity-verified official Codex0.156.1 x64 packages. In new empty
temporary homes, the existing test confirmed the version and both command-disable
flags (`shell_tool=false`, `shell_snapshot=false`). It used no global installation,
login, provider call or listener; it does not claim authenticated execution.

The ARM64 artifact was extracted from its fully SHA256-verified image layer.
Its image build stamp matches the pinned commit; its ELF machine is AArch64
(`183`), not x86-64. The binary SHA256 is
`1427907b42c18e1102f0a22711ded63355368e869d4412a7ed5e904d6401262a`.
No ARM64 executable was run in this x64 workspace. The Docker layer and the
binary's actual loader/ABI still must pass preflight in the authorized target
before rollout; authenticated provider acceptance is also still pending.
The extracted binary needs `/lib/ld-linux-aarch64.so.1`, `libgcc_s.so.1`,
`libm.so.6`, `libc.so.6`, and GLIBC symbols through **2.39**. Do not assume an
older candidate base satisfies that requirement or replace its base blindly.

If the candidate ABI cannot load this official artifact, the existing upstream
source has a narrow fallback: build only the same native runner from the exact
commit, using its pinned Rust **1.97.1** toolchain and unchanged Cargo lockfile
inside a native ARM64 builder compatible with the candidate's libc:

```
# From packages/paperclip-runner in the verified bba6a45 checkout:
cargo build --release --manifest-path runner/Cargo.toml --locked \
  -p paperclip-runner-core --bin paperclip-runnerd
node scripts/stage-runner-binary.mjs
```

This is the official package's `build:binary` command, not a new runtime. It
needs the verified source including `runner/`, `protocol/` and
`rust-toolchain.toml`, Rustup with the package's 1.97.1 toolchain, a C compiler/linker, matching libc
development files, pkg-config and the existing Node24.11+ for staging. The
official Dockerfile also exposes `runner-build`, but that unmodified stage uses
Trixie and therefore does not by itself solve an older-libc target. Retain
the healthy runtime until either artifact passes the target preflight; no
provider, database or authentication setup is part of the build.
Keep the existing runtime and paused agents unchanged until those gates pass;
preserve the same encrypted login/key/data/mounts. No reauthentication is needed
or requested by this repair. Real model-visible tools and autonomous progression
remain the separate bounded native acceptance gate in `NATIVE-COORDINATOR.md`.
