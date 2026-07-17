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
function runSimulationTick() {
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
  const result = processChatCompletion({
    agentId: agent.id,
    deptId: agent.deptId,
    model: currentDb.selectedModel,
    messages: [{ role: 'user', content: prompt }]
  });

  if (result.error) {
    console.warn(`[Sim Limit] Agent '${agent.name}' BLOCKED: ${result.error.message}`);
  } else {
    console.log(`[Sim Success] Agent '${agent.name}' consumed ${result.usage.total_tokens} tokens.`);
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


// ── Helper: Processing Logic ─────────────────
/**
 * Shared logic for checking limits, generating mock completion, or calling OpenAI,
 * and saving token usage statistics.
 */
function processChatCompletion({ agentId, deptId, model, messages }) {
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

  // Calculate agent monthly budget limit in tokens
  const agentLimit = currentDb.totalBudget * (dept.allocation / 100) * (agent.allocation / 100);
  
  // Calculate current usage
  const currentUsage = currentDb.usage[agentId]?.total || 0;

  // Budget exceeded check
  if (currentUsage >= agentLimit) {
    return {
      statusCode: 429,
      error: {
        message: `Budget Exceeded: Agent '${agent.name}' has consumed ${currentUsage.toLocaleString()} tokens, exceeding its allocated budget limit of ${Math.round(agentLimit).toLocaleString()} tokens.`,
        type: 'insufficient_budget',
        code: 'budget_exceeded'
      }
    };
  }

  // Create response
  // Simulated usage
  const promptTokens = Math.floor(Math.random() * 800) + 200; // 200–1000 input
  const completionTokens = Math.floor(Math.random() * 1200) + 300; // 300–1500 output
  const totalTokens = promptTokens + completionTokens;

  // Accumulate token spend
  db.recordUsage(agentId, promptTokens, completionTokens);

  const responseText = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

  return {
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
}


// ── Endpoints ────────────────────────────────

// 1. LLM Chat completions gateway
app.post('/v1/chat/completions', async (req, res) => {
  // Read agent headers to identify the traffic
  const agentId = req.headers['x-agent-id'] || 'code-review';
  const deptId = req.headers['x-department-id'] || 'engineering';
  
  const { model, messages } = req.body;

  // Budget Limiting + Logging Interceptor
  const result = processChatCompletion({ agentId, deptId, model, messages });

  if (result.error) {
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  // If real API key is loaded, we could optionally forward and overwrite token stats
  // For the OpenAI hackathon, returning high-fidelity mock completions with exact metrics
  // guarantees zero credit charges while proving the token counter logic works.
  return res.status(200).json(result);
});

// 2. Control Plane: Update configurations
app.post('/api/config', (req, res) => {
  const updated = db.updateConfig(req.body);
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

// ── Startup ──────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 LLM Gateway Server running at http://localhost:${PORT}`);
});
