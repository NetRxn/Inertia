import {sql} from 'drizzle-orm';
/** Test-only storage qualification, not an approved production retention policy. */
export const qualificationRetention={async assertRetentionInTransaction(tx){
 await tx.execute(sql`lock table activity_log in row exclusive mode`);
 const triggers=await tx.execute(sql`select tgname from pg_trigger where tgrelid='activity_log'::regclass and tgenabled='O' and tgname in ('qualification_immutable_funding_acceptance','qualification_no_truncate_funding_acceptance')`);
 const indexes=await tx.execute(sql`select indexname from pg_indexes where tablename='activity_log' and indexname='qualification_funding_acceptance_key'`);
 if(triggers.length!==2||indexes.length!==1)throw Error('Qualification-only receipt retention guards unavailable');
}};
