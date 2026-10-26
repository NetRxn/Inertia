import { describe, it, expect } from 'vitest';
import { buildTrail, objectiveTrailAdapter, parseTaskFields, type TrailAdapter } from '../../src/org/trail.js';
import type { IntakeMapping } from '../../src/intake/contracts.js';
import type { OrgRole } from '../../src/org/contracts.js';

describe('buildTrail', () => {
  const mockDeps = {
    readMapping: async (_key: string) => null as IntakeMapping | null,
    isHidden: async (_sourceKey: string) => false,
    viewerRole: 'member' as OrgRole,
  };

  it('returns No recorded source for issue with no originKind', async () => {
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: null,
      originId: null,
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const result = await buildTrail(issue, [objectiveTrailAdapter], mockDeps);
    expect(result.summary).toBe('No recorded source');
    expect(result.steps).toEqual([]);
    expect(result.alsoUsed).toEqual([]);
  });

  it('returns No recorded source for unknown originKind', async () => {
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: 'plugin:other:x',
      originId: 'obj-123',
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const result = await buildTrail(issue, [objectiveTrailAdapter], mockDeps);
    expect(result.summary).toBe('No recorded source');
    expect(result.steps).toEqual([]);
    expect(result.alsoUsed).toEqual([]);
  });

  it('returns No recorded source when mapping is missing', async () => {
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'obj-123',
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const deps = { ...mockDeps, readMapping: async (_key: string) => null };
    const result = await buildTrail(issue, [objectiveTrailAdapter], deps);
    expect(result.summary).toBe('No recorded source');
    expect(result.steps).toEqual([]);
    expect(result.alsoUsed).toEqual([]);
  });

  it('builds 3-step trail for objective origin with mapping', async () => {
    const mapping: IntakeMapping = {
      key: 'obj-123',
      companyId: 'co-1',
      version: 1,
      snapshot: {
        sourceSystem: 'github',
        sourceId: 'issue-456',
        organizationId: 'org-1',
        revision: 'rev-1',
        sourceHash: 'hash-1',
        expectedPreviousHash: null,
        authorRef: 'user-1',
        audience: 'members',
        title: 'Implement feature X',
        text: 'Details here',
        withdrawn: false,
      },
      nativeIssueId: 'task-1',
      pending: false,
      marker: 'marker-1',
    };
    const deps = {
      ...mockDeps,
      readMapping: async (key: string) => (key === 'obj-123' ? mapping : null),
    };
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'obj-123',
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const result = await buildTrail(issue, [objectiveTrailAdapter], deps);
    expect(result.summary).toBe('from Implement feature X · uses 1 source');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]!.label).toBe('Source');
    expect(result.steps[0]!.detail).toBe('Implement feature X (github, members)');
    expect(result.steps[0]!.available).toBe(true);
    expect(result.steps[1]!.label).toBe('Intake');
    expect(result.steps[1]!.detail).toBe('Pulled into intake as "Implement feature X"');
    expect(result.steps[1]!.available).toBe(true);
    expect(result.steps[2]!.label).toBe('Task');
    expect(result.steps[2]!.detail).toBe('This task');
    expect(result.steps[2]!.available).toBe(true);
    expect(result.alsoUsed).toEqual([]);
  });

  it('uses Meeting source format for Roundtable mappings', async () => {
    const mapping: IntakeMapping = {
      key: 'obj-123',
      companyId: 'co-1',
      version: 1,
      snapshot: {
        sourceSystem: 'roundtable',
        sourceId: 'meeting-789',
        organizationId: 'org-1',
        revision: 'rev-1',
        sourceHash: 'hash-1',
        expectedPreviousHash: null,
        authorRef: 'configured-roundtable-integration',
        audience: 'members',
        title: 'Action item from standup',
        text: 'Details here',
        withdrawn: false,
      },
      nativeIssueId: 'task-1',
      pending: false,
      marker: 'marker-1',
    };
    const deps = {
      ...mockDeps,
      readMapping: async (key: string) => (key === 'obj-123' ? mapping : null),
    };
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'obj-123',
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const result = await buildTrail(issue, [objectiveTrailAdapter], deps);
    expect(result.steps[0]!.detail).toBe('Meeting source (meeting-789)');
  });

  it('hides step 1 from member when source is hidden', async () => {
    const mapping: IntakeMapping = {
      key: 'obj-123',
      companyId: 'co-1',
      version: 1,
      snapshot: {
        sourceSystem: 'github',
        sourceId: 'issue-456',
        organizationId: 'org-1',
        revision: 'rev-1',
        sourceHash: 'hash-1',
        expectedPreviousHash: null,
        authorRef: 'user-1',
        audience: 'members',
        title: 'Implement feature X',
        text: 'Details here',
        withdrawn: false,
      },
      nativeIssueId: 'task-1',
      pending: false,
      marker: 'marker-1',
    };
    const deps = {
      ...mockDeps,
      readMapping: async (key: string) => (key === 'obj-123' ? mapping : null),
      isHidden: async (sourceKey: string) => sourceKey === 'objective:obj-123',
      viewerRole: 'member' as OrgRole,
    };
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'obj-123',
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const result = await buildTrail(issue, [objectiveTrailAdapter], deps);
    expect(result.summary).toBe('from a source not available to you · uses 1 source');
    expect(result.steps[0]!.available).toBe(false);
    expect(result.steps[0]!.detail).toBe('Source not available to you');
  });

  it('shows hidden source to moderator with (hidden) suffix', async () => {
    const mapping: IntakeMapping = {
      key: 'obj-123',
      companyId: 'co-1',
      version: 1,
      snapshot: {
        sourceSystem: 'github',
        sourceId: 'issue-456',
        organizationId: 'org-1',
        revision: 'rev-1',
        sourceHash: 'hash-1',
        expectedPreviousHash: null,
        authorRef: 'user-1',
        audience: 'members',
        title: 'Implement feature X',
        text: 'Details here',
        withdrawn: false,
      },
      nativeIssueId: 'task-1',
      pending: false,
      marker: 'marker-1',
    };
    const deps = {
      ...mockDeps,
      readMapping: async (key: string) => (key === 'obj-123' ? mapping : null),
      isHidden: async (sourceKey: string) => sourceKey === 'objective:obj-123',
      viewerRole: 'moderator' as OrgRole,
    };
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'obj-123',
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const result = await buildTrail(issue, [objectiveTrailAdapter], deps);
    expect(result.steps[0]!.available).toBe(true);
    expect(result.steps[0]!.detail).toBe('Implement feature X (github, members) (hidden)');
  });

  it('hides step 1 from member when audience is restricted', async () => {
    const mapping: IntakeMapping = {
      key: 'obj-123',
      companyId: 'co-1',
      version: 1,
      snapshot: {
        sourceSystem: 'github',
        sourceId: 'issue-456',
        organizationId: 'org-1',
        revision: 'rev-1',
        sourceHash: 'hash-1',
        expectedPreviousHash: null,
        authorRef: 'user-1',
        audience: 'restricted',
        title: 'Implement feature X',
        text: 'Details here',
        withdrawn: false,
      },
      nativeIssueId: 'task-1',
      pending: false,
      marker: 'marker-1',
    };
    const deps = {
      ...mockDeps,
      readMapping: async (key: string) => (key === 'obj-123' ? mapping : null),
      viewerRole: 'member' as OrgRole,
    };
    const issue = {
      id: 'task-1',
      title: 'Fix bug',
      status: 'open',
      originKind: 'plugin:netrxn.inertia:objective',
      originId: 'obj-123',
      description: null,
      assigneeAgentId: null,
      assigneeUserId: null,
    };
    const result = await buildTrail(issue, [objectiveTrailAdapter], deps);
    expect(result.steps[0]!.available).toBe(false);
    expect(result.steps[0]!.detail).toBe('Source not available to you');
  });
});

describe('parseTaskFields', () => {
  it('extracts Done when and Next step lines', () => {
    const description = `Some context here.

Done when: All tests pass
Next step: Review the PR

More text`;
    const result = parseTaskFields(description);
    expect(result.doneWhen).toBe('All tests pass');
    expect(result.nextStep).toBe('Review the PR');
  });

  it('returns null for absent fields', () => {
    const result = parseTaskFields('Just some description');
    expect(result.doneWhen).toBe(null);
    expect(result.nextStep).toBe(null);
  });

  it('returns null for null description', () => {
    const result = parseTaskFields(null);
    expect(result.doneWhen).toBe(null);
    expect(result.nextStep).toBe(null);
  });

  it('handles only Done when present', () => {
    const result = parseTaskFields('Done when: Feature complete');
    expect(result.doneWhen).toBe('Feature complete');
    expect(result.nextStep).toBe(null);
  });

  it('handles only Next step present', () => {
    const result = parseTaskFields('Next step: Start implementation');
    expect(result.doneWhen).toBe(null);
    expect(result.nextStep).toBe('Start implementation');
  });
});
