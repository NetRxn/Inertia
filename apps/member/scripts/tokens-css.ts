/**
 * Renders design/tokens.json as CSS custom properties. Night is the default
 * theme; Day applies under a light colour-scheme preference, and
 * `data-theme="night" | "day"` on <html> overrides both.
 */

type Themed = { night: string; day: string };
type Named<V> = { name: string; value: V };
type TypeStyle = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  fontStyle?: string;
  letterSpacing?: string;
};

export type DesignTokens = {
  color: { tokens: Named<Themed>[] };
  type: { families: Record<string, string>; groups: { family: string; styles: TypeStyle[] }[] };
  spacing: { tokens: Named<string>[] };
  radius: { tokens: Named<string>[] };
  shadow: { tokens: Named<Themed>[] };
  blur: { tokens: Named<string>[] };
  opacity: { tokens: Named<string>[] };
};

const decl = (name: string, value: string, indent: string) => `${indent}--${name}: ${value};`;

function themed(tokens: DesignTokens, theme: keyof Themed, indent: string): string[] {
  return [
    `${indent}color-scheme: ${theme === 'night' ? 'dark' : 'light'};`,
    ...tokens.color.tokens.map((t) => decl(t.name, t.value[theme], indent)),
    ...tokens.shadow.tokens.map((t) => decl(t.name, t.value[theme], indent)),
  ];
}

function constant(tokens: DesignTokens, indent: string): string[] {
  const families = Object.entries(tokens.type.families).map(([name, stack]) => decl(`font-${name}`, stack, indent));
  // Each type style becomes a `font` shorthand (--text-*) plus its tracking (--tracking-*) when it has one.
  const styles = tokens.type.groups.flatMap((group) =>
    group.styles.flatMap((s) => {
      const font = [s.fontStyle, s.fontWeight, `${s.fontSize}/${s.lineHeight}`, `var(--font-${group.family})`]
        .filter(Boolean)
        .join(' ');
      const lines = [decl(`text-${s.name}`, font, indent)];
      if (s.letterSpacing) lines.push(decl(`tracking-${s.name}`, s.letterSpacing, indent));
      return lines;
    }),
  );
  const plain = [tokens.spacing, tokens.radius, tokens.blur, tokens.opacity].flatMap((g) =>
    g.tokens.map((t) => decl(t.name, t.value, indent)),
  );
  return [...families, ...styles, ...plain];
}

export function renderTokensCss(tokens: DesignTokens): string {
  return [
    '/* Generated from design/tokens.json by `npm run tokens`. Do not edit by hand. */',
    '',
    ':root {',
    ...themed(tokens, 'night', '  '),
    ...constant(tokens, '  '),
    '}',
    '',
    '@media (prefers-color-scheme: light) {',
    '  :root:not([data-theme="night"]) {',
    ...themed(tokens, 'day', '    '),
    '  }',
    '}',
    '',
    ':root[data-theme="day"] {',
    ...themed(tokens, 'day', '  '),
    '}',
    '',
  ].join('\n');
}
