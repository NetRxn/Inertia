/** Actual pinned native authentication plus exact current attempt verification. */
import {actorMiddleware} from '../node_modules/@paperclipai/server/dist/middleware/auth.js';
import {verifyLocalAgentJwt} from '../node_modules/@paperclipai/server/dist/agent-auth-jwt.js';
export function createNativeMemberAuthenticator({db,authority}={}) {
 if(!db||typeof authority?.authenticate!=='function')return async()=>({state:'unavailable'});
 const native=actorMiddleware(db,{deploymentMode:'authenticated',memberAttemptAuthority:authority});
 return async(req,res)=>{
  if(typeof req.header!=='function')return {state:'unavailable'}; // Must be the owning Express request.
  const error=await new Promise(resolve=>{
   let settled=false;const done=err=>{if(settled)return;settled=true;res.off('finish',finished);resolve(err??null);};
   const finished=()=>done(Error('Native authentication responded'));
   res.once('finish',finished);Promise.resolve(native(req,res,done)).catch(done);
  });
  if(error)return {state:'denied'};
  const actor=req.actor;
  if(actor?.type!=='agent'||actor.source!=='agent_jwt'||actor.keyScope?.kind!=='standard'||!actor.onBehalfOfUserId||!actor.onBehalfOfMemberships?.some(m=>m.companyId===actor.companyId&&m.status==='active'))return {state:'denied'};
  const header=req.header('authorization');const token=typeof header==='string'&&/^Bearer\s+/i.test(header)?header.replace(/^Bearer\s+/i,''):null;
  const claims=verifyLocalAgentJwt(token);
  if(claims?.inertia_member_attempt!==true||!claims?.jti||claims.sub!==actor.agentId||claims.company_id!==actor.companyId||claims.run_id!==actor.runId)return {state:'denied'};
  const current=await authority.authenticate({memberId:actor.onBehalfOfUserId,agentId:actor.agentId,companyId:actor.companyId,runId:actor.runId,authorityEpoch:claims.jti});
  return current?{state:'authenticated',actor:current}:{state:'denied'};
 };
}
