# Controlled native drafting gateway qualification

This is an independent two-checkout integration harness. It makes **no deployed
configuration, authentication, grant, credential, Docker, network, or model
changes**. It does not call a plugin callback directly and describe that as a
gateway test.

## Real execution path

1. The pinned Paperclip 2026.1012.0 `createToolGatewayService.executePluginTool`
   validates a fixture authenticated-route actor against a real native run row.
2. Native tool-access policy and audit code execute real SQL.
3. The actual native plugin dispatcher and registry call `executeTool` over the
   actual SDK's JSON-RPC streams, with `parameters` and `runContext` separate.
4. `registerPublicDrafting` executes against native host services for issue,
   subtree, assignee, active-run, checkout, and document operations.
5. The production duplex bridge launches the actual Python entrypoint with
   pinned administrator scope and package sources. DFW's real drafting service
   stores a candidate, checkpoints, independent review and suggestion in SQLite.

All 304 pinned Paperclip migrations and their constraints are applied to isolated
in-memory PGlite. The DFW fixture uses a new local SQLite file for every run.
No database listener or production data source is used.

## Explicit fixtures and limits

- HTTP authentication is **not** tested. The already-authenticated actor supplied
  to the gateway service is a deterministic fixture, not a real login or token.
- Native company/project/agents/issues/runs and exact producer/reviewer tool
  grants are fixtures inserted only into the isolated in-memory database.
  Identity creation grants no tool access. Drafting consumers explicitly grant
  the four producer tools and two reviewer tools; no blanket plugin allow policy
  substitutes for their native permission checks.
- The worker-manager transport is in-memory, but the dispatcher, registry,
  JSON-RPC host and host-client capability/scope handlers are unmodified native
  code. This does not establish OS process isolation or deployment admission.
- The runtime owner is a serial fixture callback, not a concurrency/fencing test.
- Wake requests are recorded deterministically. No agent runner or LLM starts.
- Sponsor evidence and the independent review judgment are deterministic fixtures.
  They establish routing and persistence, not real research or model quality.
- PGlite and SQLite are not qualification of deployed PostgreSQL transport,
  production lifecycle, installation policy, or current DAO human authority.

## Reproduce

From the Inertia checkout, use explicit existing local dependencies:

```sh
QUALIFICATION_PRIVATE_ROOT=/absolute/path/government-funding-dfw \
QUALIFICATION_PYTHON=/absolute/path/existing-dfw-venv/bin/python \
QUALIFICATION_NATIVE_ROOT=/absolute/path/pinned-host/node_modules \
bash scripts/drafting-qualification/run.sh
```

Required environment:

- `QUALIFICATION_PRIVATE_ROOT`: `government-funding-dfw` checkout containing its
  real `src/` and `tests/test_codex_agents.py` fixture helper.
- `QUALIFICATION_PYTHON`: preinstalled DFW Python interpreter. This harness never
  installs dependencies or creates credentials.

Optional environment:

- `QUALIFICATION_PUBLIC_ROOT`: defaults to this Inertia checkout.
- `QUALIFICATION_NATIVE_ROOT`: defaults to this checkout's
  `host-composition/paperclip-durable-funding-review/node_modules`; set it when the
  existing pinned host dependencies live elsewhere.
- `QUALIFICATION_OUTPUT_DIR`: defaults to a new temporary directory. All generated
  build files, fixture databases and JSON receipts are written there, not into
  the repository. The launcher prints the final receipt path.

The locked inputs used in the original qualification were Node 24.22.1,
Paperclip server/SDK/database 2026.1012.0, PGlite 0.5.11, and the existing Python
DFW environment. Key executed native and public JavaScript files and all 124
Python package sources are fingerprinted in each receipt. The source count can
change with the candidate: the configured production pin limit remains enforced.

The launcher builds the current public source into the output directory's `build/`, not
the production checkout. The Python process receives only the administrator
configuration path and the model's operation arguments. Its authority arrives
through fresh native callback checks.

## Evidence

- `qualification-receipt.json`: exact qualified code hashes, native migration
  count, coverage, native invocation records and durable DFW identity/effect rows.
- `gateway-dispatch-proof.json`: the native dispatcher RPC with separate model
  arguments/run context, plus actual Python context callback records.
Capture stdout/stderr and the process exit status when retaining a qualification
record. Earlier local development attempts encountered two harness-only setup
errors (native fixture insertion order and a document-service lookup typo); both
were corrected before the successful integration passes. No production defect
was inferred from them.

The fourteen groups cover public workspace privacy and complete nested gap-progress
schema delivery, identity-argument spoofing,
native actor mismatch, stale run state, changed assignment/configuration,
revocation between Python callbacks, durable gap replay, native reviewer
document creation, complete strict machine-review output schema delivery,
independently authenticated review with mismatched-hash and extra-field
rejection, safe producer/reviewer retry, same-reviewer/new-native-run recovery without rewriting original review attribution,
and exact durable effect counts.

The final domain assertions require exactly one candidate, one independent review,
one still-`suggested` proposal and one gap checkpoint. Producer and reviewer
principal/run IDs come from their separate native runs. No new applicant field,
human acceptance, signoff, outcome event or submission is created.

The command-free continuation additionally qualifies protected reviewer request discovery,
canonical native checkpoints, blocked/in-review preparation lifecycle, and Alpha workspace
reload after Beta without remembered proposal arguments. Actor authentication, model judgment
and wake scheduling remain fixtures. No claim is made that Docker shell commands work; the
application route uses plugin MCP callbacks only. The source harness itself runs local test
commands, which is not a deployed Codex command capability.

## Complete-manifest catalog regression

`host-composition/paperclip-durable-funding-review/tests/funding-role-catalog.test.mjs`
uses the compiled, complete 21-tool public manifest with two exact native grant
rows. It checks each role's catalog and rejects every other declared tool through
both direct native execution and HTTP MCP. It also checks revocation against
already-issued gateways and demonstrates that a broad native grant overrides a
narrow profile. MCP inventories must equal the role tools plus the four stock
Paperclip resource/prompt facade tools; unexpected names are not filtered away.

Run with the existing pinned native dependencies and a full source build:

```sh
QUALIFICATION_PUBLIC_ROOT=/absolute/path/Inertia \
QUALIFICATION_NATIVE_ROOT=/absolute/path/pinned-host/node_modules \
QUALIFICATION_FULL_MANIFEST=/absolute/path/full-build/src/manifest.js \
node --test host-composition/paperclip-durable-funding-review/tests/funding-role-catalog.test.mjs
```

`QUALIFICATION_FULL_MANIFEST` defaults to this checkout's `dist/src/manifest.js`.
Reduced synthetic catalogs are deliberately rejected for this regression and
for the deadline/preapproval native fixtures. The funding-only composition also
retains all 21 declarations; disabled feature registration does not narrow the
native manifest catalog. The worker result is
synthetic; these tests establish native admission and revocation, not domain
writes, HTTP actor authentication, deployed configuration, or model execution.
