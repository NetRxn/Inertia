import type { DiscoveryProcessConfig } from "../discovery/stdio.js";
import { createBoundedContextBridge } from "../bridge/duplex.js";
export interface DraftingProcessConfig extends DiscoveryProcessConfig { configurationPath: string }
export interface DraftingContext {
  company_id: string; applicant_slug: string; match_id: string;
  principal_id: string; run_id: string; role: "producer"|"reviewer";
}
export interface DraftingCallbacks {
  context(signal?: AbortSignal): Promise<DraftingContext>;
  review(request: Record<string,unknown>,signal?: AbortSignal): Promise<{state:"pending";request_id:string}>;
}
export interface PublicDraftingBridge {
  call(operation:"workspace"|"save"|"save_gap_progress"|"review"|"review_context",params:Record<string,unknown>,callbacks:DraftingCallbacks):Promise<unknown>;
}
/** Public operation and authority contract is unchanged; only bounded transport is shared. */
export function createPublicDraftingBridge(configuration:DraftingProcessConfig):PublicDraftingBridge {
  return createBoundedContextBridge<DraftingContext>(configuration,"dfw-public-drafting-v1");
}
