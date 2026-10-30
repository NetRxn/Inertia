import {expect,it} from 'vitest';
import {registerConfiguredCaseWork} from '../../src/case-work/host.js';

const processConfig={executable:'/usr/bin/python3',args:['/entry','--config','/config'],entrypoint:'/entry',configurationPath:'/config',cwd:'/tmp',pins:[{path:'/entry',sha256:'a'.repeat(64)},{path:'/config',sha256:'b'.repeat(64)}],timeoutMs:30000,maxOutputBytes:4194304};
const researcher={agentId:'alpha',principalId:'alpha-principal'},producer={agentId:'beta',principalId:'beta-principal'};
function context(reviewer:unknown){
 const config={enabled:true,researchProjectId:'research',projectId:'cases',rootIssueId:'root',rootProjectId:'portfolio',applicantSlug:'applicant',researcher,producer,reviewer,policyRevision:'v1',process:processConfig,reviewProcess:processConfig};
 return {companies:{list:async()=>[{id:'company'}]},config:{get:async()=>({nativeCaseWork:config})},tools:{register:()=>{}},issues:{},db:{}} as any;
}
it('rejects Alpha as source or packet reviewer even when Beta differs',async()=>{
 await expect(registerConfiguredCaseWork(context(researcher))).rejects.toThrow(/Independent case reviewer/);
});
it('rejects shared researcher principal behind a different Charlie agent',async()=>{
 await expect(registerConfiguredCaseWork(context({agentId:'charlie',principalId:'alpha-principal'}))).rejects.toThrow(/Independent case reviewer/);
});
