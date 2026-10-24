import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.platform!=='linux'||process.arch!=='x64')throw Error('Qualified native PostgreSQL fixture requires Linux x64; requalify another platform explicitly.');
const bin=path.resolve(process.env.NATIVE_PG_BIN??path.join(root,'node_modules/@embedded-postgres/linux-x64/native/bin'));
const hashes={postgres:'c85fa9c977d9e641c2d22d93675a9b7097764b7df2c4c9ea021f5780522b2af2',pg_ctl:'24a1f166819e0924319ff3faf752ad2a1ac594e223e2f3b1a2038dc84a2969de',initdb:'7cba14094c5f505f492fd243c5eda04f0dc3be05f12b7bd278f150f1e03b721f'};
for(const [name,expected] of Object.entries(hashes)) {
 const actual=createHash('sha256').update(await fs.readFile(path.join(bin,name))).digest('hex');
 if(actual!==expected)throw Error(`Unqualified PostgreSQL binary fingerprint: ${name}. Use the locked @embedded-postgres/linux-x64 18.1.0-beta.16 package or requalify.`);
}
console.log(await fs.realpath(bin));
