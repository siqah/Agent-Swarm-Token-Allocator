import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { db } from './database.js';
import { logger } from './logger.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Environment validation ─────────────────
const REQUIRED_ENV_VARS = [];
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  REQUIRED_ENV_VARS.push('DATABASE_URL');
}
if (REQUIRED_ENV_VARS.length > 0) {
  logger.error(`Missing required environment variables: ${REQUIRED_ENV_VARS.join(', ')}`);
  process.exit(1);
}

// ── Security Middleware ──────────────────────
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
}));

const CORS_ORIGIN = process.env.CORS_ORIGIN || (NODE_ENV === 'production' ? process.env.APP_URL : '*');
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

app.use(compression());
app.use(express.json({ limit: '64kb' }));

// ── Request ID tracing ──────────────────────
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req.id);
  next();
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { message: 'Too many requests. Try again in a moment.', type: 'rate_limit_error', code: 'rate_limited' }
  }
});

const controlPlaneLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/v1/', apiLimiter);

const CONTROL_PLANE_TOKEN = process.env.CONTROL_PLANE_TOKEN ||
  `ctrl-${Math.random().toString(36).substring(2, 10)}`;

function requireControlAuth(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.substring(7) : null;
  if (token !== CONTROL_PLANE_TOKEN) {
    return res.status(401).json({
      error: { message: 'Unauthorized. Provide a valid control plane token.', type: 'authentication_error', code: 'unauthorized' }
    });
  }
  next();
}

// ── Centralized error handler ───────────────
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'internal_error', type = 'api_error') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.type = type;
  }
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'internal_error';
  const type = err.type || 'api_error';
  const message = err.message || 'An unexpected error occurred';

  if (statusCode >= 500) {
    logger.error(`[${req.id}] ${err.stack || err.message}`);
  } else {
    logger.warn(`[${req.id}] ${err.message}`);
  }

  res.status(statusCode).json({
    error: { message, type, code, requestId: req.id }
  });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

const MODEL_PRICING = {
  'gpt-5.6-sol':   { input: 5.00, output: 30.00 },
  'gpt-5.6-terra': { input: 2.50, output: 15.00 },
  'gpt-5.6-luna':  { input: 1.00, output: 6.00 },
  'gpt-5.4-nano':  { input: 0.20, output: 1.25 },
};

const FALLBACK_CHAIN = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-nano'];

function estimateCost(modelId, inputTokens, outputTokens) {
  const p = MODEL_PRICING[modelId] || MODEL_PRICING['gpt-5.6-terra'];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// ── Background Simulator Loop ────────────────
let simulationInterval = null;

const MOCK_PROMPTS = [
  "Analyze this pull request for security vulnerabilities.",
  "Optimize this database query: SELECT * FROM users JOIN orders...",
  "Write a blog post about LLM budget allocation strategies.",
  "Audit the SEO metadata for our landing page.",
  "Evaluate this lead scoring profile: Enterprise, 500 seats.",
  "Draft an email outreach for high-intent trial signups.",
  "Analyze the token burn-down chart for anomaly patterns.",
  "Generate a summary report of the Q2 compute costs."
];

const MOCK_RESPONSES = [
  "I have analyzed the query. Adding an index on user_id will reduce latency by 45%.",
  "Security audit complete. Found no severe vulnerabilities. Suggest sanitizing inputs on line 42.",
  "Here is the blog post: Managing token spend across agent fleets is critical...",
  "SEO audit results: Add meta description, optimize H1 headers for search query intent.",
  "Lead score: 92/100. High purchase probability based on seat count and sector activity.",
  "Subject: Streamlining your AI agent costs. Hi, I noticed you signed up for the trial...",
  "Anomaly detected: Engineering agent token usage spiked by 250% at 2:00 AM.",
  "Q2 token spending report generated. Marketing has spent 82% of its allocation."
];

async function runSimulationTick() {
  const currentDb = db.get();
  const allAgents = [];

  currentDb.departments.forEach((dept) => {
    dept.agents.forEach((agent) => {
      allAgents.push({ id: agent.id, name: agent.name, deptId: dept.id, deptName: dept.name });
    });
  });

  if (allAgents.length === 0) return;

  const agent = allAgents[Math.floor(Math.random() * allAgents.length)];
  const prompt = MOCK_PROMPTS[Math.floor(Math.random() * MOCK_PROMPTS.length)];

  logger.info(`[Sim] Agent '${agent.name}' (${agent.deptName}) sending request...`);

  const result = await processChatCompletion({
    agentId: agent.id,
    deptId: agent.deptId,
    model: currentDb.selectedModel,
    messages: [{ role: 'user', content: prompt }]
  });

  if (result.error) {
    logger.warn(`[Sim Limit] Agent '${agent.name}' BLOCKED: ${result.error.message}`);
  } else {
    const fallbackNote = result._fallback ? ` (fallback from ${result._requested_model} to ${result.model})` : '';
    logger.info(`[Sim Success] Agent '${agent.name}' consumed ${result.usage.total_tokens} tokens on ${result.model}.${fallbackNote}`);
  }
}

function startInternalSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(runSimulationTick, 1000);
  db.setSimulationActive(true);
  logger.info('Background Swarm Simulation started.');
}

function stopInternalSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  db.setSimulationActive(false);
  logger.info('Background Swarm Simulation stopped.');
}

if (db.get().simulationActive) {
  startInternalSimulation();
}

// ── Core Chat Completion Logic ───────────────
async function processChatCompletion({ agentId, deptId, model, messages, _originalModel, _fallbackActive }) {
  const currentDb = db.get();

  const dept = currentDb.departments.find((d) => d.id === deptId);
  const agent = dept?.agents.find((a) => a.id === agentId);

  if (!dept || !agent) {
    return {
      statusCode: 400,
      error: {
        message: `Unknown agent '${agentId}' or department '${deptId}'.`,
        type: 'invalid_request_error',
        code: 'invalid_agent_info'
      }
    };
  }

  const originalModel = _originalModel || model;

  const agentTokenLimit = currentDb.totalBudget * (dept.allocation / 100) * (agent.allocation / 100);
  const currentUsage = currentDb.usage[agentId]?.total || 0;

  const budgetCost = estimateCost(model, agentTokenLimit, agentTokenLimit);
  const usageCost = estimateCost(model, currentUsage, currentUsage);

  if (usageCost >= budgetCost) {
    const idx = FALLBACK_CHAIN.indexOf(model);
    if (idx >= 0 && idx < FALLBACK_CHAIN.length - 1) {
      const fallbackModel = FALLBACK_CHAIN[idx + 1];
      const fallbackBudgetCost = estimateCost(fallbackModel, agentTokenLimit, agentTokenLimit);
      const fallbackUsageCost = estimateCost(fallbackModel, currentUsage, currentUsage);

      if (fallbackUsageCost < fallbackBudgetCost) {
        logger.info(`[Fallback] Agent '${agent.name}': ${model} over budget, falling back to ${fallbackModel}`);
        return processChatCompletion({
          agentId, deptId, model: fallbackModel, messages,
          _originalModel: originalModel, _fallbackActive: true
        });
      }
    }

    return {
      statusCode: 429,
      error: {
        message: `Budget Exceeded: Agent '${agent.name}' has used $${usageCost.toFixed(2)} of its $${budgetCost.toFixed(2)} budget.`,
        type: 'insufficient_budget',
        code: 'budget_exceeded'
      }
    };
  }

  if (OPENAI_API_KEY) {
    try {
      const requestBody = { model, messages };
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error(`[OpenAI Error] ${response.status}:`, data.error);
        return { statusCode: response.status, error: data.error };
      }

      if (data.usage) {
        db.recordUsage(agentId, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0);
        logger.info(`[OpenAI] Agent '${agent.name}' consumed ${data.usage.total_tokens} tokens on ${model}.`);
      }

      if (_fallbackActive) {
        data._fallback = true;
        data._requested_model = originalModel;
      }

      return { statusCode: 200, ...data };
    } catch (err) {
      logger.error('OpenAI API call failed:', err);
      return {
        statusCode: 502,
        error: { message: 'OpenAI API request failed. Check network connectivity.', type: 'api_error', code: 'upstream_error' }
      };
    }
  }

  // Mock Fallback
  const promptTokens = Math.floor(Math.random() * 800) + 200;
  const completionTokens = Math.floor(Math.random() * 1200) + 300;
  const totalTokens = promptTokens + completionTokens;

  db.recordUsage(agentId, promptTokens, completionTokens);

  const responseText = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

  const result = {
    statusCode: 200,
    id: `chatcmpl-${Math.random().toString(36).substring(2, 11)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: responseText },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens
    }
  };

  if (_fallbackActive) {
    result._fallback = true;
    result._requested_model = originalModel;
  }

  return result;
}


// ── Endpoints ────────────────────────────────

// 0. Health check (no auth, no rate limit)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    openai: OPENAI_API_KEY ? 'configured' : 'mock',
    postgres: db.isPostgres,
    simulation: db.get().simulationActive,
    version: '1.0.0',
    node: process.version,
    environment: NODE_ENV,
  });
});

// 0b. Initialization — returns control plane token + status (no auth)
app.get('/api/init', (req, res) => {
  const data = db.get();
  res.status(200).json({ token: CONTROL_PLANE_TOKEN, ...data });
});

// 1. LLM Chat completions — OpenAI SDK compatible
app.post('/v1/chat/completions', async (req, res) => {
  const authHeader = req.headers['authorization'];
  let swarmKey = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    swarmKey = authHeader.substring(7).trim();
  } else if (authHeader) {
    swarmKey = authHeader.trim();
  }

  if (!swarmKey) {
    return res.status(401).json({
      error: { message: 'Missing Virtual Swarm Key. Pass it as the apiKey in the OpenAI SDK client.', type: 'authentication_error', code: 'missing_api_key' }
    });
  }

  const agentInfo = db.getAgentBySwarmKey(swarmKey);
  if (!agentInfo) {
    return res.status(401).json({
      error: { message: 'Invalid Virtual Swarm Key. Generate a new key from the dashboard.', type: 'authentication_error', code: 'invalid_api_key' }
    });
  }

  const { model, messages } = req.body;

  if (!model || typeof model !== 'string') {
    return res.status(400).json({
      error: { message: 'Missing or invalid field: model.', type: 'invalid_request_error', code: 'missing_fields' }
    });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: { message: 'Missing or invalid field: messages (must be a non-empty array).', type: 'invalid_request_error', code: 'missing_fields' }
    });
  }

  const result = await processChatCompletion({
    agentId: agentInfo.agentId,
    deptId: agentInfo.deptId,
    model,
    messages
  });

  if (result.error) {
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  if (result._fallback) {
    res.set('X-Fallback-From', result._requested_model);
    res.set('X-Fallback-To', result.model);
  }

  return res.status(200).json(result);
});

// 2. Control Plane: Update config
app.post('/api/config', controlPlaneLimiter, requireControlAuth, (req, res) => {
  try {
    const updated = db.updateConfig(req.body);
    db.ensureSwarmKeys();
    res.status(200).json({ success: true, config: updated });
  } catch (err) {
    res.status(400).json({ error: { message: err.message, type: 'invalid_request_error', code: 'validation_error' } });
  }
});

// 3. Control Plane: Get status
app.get('/api/status', controlPlaneLimiter, (req, res) => {
  res.status(200).json(db.get());
});

// 4. Control Plane: Simulation toggle
app.post('/api/simulation/toggle', controlPlaneLimiter, requireControlAuth, (req, res) => {
  const current = db.get().simulationActive;
  if (current) {
    stopInternalSimulation();
  } else {
    startInternalSimulation();
  }
  res.status(200).json({ success: true, simulationActive: db.get().simulationActive });
});

// 5. Control Plane: Reset usage
app.post('/api/usage/reset', controlPlaneLimiter, requireControlAuth, (req, res) => {
  const usage = db.resetUsage();
  res.status(200).json({ success: true, usage });
});

// 6. Control Plane: Get all swarm keys
app.get('/api/keys', controlPlaneLimiter, requireControlAuth, (req, res) => {
  const data = db.get();
  const keys = data.swarmKeys || {};
  const keyList = Object.entries(keys).map(([key, info]) => ({
    key, agentId: info.agentId, deptId: info.deptId, name: info.name
  }));
  res.status(200).json({ keys: keyList });
});

// 7. Control Plane: Regenerate all swarm keys
app.post('/api/keys/regenerate', controlPlaneLimiter, requireControlAuth, (req, res) => {
  const keys = db.regenerateSwarmKeys();
  const keyList = Object.entries(keys).map(([key, info]) => ({
    key, agentId: info.agentId, deptId: info.deptId, name: info.name
  }));
  res.status(200).json({ success: true, keys: keyList });
});

// ── Error handler middleware (must be last) ──
app.use(errorHandler);

// ── 404 handler ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: { message: `Route ${req.method} ${req.url} not found.`, type: 'invalid_request_error', code: 'not_found' }
  });
});

// ── Graceful Shutdown ────────────────────────
let server;
let connections = new Set();
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  stopInternalSimulation();

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed.');
    if (db.pool?.end) {
      db.pool.end().catch(() => {}).finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });

  // Drain existing connections
  for (const conn of connections) {
    conn.end();
  }

  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  shutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

// ── Startup ──────────────────────────────────
if (!process.env.TEST_MODE) {
  server = app.listen(PORT, () => {
    logger.info(`LLM Gateway Server running at http://localhost:${PORT} [${NODE_ENV}]`);
  });

  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => connections.delete(conn));
  });
}

export { processChatCompletion, estimateCost, MODEL_PRICING, FALLBACK_CHAIN, app, server, AppError };
