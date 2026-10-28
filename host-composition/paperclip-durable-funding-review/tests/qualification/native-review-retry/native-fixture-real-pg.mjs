// Disposable qualification backend only. Existing identity fixture and all migrations unchanged.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
if(process.env.QUALIFY_DISPOSABLE!=='1'||process.getuid?.()!==1000)throw Error('Disposable uid1000 required');
const root=process.env.QUALIFICATION_PUBLIC_ROOT??'/qual/admission-source';
const original={nativeRoot:process.env.QUALIFICATION_NATIVE_ROOT??'/opt/host/node_modules'};
export const loadNative=rel=>import(pathToFileURL(path.join(original.nativeRoot,rel)).href);
export const schema=await loadNative('@paperclipai/db/dist/schema/index.js');
export const {eq}=await loadNative('drizzle-orm/index.js');
const {drizzle}=await loadNative('drizzle-orm/postgres-js/index.js');
const {default:postgres}=await loadNative('postgres/src/index.js');
const socket=process.env.PARITY_PG_SOCKET;
if(!socket||!/^\/tmp\/native-parent-parity-pg-[A-Za-z0-9]+\/socket$/.test(socket))throw Error('Unexpected synthetic PG socket');
const metadata=await fs.lstat(socket);
if(!metadata.isDirectory()||metadata.uid!==1000||(metadata.mode&0o077)!==0)throw Error('Synthetic PG socket must be private and owned');
const options={host:socket,port:55432,username:os.userInfo().username,ssl:false,max:4,connect_timeout:5,idle_timeout:1,prepare:false,onnotice:()=>{}};
export async function nativeDatabase(){
  const name='parity_'+randomUUID().replaceAll('-','');
  const admin=postgres({...options,database:'postgres',max:1});
  try{await admin.unsafe('CREATE DATABASE "'+name+'"');}finally{await admin.end({timeout:3});}
  const sql=postgres({...options,database:name});
  let closed=false;
  const client={async close(){
    if(closed)return;closed=true;
    await sql.end({timeout:3});
    const cleanup=postgres({...options,database:'postgres',max:1});
    try{await cleanup.unsafe('DROP DATABASE "'+name+'"');}finally{await cleanup.end({timeout:3});}
  }};
  try{
    const migrationRoot=path.join(original.nativeRoot,'@paperclipai/db/dist/migrations');
    const journal=JSON.parse(await fs.readFile(path.join(migrationRoot,'meta/_journal.json'),'utf8'));
    const receipt=createHash('sha256');
    for(const entry of journal.entries){
      const bytes=await fs.readFile(path.join(migrationRoot,entry.tag+'.sql'));
      receipt.update(entry.tag+'\0').update(bytes);
      try{await sql.unsafe(bytes.toString('utf8'));}catch(error){throw new Error('Native migration '+entry.tag+' failed',{cause:error});}
    }
    console.error('[synthetic-real-pg] '+JSON.stringify({migrationCount:journal.entries.length,migrationBytesSha256:receipt.digest('hex')}));
    return {client,db:drizzle(sql,{schema}),migrationCount:journal.entries.length};
  }catch(error){
    try{await client.close();}catch(cleanup){throw new AggregateError([error,cleanup],'Synthetic migration/setup and cleanup failed');}
    throw error;
  }
}
