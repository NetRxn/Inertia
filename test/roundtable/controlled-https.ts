import { createServer, request } from "node:https";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";

/** Synthetic loopback test server. Public fixture key; never use it outside tests. */
export async function controlledHttps(
  handle: (url: string, init: RequestInit) => Promise<Response>,
) {
  const cert = await readFile(new URL("../fixtures/controlled-website/public-test-cert.txt", import.meta.url));
  const key = await readFile(new URL("../fixtures/controlled-website/public-test-key.txt", import.meta.url));
  let origin = "";
  const server = createServer({ cert, key }, async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString("utf8");
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const response = await handle(origin + incoming.url, {
        method: incoming.method ?? "GET", headers, ...(body ? { body } : {}),
      });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(500); outgoing.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = "https://127.0.0.1:" + (server.address() as AddressInfo).port;
  const fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== origin) throw Error("Controlled transport refuses another origin");
    return new Promise<Response>((resolve, reject) => {
      const req = request(url, {
        ca: cert, method: init?.method ?? "GET",
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        ...(init?.signal ? { signal: init.signal } : {}),
      }, incoming => {
        const chunks: Buffer[] = [];
        incoming.on("data", chunk => chunks.push(Buffer.from(chunk)));
        incoming.on("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode ?? 500, headers }));
        });
        incoming.on("error", reject);
      });
      req.on("error", reject);
      req.end(init?.body === undefined ? undefined : String(init.body));
    });
  }) as typeof globalThis.fetch;
  return { origin, fetch, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
