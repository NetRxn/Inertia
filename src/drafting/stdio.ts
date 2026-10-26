import type { DiscoveryProcessConfig } from "../discovery/stdio.js";
import { createBoundedContextBridge } from "../bridge/duplex.js";
export interface DraftingProcessConfig extends DiscoveryProcessConfig { configurationPath: string }
export interface DraftingContext {
  company_id: string; applicant_slug: string; match_id: string;
  principal_id: string; run_id: string; role: "producer"|"reviewer";
}
export interface DraftingCallbacks {
  /** Absolute host operation deadline; absent retains the configured transport timeout. */
  operationDeadlineAt?: number;
  context(signal?: AbortSignal): Promise<DraftingContext>;
  review(request: Record<string,unknown>,signal?: AbortSignal): Promise<{state:"pending";request_id:string;kind?:"gap_plan"}>;
}
export interface PublicDraftingBridge {
  call(operation:"workspace"|"checkpoint"|"save"|"save_gap_progress"|"review"|"review_context"|"gap_review_context"|"review_gap",params:Record<string,unknown>,callbacks:DraftingCallbacks):Promise<unknown>;
}
/** Shared bounded transport; candidate acknowledgement shape remains unchanged. */
export function createPublicDraftingBridge(configuration:DraftingProcessConfig):PublicDraftingBridge {
  const bridge=createBoundedContextBridge<DraftingContext>(configuration,"dfw-public-drafting-v1");
  return {call:(operation,params,callbacks)=>bridge.call(operation,params,{
    ...(callbacks.operationDeadlineAt===undefined?{}:{operationDeadlineAt:callbacks.operationDeadlineAt}),
    context:callbacks.context,
    review:async(request,signal)=>{
      const gap=request.kind==="gap_plan";
      if(gap && (typeof request.request_id!=="string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(request.request_id)))
        throw Error("Invalid gap-plan callback UUID");
      const pending=await callbacks.review(request,signal);
      if(gap && pending.kind!=="gap_plan")throw Error("Invalid typed gap-plan acknowledgement");
      if(!gap && pending.kind!==undefined)throw Error("Invalid candidate acknowledgement kind");
      return pending;
    },
  })};
}
