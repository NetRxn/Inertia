import { prepare, publish, pendingDaoPublisher } from '../src/roundtable/ingestion.js';

// Synthetic transcript and deterministic extractor fixture; no LLM or live service.
const prepared = await prepare({
  meetingId:'synthetic-roundtable-1',sourceId:'synthetic-drive-file',revision:'fixture-v1',
  ready:true,kind:'transcript',audience:'members',
  text:'Facilitator: We need to prepare a venue budget.\nParticipant: No owner has been assigned yet.',
}, async () => ({
  notes:[{text:'Facilitator: We need to prepare a venue budget.',line:1}],
  decisions:[],actions:[{text:'Facilitator: We need to prepare a venue budget.',line:1,owner:null}],
}));
console.log(JSON.stringify({
  mode:'synthetic fixture; no LLM, no website writes',
  transcript:prepared.transcript,notes:prepared.notes,
  sourceHash:prepared.sourceHash,outputHash:prepared.outputHash,
  publication:await publish(prepared,pendingDaoPublisher),
  next:'Implement authenticated versioned DAO publisher and configure authorized Drive source.',
},null,2));
