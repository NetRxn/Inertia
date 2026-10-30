# Inertia nested Codex sandbox qualification

This application-specific AppArmor profile passed the fixed offline qualifier
on the exact target image. **Actual provider and business acceptance remain
separate.** It is derived from the default profile template embedded in installed
Docker 29.9.2 (`0367cbe`). The adjacent template is the exact extracted baseline.
All nonmount denials remain, including proc/sys protections, AF_ALG/AF_VSOCK,
signals, and same-profile ptrace. The template's variables are rendered with
ABI 3.0, tunables/global, abstractions/base, and the new profile name. The one
blanket mount denial becomes a default-deny allowlist for Bubblewrap's private
staging roots and setup operations.

Do not set `PAPERCLIP_RUNNER_EXTERNAL_SANDBOX` for a local runner. The native
executor intentionally derives it only for a selected remote sandbox target.
Do not disable AppArmor, change the host userns sysctl, add host capabilities,
use a privileged container, or alter the installed `docker-default` profile.

The observed startup error was `bwrap: Failed to make / slave: Permission denied`.
The pinned seccomp profile already permits mount and namespace syscalls. An
unchanged-security disposable test proved userns creation succeeds and mount
propagation fails. Installed Docker's template explicitly denies mount. A named
enforced candidate then emitted specific AppArmor mount/flag denials; those
audit records establish the actual policy boundary. The original blanket deny
did not emit an audit record. No claim of an audited baseline denial is made.

## No-load syntax check

Run only on the target parser (qualified version 4.0.1):

```sh
sudo apparmor_parser -Q -K --Werror inertia-codex-nested.profile
```

`-Q` skips kernel loading and `-K` skips the policy cache. Loading/replacing this
named profile is a separate operator action requiring exact-source review. No
automatic installation, live composition changes, or profile loading is provided.

## Disposable target check

The fixture uses the actual installed runner's permission generator and the
documented `codex sandbox` CLI. There is no model, provider simulation or provider
request. It attempts a synthetic JavaScript computation, three synthetic reads
outside the allowed workspace, a write to the readonly-mounted system tree,
and an allowed workspace write. It separately verifies that a write to the
sandbox's synthetic scratch ancestor does not persist to the outer container,
and that the outer synthetic sentinel files remain byte-identical.
It checks parent/child effective capabilities and no-new-privileges. It asserts
the parent AppArmor label before invoking the sandbox. The default-profile case
expects the original denial; the candidate case requires every positive and
negative assertion to pass. A failed candidate is not acceptance.

The child deliberately has no extra `/proc` readable root. The trusted parent
observes only its own bounded process tree, following children of every owned
thread (Codex can spawn Bubblewrap from a worker), and matches the fixed inner
PID through `NSpid` plus the trusted Node runtime's process name. This verifies
inner effective/bounding capabilities are zero and no-new-privileges is set
without expanding the child's filesystem authority.

Final target evidence: profile SHA-256
`b5aa637490a149288ac8741a718d9247efcbf3f557bc758c3655bcbce26019e1`,
fixture SHA-256
`a995e349595a0cb46cc67f128f9fb3ba8757787f1da802b2583e9c784296f97c`.
Named ENFORCE run exited zero with computation42, three protected reads denied,
system write denied, workspace persistence, scratch isolation, unchanged outer
sentinels, zero parent/inner effective capabilities, zero inner bounding
capabilities and no-new-privileges. The separate diagnostic profile was removed;
the live application and `docker-default` remained unchanged during qualification.

Initial enforced probes exposed exact missing `rw,silent` propagation flags and
`silent` remount flags. A temporary separately named complain profile was used
only with the fixed no-state/no-network fixture and then removed. Kernel audit
rate suppression meant absence of additional records was not proof; remaining
Bubblewrap operations were checked against the pinned source and the final
ENFORCE run was required. Earlier fixture corrections distinguished private
scratch writes from outer mutation and moved capability observation outside the
child's intentionally hidden `/proc` filesystem.

After the operator separately authorizes/loads the exact named candidate, run:

```sh
run_qualification() {
  sudo docker run --rm -i --network none --read-only --user 1000:1000 --init \
    --cap-drop ALL --security-opt no-new-privileges:true \
    --security-opt seccomp=/srv/inertia/paperclip/seccomp.json \
    --security-opt apparmor="$1" --memory 4g --cpus 2 --pids-limit 1024 \
    --tmpfs /work:rw,exec,nosuid,nodev,uid=1000,gid=1000,mode=0700,size=2g \
    --tmpfs /tmp:rw,exec,nosuid,nodev,uid=1000,gid=1000,mode=0700,size=512m \
    --env HOME=/work/home --env CODEX_HOME=/work/codex --entrypoint node \
    sha256:48f3d62d3b6cf4ee547f4649343c06807b21ea601ce677abf4cb65892c40996f \
    --input-type=module - "$2" < qualify-codex-sandbox.mjs
}
run_qualification docker-default denied
run_qualification inertia-codex-nested-20261029 ready
```

No volumes, ports, keys, databases, app data or operational tools are mounted.
Use the existing exact image; do not build another image for this test. Even a
green offline fixture does not prove provider authentication, actual native task
completion, or funding business acceptance.

References: [Docker AppArmor](https://docs.docker.com/engine/security/apparmor/),
[Moby profile source](https://github.com/moby/profiles/blob/main/apparmor/template.go),
[Codex 0.156.1 bundled Bubblewrap source](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/vendor/bubblewrap/bubblewrap.c).
