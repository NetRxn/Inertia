import { freezeReviewedPacket } from './engine.js';
import { evaluateGrantVote } from './governance.js';
import { fixtureVerifier, grantFixture, NOW, REQUEST } from './fixtures.js';
const source=grantFixture();
const packet=await freezeReviewedPacket(source,REQUEST,NOW);
const result=await evaluateGrantVote(source,packet,fixtureVerifier(),REQUEST,NOW);
console.log(JSON.stringify({mode:'offline synthetic fixture',flow:['existing engine review export','verified artifact hashes','frozen exact packet','injected fake governance verifier'],packetId:packet.packetId,version:packet.version,packetHash:packet.contentHash,result,next:'Configure the trusted engine exporter and real chain verifier. Actual submission remains a separate human handoff.'},null,2));
