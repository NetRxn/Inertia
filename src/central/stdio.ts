import {createBoundedContextBridge,type ContextBridge,type BoundedProcessConfig} from "../bridge/duplex.js";
export interface CentralContext {company_id:string;project_id:string;applicant_slug:string;match_id:string;principal_id:string;agent_id:string;issue_id:string;run_id:string}
export type CentralBridge=ContextBridge<CentralContext>;
export function createCentralBridge(config:BoundedProcessConfig):CentralBridge {
 return createBoundedContextBridge<CentralContext>(config,"dfw-trusted-central-v1");
}
