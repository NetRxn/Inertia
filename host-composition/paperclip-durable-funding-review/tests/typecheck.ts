import type {Db} from '@paperclipai/db';
import {createFundingReviewCapture, type FundingReviewBinding, type FundingReceiptRetention} from '../node_modules/@paperclipai/server/dist/services/funding-review-capture.js';
import {issueThreadInteractionService} from '../node_modules/@paperclipai/server/dist/services/issue-thread-interactions.js';
declare const db:Db;
declare const binding:FundingReviewBinding;
declare const retention:FundingReceiptRetention;
const capture=createFundingReviewCapture({registrations:[binding],rolePermissionKeys:{program:'funding.review.program'},retention});
issueThreadInteractionService(db,{captureItemVerdictsInTransaction:capture.captureInTransaction});
const receipt=capture.readAcceptance(db,'00000000-0000-4000-8000-000000000000');
const scan=capture.listAcceptances(db,{companyId:binding.companyId,limit:100});
void [receipt,scan];

import {buildHostServices} from '../node_modules/@paperclipai/server/dist/services/plugin-host-services.js';
import {createPluginEventBus} from '../node_modules/@paperclipai/server/dist/services/plugin-event-bus.js';
import {createApp} from '../node_modules/@paperclipai/server/dist/app.js';
declare const appOptions: Parameters<typeof createApp>[1];
buildHostServices(db, 'synthetic', 'netrxn.inertia', createPluginEventBus(), undefined,
  {httpLimits: {maxRequestBytes: 8192, maxResponseBytes: 1048576, timeoutMs: 15000}});
declare const transportCapability: NonNullable<Parameters<typeof createApp>[1]['fundingReviewTransport']>;
createApp(db, {...appOptions, fundingReviewTransport: transportCapability});
// @ts-expect-error A bare database reference cannot install trusted route/parser capabilities.
createApp(db, {...appOptions, fundingReviewTransport: {db}});
// @ts-expect-error HTTP limits are numeric trusted host options, not a plugin config flag.
buildHostServices(db, 'synthetic', 'netrxn.inertia', createPluginEventBus(), undefined, {httpLimits: true});

import {createMemberPacketCapture} from '../node_modules/@paperclipai/server/dist/services/member-packet-capture.js';
import {memberNativeCodec} from '../../../dist/src/grants/member-native.js';
declare const memberBinding:unknown;
const memberCapture=createMemberPacketCapture({enabled:true,bindings:[memberBinding],contracts:memberNativeCodec,
  authorizeInTransaction:async()=>({actorUserId:'synthetic-human',actorType:'human',authenticatedHuman:true,verifiedDaoMember:true,applicationActionAllowed:true,nativeActionAllowed:true,membershipVersion:'existing-row-update',applicationAccessVersion:'existing-issue-decision'} as const),
  retention:{async assertRetentionInTransaction(){}}});
createApp(db,{...appOptions,memberPacketReviewCapture:{db,handlesNativeReview:memberCapture.handlesNativeReview,captureInTransaction:memberCapture.captureInTransaction}});
// @ts-expect-error A caller's identity/allow booleans are not a trusted capture capability.
createApp(db,{...appOptions,memberPacketReviewCapture:{db,actorUserId:'claim',allowed:true}});
// @ts-expect-error Exact source selection is required; unrelated native cards must stay stock.
createApp(db,{...appOptions,memberPacketReviewCapture:{db,captureInTransaction:memberCapture.captureInTransaction}});

// @ts-expect-error Explicit enabling cannot omit authority, codec and retention.
createMemberPacketCapture({enabled:true});

declare const nativeActionCapability: NonNullable<Parameters<typeof createApp>[1]['memberPacketActions']>;
createApp(db,{...appOptions,memberPacketActions:nativeActionCapability});
// @ts-expect-error Parsed JSON/caller allow flags do not install trusted native routes.
createApp(db,{...appOptions,memberPacketActions:{db,actorUserId:'claim',allowed:true}});
// @ts-expect-error The bounded parser must be composed before the generic host parser.
createApp(db,{...appOptions,memberPacketActions:{db,router:nativeActionCapability.router}});
