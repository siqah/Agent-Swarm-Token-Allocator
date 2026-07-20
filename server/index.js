import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { db } from './database.js';
import { logger } from './lib/logger.js';
import { validate, chatCompletionSchema, configUpdateSchema } from './lib/validate.js';
import { apiLimiter, controlPlaneLimiter } from './lib/rateLimiter.js';
import {
  trackRequest, metricsEndpoint, incrementTokens,
  incrementBudgetBlocked, incrementFallbacks, incrementUpstreamErrors,
  incrementSimulationTicks,
} from './lib/metrics.js';
import { checkCache, setCache, clearCache, getCacheStats } from './lib/cache.js';
import { recordRequest, getLogs, clearLogs } from './lib/requestLog.js';
import { syncProviderKeys, getProviderForModel, getAvailableProviders, getFallbackChain, selectKey } from './providers/index.js';
import { requireUserAuth, hashPassword, verifyPassword, createSession, destroySession, getSession } from './lib/auth.js';
import { classifyDepartment } from './lib/classifier.js';
import { sendAlert } from './lib/webhook.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Sentry ────────────────────────────────────
const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, environment: NODE_ENV });
  app.use(Sentry.Handlers.requestHandler());
  logger.info('Sentry error monitoring enabled.');
} else {
  logger.info('Sentry disabled. Set SENTRY_DSN to enable.');
}

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
  contentSecurityPolicy: NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  } : false,
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

// ── Metrics tracking ─────────────────────────
app.use(trackRequest);

app.use('/v1/', apiLimiter);

const CONTROL_PLANE_TOKEN = process.env.CONTROL_PLANE_TOKEN ||
  crypto.randomUUID();

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
const OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT, 10) || 60000;



const MODEL_PRICING = {
  'gpt-5.6-sol':   { input: 5.00, output: 30.00 },
  'gpt-5.6-terra': { input: 2.50, output: 15.00 },
  'gpt-5.6-luna':  { input: 1.00, output: 6.00 },
  'gpt-5.4-nano':  { input: 0.20, output: 1.25 },
  'o1-preview':    { input: 15.00, output: 60.00 },
  'o1-mini':       { input: 3.00, output: 12.00 },
  'o3-mini':       { input: 1.10, output: 4.40 },
  // Anthropic pricing
  'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3.5-haiku':  { input: 1.00, output: 5.00 },
  'claude-3-opus':     { input: 15.00, output: 75.00 },
  // Google pricing
  'gemini-2.0-flash':  { input: 0.10, output: 0.40 },
  'gemini-2.0-pro':    { input: 1.25, output: 5.00 },
  'gemini-1.5-pro':    { input: 1.25, output: 5.00 },
  'gemini-1.5-flash':  { input: 0.075, output: 0.30 },
  // Groq pricing
  'llama-3.3-70b':     { input: 0.59, output: 0.79 },
  'llama-3.1-8b':      { input: 0.05, output: 0.08 },
  'mixtral-8x7b':      { input: 0.24, output: 0.24 },
  'deepseek-r1':       { input: 0.55, output: 2.19 },
};

const FALLBACK_CHAIN = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-nano'];
const CROSS_PROVIDER_FALLBACK = true;

function getPrice(modelId) {
  return MODEL_PRICING[modelId] || MODEL_PRICING['gpt-5.6-terra'];
}

function estimateCost(modelId, inputTokens, outputTokens) {
  const p = getPrice(modelId);
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

function computeTokenAllocation(totalBudget, deptAllocPct, agentAllocPct) {
  return totalBudget * (deptAllocPct / 100) * (agentAllocPct / 100);
}

function getUsageStatus(dbData, agentId, agentTokenLimit, requestedModel) {
  const usage = dbData.usage[agentId]?.total || 0;

  if (usage < agentTokenLimit) {
    return { blocked: false, usage };
  }

  // Cross-provider fallback chain
  const chain = CROSS_PROVIDER_FALLBACK
    ? getFallbackChain(requestedModel)
    : FALLBACK_CHAIN.slice(FALLBACK_CHAIN.indexOf(requestedModel) + 1);

  for (const fallbackModel of chain) {
    const provider = getProviderForModel(fallbackModel);
    if (provider) {
      return { blocked: false, usage, fallbackTo: fallbackModel };
    }
  }

  return { blocked: true, usage, atCheapest: true };
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

  incrementSimulationTicks();
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

async function startInternalSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(runSimulationTick, 1000);
  await db.setSimulationActive(true);
  logger.info('Background Swarm Simulation started.');
}

async function stopInternalSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  await db.setSimulationActive(false);
  logger.info('Background Swarm Simulation stopped.');
}

if (db.get().simulationActive) {
  startInternalSimulation().catch(err => logger.error('Failed to start simulation on boot:', err));
}

// ── Core Chat Completion Logic ───────────────
async function processChatCompletion({ agentId, deptId, model, messages, temperature, max_tokens, stream, budgetOverride, _apiKey, _providerName, _originalModel, _fallbackActive }) {
  const currentDb = db.get();
  const originalModel = _originalModel || model;

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

  // Use budgetOverride if set on the swarm key, otherwise compute from config
  const agentTokenLimit = budgetOverride != null
    ? budgetOverride
    : computeTokenAllocation(currentDb.totalBudget, dept.allocation, agent.allocation);

  // Budget check with cascade fallback
  const status = getUsageStatus(currentDb, agentId, agentTokenLimit, model);

  if (status.blocked) {
    incrementBudgetBlocked();
    sendAlert('budget_exhausted', {
      agentId,
      agentName: agent.name,
      deptId,
      deptName: dept.name,
      usage: status.usage,
      limit: agentTokenLimit,
      model,
      gatewayUrl: `http://localhost:${PORT}`,
    });
    return {
      statusCode: 429,
      error: {
        message: `Budget Exceeded: Agent '${agent.name}' has used ${status.usage} of ${agentTokenLimit.toFixed(0)} tokens.`,
        type: 'insufficient_budget',
        code: 'budget_exceeded'
      }
    };
  }

  if (status.fallbackTo) {
    incrementFallbacks();
    logger.info(`[Fallback] Agent '${agent.name}': token budget exhausted on ${model}, falling back to ${status.fallbackTo}`);
    return processChatCompletion({
      agentId, deptId, model: status.fallbackTo, messages, temperature, max_tokens, stream,
      _originalModel: originalModel, _fallbackActive: true
    });
  }

  // ── Execute via provider ───────────
  const provider = getProviderForModel(model);

  if (provider && provider.isAvailable()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT);

    try {
      if (stream) {
        const gen = provider.stream({ model, messages, temperature, max_tokens, signal: controller.signal, key: _apiKey });
        return { statusCode: 200, stream: gen, agentId, agentName: agent.name, originalModel, fallbackActive: _fallbackActive };
      }

      const data = await provider.call({ model, messages, temperature, max_tokens, signal: controller.signal, key: _apiKey });
      clearTimeout(timeout);

      if (data.usage) {
        await db.recordUsage(agentId, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0);
        incrementTokens(data.usage.total_tokens || 0);
        logger.info(`[${provider.name}] Agent '${agent.name}' consumed ${data.usage.total_tokens} tokens on ${model}.`);
      }

      const result = {
        statusCode: 200,
        id: data.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: data.model,
        choices: data.choices,
        usage: data.usage,
        _provider: _providerName || provider.name,
      };

      if (_fallbackActive) {
        result._fallback = true;
        result._requested_model = originalModel;
      }

      return result;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        logger.error(`[Provider Timeout] Request to ${model} timed out after ${OPENAI_TIMEOUT}ms`);
        return {
          statusCode: 504,
          error: { message: 'Upstream API request timed out.', type: 'api_error', code: 'upstream_timeout' }
        };
      }
      incrementUpstreamErrors();
      logger.error(`[${provider.name} Error]`, err);
      return {
        statusCode: err.statusCode || 502,
        error: { message: err.message || 'Upstream API request failed.', type: 'api_error', code: err.code || 'upstream_error' }
      };
    }
  }

  // Mock Fallback (no provider configured)
  const promptTokens = Math.floor(Math.random() * 800) + 200;
  const completionTokens = Math.floor(Math.random() * 1200) + 300;

  await db.recordUsage(agentId, promptTokens, completionTokens);

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
      total_tokens: promptTokens + completionTokens
    }
  };

  if (_fallbackActive) {
    result._fallback = true;
    result._requested_model = originalModel;
  }

  return result;
}

async function pipeStreamToResponse(gen, res, agentId, agentName, originalModel, fallbackActive) {
  let finalUsage = null;
  let first = true;
  let modelName = '';

  for await (const chunk of gen) {
    if (chunk.usage) {
      finalUsage = chunk.usage;
    }
    if (!modelName && chunk.model) {
      modelName = chunk.model;
    }

    // OpenAI-style SSE format
    const payload = {
      choices: chunk.choices?.map((c) => ({
        index: c.index,
        delta: c.delta || {},
        finish_reason: c.finish_reason || null,
      })),
    };
    if (chunk.usage) {
      payload.usage = chunk.usage;
    }

    if (first && fallbackActive) {
      res.set('X-Fallback-From', originalModel);
      res.set('X-Fallback-To', modelName || 'unknown');
      first = false;
    }

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  if (finalUsage && agentId) {
    await db.recordUsage(agentId, finalUsage.prompt_tokens || 0, finalUsage.completion_tokens || 0);
    incrementTokens(finalUsage.total_tokens || 0);
    logger.info(`[Stream] Agent '${agentName}' consumed ${finalUsage.total_tokens} tokens.`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
}


// ── Endpoints ────────────────────────────────

// 0. Health check (no auth, no rate limit)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    openai: OPENAI_API_KEY ? 'configured' : 'mock',
    providers: getAvailableProviders(),
    postgres: db.isPostgres,
    simulation: db.get().simulationActive,
    version: '0.1.0',
    node: process.version,
    environment: NODE_ENV,
  });
});

// 0b. Prometheus metrics endpoint (no auth, no rate limit)
app.get('/api/metrics', metricsEndpoint);

// 0c. Initialization — returns status + control plane token (rate limited)
app.get('/api/init', controlPlaneLimiter, (req, res) => {
  const data = sanitizePublicData(db.get());
  res.status(200).json({ token: CONTROL_PLANE_TOKEN, ...data });
});

// 0d. Auth endpoints (rate limited to prevent brute force)
app.post('/api/register', apiLimiter, async (req, res, next) => {
  try {
    const { username, password, department } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        error: { message: 'username and password are required.', type: 'invalid_request_error', code: 'missing_fields' }
      });
    }
    if (typeof username !== 'string' || username.length < 2) {
      return res.status(400).json({
        error: { message: 'username must be a string with at least 2 characters.', type: 'invalid_request_error', code: 'validation_error' }
      });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: { message: 'password must be at least 6 characters.', type: 'invalid_request_error', code: 'validation_error' }
      });
    }
    const existing = db.findUserByUsername(username);
    if (existing) {
      return res.status(409).json({
        error: { message: 'Username already taken.', type: 'invalid_request_error', code: 'conflict' }
      });
    }
    const passwordHash = await hashPassword(password);
    const user = await db.createUser(username, passwordHash, department || null);
    if (!user) {
      return res.status(409).json({
        error: { message: 'Username already taken.', type: 'invalid_request_error', code: 'conflict' }
      });
    }
    const token = createSession(user.id);
    res.status(201).json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
});

app.post('/api/login', apiLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        error: { message: 'username and password are required.', type: 'invalid_request_error', code: 'missing_fields' }
      });
    }
    const user = db.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        error: { message: 'Invalid username or password.', type: 'authentication_error', code: 'invalid_credentials' }
      });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        error: { message: 'Invalid username or password.', type: 'authentication_error', code: 'invalid_credentials' }
      });
    }
    const token = createSession(user.id);
    res.status(200).json({
      success: true,
      user: { id: user.id, username: user.username, department: user.department },
      token
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/logout', requireUserAuth, async (req, res) => {
  const auth = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.substring(7) : null;
  if (token) await destroySession(token);
  res.status(200).json({ success: true });
});

app.get('/api/me', requireUserAuth, (req, res) => {
  const user = db.findUserById(req.userId);
  if (!user) {
    return res.status(404).json({
      error: { message: 'User not found.', type: 'authentication_error', code: 'not_found' }
    });
  }
  res.status(200).json({ user: { id: user.id, username: user.username, department: user.department, createdAt: user.createdAt } });
});

// 1. LLM Chat completions — OpenAI SDK compatible
app.post('/v1/chat/completions', validate(chatCompletionSchema), async (req, res) => {
  const startTime = Date.now();
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

  const { model, messages, stream, temperature, max_tokens } = req.validatedBody;

  // 1a. Check semantic cache (non-streaming only)
  const cacheResult = !stream ? checkCache(model, messages) : { hit: false };
  if (cacheResult.hit) {
    res.set('X-Cache', cacheResult.type);
    res.set('X-Cache-Similarity', cacheResult.similarity?.toFixed(3));
    incrementTokens(cacheResult.response.usage?.total_tokens || 0);
    recordRequest({
      id: req.id, agentId: agentInfo.agentId, agentName: agentInfo.name, deptId: agentInfo.deptId,
      model, provider: 'cache', promptTokens: cacheResult.response.usage?.prompt_tokens || 0,
      completionTokens: cacheResult.response.usage?.completion_tokens || 0,
      totalTokens: cacheResult.response.usage?.total_tokens || 0,
      latencyMs: Date.now() - startTime, statusCode: 200, cached: true, cacheType: cacheResult.type,
    });
    return res.status(200).json(cacheResult.response);
  }

  // 1b. Select load-balanced key
  const provider = getProviderForModel(model);
  const apiKey = provider ? selectKey(provider.name) : null;

  // 1c. Pass budget override if set on the swarm key
  const budgetOverride = agentInfo.budgetOverride || null;

  const result = await processChatCompletion({
    agentId: agentInfo.agentId,
    deptId: agentInfo.deptId,
    model,
    messages,
    temperature,
    max_tokens,
    stream: !!stream,
    budgetOverride,
    _apiKey: apiKey,
    _providerName: provider?.name || 'mock',
  });

  if (result.error) {
    recordRequest({
      id: req.id, agentId: agentInfo.agentId, agentName: agentInfo.name, deptId: agentInfo.deptId,
      model, provider: provider?.name || 'mock', latencyMs: Date.now() - startTime,
      statusCode: result.statusCode || 400, error: result.error.message,
    });
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  // Handle streaming response
  if (result.stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    return await pipeStreamToResponse(result.stream, res, result.agentId, result.agentName, result.originalModel, result.fallbackActive);
  }

  // 1d. Store in cache (non-streaming only)
  if (!stream) {
    setCache(model, messages, {
      id: result.id, object: 'chat.completion', created: result.created,
      model: result.model, choices: result.choices, usage: result.usage,
    });
  }

  // 1e. Record request log
  recordRequest({
    id: req.id, agentId: agentInfo.agentId, agentName: agentInfo.name, deptId: agentInfo.deptId,
    deptName: agentInfo.deptName,
    model: result.model, provider: result._provider || provider?.name || 'mock',
    promptTokens: result.usage?.prompt_tokens || 0,
    completionTokens: result.usage?.completion_tokens || 0,
    totalTokens: result.usage?.total_tokens || 0,
    latencyMs: Date.now() - startTime, statusCode: 200,
    fallback: !!result._fallback, fallbackFrom: result._requested_model || null,
  });

  if (result._fallback) {
    res.set('X-Fallback-From', result._requested_model);
    res.set('X-Fallback-To', result.model);
  }

  return res.status(200).json(result);
});

// 1b. Task routing — classify prompt and route to best agent
app.post('/v1/swarm/task', async (req, res) => {
  const startTime = Date.now();
  const authHeader = req.headers['authorization'];
  let swarmKey = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    swarmKey = authHeader.substring(7).trim();
  } else if (authHeader) {
    swarmKey = authHeader.trim();
  }

  if (!swarmKey) {
    return res.status(401).json({
      error: { message: 'Missing Virtual Swarm Key.', type: 'authentication_error', code: 'missing_api_key' }
    });
  }

  const agentInfo = db.getAgentBySwarmKey(swarmKey);
  if (!agentInfo) {
    return res.status(401).json({
      error: { message: 'Invalid Virtual Swarm Key.', type: 'authentication_error', code: 'invalid_api_key' }
    });
  }

  const { prompt, model, messages, stream, temperature, max_tokens } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      error: { message: 'prompt is required and must be a string.', type: 'invalid_request_error', code: 'missing_fields' }
    });
  }

  const data = db.get();
  const classification = classifyDepartment(data.departments, prompt);

  if (!classification || !classification.agentId) {
    return res.status(404).json({
      error: { message: 'No suitable agent found for the given prompt.', type: 'invalid_request_error', code: 'no_match' }
    });
  }

  const targetDept = data.departments.find((d) => d.id === classification.deptId);
  const targetAgent = targetDept?.agents.find((a) => a.id === classification.agentId);
  if (!targetAgent) {
    return res.status(404).json({
      error: { message: 'Classified agent not found.', type: 'invalid_request_error', code: 'not_found' }
    });
  }

  // Use the classified agent's swarm key for budget override
  const targetSwarmKeyInfo = Object.entries(data.swarmKeys).find(
    ([, v]) => v.agentId === classification.agentId && v.deptId === classification.deptId
  )?.[1];
  const budgetOverride = targetSwarmKeyInfo?.budgetOverride || null;

  logger.info(`[TaskRouter] "${prompt.substring(0, 60)}..." → ${targetAgent.name} (${targetDept.name}) [score=${classification.score?.toFixed(3)}]`);

  const result = await processChatCompletion({
    agentId: targetAgent.id,
    deptId: targetDept.id,
    model: model || data.selectedModel,
    messages: messages || [{ role: 'user', content: prompt }],
    temperature,
    max_tokens,
    stream: !!stream,
    budgetOverride,
    _apiKey: selectKey(getProviderForModel(model || data.selectedModel)?.name),
    _providerName: getProviderForModel(model || data.selectedModel)?.name || 'mock',
  });

  if (result.error) {
    return res.status(result.statusCode || 400).json({
      error: result.error,
      _classification: { agentId: classification.agentId, agentName: targetAgent.name, deptId: classification.deptId, deptName: targetDept.name, score: classification.score }
    });
  }

  if (result.stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Routed-Agent': targetAgent.name,
      'X-Routed-Department': targetDept.name,
    });
    return await pipeStreamToResponse(result.stream, res, result.agentId, result.agentName, result.originalModel, result.fallbackActive);
  }

  res.set('X-Routed-Agent', targetAgent.name);
  res.set('X-Routed-Department', targetDept.name);
  return res.status(200).json(result);
});

// 2. Control Plane: Update config
app.post('/api/config', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const updated = await db.updateConfig(req.body);
    await db.ensureSwarmKeys();
    res.status(200).json({ success: true, config: updated });
  } catch (err) {
    if (err.message.match(/^(totalBudget|selectedModel|departments|thresholds)/)) {
      res.status(400).json({ error: { message: err.message, type: 'invalid_request_error', code: 'validation_error' } });
    } else {
      next(err);
    }
  }
});

// 3a. Control Plane: SSE stream (no rate limit — single persistent connection)
function sanitizePublicData(data) {
  const sanitized = { ...data };
  delete sanitized.providerKeys;
  if (sanitized.swarmKeys) {
    const masked = {};
    for (const [key, info] of Object.entries(sanitized.swarmKeys)) {
      const maskedKey = key.length > 12
        ? key.slice(0, 6) + '••••' + key.slice(-4)
        : '••••••••';
      masked[maskedKey] = info;
    }
    sanitized.swarmKeys = masked;
  }
  return sanitized;
}

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendState = () => {
    const data = sanitizePublicData(db.get());
    res.write(`data: ${JSON.stringify({ ...data, availableProviders: getAvailableProviders() })}\n\n`);
  };

  sendState();

  const interval = setInterval(sendState, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// 3b. Control Plane: Get status (used as fallback, rate limited)
app.get('/api/status', controlPlaneLimiter, (req, res) => {
  res.status(200).json(sanitizePublicData(db.get()));
});

// 4. Control Plane: Simulation toggle
app.post('/api/simulation/toggle', controlPlaneLimiter, requireControlAuth, async (req, res) => {
  const current = db.get().simulationActive;
  if (current) {
  stopInternalSimulation().catch(() => {});
  } else {
    await startInternalSimulation();
  }
  res.status(200).json({ success: true, simulationActive: db.get().simulationActive });
});

// 5. Control Plane: Reset usage
app.post('/api/usage/reset', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const usage = await db.resetUsage();
    res.status(200).json({ success: true, usage });
  } catch (err) {
    next(err);
  }
});

// 6. Control Plane: Virtual Swarm Key CRUD

// 6a. Get swarm keys (optionally filtered by department)
app.get('/api/keys', controlPlaneLimiter, requireControlAuth, (req, res) => {
  const data = db.get();
  const keys = data.swarmKeys || {};
  let keyList = Object.entries(keys).map(([key, info]) => ({
    key, agentId: info.agentId, deptId: info.deptId, name: info.name
  }));
  const { department } = req.query;
  if (department) {
    keyList = keyList.filter((k) => k.deptId === department);
  }
  res.status(200).json({ keys: keyList });
});

// 6aa. User-scoped keys — auto-filtered by the authenticated user's department
app.get('/api/user/keys', controlPlaneLimiter, requireUserAuth, (req, res) => {
  const user = db.findUserById(req.userId);
  if (!user) {
    return res.status(404).json({
      error: { message: 'User not found.', type: 'authentication_error', code: 'not_found' }
    });
  }
  const data = db.get();
  const keys = data.swarmKeys || {};
  const keyList = Object.entries(keys)
    .filter(([, info]) => !user.department || info.deptId === user.department)
    .map(([key, info]) => ({
      key, agentId: info.agentId, deptId: info.deptId, name: info.name
    }));
  res.status(200).json({ keys: keyList, department: user.department });
});

// 6b. Create a new swarm key for a specific agent
app.post('/api/keys', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const { agentId, deptId } = req.body;
    if (!agentId || !deptId) {
      return res.status(400).json({
        error: { message: 'agentId and deptId are required.', type: 'invalid_request_error', code: 'missing_fields' }
      });
    }
    const key = await db.createSwarmKey(agentId, deptId);
    if (!key) {
      return res.status(404).json({
        error: { message: `Agent '${agentId}' not found in department '${deptId}'.`, type: 'invalid_request_error', code: 'not_found' }
      });
    }
    res.status(201).json({ success: true, key });
  } catch (err) {
    next(err);
  }
});

// 6c. Revoke a specific swarm key
app.delete('/api/keys/:key', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const revoked = await db.revokeSwarmKey(req.params.key);
    if (!revoked) {
      return res.status(404).json({
        error: { message: 'Swarm key not found.', type: 'invalid_request_error', code: 'not_found' }
      });
    }
    res.status(200).json({ success: true, revoked });
  } catch (err) {
    next(err);
  }
});

// 6d. Regenerate a single swarm key
app.post('/api/keys/:key/regenerate', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const result = await db.regenerateSingleSwarmKey(req.params.key);
    if (!result) {
      return res.status(404).json({
        error: { message: 'Swarm key not found.', type: 'invalid_request_error', code: 'not_found' }
      });
    }
    res.status(200).json({ success: true, key: result });
  } catch (err) {
    next(err);
  }
});

// 6e. Regenerate all swarm keys
app.post('/api/keys/regenerate', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const keys = await db.regenerateSwarmKeys();
    const keyList = Object.entries(keys).map(([key, info]) => ({
      key, agentId: info.agentId, deptId: info.deptId, name: info.name
    }));
    res.status(200).json({ success: true, keys: keyList });
  } catch (err) {
    next(err);
  }
});

// 7. Budget overrides on swarm keys
app.put('/api/keys/:key/budget', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const { budgetOverride } = req.body;
    if (budgetOverride != null && (typeof budgetOverride !== 'number' || budgetOverride < 0)) {
      return res.status(400).json({
        error: { message: 'budgetOverride must be a non-negative number or null.', type: 'invalid_request_error', code: 'validation_error' }
      });
    }
    const result = await db.setKeyBudgetOverride(req.params.key, budgetOverride);
    if (!result) {
      return res.status(404).json({
        error: { message: 'Swarm key not found.', type: 'invalid_request_error', code: 'not_found' }
      });
    }
    res.status(200).json({ success: true, key: result });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/keys/:key/budget', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const result = await db.removeKeyBudgetOverride(req.params.key);
    if (!result) {
      return res.status(404).json({
        error: { message: 'Swarm key not found.', type: 'invalid_request_error', code: 'not_found' }
      });
    }
    res.status(200).json({ success: true, key: result });
  } catch (err) {
    next(err);
  }
});

// 8. Provider key management
app.get('/api/providers', controlPlaneLimiter, requireControlAuth, (req, res) => {
  const providers = getAvailableProviders();
  res.status(200).json({ providers });
});

app.get('/api/providers/:name/keys', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const keys = await db.getProviderKeys(req.params.name);
    res.status(200).json({ provider: req.params.name, keys: keys.map(() => '••••••••') });
  } catch (err) {
    next(err);
  }
});

app.post('/api/providers/:name/keys', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({
        error: { message: 'key is required.', type: 'invalid_request_error', code: 'missing_fields' }
      });
    }
    const result = await db.setProviderKey(req.params.name, key);
    syncProviderKeys(db);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/providers/:name/keys', controlPlaneLimiter, requireControlAuth, async (req, res, next) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({
        error: { message: 'key is required.', type: 'invalid_request_error', code: 'missing_fields' }
      });
    }
    const result = await db.removeProviderKey(req.params.name, key);
    if (!result) {
      return res.status(404).json({
        error: { message: 'Key not found for this provider.', type: 'invalid_request_error', code: 'not_found' }
      });
    }
    syncProviderKeys(db);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// 9. Cache management
app.get('/api/cache', controlPlaneLimiter, requireControlAuth, (req, res) => {
  res.status(200).json(getCacheStats());
});

app.delete('/api/cache', controlPlaneLimiter, requireControlAuth, (req, res) => {
  clearCache();
  res.status(200).json({ success: true, message: 'Cache cleared.' });
});

// 10. Request logs
app.get('/api/logs', controlPlaneLimiter, requireControlAuth, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  const { agentId, deptId } = req.query;
  const logs = getLogs({ limit, offset, agentId, deptId });
  res.status(200).json(logs);
});

app.delete('/api/logs', controlPlaneLimiter, requireControlAuth, (req, res) => {
  clearLogs();
  res.status(200).json({ success: true, message: 'Logs cleared.' });
});

// ── Sentry error handler (before custom handler) ──
if (SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

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

  const exit = () => {
    if (db.pool?.end) {
      db.pool.end().catch(() => {}).finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  };

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
      exit();
    });
    for (const conn of connections) {
      conn.end();
    }
  } else {
    exit();
  }

  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

if (!process.env.TEST_MODE) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    shutdown('UNCAUGHT_EXCEPTION');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
}

// ── Sync provider keys from DB ─────────────
syncProviderKeys(db);

// ── Startup ──────────────────────────────────
if (!process.env.TEST_MODE) {
  server = app.listen(PORT, () => {
    logger.info(`LLM Gateway Server running at http://localhost:${PORT} [${NODE_ENV}]`);
    if (!process.env.CONTROL_PLANE_TOKEN) {
      logger.info(`Control plane token (set CONTROL_PLANE_TOKEN env var to persist): ${CONTROL_PLANE_TOKEN}`);
    }
  });

  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => connections.delete(conn));
  });
}

export { processChatCompletion, estimateCost, MODEL_PRICING, FALLBACK_CHAIN, app, server, AppError, pipeStreamToResponse };
