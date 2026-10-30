import type { SourceRef } from '../adapters/types';

/** Attribute values: ampersands, quotes and angle brackets can't end or forge a tag. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Body text: any opening or closing source tag is defused, so the block has exactly one of each. */
function neutralizeTags(text: string): string {
  return text.replace(/<(\/?source)/gi, '&lt;$1');
}

function openTag(ref: SourceRef): string {
  return `<source kind="${escapeAttribute(ref.kind)}" id="${escapeAttribute(ref.id)}" title="${escapeAttribute(ref.title)}">`;
}

const CLOSE_TAG = '</source>';

/**
 * Wraps text the assistant reads (meetings, chats, shares) in a delimited
 * block. The system prompt treats everything inside as data, never
 * instructions; neutralizing stray tags keeps text from closing the block early.
 */
export function wrapSourceData(ref: SourceRef, text: string): string {
  return `${openTag(ref)}\n${neutralizeTags(text)}\n${CLOSE_TAG}`;
}

/**
 * Like wrapSourceData, but the whole block (tags included) fits in maxLength.
 * Overlong text is cut and marked with an ellipsis; the closing tag always survives.
 */
export function wrapSourceDataCapped(ref: SourceRef, text: string, maxLength: number): string {
  const block = wrapSourceData(ref, text);
  if (block.length <= maxLength) return block;
  const head = `${openTag(ref)}\n`;
  const tail = `\n${CLOSE_TAG}`;
  const room = Math.max(0, maxLength - head.length - tail.length - 1);
  return `${head}${neutralizeTags(text).slice(0, room)}…${tail}`;
}
