import {expect,it} from "vitest";
import {PLUGIN_RPC_ERROR_CODES} from "@paperclipai/plugin-sdk";
import {createPlugin} from "../../src/worker.js";
it("delegates config rebuild to native lifecycle with the pinned SDK restart signal",async()=>{
 const plugin=createPlugin();expect(plugin.definition.multiCompanyConfig).toBe(true);
 expect(plugin.definition.onConfigChanged).toBeTypeOf("function");
 await expect(plugin.definition.onConfigChanged!({generalEnrichment:{enabled:true}},{companyId:"company-a"})).rejects.toMatchObject({code:PLUGIN_RPC_ERROR_CODES.METHOD_NOT_IMPLEMENTED});
 await expect(plugin.definition.onConfigChanged!({enabled:false},{companyId:"company-b"})).rejects.toMatchObject({code:PLUGIN_RPC_ERROR_CODES.METHOD_NOT_IMPLEMENTED});
});
