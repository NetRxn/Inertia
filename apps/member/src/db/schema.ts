import { pgSchema, uuid, text, timestamp, check, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SourceRef } from '../adapters/types';

export const memberAppSchema = pgSchema('member_app');

export const members = memberAppSchema.table('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: text('external_id').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  // 'directory' rows follow the member directory; 'local' rows were added in the app and sync leaves them alone.
  origin: text('origin', { enum: ['directory', 'local'] }).notNull().default('directory'),
  // The member's user in the work engine, so a claim can assign the task to them.
  workUserId: text('work_user_id'),
  lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at'),
}, (table) => [
  check('email_lowercase', sql`${table.email} = LOWER(${table.email})`),
]);

export const loginTokens = memberAppSchema.table('loginTokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sessions = memberAppSchema.table('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const files = memberAppSchema.table('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  uploadedBy: uuid('uploaded_by').notNull().references(() => members.id),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
});

export const shares = memberAppSchema.table('shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  kind: text('kind', { enum: ['idea', 'resource', 'event', 'update'] }).notNull().default('idea'),
  description: text('description').notNull(),
  linkUrl: text('link_url'),
  linkTitle: text('link_title'),
  linkDescription: text('link_description'),
  linkImageUrl: text('link_image_url'),
  fileId: uuid('file_id').references(() => files.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const conversations = memberAppSchema.table('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messages = memberAppSchema.table('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources').$type<SourceRef[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const documents = memberAppSchema.table('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources').$type<SourceRef[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

import type { OrgProfile } from '../org/profile-types';

/** The one organization this app serves. Row id is always 1. */
export const organization = memberAppSchema.table('organization', {
  id: integer('id').primaryKey().default(1),
  name: text('name').notNull(),
  website: text('website'),
  description: text('description').notNull().default(''),
  profile: jsonb('profile').$type<OrgProfile>(),
  profileGeneratedAt: timestamp('profile_generated_at'),
  governanceEnabled: boolean('governance_enabled').notNull().default(false),
  setupCompletedAt: timestamp('setup_completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [check('organization_singleton', sql`${table.id} = 1`)]);

/** Everything the organization has told Inertia: uploads, the website, notes, chat exports. */
export const orgSources = memberAppSchema.table('org_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['website', 'meeting', 'document', 'note', 'chat-export', 'link'] }).notNull(),
  title: text('title').notNull(),
  // Where it came from: a URL or the uploaded file name.
  origin: text('origin'),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull().unique(),
  summary: text('summary'),
  addedBy: uuid('added_by').references(() => members.id),
  status: text('status', { enum: ['active', 'hidden'] }).notNull().default('active'),
  hiddenReason: text('hidden_reason'),
  hiddenBy: uuid('hidden_by').references(() => members.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Searchable pieces of a source, each with where it sits in the original. */
export const orgPassages = memberAppSchema.table('org_passages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull().references(() => orgSources.id, { onDelete: 'cascade' }),
  ordinal: integer('ordinal').notNull(),
  location: text('location').notNull(),
  text: text('text').notNull(),
}, (table) => [
  index('org_passages_search').using('gin', sql`to_tsvector('english', ${table.text})`),
]);

/** Who did what on which task, kept even when the work engine changes. */
export const workEvents = memberAppSchema.table('work_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').references(() => members.id),
  taskId: text('task_id').notNull(),
  kind: text('kind', { enum: ['suggested', 'claimed', 'released', 'answered', 'completed', 'created'] }).notNull(),
  detail: text('detail'),
  at: timestamp('at').notNull().defaultNow(),
});

/**
 * Integration settings an admin saved in the app. They overlay the matching
 * environment variables; the secret is encrypted (src/settings/secrets.ts)
 * and never leaves the server.
 */
export const integrationSettings = memberAppSchema.table('integration_settings', {
  id: text('id', { enum: ['model', 'telegram'] }).primaryKey(),
  config: jsonb('config').notNull().$type<Record<string, string>>(),
  secret: text('secret'),
  updatedBy: uuid('updated_by').references(() => members.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const schema = {
  integrationSettings,
  members,
  loginTokens,
  sessions,
  files,
  shares,
  conversations,
  messages,
  documents,
  organization,
  orgSources,
  orgPassages,
  workEvents,
};
