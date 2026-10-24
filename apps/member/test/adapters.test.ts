import { describe, it, expect } from 'vitest';
import { createFixtureAdapters, defaultFixture, FIXTURE_NOW, getAdapters } from '../src/adapters/index.js';

describe('Adapter fixtures', () => {
  it('claim succeeds once then reports already-claimed', async () => {
    const adapters = createFixtureAdapters();
    const tasks = await adapters.work.listHumanTasks();
    const openTask = tasks.find(t => t.status === 'open');

    expect(openTask).toBeDefined();
    const taskId = openTask!.id;

    // First claim succeeds
    const result1 = await adapters.work.claim(taskId, 'm-ana');
    expect(result1).toEqual({ ok: true });

    // Verify task is now claimed
    const tasksAfterClaim = await adapters.work.listHumanTasks();
    const claimedTask = tasksAfterClaim.find(t => t.id === taskId);
    expect(claimedTask?.status).toBe('claimed');
    expect(claimedTask?.claimedBy).toBe('m-ana');

    // Second claim by different member fails
    const result2 = await adapters.work.claim(taskId, 'm-rob');
    expect(result2).toEqual({ ok: false, reason: 'already-claimed' });
  });

  it('claim of unknown task is not-found', async () => {
    const adapters = createFixtureAdapters();
    const result = await adapters.work.claim('nonexistent-task-id', 'm-ana');
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('completionsBetween counts done tasks per member inside the window only', async () => {
    const data = defaultFixture();
    const adapters = createFixtureAdapters(data);

    // The test requires at least 3 done tasks this week
    // "This week" for FIXTURE_NOW (2026-10-24T15:00Z) is 2026-10-19T05:00Z to 2026-10-26T05:00Z
    const weekStart = new Date('2026-10-19T05:00:00Z');
    const weekEnd = new Date('2026-10-26T05:00:00Z');

    const completions = await adapters.work.completionsBetween(weekStart, weekEnd);

    // Should have at least one member with completions
    expect(completions.length).toBeGreaterThan(0);

    // Verify total is at least 3 (requirement says ≥3 done this week)
    const totalCompletions = completions.reduce((sum, c) => sum + c.count, 0);
    expect(totalCompletions).toBeGreaterThanOrEqual(3);

    // Verify counts only include tasks within window
    const allTasks = await adapters.work.listHumanTasks();
    const expectedCounts = new Map<string, number>();

    for (const task of allTasks) {
      if (task.status === 'done' && task.completedAt && task.completedBy) {
        const completedAt = new Date(task.completedAt);
        if (completedAt >= weekStart && completedAt < weekEnd) {
          expectedCounts.set(
            task.completedBy,
            (expectedCounts.get(task.completedBy) || 0) + 1
          );
        }
      }
    }

    // Verify returned counts match expected
    for (const { memberExternalId, count } of completions) {
      expect(count).toBe(expectedCounts.get(memberExternalId) || 0);
    }
  });

  it('meeting and chat search match case-insensitively on title and body', async () => {
    const adapters = createFixtureAdapters();

    // Search meetings
    const meetingResults = await adapters.meetings.search('GARDEN');
    expect(meetingResults.length).toBeGreaterThan(0);

    // Verify matches are case-insensitive
    const hasGardenInTitleOrContent = meetingResults.some(m =>
      m.title.toLowerCase().includes('garden') ||
      m.summary.toLowerCase().includes('garden') ||
      m.decisions.some(d => d.toLowerCase().includes('garden')) ||
      m.openQuestions.some(q => q.toLowerCase().includes('garden'))
    );
    expect(hasGardenInTitleOrContent).toBe(true);

    // Search chat
    const chatResults = await adapters.chat.search('coding');
    expect(chatResults.length).toBeGreaterThan(0);

    // Verify matches are case-insensitive
    const hasCodingInThreadOrMessages = chatResults.some(thread =>
      thread.title.toLowerCase().includes('coding') ||
      (thread.summary?.toLowerCase().includes('coding')) ||
      thread.messages.some(m => m.text.toLowerCase().includes('coding'))
    );
    expect(hasCodingInThreadOrMessages).toBe(true);
  });

  it('getAdapters rejects unknown adapter mode', () => {
    const originalEnv = process.env.MEMBER_APP_ADAPTERS;

    try {
      process.env.MEMBER_APP_ADAPTERS = 'unknown-mode';
      expect(() => getAdapters()).toThrow('Unknown MEMBER_APP_ADAPTERS value: unknown-mode');
    } finally {
      process.env.MEMBER_APP_ADAPTERS = originalEnv;
    }
  });
});
