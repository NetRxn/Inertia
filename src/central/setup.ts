import {randomUUID} from "node:crypto";
import type {PluginContext,JsonSchema} from "@paperclipai/plugin-sdk";
import {createRuntimeOwner} from "../bridge/ownership.js";
import type {BoundedProcessConfig} from "../bridge/duplex.js";
import {discoveryHash} from "../discovery/service.js";
import {publicDraftingSchema} from "../drafting/schema.js";
import {registerTrustedCentral,type CentralBinding,type CentralActor} from "./host.js";
import {createCentralBridge} from "./stdio.js";
const text={type:"string",minLength:1,maxLength:128};
export const centralConfigSchema:JsonSchema={type:"object",additionalProperties:false,properties:{
 enabled:{type:"boolean",default:false},projectId:text,applicantSlug:text,matchId:text,
 agents:{type:"array",minItems:1,maxItems:30,items:{type:"object",additionalProperties:false,properties:{issueId:text,agentId:text,principalId:text,role:{type:"string",enum:["central","reviewer"]}},required:["issueId","agentId","principalId","role"]}},
 process:(publicDraftingSchema as {properties:Record<string,unknown>}).properties.process!,
}};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
function exact(v:unknown,keys:string[]):Record<string,unknown>{if(!object(v)||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k)))throw Error("Invalid central configuration");return v;}
export async function registerConfiguredTrustedCentral(ctx:PluginContext):Promise<void>{
 const bindings:CentralBinding[]=[];
 for(const company of await ctx.companies.list({limit:1000})){
  let raw:unknown;try{raw=(await ctx.config.get(company.id)).trustedCentral;}catch(error){if(error instanceof Error&&error.message.includes("company context is required"))continue;throw error;}
  if(!object(raw)||raw.enabled!==true)continue;
  const c=exact(raw,["enabled","projectId","applicantSlug","matchId","agents","process"]);
  if(!Array.isArray(c.agents))throw Error("Invalid central agents");
  for(const a of c.agents)exact(a,["issueId","agentId","principalId","role"]);
  const process=exact(c.process,["executable","args","cwd","entrypoint","configurationPath","timeoutMs","maxOutputBytes","pins"]);
  if(!Array.isArray(process.pins))throw Error("Invalid central process pins");for(const pin of process.pins)exact(pin,["path","sha256"]);
  const fingerprint=discoveryHash(c);
  bindings.push({enabled:true,companyId:company.id,projectId:c.projectId as string,applicantSlug:c.applicantSlug as string,matchId:c.matchId as string,
   agents:structuredClone(c.agents) as CentralActor[],bridge:createCentralBridge(process as unknown as BoundedProcessConfig),
   authorize:async()=>discoveryHash((await ctx.config.get(company.id)).trustedCentral)===fingerprint});
 }
 registerTrustedCentral(ctx,bindings,createRuntimeOwner(ctx.db,{workerId:"trusted-central:"+process.pid+":"+randomUUID(),runId:"native-plugin-worker"}));
}
