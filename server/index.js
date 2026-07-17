/**
 * index.js — LLM API Gateway Proxy and Control API.
 * Intercepts calls, checks budget limits, logs real-time tokens.
 */

import express from 'express';
import cors from 'cors';
import { db } from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Load OpenAI API Key from environment if available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

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

/**
 * Direct simulator worker.
 * Runs inside the server process to simulate agent traffic without external network dependencies.
 */
async function runSimulationTick() {
  const currentDb = db.get();
  const allAgents = [];

  currentDb.departments.forEach((dept) => {
    dept.agents.forEach((agent) => {
      allAgents.push({
        id: agent.id,
        name: agent.name,
        deptId: dept.id,
        deptName: dept.name,
      });
    });
  });

  if (allAgents.length === 0) return;

  // Pick a random agent to make a request
  const agent = allAgents[Math.floor(Math.random() * allAgents.length)];
  const prompt = MOCK_PROMPTS[Math.floor(Math.random() * MOCK_PROMPTS.length)];

  console.log(`[Sim] Agent '${agent.name}' (${agent.deptName}) sending request...`);

  // Simulate completion call
  const result = await processChatCompletion({
    agentId: agent.id,
    deptId: agent.deptId,
    model: currentDb.selectedModel,
    messages: [{ role: 'user', content: prompt }]
  });

  if (result.error) {
    console.warn(`[Sim Limit] Agent '${agent.name}' BLOCKED: ${result.error.message}`);
  } else {
    const fallbackNote = result._fallback ? ` (fallback from ${result._requested_model} to ${result.model})` : '';
    console.log(`[Sim Success] Agent '${agent.name}' consumed ${result.usage.total_tokens} tokens on ${result.model}.${fallbackNote}`);
  }
}

function startInternalSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(runSimulationTick, 1000); // 1 tick per second
  db.setSimulationActive(true);
  console.log('Background Swarm Simulation started.');
}

function stopInternalSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  db.setSimulationActive(false);
  console.log('Background Swarm Simulation stopped.');
}

// Restart simulation on startup if DB states it was active
if (db.get().simulationActive) {
  startInternalSimulation();
}


// ── Model Fallback Chain ─────────────────────
const FALLBACK_CHAIN = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-nano'];

/**
 * Shared logic for checking limits, generating mock completion, or calling OpenAI,
 * and saving token usage statistics.
 */
async function processChatCompletion({ agentId, deptId, model, messages, _originalModel, _fallbackActive }) {
  const currentDb = db.get();

  // Find department & agent configuration to verify budget limit
  const dept = currentDb.departments.find((d) => d.id === deptId);
  const agent = dept?.agents.find((a) => a.id === agentId);

  if (!dept || !agent) {
    return {
      statusCode: 400,
      error: {
        message: `Unknown agent '${agentId}' or department '${deptId}'. Check config headers.`,
        type: 'invalid_request_error',
        code: 'invalid_agent_info'
      }
    };
  }

  const originalModel = _originalModel || model;

  // Calculate agent monthly budget limit in tokens
  const agentLimit = currentDb.totalBudget * (dept.allocation / 100) * (agent.allocation / 100);
  
  // Calculate current usage
  const currentUsage = currentDb.usage[agentId]?.total || 0;

  // Budget exceeded check — try model fallback first
  if (currentUsage >= agentLimit) {
    const idx = FALLBACK_CHAIN.indexOf(model);
    if (idx >= 0 && idx < FALLBACK_CHAIN.length - 1) {
      const fallbackModel = FALLBACK_CHAIN[idx + 1];
      console.log(`[Fallback] Agent '${agent.name}': ${model} over budget, falling back to ${fallbackModel}`);
      return processChatCompletion({
        agentId,
        deptId,
        model: fallbackModel,
        messages,
        _originalModel: originalModel,
        _fallbackActive: true
      });
    }

    // Even the cheapest model is over budget
    return {
      statusCode: 429,
      error: {
        message: `Budget Exceeded: Agent '${agent.name}' has consumed ${currentUsage.toLocaleString()} tokens, exceeding its allocated budget limit of ${Math.round(agentLimit).toLocaleString()} tokens.`,
        type: 'insufficient_budget',
        code: 'budget_exceeded'
      }
    };
  }

  // ── Forward to Real OpenAI ─────────────────
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({ model, messages, stream: false })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`[OpenAI Error] ${response.status}:`, data.error);
        return { statusCode: response.status, error: data.error };
      }

      // Record actual token usage from OpenAI response
      if (data.usage) {
        db.recordUsage(agentId, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0);
        console.log(`[OpenAI] Agent '${agent.name}' consumed ${data.usage.total_tokens} tokens on ${model}.`);
      }

      // Annotate fallback info
      if (_fallbackActive) {
        data._fallback = true;
        data._requested_model = originalModel;
        console.log(`[Fallback] Agent '${agent.name}' was routed from ${originalModel} to ${model}.`);
      }

      return { statusCode: 200, ...data };
    } catch (err) {
      console.error('OpenAI API call failed:', err);
      return {
        statusCode: 502,
        error: {
          message: 'OpenAI API request failed. Check your OPENAI_API_KEY and network connectivity.',
          type: 'api_error',
          code: 'upstream_error'
        }
      };
    }
  }

  // ── Mock Fallback (when no real API key) ────
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
        message: {
          role: 'assistant',
          content: responseText
        },
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
    console.log(`[Fallback] Agent '${agent.name}' was routed from ${originalModel} to ${model} (mock).`);
  }

  return result;
}


// ── Endpoints ────────────────────────────────

// 1. LLM Chat completions gateway — OpenAI SDK Compatible
// Developers connect by setting:
//   baseURL: 'http://localhost:3000/v1'
//   apiKey: 'swarm-<agent-id>-<random>'  (from the dashboard)
app.post('/v1/chat/completions', async (req, res) => {
  // Extract API key from Authorization header (Bearer <key>) or from body
  const authHeader = req.headers['authorization'];
  let swarmKey = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    swarmKey = authHeader.substring(7).trim();
  } else if (authHeader) {
    swarmKey = authHeader.trim();
  }

  if (!swarmKey) {
    return res.status(401).json({
      error: {
        message: 'Missing API key. Pass your Virtual Swarm Key as the apiKey in the OpenAI SDK client.',
        type: 'authentication_error',
        code: 'missing_api_key'
      }
    });
  }

  // Look up the swarm key to identify the agent
  const agentInfo = db.getAgentBySwarmKey(swarmKey);
  if (!agentInfo) {
    return res.status(401).json({
      error: {
        message: `Invalid Virtual Swarm Key: '${swarmKey}'. Generate a new key from the dashboard.`,
        type: 'authentication_error',
        code: 'invalid_api_key'
      }
    });
  }

  const { model, messages } = req.body;

  if (!model || !messages) {
    return res.status(400).json({
      error: {
        message: 'Missing required fields: model and messages.',
        type: 'invalid_request_error',
        code: 'missing_fields'
      }
    });
  }

  // Budget Limiting + Logging Interceptor
  const result = await processChatCompletion({
    agentId: agentInfo.agentId,
    deptId: agentInfo.deptId,
    model,
    messages
  });

  if (result.error) {
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  // Set fallback header if applicable
  if (result._fallback) {
    res.set('X-Fallback-From', result._requested_model);
    res.set('X-Fallback-To', result.model);
  }

  return res.status(200).json(result);
});

// 2. Control Plane: Update configurations
app.post('/api/config', (req, res) => {
  const updated = db.updateConfig(req.body);
  db.ensureSwarmKeys();
  res.status(200).json({ success: true, config: updated });
});

// 3. Control Plane: Get status
app.get('/api/status', (req, res) => {
  res.status(200).json(db.get());
});

// 4. Control Plane: Simulation toggle
app.post('/api/simulation/toggle', (req, res) => {
  const current = db.get().simulationActive;
  if (current) {
    stopInternalSimulation();
  } else {
    startInternalSimulation();
  }
  res.status(200).json({ success: true, simulationActive: db.get().simulationActive });
});

// 5. Control Plane: Reset usage
app.post('/api/usage/reset', (req, res) => {
  const usage = db.resetUsage();
  res.status(200).json({ success: true, usage });
});

// 6. Control Plane: Get all swarm keys
app.get('/api/keys', (req, res) => {
  const keys = db.get().swarmKeys || {};
  // Return structured key info for the frontend
  const keyList = Object.entries(keys).map(([key, info]) => ({
    key,
    agentId: info.agentId,
    deptId: info.deptId,
    name: info.name
  }));
  res.status(200).json({ keys: keyList });
});

// 7. Control Plane: Regenerate all swarm keys
app.post('/api/keys/regenerate', (req, res) => {
  const keys = db.regenerateSwarmKeys();
  const keyList = Object.entries(keys).map(([key, info]) => ({
    key,
    agentId: info.agentId,
    deptId: info.deptId,
    name: info.name
  }));
  res.status(200).json({ success: true, keys: keyList });
});

// ── Startup ──────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 LLM Gateway Server running at http://localhost:${PORT}`);
});
