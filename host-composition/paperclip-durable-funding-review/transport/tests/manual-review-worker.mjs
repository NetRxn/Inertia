/** Disposable fixture bootstrap. Never a production worker entrypoint. */
import fs from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {definePlugin, runWorker} from '@paperclipai/plugin-sdk';
import {registerReviewTransportJob} from '../native/host-composition.mjs';
const root = process.env.NATIVE_CAPTURE_FIXTURE_ROOT;
if (!root?.split('/').at(-1)?.startsWith('native-pg-qualification.')) throw Error('Use the disposable native fixture launcher');
const scope = JSON.parse(process.env.REVIEW_WORKER_SCOPE);
const plugin = definePlugin({setup(ctx) {
  registerReviewTransportJob(ctx, {enabled: true, scope,
    nativeUrl: 'https://native.example/api/funding-review-transport', fundingUrl: 'https://funding.example/funding-review-transport',
    nativeSecretRef: {type: 'secret_ref', secretId: 'native-existing'}, fundingSecretRef: {type: 'secret_ref', secretId: 'funding-existing'},
    lifecycle: {acknowledgeTerminal: async value => {
      const output = process.env.REVIEW_WORKER_ACK_FILE;
      if (!output?.startsWith(root + '/')) throw Error('Fixture acknowledgement path required');
      await delay(10);
      await fs.writeFile(output, JSON.stringify({acceptanceId: value.receipt.acceptanceId, state: value.outcome.state}) + '\n');
    }}});
}});
runWorker(plugin, import.meta.url);
