import { pgSchema, uuid, text, timestamp, check, jsonb, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SourceRef } from '../adapters/types';

export const memberAppSchema = pgSchema('member_app');

export const members = memberAppSchema.table('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: text('external_id').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
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

export const schema = {
  members,
  loginTokens,
  sessions,
  files,
  shares,
  conversations,
  messages,
  documents,
};
