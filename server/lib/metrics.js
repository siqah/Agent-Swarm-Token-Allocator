const metrics = {
  http_requests_total: 0,
  http_requests_active: 0,
  http_requests_duration_ms: [],
  http_errors_total: 0,
  http_requests_by_path: {},
  simulation_ticks_total: 0,
  tokens_used_total: 0,
  budget_blocked_total: 0,
  fallbacks_total: 0,
  upstream_errors_total: 0,
};

const MAX_DURATION_SAMPLES = 1000;

export function trackRequest(req, res, next) {
  metrics.http_requests_total++;
  metrics.http_requests_active++;
  const start = Date.now();

  res.on('finish', () => {
    metrics.http_requests_active--;
    const duration = Date.now() - start;

    if (metrics.http_requests_duration_ms.length >= MAX_DURATION_SAMPLES) {
      metrics.http_requests_duration_ms.shift();
    }
    metrics.http_requests_duration_ms.push(duration);

    const path = req.route?.path || req.path || 'unknown';
    metrics.http_requests_by_path[path] = (metrics.http_requests_by_path[path] || 0) + 1;

    if (res.statusCode >= 400) {
      metrics.http_errors_total++;
    }
  });

  next();
}

export function incrementTokens(count) {
  metrics.tokens_used_total += count;
}

export function incrementBudgetBlocked() {
  metrics.budget_blocked_total++;
}

export function incrementFallbacks() {
  metrics.fallbacks_total++;
}

export function incrementUpstreamErrors() {
  metrics.upstream_errors_total++;
}

export function incrementSimulationTicks() {
  metrics.simulation_ticks_total++;
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function p99(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.99) - 1;
  return sorted[Math.max(0, idx)];
}

export function getMetrics() {
  return {
    http: {
      total: metrics.http_requests_total,
      active: metrics.http_requests_active,
      errors: metrics.http_errors_total,
      avg_duration_ms: Math.round(avg(metrics.http_requests_duration_ms)),
      p99_duration_ms: Math.round(p99(metrics.http_requests_duration_ms)),
      by_path: { ...metrics.http_requests_by_path },
    },
    rates: {
      tokens_used: metrics.tokens_used_total,
      budget_blocked: metrics.budget_blocked_total,
      fallbacks: metrics.fallbacks_total,
      upstream_errors: metrics.upstream_errors_total,
    },
    simulation: {
      ticks: metrics.simulation_ticks_total,
    },
  };
}

export function metricsEndpoint(req, res) {
  const m = getMetrics();

  const lines = [
    '# HELP swarm_http_requests_total Total HTTP requests',
    '# TYPE swarm_http_requests_total counter',
    `swarm_http_requests_total ${m.http.total}`,
    `swarm_http_requests_active ${m.http.active}`,
    `swarm_http_errors_total ${m.http.errors}`,
    `swarm_http_duration_avg_ms ${m.http.avg_duration_ms}`,
    `swarm_http_duration_p99_ms ${m.http.p99_duration_ms}`,
    '',
    '# HELP swarm_tokens_used_total Total tokens consumed',
    '# TYPE swarm_tokens_used_total counter',
    `swarm_tokens_used_total ${m.rates.tokens_used}`,
    `swarm_budget_blocked_total ${m.rates.budget_blocked}`,
    `swarm_fallbacks_total ${m.rates.fallbacks}`,
    `swarm_upstream_errors_total ${m.rates.upstream_errors}`,
    '',
    '# HELP swarm_simulation_ticks_total Simulation loop iterations',
    '# TYPE swarm_simulation_ticks_total counter',
    `swarm_simulation_ticks_total ${m.simulation.ticks}`,
  ];

  res.type('text/plain').send(lines.join('\n') + '\n');
}
