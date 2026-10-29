import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeDomainReviewComposition} from '../transport/native/native-domain-review-composition.mjs';
const scope={companyId:'company',projectId:'project',issueId:'root',portfolioRootIssueId:'root',producerAgentId:'beta',reviewerAgentId:'alpha',producerPrincipalId:'p-beta',reviewerPrincipalId:'p-alpha',wholePacketReview:true};
test('only configured direct native children receive the mandatory domain completion gate',()=>{
 const c=createNativeDomainReviewComposition({required:true});
 c.install({scopes:[scope],acquireFence:async()=>{},authorize:async()=>true,readReviewContext:async()=>{},admitReview:async()=>{},readReviewReceipt:async()=>{}});
 const issue={companyId:'company',projectId:'project',id:'case-one',parentId:'root',status:'in_progress'};
 assert.equal(c.isBound({...issue,projectId:'other'}),false);
 assert.equal(c.isBound(issue),true);assert.throws(()=>c.assertCompletion({issue,toStatus:'done'}),/required_before_completion/);
 for(const changes of[{parentId:'other'},{companyId:'other'},{id:'root',parentId:null}])assert.equal(c.isBound({...issue,...changes}),false);
});

test('exact nonportfolio completion scope stays bound after project drift',()=>{
 const c=createNativeDomainReviewComposition();const exact={...scope};delete exact.portfolioRootIssueId;
 c.install({scopes:[exact],acquireFence:async()=>{},authorize:async()=>true,readReviewContext:async()=>{},admitReview:async()=>{},readReviewReceipt:async()=>{}});
 assert.equal(c.isBound({companyId:'company',projectId:'foreign',id:'root'}),true);
});
