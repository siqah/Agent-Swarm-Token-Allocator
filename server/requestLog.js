const MAX_LOG_ENTRIES = parseInt(process.env.REQUEST_LOG_SIZE, 10) || 1000;
const log = [];

export function recordRequest(entry) {
  log.push({
    id: entry.id,
    timestamp: new Date().toISOString(),
    agentId: entry.agentId,
    agentName: entry.agentName,
    deptId: entry.deptId,
    deptName: entry.deptName,
    model: entry.model,
    provider: entry.provider,
    promptTokens: entry.promptTokens || 0,
    completionTokens: entry.completionTokens || 0,
    totalTokens: entry.totalTokens || 0,
    latencyMs: entry.latencyMs,
    statusCode: entry.statusCode,
    cached: !!entry.cached,
    cacheType: entry.cacheType || null,
    fallback: !!entry.fallback,
    fallbackFrom: entry.fallbackFrom || null,
    error: entry.error || null,
  });

  if (log.length > MAX_LOG_ENTRIES) {
    log.splice(0, log.length - MAX_LOG_ENTRIES);
  }
}

export function getLogs({ limit = 50, offset = 0, agentId, deptId } = {}) {
  let filtered = [...log];

  if (agentId) filtered = filtered.filter((e) => e.agentId === agentId);
  if (deptId) filtered = filtered.filter((e) => e.deptId === deptId);

  // Most recent first
  filtered.reverse();

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  return { entries: page, total, limit, offset };
}

export function clearLogs() {
  log.length = 0;
}
