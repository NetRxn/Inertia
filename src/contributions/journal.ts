import type { PluginDatabaseClient } from '@paperclipai/plugin-sdk';
import { BRIDGE_NAMESPACE } from '../store/postgres.js';
import type { Candidate, CandidateJournal } from './contracts.js';
/** Reuses the existing native plugin receipt storage, not a parallel task database. */
export function createContributionJournal(db: PluginDatabaseClient): CandidateJournal {
  if (db.namespace!==BRIDGE_NAMESPACE) throw Error('Unexpected plugin database namespace');
  const table=`"${BRIDGE_NAMESPACE}".bridge_runtime`, namespace='inertia:member-candidate:v1';
  const valid=(id:string)=>{if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid candidate identity');};
  return {
    async get(operationId,companyId) {
      valid(operationId);
      const rows=await db.query<{value:Candidate}>(`SELECT value FROM ${table} WHERE company_id=$1 AND relay=$2 AND state_key=$3`,[companyId,namespace,operationId]);
      return rows[0]?.value??null;
    },
    async put(candidate) {
      valid(candidate.operationId);
      await db.execute(`INSERT INTO ${table} (company_id,relay,state_key,value) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,[candidate.binding.companyId,namespace,candidate.operationId,JSON.stringify(candidate)]);
    },
  };
}
