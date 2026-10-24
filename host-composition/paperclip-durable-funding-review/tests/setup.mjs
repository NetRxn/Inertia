import {applyPendingMigrations} from '@paperclipai/db';
const url=process.env.NATIVE_CAPTURE_DATABASE_URL;
if(!url || !process.env.NATIVE_CAPTURE_FIXTURE_ROOT?.split('/').at(-1)?.startsWith('native-pg-qualification.'))throw Error('Use the disposable native PostgreSQL launcher');
const parsed=new URL(url);
if(parsed.hostname!=='127.0.0.1'||!parsed.port||parsed.username!=='fixture'||!parsed.password||parsed.pathname!=='/postgres')throw Error('Invalid launcher fixture database');
await applyPendingMigrations(url);
