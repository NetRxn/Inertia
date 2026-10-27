import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { organization } from '../db/schema';
import type { OrgProfile, ProposedInitiative } from './profile-types';

export type Organization = typeof organization.$inferSelect;

export async function getOrganization(db: Db): Promise<Organization | null> {
  const [row] = await db.select().from(organization).where(eq(organization.id, 1));
  return row ?? null;
}

/** Creates or updates the organization's basics from the setup conversation. */
export async function saveBasics(db: Db, input: { name?: string; website?: string | null; description?: string }): Promise<Organization> {
  const existing = await getOrganization(db);
  const values = {
    ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) } : {}),
    ...(input.website !== undefined ? { website: input.website?.trim() || null } : {}),
    ...(input.description !== undefined ? { description: input.description.trim().slice(0, 4000) } : {}),
    updatedAt: new Date(),
  };
  if (existing) {
    const [row] = await db.update(organization).set(values).where(eq(organization.id, 1)).returning();
    return row;
  }
  const [row] = await db.insert(organization).values({ id: 1, name: 'Our organization', ...values }).returning();
  return row;
}

export async function saveProfile(db: Db, profile: OrgProfile, now = new Date()): Promise<void> {
  await db.update(organization).set({ profile, profileGeneratedAt: now, updatedAt: now }).where(eq(organization.id, 1));
}

export async function completeSetup(db: Db, now = new Date()): Promise<void> {
  await db.update(organization).set({ setupCompletedAt: now, updatedAt: now }).where(eq(organization.id, 1));
}

export async function setGovernance(db: Db, enabled: boolean): Promise<void> {
  await db.update(organization).set({ governanceEnabled: enabled, updatedAt: new Date() }).where(eq(organization.id, 1));
}

/** Changes one proposed initiative in place, e.g. after it is accepted in the work engine. */
export async function updateInitiative(db: Db, id: string, change: Partial<Pick<ProposedInitiative, 'status' | 'workId' | 'adopted' | 'title' | 'summary'>>): Promise<ProposedInitiative | null> {
  const org = await getOrganization(db);
  const profile = org?.profile;
  const found = profile?.initiatives.find((i) => i.id === id);
  if (!profile || !found) return null;
  const updated = { ...found, ...change };
  await db
    .update(organization)
    .set({ profile: { ...profile, initiatives: profile.initiatives.map((i) => (i.id === id ? updated : i)) }, updatedAt: new Date() })
    .where(eq(organization.id, 1));
  return updated;
}
