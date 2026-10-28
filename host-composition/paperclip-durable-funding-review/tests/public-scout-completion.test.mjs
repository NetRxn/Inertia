import test from 'node:test';
import assert from 'node:assert/strict';
import {publicScoutProjection,publicScoutInstructions,publicScoutTurn} from '../transport/native/public-scout-projection.mjs';
const projection=publicScoutProjection({version:1,role:'scout',key:'public-funding-fixture',bindingHash:'a'.repeat(64),publicQueries:['official public funding policies']});
test('closed scout instructions distinguish capture completion from later agent diligence and human authorization',()=>{
 const instructions=publicScoutInstructions(projection);
 assert.match(instructions,/Coordinator owns delegation, follow-up and escalation/);
 assert.match(instructions,/native completion report/);
 assert.match(instructions,/captured_review_required means subsequent independent agent diligence/);
 assert.match(instructions,/complete the bounded scout task as done/);
 assert.match(instructions,/Do not request human review merely because eligibility, fit, publication or application readiness is unverified/);
 assert.match(instructions,/genuine owner-only decision or authorization/);
 assert.match(instructions,/No outreach, accounts, commitments, applications or submissions/);
});
test('public completion turn preserves only identifiers and never turns unknown diligence into permission',()=>{
 const text=publicScoutTurn(projection,JSON.stringify({task:{prompt:'PRIVATE'},completionContract:{revision:'r1',criteria:[{id:'objective',requirement:'PRIVATE'}]},interactionResponses:['PRIVATE']}));
 assert(!text.includes('PRIVATE'));
 const turn=JSON.parse(text);assert.deepEqual(turn.completion,{revision:'r1',criterionIds:['objective']});
});
