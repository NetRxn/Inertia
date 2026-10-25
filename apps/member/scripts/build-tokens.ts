#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { renderTokensCss, type DesignTokens } from './tokens-css';

const root = path.resolve(__dirname, '..');
const tokens = JSON.parse(readFileSync(path.join(root, 'design/tokens.json'), 'utf8')) as DesignTokens;
const out = path.join(root, 'src/styles/tokens.css');

writeFileSync(out, renderTokensCss(tokens));
console.log(`Wrote ${path.relative(root, out)}`);
