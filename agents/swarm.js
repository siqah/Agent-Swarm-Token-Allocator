/**
 * swarm.js — Standalone Swarm Simulator Client.
 * Uses Virtual Swarm Keys (just like a real developer would with the OpenAI SDK).
 */

const GATEWAY_URL = 'http://localhost:3001/v1/chat/completions';

const AGENTS = [
  { id: 'code-review', dept: 'engineering', name: '🔍 Code Review Agent', key: 'swarm-code-review-xxxxx' },
  { id: 'debug-agent', dept: 'engineering', name: '🐛 Debug Agent', key: 'swarm-debug-agent-xxxxx' },
  { id: 'content-agent', dept: 'marketing', name: '✍️ Content Agent', key: 'swarm-content-agent-xxxxx' },
  { id: 'seo-agent', dept: 'marketing', name: '🔎 SEO Agent', key: 'swarm-seo-agent-xxxxx' },
  { id: 'lead-scoring', dept: 'sales', name: '🎯 Lead Scoring Agent', key: 'swarm-lead-scoring-xxxxx' },
  { id: 'email-drafter', dept: 'sales', name: '📧 Email Drafter Agent', key: 'swarm-email-drafter-xxxxx' },
  { id: 'data-analysis', dept: 'operations', name: '📈 Data Analysis Agent', key: 'swarm-data-analysis-xxxxx' },
  { id: 'reporting', dept: 'operations', name: '📋 Reporting Agent', key: 'swarm-reporting-xxxxx' }
];

const PROMPTS = [
  "Verify if this code complies with ESLint standards.",
  "Check the memory usage profile of this loop operation.",
  "Create 3 taglines for a SaaS product focused on compute budgets.",
  "Audit the backlink profile of search query terms.",
  "Qualify this trial user: 45 page views, clicked upgrade twice.",
  "Write an email follow-up offering a 1-on-1 budget optimization call.",
  "Plot the token allocations vs actual burn rates for operations.",
  "Export the monthly summary breakdown as PDF format."
];

async function fetchSwarmKeys() {
  try {
    const res = await fetch('http://localhost:3001/api/keys');
    const data = await res.json();
    if (data.keys) {
      data.keys.forEach(({ key, agentId }) => {
        const agent = AGENTS.find(a => a.id === agentId);
        if (agent) agent.key = key;
      });
      console.log('Loaded Virtual Swarm Keys from gateway.');
    }
  } catch {
    console.warn('Could not fetch keys from gateway, using defaults. Start the server first.');
  }
}

async function runAgent(agent) {
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agent.key}` // Standard OpenAI SDK auth
      },
      body: JSON.stringify({
        model: 'gpt-5.6-terra',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (response.status === 429) {
      console.warn(`\x1b[31m[BLOCKED] ${agent.name} (Budget Exceeded): ${data.error.message}\x1b[0m`);
    } else if (response.status === 200) {
      const fallbackNote = data._fallback ? ` [fallback ${data._requested_model} → ${data.model}]` : '';
      console.log(`\x1b[32m[SUCCESS] ${agent.name} consumed ${data.usage.total_tokens} tokens on ${data.model}.${fallbackNote}\x1b[0m`);
    } else if (response.status === 401) {
      console.error(`\x1b[31m[AUTH ERROR] ${agent.name}: ${data.error?.message}\x1b[0m`);
    } else {
      console.error(`[ERROR] ${agent.name} failed:`, data.error?.message || 'Unknown error');
    }
  } catch (err) {
    console.error(`[CONNECTION FAILED] Could not contact Gateway at ${GATEWAY_URL}`);
  }
}

async function start() {
  await fetchSwarmKeys();

  console.log('🚀 Standalone Agent Swarm simulator client started.');
  console.log(`Targeting LLM Gateway at ${GATEWAY_URL}`);
  console.log('Press Ctrl+C to stop.\n');

  function scheduleNext() {
    const delay = Math.floor(Math.random() * 1500) + 500;
    setTimeout(async () => {
      const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      await runAgent(agent);
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

start();
