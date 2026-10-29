/**
 * Prints a one-time sign-in link for a member, from the server. Use it to get
 * the first admin in on a fresh install (the email becomes the founder when no
 * admin exists yet), or whenever someone needs a link and no admin is signed in.
 *
 *   npx tsx scripts/sign-in-link.ts kyle@example.org
 *
 * The link is printed here only; treat it like a password until it's used.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { members } from '../src/db/schema';
import { issueSignInLink } from '../src/identity/auth';
import { ensureFounder } from '../src/org/members';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npx tsx scripts/sign-in-link.ts <email>');
  const db = getDb();
  await runMigrations(db);
  if (await ensureFounder(db, email)) console.log(`${email} is the first admin.`);
  const [member] = await db.select({ id: members.id, status: members.status }).from(members).where(eq(members.email, email));
  if (!member || member.status !== 'active') throw new Error(`${email} isn't an active member. An admin can add them in Organization → Members.`);
  const issued = await issueSignInLink(db, member.id, { baseUrl: process.env.MEMBER_APP_BASE_URL || 'http://localhost:3000' });
  console.log(`Sign-in link (works once, until ${issued!.expiresAt.toISOString()}):\n${issued!.url}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
