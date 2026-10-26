import type { PluginContext, PluginPerformActionContext } from '@paperclipai/plugin-sdk';
import { createOrgStore } from './store.js';
import { createOrgService } from './service.js';
import { OrgError } from './contracts.js';
import { buildTrail, objectiveTrailAdapter, parseTaskFields } from './trail.js';
import { createIntakeStore } from '../intake/store.js';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { kind: string; message?: string } };

function forbidden(): ActionResult<never> {
  return { ok: false, error: { kind: 'forbidden' } };
}

function unavailable(): ActionResult<never> {
  return { ok: false, error: { kind: 'unavailable', message: 'Operation unavailable.' } };
}

export function registerOrgProfile(ctx: PluginContext): void {
  if (!ctx.actions) {
    return;
  }

  const store = createOrgStore(ctx.db);
  const service = createOrgService(
    store,
    () => new Date(),
    () => crypto.randomUUID()
  );

  async function withUser<T>(
    context: PluginPerformActionContext,
    fn: (userId: string, companyId: string) => Promise<T>
  ): Promise<ActionResult<T>> {
    try {
      if (context.actor.type !== 'user' || !context.actor.userId || !context.actor.companyId) {
        return forbidden();
      }
      const data = await fn(context.actor.userId, context.actor.companyId);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof OrgError) {
        return { ok: false, error: { kind: error.kind, ...(error.message ? { message: error.message } : {}) } };
      }
      return unavailable();
    }
  }

  ctx.actions.register('org.overview', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const overview = await service.overview(companyId, userId);
      if (!overview) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const issues = await ctx.issues.list({ companyId, limit: 50 });
      const initiatives = issues
        .filter(issue => !issue.parentId)
        .map(issue => {
          const openTasks = issues.filter(
            child => child.parentId === issue.id && child.status !== 'done' && child.status !== 'cancelled'
          ).length;
          return {
            issueId: issue.id,
            title: issue.title,
            openTasks,
          };
        });

      return { ...overview, initiatives };
    });
  });

  ctx.actions.register('org.setup', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { name: string; displayName: string };
      return service.setup(companyId, userId, input);
    });
  });

  ctx.actions.register('org.members', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      return service.members(companyId, userId);
    });
  });

  ctx.actions.register('org.member.add', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { userId: string; displayName: string; reason: string };
      await service.addMember(companyId, userId, input);
      return null;
    });
  });

  ctx.actions.register('org.member.remove', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { userId: string; reason: string };
      await service.removeMember(companyId, userId, input);
      return null;
    });
  });

  ctx.actions.register('org.moderator.set', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { userId: string; moderator: boolean; reason: string };
      await service.setModerator(companyId, userId, input);
      return null;
    });
  });

  ctx.actions.register('org.source.share', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      return service.share(companyId, userId, params);
    });
  });

  ctx.actions.register('org.sources', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { kind?: 'link' | 'file' | 'note' | 'objective'; hidden: boolean };
      return service.sources(companyId, userId, input);
    });
  });

  ctx.actions.register('org.source.hide', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { sourceKey: string; reason: string };
      await service.hide(companyId, userId, input);
      return null;
    });
  });

  ctx.actions.register('org.source.restore', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { sourceKey: string; reason: string };
      await service.restore(companyId, userId, input);
      return null;
    });
  });

  ctx.actions.register('org.source.pin', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { sourceKey: string };
      await service.pin(companyId, userId, input);
      return null;
    });
  });

  ctx.actions.register('org.task.trail', async (params, context) => {
    return withUser(context, async (userId, companyId) => {
      const input = params as { issueId: string };
      const issue = await ctx.issues.get(input.issueId, companyId);

      if (!issue) {
        throw new OrgError('invalid', 'Task not found.');
      }

      const role = await service.actorRole(companyId, userId);
      if (!role) {
        throw new OrgError('forbidden', 'Access denied.');
      }

      const trail = await buildTrail(
        issue,
        [objectiveTrailAdapter],
        {
          readMapping: (key: string) => createIntakeStore(ctx.db).read(key),
          isHidden: (sourceKey: string) => store.isHidden(companyId, sourceKey),
          viewerRole: role,
        }
      );

      const { doneWhen, nextStep } = parseTaskFields(issue.description ?? null);
      const assignee = issue.assigneeUserId ?? issue.assigneeAgentId ?? null;

      return {
        title: issue.title,
        status: issue.status,
        assignee,
        doneWhen,
        nextStep,
        trail,
      };
    });
  });
}
