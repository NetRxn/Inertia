import { randomUUID } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { createRuntimeOwner } from "../bridge/ownership.js";
import { discoveryHash } from "../discovery/service.js";
import { registerPublicDrafting,type PublicDraftingBinding,type DraftingActor } from "./host.js";
import { createPublicDraftingBridge,type DraftingProcessConfig } from "./stdio.js";
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==="object" && !Array.isArray(v);
function fields(v:unknown,allowed:string[],required=allowed):Record<string,unknown>{
  if(!object(v) || Object.keys(v).some(k=>!allowed.includes(k)) || required.some(k=>!Object.hasOwn(v,k))) throw Error("Invalid public drafting configuration");
  return v;
}
/** Installation declares tools; enabling the fixed company connection remains separate admission. */
export async function registerConfiguredPublicDrafting(ctx:PluginContext):Promise<void>{
  const bindings:PublicDraftingBinding[]=[];
  for(const company of await ctx.companies.list({limit:1000})) {
    let raw:unknown;
    try {raw=(await ctx.config.get(company.id)).publicDrafting;}
    catch(error) {if(error instanceof Error && error.message.includes("company context is required"))continue;throw error;}
    if(!object(raw) || raw.enabled!==true)continue;
    const required=["enabled","projectId","applicantSlug","matchId","producer","reviewer","process"];
    const c=fields(raw,[...required,"nativeCaseProgression"],required);
    if(c.nativeCaseProgression!==undefined && typeof c.nativeCaseProgression!=="boolean")throw Error("Invalid native case progression configuration");
    fields(c.producer,["issueId","agentId","principalId"]);fields(c.reviewer,["issueId","agentId","principalId"]);
    const process=fields(c.process,["executable","args","cwd","entrypoint","configurationPath","timeoutMs","maxOutputBytes","pins"]);
    if(!Array.isArray(process.pins))throw Error("Invalid public drafting process pins");
    for(const pin of process.pins)fields(pin,["path","sha256"]);
    const fingerprint=discoveryHash(c);
    bindings.push({enabled:true,companyId:company.id,projectId:c.projectId as string,applicantSlug:c.applicantSlug as string,matchId:c.matchId as string,
      nativeCaseProgression:c.nativeCaseProgression===true,
      producer:structuredClone(c.producer) as unknown as DraftingActor,reviewer:structuredClone(c.reviewer) as unknown as DraftingActor,
      bridge:createPublicDraftingBridge(process as unknown as DraftingProcessConfig),
      authorize:async()=>discoveryHash((await ctx.config.get(company.id)).publicDrafting)===fingerprint,
    });
  }
  const owner=createRuntimeOwner(ctx.db,{workerId:"public-drafting:"+process.pid+":"+randomUUID(),runId:"native-plugin-worker"});
  registerPublicDrafting(ctx,bindings,owner);
}
