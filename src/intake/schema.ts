import { isAbsolute, normalize } from 'node:path';
import type { JsonSchema } from '@paperclipai/plugin-sdk';
import type { ObjectiveSubmission } from './contracts.js';
export interface ObjectiveSourceConfiguration {
  sourceSystem: string;
  sourceId: string;
  path: string;
  allowedAgentIds: string[];
  allowedAudiences: ObjectiveSubmission['audience'][];
}
export interface ObjectiveIntakeConfiguration {
  enabled: true;
  sourceMode: 'owner-file';
  companyId: string;
  organizationId: string;
  projectId: string;
  intakeAgentId: string;
  sources: ObjectiveSourceConfiguration[];
}
const identifier = { type: 'string', minLength: 1, maxLength: 128 };
const sourceSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    sourceSystem: identifier, sourceId: identifier,
    path: { type: 'string', minLength: 1, maxLength: 4096, description: 'Administrator-pinned absolute owner-only local JSON file; never an agent-supplied path.' },
    allowedAgentIds: { type: 'array', items: identifier, minItems: 1, maxItems: 32, uniqueItems: true },
    allowedAudiences: { type: 'array', items: { enum: ['public', 'members', 'restricted'] }, minItems: 1, maxItems: 3, uniqueItems: true },
  },
  required: ['sourceSystem', 'sourceId', 'path', 'allowedAgentIds', 'allowedAudiences'],
};
export const objectiveIntakeSchema: JsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    enabled: { type: 'boolean', default: false },
    sourceMode: { const: 'owner-file' },
    organizationId: identifier, projectId: identifier, intakeAgentId: identifier,
    sources: { type: 'array', items: sourceSchema, minItems: 1, maxItems: 100 },
  },
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && !!v && v.length <= 128 && !/[\x00-\x1f\x7f]/.test(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join(',') === keys.sort().join(',');
/** The host supplies company identity. Neither file content nor tool parameters grant access. */
export function parseObjectiveIntakeConfiguration(value: unknown, companyId: string): ObjectiveIntakeConfiguration | null {
  if (value === undefined || value === null) return null;
  if (!object(value) || (value.enabled !== undefined && typeof value.enabled !== 'boolean')) throw Error('Invalid objective intake configuration.');
  if (value.enabled !== true) return null;
  if (!exact(value, ['enabled', 'sourceMode', 'organizationId', 'projectId', 'intakeAgentId', 'sources']) ||
      value.sourceMode !== 'owner-file' || !id(companyId) || !id(value.organizationId) || !id(value.projectId) || !id(value.intakeAgentId) ||
      !Array.isArray(value.sources) || !value.sources.length || value.sources.length > 100)
    throw Error('Invalid objective intake configuration.');
  const seen = new Set<string>();
  for (const source of value.sources) {
    if (!object(source) || !exact(source, ['sourceSystem', 'sourceId', 'path', 'allowedAgentIds', 'allowedAudiences']) ||
        !id(source.sourceSystem) || !id(source.sourceId) || typeof source.path !== 'string' || !isAbsolute(source.path) ||
        normalize(source.path) !== source.path || source.path.length > 4096 || /[\x00-\x1f\x7f]/.test(source.path) ||
        !Array.isArray(source.allowedAgentIds) || !source.allowedAgentIds.length || source.allowedAgentIds.length > 32 ||
        source.allowedAgentIds.some(a => !id(a)) || new Set(source.allowedAgentIds).size !== source.allowedAgentIds.length ||
        !source.allowedAgentIds.includes(value.intakeAgentId) ||
        !Array.isArray(source.allowedAudiences) || !source.allowedAudiences.length || source.allowedAudiences.length > 3 ||
        source.allowedAudiences.some(a => !['public', 'members', 'restricted'].includes(a)) || new Set(source.allowedAudiences).size !== source.allowedAudiences.length)
      throw Error('Invalid objective source configuration.');
    const key = JSON.stringify([source.sourceSystem, source.sourceId]);
    if (seen.has(key)) throw Error('Duplicate objective source configuration.');
    seen.add(key);
  }
  return structuredClone({ ...value, companyId }) as unknown as ObjectiveIntakeConfiguration;
}
