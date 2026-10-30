/** Optional owning-host read projection. No agent, packet action or write port. */
import express from 'express';
import {and,eq,sql} from 'drizzle-orm';
import {authUsers,companies,companyMemberships} from '@paperclipai/db';
import {assertCompanyAccess} from '../../node_modules/@paperclipai/server/dist/routes/authz.js';
import {HttpError} from '../../node_modules/@paperclipai/server/dist/errors.js';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const catalogPath=/^\/companies\/[^/]+\/funding(?:\/|$)/;
const need=(ok,status,message)=>{if(!ok)throw new HttpError(status,message);};

/** Construct only in trusted bootstrap using the same native root database.
 * readOpportunities is a pinned, bounded, read-only source port; callbacks resolve
 * native current membership anew. It must not acquire sources or prepare work.
 * An existing Packet action mount can be composed without requiring its ports.
 */
export function createMemberFundingReadRouter(config={}) {
  if(config.enabled!==true)return Object.freeze({appOptions:Object.freeze({})});
  const {db,companyId}=config;
  need(db&&typeof db.transaction==='function'&&typeof db.rollback!=='function',500,'Trusted root database required');
  need(typeof companyId==='string'&&UUID.test(companyId)&&typeof config.readOpportunities==='function'&&
    typeof config.contracts?.parseRequest==='function'&&typeof config.contracts?.parsePage==='function',500,'Trusted bounded member read composition required');
  const read=config.readOpportunities.bind(config),parseRequest=config.contracts.parseRequest.bind(config.contracts),parsePage=config.contracts.parsePage.bind(config.contracts);
  const existing=config.existingMount;
  need(!existing||(existing.db===db&&typeof existing.beforeBodyParser==='function'&&typeof existing.router==='function'),500,'Existing member mount must use the same root database composition');
  const oldParser=existing?.beforeBodyParser.bind(existing),oldRouter=existing?.router;
  const beforeBodyParser=(req,res,next)=>{
    if(!catalogPath.test(req.path))return oldParser?oldParser(req,res,next):next();
    res.set('Cache-Control','no-store');
    if(req.get('transfer-encoding')||req.get('content-encoding')||req.get('content-length')&&req.get('content-length')!=='0')
      return res.status(400).json({error:'request_body_not_allowed'});
    if(req.method!=='GET')return res.set('Allow','GET').status(405).json({error:'read_only'});
    next();
  };
  const router=express.Router();
  router.all('/companies/:companyId/funding/:collection',async(req,res,next)=>{
    if(!['opportunities','applications'].includes(req.params.collection))return next();
    res.set('Cache-Control','no-store');
    if(req.method!=='GET')return res.set('Allow','GET').status(405).json({error:'read_only'});
    need(req.actor?.type&&req.actor.type!=='none',401,'Sign in again before continuing.');
    need(req.params.companyId===companyId,404,'Funding read unavailable');
    need(req.actor.type==='board'&&['session','board_key','cloud_tenant','mcp_oauth'].includes(req.actor.source)&&
      typeof req.actor.userId==='string'&&req.actor.userId&&!req.actor.agentId&&!req.actor.runId,403,'Authenticated native human required');
    assertCompanyAccess(req,companyId);
    const actorUserId=req.actor.userId,controller=new AbortController();
    async function nativeMembership() {
      assertCompanyAccess(req,companyId);
      need(req.actor.type==='board'&&req.actor.userId===actorUserId&&!req.actor.agentId&&!req.actor.runId,403,'Native member identity changed');
      await db.transaction(async tx=>{
        await tx.execute(sql`set transaction read only`);
        await tx.execute(sql`set local statement_timeout='2000ms'`);
        const [member]=await tx.select({id:authUsers.id}).from(companies)
          .innerJoin(companyMemberships,and(eq(companyMemberships.companyId,companies.id),eq(companyMemberships.principalType,'user'),eq(companyMemberships.principalId,actorUserId),eq(companyMemberships.status,'active')))
          .innerJoin(authUsers,eq(authUsers.id,companyMemberships.principalId))
          .where(and(eq(companies.id,companyId),eq(companies.status,'active'))).limit(1);
        need(member,403,'Current native membership required');
      });
      return{company_id:companyId,user_id:actorUserId};
    }
    async function current(signal) {
      need(!controller.signal.aborted&&!signal?.aborted,503,'Funding read unavailable');
      const context=await nativeMembership();
      need(!controller.signal.aborted&&!signal?.aborted,503,'Funding read unavailable');
      return context;
    }
    await current();
    let query;
    try {
      const keys=Object.keys(req.query);
      if(keys.some(k=>!['limit','cursor'].includes(k))||req.query.limit!==undefined&&(typeof req.query.limit!=='string'||!/^\d{1,3}$/.test(req.query.limit))||req.query.cursor!==undefined&&typeof req.query.cursor!=='string')throw Error();
      query=parseRequest({limit:req.query.limit===undefined?50:Number(req.query.limit),cursor:req.query.cursor??null});
    }catch {return res.status(400).json({error:'invalid_page'});}
    // No general current application-read binding is qualified by this slice.
    // Do not leak existence/counts or turn missing authority into an empty list.
    if(req.params.collection==='applications')return res.status(503).json({error:'application_reads_unavailable'});
    let timer,value;
    try {
      const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('read deadline'));},5000);});
      const raw=await Promise.race([read(query,{context:current}),deadline]);
      value=parsePage(raw,query);
    }catch {return res.status(503).json({error:'funding_read_unavailable'});}
    finally {clearTimeout(timer);controller.abort();}
    // No transaction spans the cross-domain read. This is a fresh authorization
    // read, not an atomic cross-database or cached permission assertion.
    await nativeMembership();
    res.json(value);
  });
  if(oldRouter)router.use(oldRouter);
  return Object.freeze({appOptions:Object.freeze({memberPacketActions:Object.freeze({db,beforeBodyParser,router})})});
}
