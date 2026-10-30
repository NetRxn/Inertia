import {createBoundedContextBridge, type BoundedProcessConfig} from "../bridge/duplex.js";
import {parseFundingOpportunityPage,parseFundingPageRequest,type FundingOpportunityPage,type FundingPageRequest} from "./contracts.js";

/** Native host callback only; never an apps/member ID or an agent run context. */
export interface NativeMemberReadContext { company_id: string; user_id: string }
export interface MemberFundingReadCallbacks { context(signal?:AbortSignal):Promise<NativeMemberReadContext> }
export interface MemberFundingReadBridge {
  readOpportunities(page:FundingPageRequest,callbacks:MemberFundingReadCallbacks):Promise<FundingOpportunityPage>;
}
/** Existing pinned bounded subprocess transport, with no review or write callback. */
export function createMemberFundingReadBridge(configuration:BoundedProcessConfig):MemberFundingReadBridge {
  if (configuration.timeoutMs>5000 || configuration.maxOutputBytes>512*1024)
    throw Error("Member funding read exceeds bounded budget");
  const bridge=createBoundedContextBridge<NativeMemberReadContext>(configuration,"dfw-member-funding-read-v1");
  return {async readOpportunities(page,callbacks) {
    const request=parseFundingPageRequest(page);
    let previous:NativeMemberReadContext|undefined;
    const result=await bridge.call("opportunities",{...request},{context:async signal=>{
      const current=await callbacks.context(signal);
      if (!current || Object.keys(current).length!==2 ||
          ![current.company_id,current.user_id].every(v=>typeof v==="string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v)) ||
          previous && (current.company_id!==previous.company_id || current.user_id!==previous.user_id))
        throw Error("Invalid current native member read identity");
      previous={company_id:current.company_id,user_id:current.user_id};return previous;
    }});
    return parseFundingOpportunityPage(result,request);
  }};
}
