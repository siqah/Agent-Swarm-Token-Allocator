import { eq, desc, asc, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { getDb, getSqlite } from './index.js';
import {
  config, users, swarmKeys, providerKeys,
  models, fallbackChains, usage, auditLog,
  workflows, runs, runLogs, agents,
} from './schema.js';
import { encrypt, decrypt, isEncrypted } from '../lib/encrypt.js';
import { logger } from '../lib/logger.js';

// ── Config helpers ───────────────────────────

export function getConfig(key) {
  const db = getDb();
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value ?? null;
}

export function setConfig(key, value) {
  const db = getDb();
  db.insert(config)
    .values({ key, value: String(value) })
    .onConflictDoUpdate({ target: config.key, set: { value: String(value) } })
    .run();
}

export function getConfigJson(key) {
  const raw = getConfig(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export function setConfigJson(key, value) {
  setConfig(key, JSON.stringify(value));
}

// ── Full state (compatibility with old db.get()) ─
export function getFullState() {
  return {
    totalBudget: Number(getConfig('totalBudget') || 10000000),
    selectedModel: getConfig('selectedModel') || 'gpt-5.6-terra',
    thresholds: getConfigJson('thresholds') || { warning: 80, danger: 95 },
    departments: getConfigJson('departments') || [],
    simulationActive: getConfig('simulationActive') === 'true',
    usage: getAllUsage(),
    swarmKeys: getAllSwarmKeys(),
    providerKeys: getAllProviderKeys(),
  };
}

export function updateFullConfig(updates) {
  if (updates.totalBudget !== undefined) {
    if (typeof updates.totalBudget !== 'number' || updates.totalBudget < 0) {
      throw new Error('totalBudget must be a non-negative number.');
    }
    setConfig('totalBudget', updates.totalBudget);
  }
  if (updates.selectedModel !== undefined) {
    if (typeof updates.selectedModel !== 'string') {
      throw new Error('selectedModel must be a string.');
    }
    setConfig('selectedModel', updates.selectedModel);
  }
  if (updates.thresholds !== undefined) {
    setConfigJson('thresholds', updates.thresholds);
  }
  if (updates.departments !== undefined) {
    if (!Array.isArray(updates.departments)) {
      throw new Error('departments must be an array.');
    }
    setConfigJson('departments', updates.departments);
  }
  return getFullState();
}

// ── Usage ────────────────────────────────────

export function getAllUsage() {
  const db = getDb();
  const rows = db.select().from(usage).all();
  const result = {};
  for (const row of rows) {
    result[row.agentId] = {
      input: row.inputTokens,
      output: row.outputTokens,
      total: row.totalTokens,
    };
  }
  return result;
}

export function recordUsage(agentId, inputTk, outputTk) {
  const db = getDb();
  const existing = db.select().from(usage).where(eq(usage.agentId, agentId)).get();
  if (existing) {
    db.update(usage)
      .set({
        inputTokens: existing.inputTokens + inputTk,
        outputTokens: existing.outputTokens + outputTk,
        totalTokens: existing.totalTokens + inputTk + outputTk,
      })
      .where(eq(usage.agentId, agentId))
      .run();
  } else {
    db.insert(usage).values({
      agentId,
      inputTokens: inputTk,
      outputTokens: outputTk,
      totalTokens: inputTk + outputTk,
    }).run();
  }
}

export function resetUsage() {
  const db = getDb();
  db.update(usage).set({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }).run();
  return getAllUsage();
}

// ── Swarm Keys ───────────────────────────────

export function getAllSwarmKeys() {
  const db = getDb();
  const rows = db.select().from(swarmKeys).all();
  const result = {};
  for (const row of rows) {
    result[row.key] = {
      agentId: row.agentId,
      deptId: row.deptId,
      name: row.name,
      budgetOverride: row.budgetOverride,
    };
  }
  return result;
}

export function getAgentBySwarmKey(key) {
  const db = getDb();
  const row = db.select().from(swarmKeys).where(eq(swarmKeys.key, key)).get();
  if (!row) return null;
  // Attach department name from config
  const depts = getConfigJson('departments') || [];
  const dept = depts.find(d => d.id === row.deptId);
  return {
    agentId: row.agentId,
    deptId: row.deptId,
    name: row.name,
    deptName: dept?.name || row.deptId,
    budgetOverride: row.budgetOverride,
  };
}

export function createSwarmKey(agentId, deptId) {
  const db = getDb();
  const depts = getConfigJson('departments') || [];
  const dept = depts.find(d => d.id === deptId);
  const agent = dept?.agents?.find(a => a.id === agentId);
  if (!agent) return null;
  const key = `swarm-${crypto.randomUUID().replace(/-/g, '')}`;
  db.insert(swarmKeys).values({
    key, agentId, deptId, name: agent.name,
  }).run();
  return { key, agentId, deptId, name: agent.name };
}

export function revokeSwarmKey(key) {
  const db = getDb();
  const existing = db.select().from(swarmKeys).where(eq(swarmKeys.key, key)).get();
  if (!existing) return null;
  db.delete(swarmKeys).where(eq(swarmKeys.key, key)).run();
  return existing;
}

export function regenerateSingleSwarmKey(oldKey) {
  const db = getDb();
  const existing = db.select().from(swarmKeys).where(eq(swarmKeys.key, oldKey)).get();
  if (!existing) return null;
  const newKey = `swarm-${crypto.randomUUID().replace(/-/g, '')}`;
  db.delete(swarmKeys).where(eq(swarmKeys.key, oldKey)).run();
  db.insert(swarmKeys).values({ ...existing, key: newKey }).run();
  return { key: newKey, agentId: existing.agentId, deptId: existing.deptId, name: existing.name };
}

export function regenerateSwarmKeys() {
  const db = getDb();
  const rows = db.select().from(swarmKeys).all();
  db.delete(swarmKeys).run();
  const result = {};
  for (const row of rows) {
    const newKey = `swarm-${crypto.randomUUID().replace(/-/g, '')}`;
    db.insert(swarmKeys).values({ key: newKey, agentId: row.agentId, deptId: row.deptId, name: row.name }).run();
    result[newKey] = { agentId: row.agentId, deptId: row.deptId, name: row.name };
  }
  return result;
}

export function setKeyBudgetOverride(key, budget) {
  const db = getDb();
  const existing = db.select().from(swarmKeys).where(eq(swarmKeys.key, key)).get();
  if (!existing) return null;
  db.update(swarmKeys).set({ budgetOverride: budget }).where(eq(swarmKeys.key, key)).run();
  return { key, budgetOverride: budget };
}

export function removeKeyBudgetOverride(key) {
  return setKeyBudgetOverride(key, null);
}

export function ensureSwarmKeys() {
  const db = getDb();
  const depts = getConfigJson('departments') || [];
  for (const dept of depts) {
    for (const agent of dept.agents || []) {
      const existing = db.select().from(swarmKeys)
        .where(and(eq(swarmKeys.agentId, agent.id), eq(swarmKeys.deptId, dept.id)))
        .get();
      if (!existing) {
        const key = `swarm-${crypto.randomUUID().replace(/-/g, '')}`;
        db.insert(swarmKeys).values({
          key, agentId: agent.id, deptId: dept.id, name: agent.name,
        }).run();
      }
    }
  }
}

// ── Provider Keys ────────────────────────────

export function getAllProviderKeys() {
  const db = getDb();
  const rows = db.select().from(providerKeys).all();
  const result = {};
  for (const row of rows) {
    if (!result[row.providerName]) result[row.providerName] = [];
    result[row.providerName].push(row.encryptedKey);
  }
  return result;
}

export function getProviderKeysForProvider(providerName) {
  const db = getDb();
  const rows = db.select().from(providerKeys).where(eq(providerKeys.providerName, providerName)).all();
  return rows.map(r => r.encryptedKey);
}

export function setProviderKey(providerName, key) {
  const db = getDb();
  const encrypted = encrypt(key);
  db.insert(providerKeys).values({ providerName, encryptedKey: encrypted }).run();
  return { provider: providerName, keyCount: getProviderKeysForProvider(providerName).length };
}

export function removeProviderKey(providerName, key) {
  const db = getDb();
  const encrypted = encrypt(key);
  const rows = db.select().from(providerKeys)
    .where(eq(providerKeys.providerName, providerName)).all();
  const target = rows.find(r => {
    try { return decrypt(r.encryptedKey) === key; } catch { return r.encryptedKey === key; }
  });
  if (!target) return null;
  db.delete(providerKeys).where(eq(providerKeys.id, target.id)).run();
  return { provider: providerName, keyCount: getProviderKeysForProvider(providerName).length };
}

export function clearProviderKeys(providerName) {
  const db = getDb();
  const rows = db.select().from(providerKeys).where(eq(providerKeys.providerName, providerName)).all();
  if (rows.length === 0) return null;
  db.delete(providerKeys).where(eq(providerKeys.providerName, providerName)).run();
  return { provider: providerName, removed: rows.length };
}

// ── Users ────────────────────────────────────

export function findUserByUsername(username) {
  const db = getDb();
  return db.select().from(users).where(eq(users.username, username)).get() || null;
}

export function findUserById(id) {
  const db = getDb();
  return db.select().from(users).where(eq(users.id, id)).get() || null;
}

export function createUser(username, passwordHash, department) {
  const db = getDb();
  const existing = findUserByUsername(username);
  if (existing) return null;
  const id = crypto.randomUUID();
  db.insert(users).values({ id, username, passwordHash, department }).run();
  return { id, username, department };
}

export function updateUserPassword(userId, passwordHash) {
  const db = getDb();
  db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
}

// ── Models ───────────────────────────────────

export function getModels() {
  const db = getDb();
  return db.select().from(models).all();
}

export function getModel(id) {
  const db = getDb();
  return db.select().from(models).where(eq(models.id, id)).get() || null;
}

export function upsertModel(m) {
  const db = getDb();
  db.insert(models)
    .values({
      id: m.id, name: m.name, provider: m.provider, tier: m.tier,
      inputPrice: m.input ?? m.inputPrice ?? 0,
      outputPrice: m.output ?? m.outputPrice ?? 0,
      cachedPrice: m.cached ?? m.cachedPrice ?? 0,
      description: m.description || '',
    })
    .onConflictDoUpdate({
      target: models.id,
      set: {
        name: m.name, provider: m.provider, tier: m.tier,
        inputPrice: m.input ?? m.inputPrice ?? 0,
        outputPrice: m.output ?? m.outputPrice ?? 0,
        cachedPrice: m.cached ?? m.cachedPrice ?? 0,
        description: m.description || '',
      },
    })
    .run();
  return getModel(m.id);
}

export function deleteModel(id) {
  const db = getDb();
  const existing = getModel(id);
  if (!existing) return false;
  db.delete(models).where(eq(models.id, id)).run();
  db.delete(fallbackChains).where(eq(fallbackChains.modelId, id)).run();
  return true;
}

export function cleanupZeroPricedModels() {
  const db = getDb();
  const zeroPriced = db.select().from(models)
    .where(and(eq(models.inputPrice, 0), eq(models.outputPrice, 0))).all();
  let removed = 0;
  for (const m of zeroPriced) {
    db.delete(models).where(eq(models.id, m.id)).run();
    removed++;
  }
  return removed;
}

// ── Fallback Chains ──────────────────────────

export function getFallbackChain(modelId) {
  const db = getDb();
  const rows = db.select().from(fallbackChains)
    .where(eq(fallbackChains.modelId, modelId))
    .orderBy(asc(fallbackChains.priority))
    .all();
  return rows.map(r => r.fallbackModelId);
}

export function setFallbackChain(modelId, fallbacks) {
  const db = getDb();
  db.delete(fallbackChains).where(eq(fallbackChains.modelId, modelId)).run();
  fallbacks.forEach((fbId, idx) => {
    db.insert(fallbackChains).values({
      modelId,
      fallbackModelId: fbId,
      priority: idx,
    }).run();
  });
}

// ── Audit Log ────────────────────────────────

export function appendAuditLog(entry) {
  const db = getDb();
  const { action, userId, ...rest } = entry;
  db.insert(auditLog).values({
    action,
    detailsJson: JSON.stringify(rest),
    userId: userId || null,
  }).run();
}

export function getAuditLog(limit = 50, offset = 0) {
  const db = getDb();
  const rows = db.select().from(auditLog)
    .orderBy(desc(auditLog.id))
    .limit(limit)
    .offset(offset)
    .all();
  return {
    entries: rows.map(r => ({
      id: r.id,
      action: r.action,
      details: r.detailsJson ? JSON.parse(r.detailsJson) : {},
      userId: r.userId,
      createdAt: r.createdAt,
    })),
    total: rows.length,
  };
}

// ── Simulation ───────────────────────────────

export function setSimulationActive(active) {
  setConfig('simulationActive', String(active));
}

// ── Workflows ────────────────────────────────

export function createWorkflow(name, graphJson) {
  const db = getDb();
  const result = db.insert(workflows).values({
    name,
    graphJson: typeof graphJson === 'string' ? graphJson : JSON.stringify(graphJson),
  }).run();
  return { id: Number(result.lastInsertRowid), name, graphJson };
}

export function getWorkflow(id) {
  const db = getDb();
  return db.select().from(workflows).where(eq(workflows.id, id)).get() || null;
}

export function listWorkflows() {
  const db = getDb();
  return db.select().from(workflows).orderBy(desc(workflows.id)).all();
}

export function updateWorkflow(id, updates) {
  const db = getDb();
  const existing = getWorkflow(id);
  if (!existing) return null;
  const vals = {};
  if (updates.name) vals.name = updates.name;
  if (updates.graphJson) vals.graphJson = typeof updates.graphJson === 'string' ? updates.graphJson : JSON.stringify(updates.graphJson);
  vals.updatedAt = new Date().toISOString();
  db.update(workflows).set(vals).where(eq(workflows.id, id)).run();
  return getWorkflow(id);
}

export function deleteWorkflow(id) {
  const db = getDb();
  const existing = getWorkflow(id);
  if (!existing) return false;
  db.delete(workflows).where(eq(workflows.id, id)).run();
  return true;
}

// ── Agents (extracted from workflow graphs) ───

export function saveAgentsForWorkflow(workflowId, nodes) {
  const db = getDb();
  db.delete(agents).where(eq(agents.workflowId, workflowId)).run();
  if (!nodes || nodes.length === 0) return [];
  const inserted = [];
  for (const node of nodes) {
    const data = node.data || {};
    db.insert(agents).values({
      workflowId,
      name: data.name || node.id,
      model: data.model || 'gpt-5.6-terra',
      systemPrompt: data.systemPrompt || '',
      temperature: data.temperature != null ? data.temperature : 0.7,
    }).run();
    inserted.push({
      workflowId,
      nodeId: node.id,
      name: data.name || node.id,
      model: data.model || 'gpt-5.6-terra',
      systemPrompt: data.systemPrompt || '',
      temperature: data.temperature != null ? data.temperature : 0.7,
    });
  }
  return inserted;
}

export function getAgentsByWorkflowId(workflowId) {
  const db = getDb();
  return db.select().from(agents).where(eq(agents.workflowId, workflowId)).all();
}

// ── Runs ─────────────────────────────────────

export function createRun(workflowId) {
  const db = getDb();
  const result = db.insert(runs).values({
    workflowId,
    status: 'pending',
    startedAt: new Date().toISOString(),
  }).run();
  return { id: Number(result.lastInsertRowid), workflowId, status: 'pending' };
}

export function getRun(id) {
  const db = getDb();
  return db.select().from(runs).where(eq(runs.id, id)).get() || null;
}

export function listRuns(workflowId) {
  const db = getDb();
  let query = db.select().from(runs).orderBy(desc(runs.id));
  if (workflowId) {
    query = db.select().from(runs).where(eq(runs.workflowId, workflowId)).orderBy(desc(runs.id));
  }
  return query.all();
}

export function updateRun(id, updates) {
  const db = getDb();
  db.update(runs).set(updates).where(eq(runs.id, id)).run();
  return getRun(id);
}

// ── Run Logs ─────────────────────────────────

export function createRunLog(entry) {
  const db = getDb();
  const result = db.insert(runLogs).values({
    runId: entry.runId,
    agentNodeId: entry.agentNodeId,
    agentName: entry.agentName,
    model: entry.model || null,
    systemPrompt: entry.systemPrompt || null,
    status: 'pending',
    startedAt: new Date().toISOString(),
  }).run();
  return Number(result.lastInsertRowid);
}

export function updateRunLog(id, updates) {
  const db = getDb();
  db.update(runLogs).set(updates).where(eq(runLogs.id, id)).run();
}

export function getRunLogs(runId) {
  const db = getDb();
  return db.select().from(runLogs)
    .where(eq(runLogs.runId, runId))
    .orderBy(asc(runLogs.id))
    .all();
}

// ── Token Limit Computation ──────────────────

export function getTokenLimit(dept, agent) {
  const totalBudget = Number(getConfig('totalBudget') || 10000000);
  return totalBudget * (dept.allocation / 100) * (agent.allocation / 100);
}

// ── Compatibility wrapper ────────────────────
// This object mimics the old db.get() / db.method() API for minimal server changes

export const dbCompat = {
  get: getFullState,
  updateConfig: updateFullConfig,
  recordUsage,
  resetUsage,
  getAgentBySwarmKey,
  createSwarmKey,
  revokeSwarmKey,
  regenerateSingleSwarmKey,
  regenerateSwarmKeys,
  setKeyBudgetOverride,
  removeKeyBudgetOverride,
  ensureSwarmKeys,
  getAllProviderKeys,
  getProviderKeys: getProviderKeysForProvider,
  setProviderKey,
  removeProviderKey,
  clearProviderKeys,
  findUserByUsername,
  findUserById,
  createUser,
  updateUserPassword,
  getModels,
  getModel,
  upsertModel,
  deleteModel,
  cleanupZeroPricedModels,
  getFallbackChain,
  setFallbackChain,
  appendAuditLog,
  getAuditLog,
  setSimulationActive,
  getTokenLimit,
  isPostgres: false,
  pool: null,
};
