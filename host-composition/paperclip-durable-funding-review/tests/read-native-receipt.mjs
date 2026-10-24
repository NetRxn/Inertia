import {db,client} from './fixture.mjs';
import {createFundingReviewCapture} from '../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
try {console.log(JSON.stringify(await createFundingReviewCapture({registrations:[],rolePermissionKeys:{},readCompanyIds:[process.argv[3]]}).readAcceptance(db,process.argv[2])));}finally{await client.end();}
