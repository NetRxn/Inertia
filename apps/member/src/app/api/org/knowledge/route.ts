import {getDb} from '../../../../db/client';
import {createOrganizationKnowledgeHandler} from '../../../../org/machine-reader';
/** Optional service-read authority only; no cookie, ingestion token or model call. */
export const POST=createOrganizationKnowledgeHandler({db:getDb,readToken:()=>process.env.MEMBER_APP_KNOWLEDGE_READ_TOKEN});
