// Qualification only: real pinned services and SQL, synthetic native identities.
import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

export const publicRoot = process.env.QUALIFICATION_PUBLIC_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const nativeRoot = process.env.QUALIFICATION_NATIVE_ROOT ?? path.join(publicRoot,'host-composition/paperclip-durable-funding-review/node_modules');
export const loadNative = rel => import(pathToFileURL(path.join(nativeRoot, rel)).href);
const {PGlite} = await import(pathToFileURL(path.join(publicRoot, 'node_modules/@electric-sql/pglite/dist/index.js')).href);
const {pg_trgm} = await import(pathToFileURL(path.join(publicRoot, 'node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js')).href);
const {fuzzystrmatch} = await import(pathToFileURL(path.join(publicRoot, 'node_modules/@electric-sql/pglite/dist/contrib/fuzzystrmatch.js')).href);
const {drizzle} = await loadNative('drizzle-orm/pglite/index.js');
export const schema = await loadNative('@paperclipai/db/dist/schema/index.js');
export const {eq} = await loadNative('drizzle-orm/index.js');

export async function nativeDatabase() {
  const client = new PGlite({extensions:{pg_trgm, fuzzystrmatch}});
  const migrationRoot = path.join(nativeRoot, '@paperclipai/db/dist/migrations');
  const journal = JSON.parse(await fs.readFile(path.join(migrationRoot, 'meta/_journal.json'),'utf8'));
  for (const entry of journal.entries) {
    try { await client.exec(await fs.readFile(path.join(migrationRoot, `${entry.tag}.sql`),'utf8')); }
    catch (error) { throw new Error(`Native migration ${entry.tag} failed`,{cause:error}); }
  }
  return {client, db:drizzle(client,{schema}), migrationCount:journal.entries.length};
}

export async function nativeIdentityFixture(db) {
  const companyId=randomUUID(), projectId=randomUUID();
  const producer={issueId:randomUUID(),agentId:randomUUID(),runId:randomUUID(),principalId:'fixture-producer'};
  const reviewer={issueId:randomUUID(),agentId:randomUUID(),runId:randomUUID(),principalId:'fixture-reviewer'};
  await db.insert(schema.companies).values({id:companyId,name:'Drafting gateway qualification',issuePrefix:'QDG'});
  await db.insert(schema.projects).values({id:projectId,companyId,name:'Qualification fixture'});
  for(const [role,actor] of Object.entries({producer,reviewer})){
    await db.insert(schema.agents).values({id:actor.agentId,companyId,name:`Fixture ${role}`,role:'engineer',status:'running',adapterType:'process',adapterConfig:{}});
    await db.insert(schema.heartbeatRuns).values({id:actor.runId,companyId,agentId:actor.agentId,status:'running',contextSnapshot:{issueId:actor.issueId,projectId}});
    await db.insert(schema.issues).values({id:actor.issueId,companyId,projectId,title:`Fixture ${role} task`,status:'in_progress',assigneeAgentId:actor.agentId,executionRunId:actor.runId,checkoutRunId:actor.runId});
  }
  return {companyId,projectId,producer,reviewer};
}

// Explicit, isolated test authority. Identity creation alone grants no tool access.
export async function nativeDraftingGrants(db, identity, pluginKey='netrxn.inertia') {
  const roles={
    producer:['funding_drafting_workspace','save_funding_proposals','save_funding_gap_progress','funding_drafting_checkpoint'],
    reviewer:['funding_review_context','review_funding_candidate'],
  };
  for(const [role,tools] of Object.entries(roles)) {
    await db.insert(schema.principalPermissionGrants).values({
      companyId:identity.companyId,principalType:'agent',principalId:identity[role].agentId,
      permissionKey:'tools:use',scope:{allow:tools.map(tool=>`tool:${pluginKey}:${tool}`)},
    });
  }
}
