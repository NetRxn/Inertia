import { OrgError } from './contracts.js';

export type ShareLinkInput = { kind: 'link'; title: string; url: string };
export type ShareNoteInput = { kind: 'note'; title: string; text: string };
export type ShareFileInput = { kind: 'file'; title: string; mediaType: string; bytes: Uint8Array };

export function validateShare(input: unknown): ShareLinkInput | ShareNoteInput | ShareFileInput {
  if (!input || typeof input !== 'object') {
    throw new OrgError('invalid', 'Invalid share input.');
  }

  const obj = input as Record<string, unknown>;

  if (!obj.title || typeof obj.title !== 'string') {
    throw new OrgError('invalid', 'Title is required.');
  }

  const title = obj.title.trim();
  if (title.length < 1 || title.length > 200 || /[\x00-\x1F\x7F]/.test(title)) {
    throw new OrgError('invalid', 'Title must be 1-200 characters without control characters.');
  }

  if (obj.kind === 'link') {
    if (typeof obj.url !== 'string') {
      throw new OrgError('invalid', 'URL is required for link shares.');
    }

    let parsed: URL;
    try {
      parsed = new URL(obj.url);
    } catch {
      throw new OrgError('invalid', 'Invalid URL format.');
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new OrgError('invalid', 'URL must use http: or https: protocol.');
    }

    return { kind: 'link', title, url: obj.url };
  }

  if (obj.kind === 'note') {
    if (typeof obj.text !== 'string') {
      throw new OrgError('invalid', 'Text is required for note shares.');
    }

    if (obj.text.length > 20000) {
      throw new OrgError('invalid', 'Note text must not exceed 20,000 characters.');
    }

    return { kind: 'note', title, text: obj.text };
  }

  if (obj.kind === 'file') {
    if (typeof obj.mediaType !== 'string') {
      throw new OrgError('invalid', 'Media type is required for file shares.');
    }

    if (!(obj.bytes instanceof Uint8Array)) {
      throw new OrgError('invalid', 'Bytes must be a Uint8Array for file shares.');
    }

    if (obj.bytes.length > 1048576) {
      throw new OrgError('invalid', 'File size must not exceed 1,048,576 bytes.');
    }

    return { kind: 'file', title, mediaType: obj.mediaType, bytes: obj.bytes };
  }

  throw new OrgError('invalid', 'Invalid share kind.');
}

export function significance(source: { citations: number; pins: number }): number {
  return source.citations * 2 + source.pins;
}
