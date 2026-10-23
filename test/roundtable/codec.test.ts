import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { prepare, type Source, type Prepared } from '../../src/roundtable/ingestion.js';
import * as codec from '../../src/roundtable/codec.js';
const vectors: Array<{ source: Source; prepared: Prepared }> = JSON.parse(readFileSync(new URL('../fixtures/roundtable-extractive-v1.json', import.meta.url), 'utf8'));
it('exports the shared extractive-v1 hash codec without changing historical digests', () => {
  expect(codec.publicationOutputHash).toBeTypeOf('function');
  expect(codec.publicationOperationId).toBeTypeOf('function');
});
it.each(vectors)('pins source bytes, Unicode/newlines/escaping, note property order and null owner: $source.text', async ({ source, prepared }) => {
  const result = await prepare(source, async () => prepared.notes);
  expect(result).toEqual(prepared);
  expect(codec.publicationOutputHash(prepared)).toBe(prepared.outputHash);
  expect(codec.publicationOperationId(prepared)).toBe(prepared.operationId);
});
