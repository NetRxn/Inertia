const encoder = new TextEncoder();

/** Fit host text to the client parser: no control characters, collapsed spaces, trimmed, at most maxBytes UTF-8. */
export function clean(value: unknown, maxBytes: number, fallback: string): string {
  const flat = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!flat) {
    return fallback;
  }
  if (encoder.encode(flat).length <= maxBytes) {
    return flat;
  }
  let out = '';
  let bytes = 0;
  const budget = maxBytes - encoder.encode('…').length;
  for (const char of flat) {
    const size = encoder.encode(char).length;
    if (bytes + size > budget) break;
    out += char;
    bytes += size;
  }
  return out.trimEnd() + '…';
}
