/** Disposable server, synthetic PostgreSQL only; no operational env or provider credentials. */
import fs from 'node:fs/promises';import {randomBytes} from 'node:crypto';import {pathToFileURL} from 'node:url';
const [dsn,server]=process.argv.slice(2);if(!dsn?.startsWith('postgres')||!server?.startsWith('/tmp/'))throw Error('synthetic_fixture_required');
const home=await fs.mkdtemp('/tmp/org-profile-bootstrap-'),key=home+'/key';await fs.writeFile(key,randomBytes(48).toString('hex'),{mode:0o600});
const config={$meta:{version:1,updatedAt:new Date().toISOString(),source:'configure'},logging:{mode:'file',logDir:home+'/logs'},database:{mode:'postgres',connectionString:dsn,backup:{enabled:false}},server:{deploymentMode:'local_trusted',exposure:'private',host:'127.0.0.1',port:43117,serveUi:false},telemetry:{enabled:false},updates:{checkEnabled:false},storage:{provider:'local_disk',localDisk:{baseDir:home+'/storage'}},secrets:{provider:'local_encrypted',strictMode:false,localEncrypted:{keyFilePath:key}}};
await fs.writeFile(home+'/config.json',JSON.stringify(config));Object.assign(process.env,{HOME:home,PAPERCLIP_HOME:home,PAPERCLIP_CONFIG:home+'/config.json',DATABASE_URL:dsn,HOST:'127.0.0.1',PORT:'43117',SERVE_UI:'false',PAPERCLIP_MIGRATION_AUTO_APPLY:'true',HEARTBEAT_SCHEDULER_ENABLED:'true',PAPERCLIP_TELEMETRY_DISABLED:'1',PAPERCLIP_UPDATE_CHECK_ENABLED:'false',PAPERCLIP_AGENT_JWT_SECRET:'synthetic-fixture-'+randomBytes(32).toString('hex')});
const {startServer}=await import(pathToFileURL(server+'/dist/index.js'));const runtime=await startServer();
process.send?.({ready:true,port:runtime.listenPort});
process.on('message',async message=>{if(message==='shutdown'){await runtime.shutdown();await fs.rm(home,{recursive:true,force:true});process.exit(0);}});
