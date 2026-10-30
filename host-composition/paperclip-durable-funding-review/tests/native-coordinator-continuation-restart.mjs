/** Synthetic fixture-only cold tool replay. No provider credentials or external network. */
import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
const input=JSON.parse(process.argv[2]),native='/opt/host/node_modules',server='/tmp/case-native-sql';
const {createDb}=await import(pathToFileURL(native+'/@paperclipai/db/dist/index.js'));
const {PaperclipRunnerToolAuthority}=await import(pathToFileURL(server+'/node_modules/@paperclipai/server/dist/services/native-runtime/paperclip-runner-tool-authority.js'));
const {heartbeatService,startTaskDrain,stopTaskDrain}=await import(pathToFileURL(server+'/node_modules/@paperclipai/server/dist/services/heartbeat.js'));
const db=createDb(input.connectionString),heartbeat=heartbeatService(db);startTaskDrain();let enqueues=0;
const authority=new PaperclipRunnerToolAuthority(db,{...input.binding,enqueueWakeup:async(...args)=>{enqueues++;return heartbeat.wakeup(...args);}});
const context=await authority.execute({tool:'get_task_context',callId:randomUUID(),arguments:{targetTaskId:input.targetId}});
const recovery=context.continuationRequests.items.find(value=>value.targetTaskId===input.targetId)?.recoveryArguments;
let result;
if(recovery)result=await authority.execute({tool:'continue_task',callId:randomUUID(),arguments:recovery});
else if(input.replayArguments)result=await authority.execute({tool:'continue_task',callId:randomUUID(),arguments:input.replayArguments});
else throw Error('expected saved discoverable recovery arguments');
const s=await import(pathToFileURL(native+'/@paperclipai/db/dist/schema/index.js')),{eq}=await import(pathToFileURL(native+'/drizzle-orm/index.js'));const [run]=await db.select().from(s.heartbeatRuns).where(eq(s.heartbeatRuns.id,result.runId));if(run.status!=='queued'||run.startedAt!==null)throw Error('synthetic cold successor must remain queued without provider admission');stopTaskDrain();console.log(JSON.stringify({result,enqueues,recoveredFromNativeContext:!!recovery,providerStarted:run.startedAt!==null,queuedStatus:run.status}));
process.exit(0);
