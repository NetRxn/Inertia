import { Fragment, type ReactNode } from 'react';

/** **bold** and `code` inside a line, as React elements; everything else stays plain text. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(match[1] !== undefined ? <strong key={match.index}>{match[1]}</strong> : <code key={match.index}>{match[2]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;

/**
 * Renders an assistant reply's light Markdown (paragraphs, bullet and
 * numbered lists, short headings, bold and code) without ever parsing HTML.
 */
export function ChatText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.split('\n').filter((l) => l.trim()));
  return (
    <div className={className}>
      {blocks.filter((lines) => lines.length).map((lines, i) => {
        if (lines.every((l) => BULLET.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(BULLET, ''))}</li>)}</ul>;
        if (lines.every((l) => NUMBERED.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(NUMBERED, ''))}</li>)}</ol>;
        if (lines.length === 1 && HEADING.test(lines[0])) return <p key={i}><strong>{inline(lines[0].replace(HEADING, ''))}</strong></p>;
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(BULLET, '• '))}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
