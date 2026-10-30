import type { AgentTask, Adapters, HumanTask, Initiative } from '../adapters/types';

export type LaneCounts = { open: number; inProgress: number; done: number };

export type InitiativeStatus = {
  initiative: Initiative;
  people: HumanTask[];
  agents: AgentTask[];
  peopleCounts: LaneCounts;
  agentCounts: LaneCounts;
};

export type WorkStatus = {
  recap: {
    peopleDoneThisWeek: number;
    agentsDoneThisWeek: number;
    waitingOnPeople: number;
    agentsWorking: number;
  };
  engine: { name: string; url: string | null } | null;
  initiatives: InitiativeStatus[];
};

const DAY = 24 * 60 * 60 * 1000;

function peopleCounts(tasks: HumanTask[]): LaneCounts {
  return {
    open: tasks.filter((t) => t.status === 'open').length,
    inProgress: tasks.filter((t) => t.status === 'claimed').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };
}

function agentCounts(tasks: AgentTask[]): LaneCounts {
  return {
    open: tasks.filter((t) => t.status === 'queued' || t.status === 'blocked').length,
    inProgress: tasks.filter((t) => t.status === 'running').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };
}

/**
 * One picture of the work, human and agent side by side: what finished this
 * week on each side, what is waiting on a person, and both lanes per initiative.
 */
export async function buildWorkStatus(adapters: Pick<Adapters, 'work'>, now: Date, orgInitiatives?: Initiative[]): Promise<WorkStatus> {
  const work = adapters.work;
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [initiatives, human, agents, completions, agentDone] = await Promise.all([
    orgInitiatives ?? work.listInitiatives(),
    work.listHumanTasks(),
    work.listAgentTasks ? work.listAgentTasks() : Promise.resolve([] as AgentTask[]),
    work.completionsBetween(weekAgo, now),
    work.agentCompletionsBetween ? work.agentCompletionsBetween(weekAgo, now) : Promise.resolve(0),
  ]);
  const visible = initiatives.filter((i) => i.status !== 'done');
  const known = new Set(visible.map((i) => i.id));
  const other: Initiative = { id: '', title: 'Not tied to an initiative', status: 'active' };
  const groups = [...visible, other].map((initiative) => {
    const inGroup = (id: string | null) => (initiative.id ? id === initiative.id : !id || !known.has(id));
    const people = human.filter((t) => inGroup(t.initiativeId));
    const agentWork = agents.filter((t) => inGroup(t.initiativeId));
    return { initiative, people, agents: agentWork, peopleCounts: peopleCounts(people), agentCounts: agentCounts(agentWork) };
  });
  return {
    recap: {
      peopleDoneThisWeek: completions.reduce((sum, c) => sum + c.count, 0),
      agentsDoneThisWeek: agentDone,
      waitingOnPeople: human.filter((t) => t.status === 'open').length,
      agentsWorking: agents.filter((t) => t.status === 'running').length,
    },
    engine: work.engine ?? null,
    initiatives: groups.filter((g) => g.initiative.id || g.people.length || g.agents.length),
  };
}

/** The recap as one friendly sentence. */
export function recapSentence(recap: WorkStatus['recap']): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const finished = `This week agents finished ${plural(recap.agentsDoneThisWeek, 'task', 'tasks')} and members finished ${recap.peopleDoneThisWeek}.`;
  const waiting = recap.waitingOnPeople
    ? ` ${plural(recap.waitingOnPeople, 'thing is', 'things are')} waiting on a person.`
    : ' Nothing is waiting on a person.';
  const working = recap.agentsWorking ? ` ${plural(recap.agentsWorking, 'agent is', 'agents are')} working now.` : '';
  return finished + waiting + working;
}
