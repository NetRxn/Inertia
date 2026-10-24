import { expect, it, vi } from 'vitest';
import type { PluginContext } from '@paperclipai/plugin-sdk';
import { createNativeContributionReader, nativeTaskRevision } from '../../src/contributions/native.js';
import type { ContributionBinding } from '../../src/contributions/contracts.js';
const scope={companyId:'c',projectId:'p',issueId:'i',agentId:'a'};
function fixture(){
 const issue={id:'i',companyId:'c',projectId:'p',assigneeAgentId:'a',status:'in_progress',checkoutRunId:'r',executionRunId:'r',updatedAt:'2026-10-24T00:00:00Z',title:'secret company title',description:'never export raw company data'};
 const run={id:'r',issueId:'i',agentId:'a',status:'running',finishedAt:null};
 const ctx={issues:{get:vi.fn(async()=>issue),summaries:{getOrchestration:vi.fn(async()=>({issueId:'i',companyId:'c',runs:[run]}))}},agents:{get:vi.fn(async()=>({id:'a',companyId:'c',status:'idle'}))}};
 const reader=createNativeContributionReader(ctx as unknown as Pick<PluginContext,'issues'|'agents'>,scope);
 const b={...scope,runId:'r',checkoutRunId:'r'} as ContributionBinding;
 return {reader,ctx,issue,run,b};
}
it('uses pinned exact issue/agent/orchestration signatures, exports no raw content',async()=>{const f=fixture();const result=await f.reader(f.b);expect(result?.running).toBe(true);expect(JSON.stringify(result)).not.toMatch(/secret|description|title/);expect(f.ctx.issues.summaries.getOrchestration).toHaveBeenCalledWith({issueId:'i',companyId:'c',includeSubtree:false});});
it('denies guessed scope before privileged native reads',async()=>{const f=fixture();expect(await f.reader({...f.b,issueId:'guessed'})).toBeNull();expect(f.ctx.issues.get).not.toHaveBeenCalled();});
it.each(['checkoutRunId','executionRunId','assigneeAgentId'])('does not adopt changed %s',async(key)=>{const f=fixture();Object.assign(f.issue,{[key]:'other'});expect(await f.reader(f.b)).toBeNull();});
it('denies terminal or unrelated runs',async()=>{const f=fixture();f.run.issueId='other';expect(await f.reader(f.b)).toBeNull();f.run.issueId='i';f.run.status='succeeded';expect(await f.reader(f.b)).toBeNull();});
it('revision changes with content even if timestamp unchanged',()=>{const f=fixture();const issue=f.issue as unknown as Parameters<typeof nativeTaskRevision>[0];const initial=nativeTaskRevision(issue);issue.description='changed';expect(nativeTaskRevision(issue)).not.toBe(initial);});
it('projects only configured scope fields, not extra enrollment properties',async()=>{const f=fixture();const reader=createNativeContributionReader(f.ctx as unknown as Pick<PluginContext,'issues'|'agents'>,{...scope,input:'private curated input'} as typeof scope);expect((await reader(f.b))?.running).toBe(true);});
