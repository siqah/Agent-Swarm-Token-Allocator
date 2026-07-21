import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── Agents ────────────────────────────────────
export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workflowId: integer('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  model: text('model').notNull().default('gpt-5.6-terra'),
  systemPrompt: text('system_prompt').default(''),
  temperature: real('temperature').default(0.7),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ── Workflows ────────────────────────────────
export const workflows = sqliteTable('workflows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  graphJson: text('graph_json').notNull().default('{"nodes":[],"edges":[]}'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ── Runs (workflow executions) ───────────────
export const runs = sqliteTable('runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workflowId: integer('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed
  totalTokens: integer('total_tokens').default(0),
  totalCost: real('total_cost').default(0),
  startedAt: text('started_at').default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

// ── Run logs (per-agent execution records) ───
export const runLogs = sqliteTable('run_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: integer('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  agentNodeId: text('agent_node_id').notNull(),
  agentName: text('agent_name').notNull(),
  model: text('model'),
  systemPrompt: text('system_prompt'),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  totalTokens: integer('total_tokens').default(0),
  cost: real('cost').default(0),
  responseText: text('response_text'),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed
  errorMessage: text('error_message'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

// ── Config (key-value for global settings) ───
export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ── Users ────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  department: text('department'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ── Swarm Keys ───────────────────────────────
export const swarmKeys = sqliteTable('swarm_keys', {
  key: text('key').primaryKey(),
  agentId: text('agent_id').notNull(),
  deptId: text('dept_id').notNull(),
  name: text('name').notNull(),
  budgetOverride: real('budget_override'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ── Provider Keys ────────────────────────────
export const providerKeys = sqliteTable('provider_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerName: text('provider_name').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
});

// ── Models (pricing registry) ────────────────
export const models = sqliteTable('models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull().default('openai'),
  tier: text('tier').notNull().default('balanced'),
  inputPrice: real('input_price').notNull().default(0),
  outputPrice: real('output_price').notNull().default(0),
  cachedPrice: real('cached_price').default(0),
  description: text('description').default(''),
});

// ── Fallback Chains ──────────────────────────
export const fallbackChains = sqliteTable('fallback_chains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  modelId: text('model_id').notNull(),
  fallbackModelId: text('fallback_model_id').notNull(),
  priority: integer('priority').notNull().default(0),
});

// ── Usage Tracking ───────────────────────────
export const usage = sqliteTable('usage', {
  agentId: text('agent_id').primaryKey(),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  totalTokens: integer('total_tokens').default(0),
});

// ── Audit Log ────────────────────────────────
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull(),
  detailsJson: text('details_json'),
  userId: text('user_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});
