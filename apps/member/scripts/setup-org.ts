#!/usr/bin/env tsx
/**
 * Sets up an organization from the command line: the same steps as the
 * "Tell me about your organization" conversation, for seeding and rehearsals.
 *
 *   npx tsx scripts/setup-org.ts --name "FWTX DAO" --website https://fwtx.city \
 *     --description "..." --founder kyle@example.org [--github FWTX-DAO] [--file notes.md ...] [--no-profile]
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { backgroundAskJson } from '../src/assistant/model';
import { addSource, fileToText } from '../src/org/ingest';
import { ensureFounder } from '../src/org/members';
import { saveBasics } from '../src/org/organization';
import { regenerateProfile } from '../src/org/profile';
import { readWebsite } from '../src/org/website';
import { readGithub } from '../src/org/github';

function args(argv: string[]) {
  const out: { name?: string; website?: string; description?: string; founder?: string; files: string[]; github?: string; profile: boolean } = { files: [], profile: true };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--name') out.name = value;
    else if (flag === '--website') out.website = value;
    else if (flag === '--description') out.description = value;
    else if (flag === '--founder') out.founder = value;
    else if (flag === '--file') out.files.push(value);
    else if (flag === '--github') out.github = value;
    else if (flag === '--no-profile') { out.profile = false; continue; }
    else continue;
    i++;
  }
  return out;
}

async function main() {
  const opts = args(process.argv.slice(2));
  const db = getDb();
  await runMigrations(db);
  if (opts.founder) console.log(`Founder ${opts.founder}: ${(await ensureFounder(db, opts.founder)) ? 'added as first admin' : 'an admin already exists'}`);
  const org = await saveBasics(db, { name: opts.name, website: opts.website, description: opts.description });
  console.log(`Organization: ${org.name}`);
  if (opts.description) {
    const { duplicate } = await addSource(db, { kind: 'note', title: `About ${org.name}`, content: opts.description });
    console.log(`  description ${duplicate ? '(already saved)' : 'saved'}`);
  }
  if (opts.website) {
    const pages = await readWebsite(opts.website);
    for (const page of pages) {
      const { duplicate } = await addSource(db, { kind: 'website', title: page.title, origin: page.url, content: page.text });
      console.log(`  ${duplicate ? '=' : '+'} ${page.url}`);
    }
  }
  if (opts.github) {
    for (const page of await readGithub(opts.github)) {
      const { duplicate } = await addSource(db, { kind: 'document', title: page.title, origin: page.url, content: page.text });
      console.log(`  ${duplicate ? '=' : '+'} ${page.url}`);
    }
  }
  for (const file of opts.files) {
    const read = fileToText(path.basename(file), await readFile(file));
    const { duplicate } = await addSource(db, { kind: read.kind, title: read.title, origin: path.basename(file), content: read.text });
    console.log(`  ${duplicate ? '=' : '+'} ${file}`);
  }
  if (opts.profile) {
    console.log('Drafting the profile...');
    const profile = await regenerateProfile(db, backgroundAskJson());
    console.log(JSON.stringify({
      mission: profile.mission?.text,
      programs: profile.programs.map((l) => l.text),
      people: profile.people.map((l) => l.text),
      recent: profile.recent.map((l) => l.text),
      initiatives: profile.initiatives.map((i) => `${i.title} — ${i.summary} [${i.citations.map((c) => c.title).join('; ')}]`),
    }, null, 2));
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
