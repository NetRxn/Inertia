/** Test-only in-memory wires around the actual pinned SDK JSON-RPC host. */
import {PassThrough} from 'node:stream';
import {createInterface} from 'node:readline';
import {definePlugin, startWorkerRpcHost, createHostClientHandlers} from '@paperclipai/plugin-sdk';

export async function sdkFixture({services, setup, jobs = [], companyId}) {
  const input = new PassThrough();
  const output = new PassThrough();
  const pending = new Map();
  const messages = [];
  let nextId = 10000;
  let ctx;
  const handlers = createHostClientHandlers({pluginId: 'synthetic-review', capabilities: ['http.outbound', 'secrets.read-ref', 'plugin.state.read', 'plugin.state.write'], services});
  const lines = createInterface({input: output});
  lines.on('line', async line => {
    const message = JSON.parse(line);
    messages.push({direction: 'worker', message, bytes: Buffer.byteLength(line)});
    if (message.method) {
      let reply;
      try { reply = {jsonrpc: '2.0', id: message.id, result: await handlers[message.method](message.params, companyId ? {invocationScope: {companyId}} : undefined) ?? null}; }
      catch (error) { reply = {jsonrpc: '2.0', id: message.id, error: {code: -32000, message: error.message}}; }
      const encoded = JSON.stringify(reply);
      messages.push({direction: 'host', message: reply, bytes: Buffer.byteLength(encoded)});
      input.write(encoded + '\n');
    } else {
      const call = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) call.reject(new Error(message.error.message));
      else call.resolve(message.result);
    }
  });
  const worker = startWorkerRpcHost({plugin: definePlugin({async setup(context) { ctx = context; await setup?.(context); }}), stdin: input, stdout: output});
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {resolve, reject});
    input.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n');
  });
  await call('initialize', {manifest: {id: 'netrxn.inertia', apiVersion: 1, version: '0.0.0', capabilities: ['http.outbound', 'secrets.read-ref', 'plugin.state.read', 'plugin.state.write'], jobs}, config: {}});
  return {ctx, call, messages, close() { worker.stop(); lines.close(); input.destroy(); output.destroy(); }};
}
