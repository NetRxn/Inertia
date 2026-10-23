import { mkdir, writeFile } from 'node:fs/promises';
import { runWorkflowDemo } from './workflow.js';
const receipt = await runWorkflowDemo();
await mkdir('runs', { recursive: true });
await writeFile('runs/workflow-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
console.log([
    'Inertia: one initiative, offline synthetic rehearsal',
    '1. Meeting captured and faithful source-line notes prepared: ' + receipt.meeting.revision,
    '2. Candidate action attached to fixture-seeded native work: ' + receipt.work.issueId,
    '3. Paired human acknowledgment passed through the real bridge; one native response, replay deduplicated.',
    '4. Exact reviewed packet v' + receipt.grant.version + ' evaluated against fixture governance: ' + receipt.grant.packetHash,
    '5. Website publication remains ' + receipt.meeting.publication + '. Live handoffs: ' + receipt.handoffs.map(x => x.id).join(', ') + '.',
    'Receipt manifest: runs/workflow-receipt.json',
].join('\n'));
