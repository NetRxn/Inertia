/** Owning-host optional case routing; existing compositions retain every lifecycle/fence rule. */
export function createNativeCaseReviewRouter(base,createComposition){
 let runtime,composition;const select=issue=>runtime?.matches(issue)?composition:base;
 return Object.freeze({
  install:input=>base.install(input),
  installCaseWork(value){if(runtime)throw Error('native_case_review_already_initialized');if(typeof value?.matches!=='function')throw Error('native_case_review_configuration_invalid');const candidate=createComposition();candidate.install(value);runtime=value;composition=candidate;},
  assertReady(){base.assertReady();composition?.assertReady();},
  assertCasePreparation(issue,bindingHash){if(!runtime?.matches(issue)||!composition.isBound(issue)||runtime.bindingHash!==bindingHash)throw Error("native_case_preparation_review_unconfigured_or_changed");},
  isCaseBound:issue=>Boolean(runtime?.matches(issue)&&composition.isBound(issue)),
  isBound:issue=>select(issue).isBound(issue),reviewArtifactSchema:issue=>select(issue).reviewArtifactSchema(issue),preparationReviewEnabled:issue=>select(issue).preparationReviewEnabled(issue),preparationItemSchema:issue=>select(issue).preparationItemSchema(issue),
  recordPreparationReview:(input,artifact)=>select(input?.issue).recordPreparationReview(input,artifact),reviewContext:(input,selection)=>select(input?.issue).reviewContext(input,selection),admitReview:(input,artifact)=>select(input?.issue).admitReview(input,artifact),readReviewReceipt:(input,artifact)=>select(input?.issue).readReviewReceipt(input,artifact),assertCompletion:input=>select(input?.issue).assertCompletion(input),acquireResolution:input=>select(input?.issue).acquireResolution(input),
 });
}
