import type { Db } from '../db/client';
import type { MemberDirectory, DirectoryMember } from '../adapters/types';
import { members, loginTokens } from '../db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export interface SyncResult {
  added: number;
  updated: number;
  deactivated: number;
}

/**
 * Syncs members from the directory into the database.
 * Keys on externalId, lowercases email, sets status: 'inactive' for directory members
 * with active: false and for app members missing from the directory.
 * Never deletes rows.
 */
export async function syncMembers(
  db: Db,
  directory: MemberDirectory,
  now: Date = new Date()
): Promise<SyncResult> {
  // Fetch directory members
  const directoryMembers = await directory.listMembers();

  // Create a map for fast lookup
  const directoryMap = new Map<string, DirectoryMember>();
  for (const dm of directoryMembers) {
    directoryMap.set(dm.externalId, dm);
  }

  let added = 0;
  let updated = 0;
  let deactivated = 0;

  // Execute all operations in a transaction
  await db.transaction(async (tx) => {
    // Use current, locked identity state, not a pre-transaction snapshot.
    // Stable lock ordering also serializes competing directory syncs.
    const existingMembers = await tx.select().from(members).orderBy(members.id).for('update');
    const existingMap = new Map(existingMembers.map(m => [m.externalId, m]));
    // Process directory members (add or update)
    for (const dm of directoryMembers) {
      const existing = existingMap.get(dm.externalId);
      const lowercaseEmail = dm.email.toLowerCase();
      const status = dm.active ? 'active' : 'inactive';

      if (!existing) {
        // Add new member
        await tx.insert(members).values({
          externalId: dm.externalId,
          email: lowercaseEmail,
          displayName: dm.displayName,
          status,
          lastSyncedAt: now,
        });
        added++;
        if (!dm.active) {
          deactivated++;
        }
      } else {
        // Check if anything changed
        const needsUpdate =
          existing.email !== lowercaseEmail ||
          existing.displayName !== dm.displayName ||
          existing.status !== status;

        if (needsUpdate) {
          if (existing.email !== lowercaseEmail || existing.status !== status) {
            // Keep issuance history for rate limiting, but revoke outstanding
            // links permanently (including a later change back/reactivation).
            await tx.update(loginTokens).set({ usedAt: now })
              .where(and(eq(loginTokens.memberId, existing.id), isNull(loginTokens.usedAt)));
          }
          await tx
            .update(members)
            .set({
              email: lowercaseEmail,
              displayName: dm.displayName,
              status,
              lastSyncedAt: now,
            })
            .where(eq(members.externalId, dm.externalId));
          updated++;
        }
      }
    }

    // Deactivate members missing from directory
    for (const existing of existingMembers) {
      if (!directoryMap.has(existing.externalId) && existing.status === 'active') {
        await tx.update(loginTokens).set({ usedAt: now })
          .where(and(eq(loginTokens.memberId, existing.id), isNull(loginTokens.usedAt)));
        await tx
          .update(members)
          .set({
            status: 'inactive',
            lastSyncedAt: now,
          })
          .where(eq(members.externalId, existing.externalId));
        deactivated++;
      }
    }
  });

  return { added, updated, deactivated };
}
