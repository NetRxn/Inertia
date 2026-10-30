import type { JsonSchema } from "@paperclipai/plugin-sdk";
const text={type:"string",minLength:1,maxLength:128};
const actor={type:"object",properties:{issueId:text,agentId:text,principalId:text},required:["issueId","agentId","principalId"],additionalProperties:false};
export const publicDraftingSchema:JsonSchema={
  type:"object",additionalProperties:false,
  properties:{
    enabled:{type:"boolean",default:false},projectId:text,applicantSlug:text,matchId:text,producer:actor,reviewer:actor,
    portfolioRootIssueId:{type:"string",minLength:1,maxLength:128,description:"Protected direct-child portfolio root; producer/reviewer issue templates must equal this root and native attention is required."},
    nativeAttention:{type:"boolean",const:true,description:"Administrator opt-in to lifecycle-free producer tools. Native attention owns same-task independent review and continuation. Mutually exclusive with legacy case progression and dependency handoff; typed gap-plan review requires matching protected protocol; requires matching native role and trusted execution metadata."},
    nativeCaseProgression:{type:"boolean",default:false,description:"Administrator opt-in to immutable private case checkpoint receipts. Requires matching pinned domain protocol; does not schedule new runs."},
    nativeDependencyHandoff:{type:"boolean",default:false,description:"Experimental fixed-pair native dependency handoff. Requires nativeCaseProgression, the matching private run-freeze protocol and a preconfigured producer-blocked-by-reviewer edge. Live finalization/replay qualification remains required; not owner or next-case closure."},
    nativeGapPlanReview:{type:"boolean",default:false,description:"Optional seventh independent machine gap-plan reviewer tool. Requires native attention with matching pinned gap-plan protocol, or the existing nativeCaseProgression/nativeDependencyHandoff mode. Source support is not runtime admission or human authorization."},
    process:{type:"object",description:"Administrator-selected executable, entrypoint, single-company configurationPath and SHA-256 pins. Not model input.",additionalProperties:false,
      properties:{executable:{type:"string"},args:{type:"array",items:{type:"string"},maxItems:30},cwd:{type:"string"},entrypoint:{type:"string"},configurationPath:{type:"string"},timeoutMs:{type:"integer",minimum:100,maximum:120000},maxOutputBytes:{type:"integer",minimum:1024,maximum:4194304},pins:{type:"array",minItems:2,maxItems:256,items:{type:"object",properties:{path:{type:"string"},sha256:{type:"string",pattern:"^[a-f0-9]{64}$"}},required:["path","sha256"],additionalProperties:false}}},
      required:["executable","args","cwd","entrypoint","configurationPath","timeoutMs","maxOutputBytes","pins"]},
  },
};
