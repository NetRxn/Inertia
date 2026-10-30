import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { renderTokensCss, type DesignTokens } from '../scripts/tokens-css';

const root = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const tokensCss = read('src/styles/tokens.css');
const defined = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

describe('design system', () => {
  it('tokens.css is up to date with design/tokens.json', () => {
    const tokens = JSON.parse(read('design/tokens.json')) as DesignTokens;
    expect(tokensCss).toBe(renderTokensCss(tokens));
  });

  it('defines every custom property bundle.css uses', () => {
    const used = new Set([...read('design/components/bundle.css').matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });

  it('defines every custom property the app styles use', () => {
    const files = readdirSync(path.join(root, 'src'), { recursive: true })
      .map((f) => path.join('src', String(f)))
      .filter((f) => f.endsWith('.css') && f !== path.join('src', 'styles', 'tokens.css'));
    // next/font sets these three on <html>; globals.css defines the rest of its own.
    const local = new Set(['--font-schibsted', '--font-newsreader', '--font-martian']);
    for (const file of files) {
      const css = read(file);
      for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) local.add(m[1]);
    }
    const missing = files.flatMap((file) =>
      [...read(file).matchAll(/var\((--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((name) => !defined.has(name) && !local.has(name))
        .map((name) => `${file}: ${name}`),
    );
    expect(missing).toEqual([]);
  });

  it('keeps the token fallback stacks behind the self-hosted fonts', () => {
    const tokens = JSON.parse(read('design/tokens.json')) as DesignTokens;
    const globals = read('src/app/globals.css');
    for (const [family, stack] of Object.entries(tokens.type.families)) {
      const fallbacks = stack.split(',').slice(1).join(',').trim();
      const wired = globals.match(new RegExp(`--font-${family}:\\s*var\\(--font-[\\w-]+\\),\\s*([^;]+);`));
      expect(wired?.[1], `--font-${family}`).toBe(fallbacks);
    }
  });

  it('serves the design system logos unchanged from public/logos', () => {
    const source = 'design/assets/Logos';
    const logos = readdirSync(path.join(root, source)).filter((f) => f.endsWith('.svg'));
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect(read(`public/logos/${logo}`), logo).toBe(read(`${source}/${logo}`));
    }
  });
});
