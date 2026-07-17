/**
 * swarm.js — Standalone Swarm Simulator Client.
 * Runs in the background, making continuous HTTP requests to our Gateway,
 * simulating a fleet of active agents running tasks.
 */

const GATEWAY_URL = 'http://localhost:3001/v1/chat/completions';

const AGENTS = [
  { id: 'code-review', dept: 'engineering', name: '🔍 Code Review Agent' },
  { id: 'debug-agent', dept: 'engineering', name: '🐛 Debug Agent' },
  { id: 'content-agent', dept: 'marketing', name: '✍️ Content Agent' },
  { id: 'seo-agent', dept: 'marketing', name: '🔎 SEO Agent' },
  { id: 'lead-scoring', dept: 'sales', name: '🎯 Lead Scoring Agent' },
  { id: 'email-drafter', dept: 'sales', name: '📧 Email Drafter Agent' },
  { id: 'data-analysis', dept: 'operations', name: '📈 Data Analysis Agent' },
  { id: 'reporting', dept: 'operations', name: '📋 Reporting Agent' }
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

async function runAgent(agent) {
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-ID': agent.id,
        'X-Department-ID': agent.dept
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
      console.log(`\x1b[32m[SUCCESS] ${agent.name} consumed ${data.usage.total_tokens} tokens.\x1b[0m`);
    } else {
      console.error(`[ERROR] ${agent.name} failed:`, data.error?.message || 'Unknown error');
    }
  } catch (err) {
    console.error(`[CONNECTION FAILED] Could not contact Gateway at ${GATEWAY_URL}`);
  }
}

function start() {
  console.log('🚀 Standalone Agent Swarm simulator client started.');
  console.log(`Targeting LLM Gateway at ${GATEWAY_URL}`);
  console.log('Press Ctrl+C to stop.\n');

  // Trigger agent requests at random intervals between 500ms and 2000ms
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
