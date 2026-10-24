# Review-service transport: integration requirements

The offline implementation is built and tested; production remains disabled.

1. Owning-host route composition. Confirm the supported Paperclip source patch/upgrade path and mount the authenticated native router after actorMiddleware. The installed plugin SDK does not register arbitrary authenticated routes.
2. Explicit pairing contract. Approve immutable source identity/origin, destination identity/database, company, applicant, funding source scope and purpose. Both services must use the identical scope handshake. Review any later mapping migration separately.
3. Current transport identity and least privilege. Provide existing approved credential references and an exact native key/user/company mapping, plus a DFW verified-principal/scope mapping and separately authorized cancellation actor. Generic admin access is not asserted to be least privilege. No live keys or grants have been created.
4. Approved receipt lifecycle. Supply verified durable native read/retention capability and idempotent exact-terminal acknowledgement/archival capability. Decide the authorized deletion/archive path and required retained audit handoff. This code defines no deletion policy or indefinite company-deletion lock.
5. DFW owning-service safeguards. Qualify the real PostgreSQL writer fence, immutable funding input/version bindings and current domain/cancellation permissions. Existing approval logic and transaction authority remain unchanged.
6. Network/resource qualification. Production must use fixed HTTPS endpoints. The SDK denies private addresses, pins DNS and does not redirect; private-only connectivity needs an explicitly supported owning-host route. Its HTTP RPC pre-buffers up to200MiB, so qualify a tighter host limit before live use. The adapter rejects protocol responses above1MiB.
7. Native job integration. Attach the bounded callable to an approved native job only after scheduling is authorized. Six HTTP requests per invocation cap SDK HTTP time at180seconds. Qualify lifecycle, secret and state operations within the scheduler's remaining five-minute budget. No recurring schedule is enabled by this work.
8. End-user walkthrough. Perform real authenticated human edit → regenerate → native review → DFW apply/cancel → archive/readback, including uncertain network response and revoked transport access. Synthetic tests do not replace this activation walkthrough.

No production routes, credentials, recurring runs, real data transfer, submissions or external outreach are activated by the tested source package.
