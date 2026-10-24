import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../src/db/test-db';
import { createFixtureAdapters, defaultFixture, FIXTURE_NOW } from '../src/adapters/index';
import { syncMembers } from '../src/identity/sync';
import { eq } from 'drizzle-orm';
import { members } from '../src/db/schema';

describe('syncMembers', () => {
  it('adds new members with lowercase email', async () => {
    const db = await createTestDb();
    const data = defaultFixture(FIXTURE_NOW);
    const adapters = createFixtureAdapters(data);

    const result = await syncMembers(db, adapters.directory, FIXTURE_NOW);

    // Expect: { added: 12, updated: 0, deactivated: 1 }
    // The inactive fixture member (m-pat) counts as both added and deactivated
    expect(result).toEqual({ added: 12, updated: 0, deactivated: 1 });

    // Verify all members were added
    const allMembers = await db.select().from(members);
    expect(allMembers).toHaveLength(12);

    // Verify emails are lowercase
    for (const member of allMembers) {
      expect(member.email).toBe(member.email.toLowerCase());
    }

    // Verify inactive member has status 'inactive'
    const inactiveMember = allMembers.find(m => m.externalId === 'm-pat');
    expect(inactiveMember?.status).toBe('inactive');

    // Verify active members have status 'active'
    const activeMembers = allMembers.filter(m => m.externalId !== 'm-pat');
    for (const member of activeMembers) {
      expect(member.status).toBe('active');
    }
  });

  it('updates changed display name and email', async () => {
    const db = await createTestDb();
    const data = defaultFixture(FIXTURE_NOW);
    const adapters = createFixtureAdapters(data);

    // First sync
    await syncMembers(db, adapters.directory, FIXTURE_NOW);

    // Modify one member's data
    const modifiedData = defaultFixture(FIXTURE_NOW);
    const anaIndex = modifiedData.members.findIndex(m => m.externalId === 'm-ana');
    modifiedData.members[anaIndex] = {
      ...modifiedData.members[anaIndex],
      email: 'ANA.NEW@EXAMPLE.ORG', // Changed with uppercase
      displayName: 'Ana Rodriguez-Smith', // Changed
    };

    const modifiedAdapters = createFixtureAdapters(modifiedData);

    // Second sync
    const result = await syncMembers(db, modifiedAdapters.directory, FIXTURE_NOW);

    expect(result).toEqual({ added: 0, updated: 1, deactivated: 0 });

    // Verify the member was updated
    const updatedMember = await db.select().from(members).where(eq(members.externalId, 'm-ana'));
    expect(updatedMember[0].email).toBe('ana.new@example.org'); // Lowercase
    expect(updatedMember[0].displayName).toBe('Ana Rodriguez-Smith');
  });

  it('deactivates members missing from the directory and keeps their row', async () => {
    const db = await createTestDb();
    const data = defaultFixture(FIXTURE_NOW);
    const adapters = createFixtureAdapters(data);

    // First sync
    await syncMembers(db, adapters.directory, FIXTURE_NOW);

    // Remove one member from directory
    const modifiedData = defaultFixture(FIXTURE_NOW);
    modifiedData.members = modifiedData.members.filter(m => m.externalId !== 'm-rob');

    const modifiedAdapters = createFixtureAdapters(modifiedData);

    // Second sync
    const result = await syncMembers(db, modifiedAdapters.directory, FIXTURE_NOW);

    expect(result).toEqual({ added: 0, updated: 0, deactivated: 1 });

    // Verify the member row still exists but is inactive
    const deactivatedMember = await db.select().from(members).where(eq(members.externalId, 'm-rob'));
    expect(deactivatedMember).toHaveLength(1);
    expect(deactivatedMember[0].status).toBe('inactive');

    // Verify total count is still 12
    const allMembers = await db.select().from(members);
    expect(allMembers).toHaveLength(12);
  });

  it('reactivates a member who returns active', async () => {
    const db = await createTestDb();
    const data = defaultFixture(FIXTURE_NOW);
    const adapters = createFixtureAdapters(data);

    // First sync - m-pat is inactive
    await syncMembers(db, adapters.directory, FIXTURE_NOW);

    // Verify m-pat is inactive
    let patMember = await db.select().from(members).where(eq(members.externalId, 'm-pat'));
    expect(patMember[0].status).toBe('inactive');

    // Make m-pat active again
    const modifiedData = defaultFixture(FIXTURE_NOW);
    const patIndex = modifiedData.members.findIndex(m => m.externalId === 'm-pat');
    modifiedData.members[patIndex] = {
      ...modifiedData.members[patIndex],
      active: true,
    };

    const modifiedAdapters = createFixtureAdapters(modifiedData);

    // Second sync
    const result = await syncMembers(db, modifiedAdapters.directory, FIXTURE_NOW);

    expect(result).toEqual({ added: 0, updated: 1, deactivated: 0 });

    // Verify m-pat is now active
    patMember = await db.select().from(members).where(eq(members.externalId, 'm-pat'));
    expect(patMember[0].status).toBe('active');
  });

  it('is idempotent', async () => {
    const db = await createTestDb();
    const data = defaultFixture(FIXTURE_NOW);
    const adapters = createFixtureAdapters(data);

    // First sync
    await syncMembers(db, adapters.directory, FIXTURE_NOW);

    // Second sync with same data
    const result = await syncMembers(db, adapters.directory, FIXTURE_NOW);

    // Should return all zeros
    expect(result).toEqual({ added: 0, updated: 0, deactivated: 0 });
  });
});
