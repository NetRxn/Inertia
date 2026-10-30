# Access origin verifier (source candidate)

This is a second origin check of Cloudflare Access app JWTs, separate from member application and Paperclip authentication. Configuration is operator-owned JSON, never model parameters. No application roles or sessions are created. It does not proxy requests. Only GET /verify and GET /healthz exist; health reports process reachability, not JWKS availability or deployment readiness.

The example issuer, audience and exact two-email allowlist reflect the approved configuration. These values are not secrets. Confirm the manually configured Cloudflare Access application covers **both** inertia.ing and paperclip.inertia.ing and uses this audience; if the hosts have different Access applications, each needs a separate verifier configuration/process with its own audience. Port 19091 is an example pending shared-proxy coordination.

Use the already installed, pinned @paperclipai/server dependency graph (Node >=24.11). No new dependency installation is required. Select the directory containing the server's package.json explicitly, not the repository/package working directory:

```sh
SERVER_PACKAGE_ROOT=/opt/host/node_modules/@paperclipai/server \
  node /opt/inertia/host-composition/deployment/access-origin.mjs \
  /etc/inertia/access-origin.json
```

Install JSON and source as operator-owned files outside application/model writable directories. The command validates issuer, audience, email allowlist and loopback binding before listening. It resolves jose through the selected package root; maintain the existing host lockfile and dependency qualification. Use an ordinary unprivileged service account. No service unit/startup or public listeners are added by this candidate.

Example Caddy fragment for insertion into **each approved site block**, after agreement on the shared Caddy owner and actual upstream ports. Replace MEMBER_OR_PAPERCLIP_LOOPBACK_PORT with the actual service port:

```caddyfile
route {
    forward_auth 127.0.0.1:19091 {
        uri /verify
    }
    reverse_proxy 127.0.0.1:MEMBER_OR_PAPERCLIP_LOOPBACK_PORT {
        header_up -Cf-Access-Authenticated-User-Email
        header_up -Cf-Access-Jwt-Assertion
    }
}
```

`forward_auth` sends GET /verify before proxying. A missing, forged, expired, wrong-issuer/audience/algorithm/type or unlisted-email assertion receives 403. Access email headers alone never authorize. No identity response headers are copied into the app. Keep application authentication/session checks intact. Do not add a bypass route to the upstreams; all member/Paperclip public routes, including websocket handshakes, must pass through this guard. This source does not configure DNS, firewall, Cloudflare policies or app binding. Verify those independently before exposing either service.

Only exact HTTPS team origins under cloudflareaccess.com and RS256 are accepted. exp, iat, iss, aud, type=app and normalized allowlisted email are mandatory. The JWT signature is always verified with jose. Remote keys come exclusively from issuer + /cdn-cgi/access/certs with a 2.5s fetch timeout, 30s fetch cooldown and 5min key cache. A needed JWKS lookup failure denies authentication; there is no decoded-claims fallback. Already cached public keys remain usable during their cache lifetime, so an outage does not invalidate independently verifiable tokens signed by those keys. No JWT, claim or email logging occurs.

Bounds: 8KiB assertion, 12KiB HTTP header block, 32 headers, 64 connections, one request per socket, 5s request/header/socket limits and 1s keepalive; responses close the connection. No submitted request body is read or forwarded. HTTP resource settings are conservative defaults, not a load qualification.

Isolated verification with the existing pinned host graph:

```sh
SERVER_PACKAGE_ROOT=/path/to/installed/@paperclipai/server \
  node --test host-composition/deployment/access-origin.test.mjs
```

Tests generate local RSA keys, sign real JWTs, and use real jose verification. Key-resolution-failure testing injects a failing cryptographic key resolver at the verifier factory boundary; no claim-validation bypass is present. The source does not fetch keys or start a listener when imported.
