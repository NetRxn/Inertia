/** Offline outgoing-schema probe: real pinned CLI, loopback fixture, no inference/auth. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const cli = process.env.NATIVE_WEB_CLI;
const securityModule = process.env.NATIVE_WEB_SECURITY_MODULE;
const commandNames = new Set(['exec_command','write_stdin','shell','shell_command','local_shell','terminal']);
const names = tools => tools.flatMap(t => [t.name, ...names(t.tools ?? [])].filter(Boolean));

test('native Codex hosted search is independent of disabled command network and shell', {
  skip: !cli || !securityModule ? 'Set NATIVE_WEB_CLI and NATIVE_WEB_SECURITY_MODULE to qualified local artifacts' : false,
  timeout: 120000,
}, async () => {
  const {createIsolatedCodexAppServerArgs} = await import(pathToFileURL(securityModule));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-web-schema-'));
  const requests = [];
  const server = http.createServer(async (req, res) => {
    if (req.url?.split('?')[0] !== '/v1/responses') { res.writeHead(404); res.end(); return; }
    assert.equal(req.headers.authorization, undefined, 'No credential may reach the fixture');
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
    const output = {id:'fixture-message',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'OFFLINE_SCHEMA_ONLY',annotations:[]}]};
    res.writeHead(200, {'Content-Type':'text/event-stream'});
    for (const [event, data] of [
      ['response.created',{type:'response.created',response:{id:'fixture-response',status:'in_progress',output:[]}}],
      ['response.output_item.done',{type:'response.output_item.done',output_index:0,item:output}],
      ['response.completed',{type:'response.completed',response:{id:'fixture-response',status:'completed',output:[output],usage:{input_tokens:0,output_tokens:0,total_tokens:0}}}],
    ]) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    res.end();
  });
  const inventories = [];
  try {
    await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    const versionHome = path.join(root, 'version'); await fs.mkdir(versionHome);
    const version = execFileSync(cli, ['--version'], {encoding:'utf8',env:{PATH:process.env.PATH,HOME:versionHome,CODEX_HOME:versionHome}}).trim();
    assert.equal(version, 'codex-cli 0.156.1');
    for (const mode of [null, 'disabled', 'cached', 'live']) {
      const home = path.join(root, mode ?? 'default'), cwd = path.join(home, 'workspace'), codexHome = path.join(home, 'codex');
      await fs.mkdir(cwd, {recursive:true}); await fs.mkdir(codexHome);
      // Override only the provider endpoint for this disposable, unauthenticated fixture.
      await fs.writeFile(path.join(codexHome, 'config.toml'), [
        'model="gpt-5.4"', 'model_provider="fixture"', ...(mode ? [`web_search=${JSON.stringify(mode)}`] : []),
        '[analytics]', 'enabled=false', '[feedback]', 'enabled=false', '[otel]', 'exporter="none"', 'trace_exporter="none"',
        '[features]', 'shell_snapshot=false', 'hooks=false', 'plugins=false', 'remote_plugin=false', 'enable_request_compression=false',
        '[model_providers.fixture]', 'name="Deterministic offline fixture"', `base_url="http://127.0.0.1:${port}/v1"`,
        'wire_api="responses"', 'requires_openai_auth=false', 'supports_websockets=false', '',
      ].join('\n'), {mode:0o600});
      const env = {PATH:process.env.PATH,HOME:home,CODEX_HOME:codexHome,XDG_CONFIG_HOME:path.join(home,'config'),XDG_DATA_HOME:path.join(home,'data'),OTEL_SDK_DISABLED:'true',NO_PROXY:'127.0.0.1,localhost',PAPERCLIP_RUNNER_DISABLE_COMMAND_EXECUTION:'1'};
      const args = createIsolatedCodexAppServerArgs(env, [], undefined);
      assert(args.includes('features.shell_tool=false'));
      assert(args.includes('permissions.paperclip-runner-workspace-only.network.enabled=false'));
      const child = spawn(cli, args, {cwd,env,stdio:['pipe','pipe','pipe']});
      const closed = new Promise(resolve=>child.once('close',resolve));
      let stderr = '', buffer = '', sequence = 0;
      const pending = new Map();
      child.stderr.on('data', b => { stderr += b; });
      const rpc = (method, params) => new Promise((resolve,reject) => {
        const id = ++sequence; pending.set(id, {resolve,reject}); child.stdin.write(JSON.stringify({id,method,params})+'\n');
      });
      child.stdout.on('data', b => {
        buffer += b;
        let index; while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0,index); buffer = buffer.slice(index+1);
          let message; try { message = JSON.parse(line); } catch { continue; }
          if (message.id !== undefined && pending.has(message.id)) {
            const p = pending.get(message.id); pending.delete(message.id);
            message.error ? p.reject(Error(JSON.stringify(message.error))) : p.resolve(message.result);
          }
        }
      });
      child.on('error', error => { for (const p of pending.values()) p.reject(error); pending.clear(); });
      child.on('exit', () => { for (const p of pending.values()) p.reject(Error(stderr)); pending.clear(); });
      const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
      const before = requests.length;
      try {
        await rpc('initialize',{clientInfo:{name:'offline-native-web-probe',version:'1'},capabilities:{experimentalApi:true}});
        child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
        const opened = await rpc('thread/start',{cwd,model:'gpt-5.4',approvalPolicy:'never',permissions:'paperclip-runner-workspace-only',runtimeWorkspaceRoots:[cwd],dynamicTools:[],developerInstructions:'Offline fixture. Return the supplied acknowledgement. No tool execution.'});
        await rpc('turn/start',{threadId:opened.thread.id,cwd,permissions:'paperclip-runner-workspace-only',runtimeWorkspaceRoots:[cwd],input:[{type:'text',text:'Acknowledge.',text_elements:[]}]});
        const deadline = Date.now()+15000;
        while (requests.length === before && Date.now()<deadline) await new Promise(r=>setTimeout(r,20));
        assert.equal(requests.length, before+1, stderr);
        const tools = requests.at(-1).tools ?? [];
        const web = tools.filter(t => ['web_search','web_search_preview'].includes(t.type));
        const commandTools = names(tools).filter(n=>commandNames.has(n.split('.').at(-1)));
        assert.deepEqual(commandTools, []);
        if (mode === 'disabled') assert.deepEqual(web, []);
        else {
          assert.equal(web.length, 1, JSON.stringify(tools));
          assert.equal(web[0].external_web_access, mode === 'live');
        }
        inventories.push({mode:mode ?? 'default',webTools:web,commandTools});
      } finally { clearTimeout(timer); child.kill('SIGTERM'); await closed; }
    }
    const receipt = {scope:'Pinned native CLI against unauthenticated loopback fixture; no inference, credentials, search execution or container access',limits:'Darwin/ARM64 qualification; manually assembled app-server requests, empty dynamicTools, custom fixture provider; not actual Rust runner, deployed Linux, real account capability or OS-enforced whole-process network isolation',platform:process.platform,arch:process.arch,version,binarySha256:createHash('sha256').update(await fs.readFile(cli)).digest('hex'),securityModuleSha256:createHash('sha256').update(await fs.readFile(securityModule)).digest('hex'),requests:requests.length,inventories};
    if (process.env.NATIVE_WEB_OUTPUT) await fs.writeFile(process.env.NATIVE_WEB_OUTPUT, JSON.stringify(receipt,null,2)+'\n');
    console.log(JSON.stringify(receipt));
  } finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); await fs.rm(root,{recursive:true,force:true}); }
});
