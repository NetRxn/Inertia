import fs from 'node:fs/promises';
import {client} from './fixture.mjs';
try {await client.unsafe(await fs.readFile(new URL('./qualification-retention.sql',import.meta.url),'utf8'));} finally {await client.end();}
