import { MAX_UPLOAD_BYTES } from './files';

// Preserve a full-size file plus bounded text fields, filename and multipart
// framing. This cap applies to every byte, even without honest Content-Length.
const MAX_FORM_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const BLOCK_BYTES = 64 * 1024;
export class ShareBodyTooLargeError extends Error {}

/** Read at most the request budget before invoking the multipart parser. */
export async function readShareForm(request: Request): Promise<FormData> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    await request.body?.cancel().catch(() => {});
    throw new Error('Invalid Content-Length');
  }
  if (length !== null && Number(length) > MAX_FORM_BYTES) {
    await request.body?.cancel().catch(() => {});
    throw new ShareBodyTooLargeError();
  }

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let block: Uint8Array<ArrayBuffer> | undefined;
  let filled = 0;
  const reader = request.body?.getReader();
  let total = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_FORM_BYTES) throw new ShareBodyTooLargeError();
        // Retain at most 161 coalesced blocks, not one object per incoming
        // chunk. Tiny/empty chunks must not amplify memory below the byte cap.
        let offset = 0;
        while (offset < value.byteLength) {
          block ??= new Uint8Array(BLOCK_BYTES);
          const take = Math.min(BLOCK_BYTES - filled, value.byteLength - offset);
          block.set(value.subarray(offset, offset + take), filled);
          offset += take;
          filled += take;
          if (filled === BLOCK_BYTES) {
            chunks.push(block);
            block = undefined;
            filled = 0;
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  if (block && filled > 0) chunks.push(block.subarray(0, filled));

  return new Response(new Blob(chunks), {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
  }).formData();
}
