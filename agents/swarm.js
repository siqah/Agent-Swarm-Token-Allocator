const GATEWAY_URL = 'http://localhost:3001/v1/chat/completions';
const CONTROL_PLANE = 'http://localhost:3001';

const AGENTS = [
  { id: 'code-review', dept: 'engineering', name: 'Code Review Agent', key: null },
  { id: 'debug-agent', dept: 'engineering', name: 'Debug Agent', key: null },
  { id: 'content-agent', dept: 'marketing', name: 'Content Agent', key: null },
  { id: 'seo-agent', dept: 'marketing', name: 'SEO Agent', key: null },
  { id: 'lead-scoring', dept: 'sales', name: 'Lead Scoring Agent', key: null },
  { id: 'email-drafter', dept: 'sales', name: 'Email Drafter Agent', key: null },
  { id: 'data-analysis', dept: 'operations', name: 'Data Analysis Agent', key: null },
  { id: 'reporting', dept: 'operations', name: 'Reporting Agent', key: null }
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

async function fetchSwarmKeys(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${CONTROL_PLANE}/api/status`);
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      if (data.departments) {
        data.departments.forEach((dept) => {
          dept.agents.forEach((agent) => {
            const match = AGENTS.find(a => a.id === agent.id);
            if (match && agent.swarmKey) match.key = agent.swarmKey;
          });
        });
      }
      const missing = AGENTS.filter(a => !a.key);
      if (missing.length > 0) {
        console.warn(`Could not resolve keys for: ${missing.map(a => a.id).join(', ')}`);
      }
      console.log('Loaded Virtual Swarm Keys from gateway.');
      return;
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`Failed to fetch keys (attempt ${i + 1}/${retries}), retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.error('Could not fetch keys from gateway. Start the server first.');
        process.exit(1);
      }
    }
  }
}

async function runAgent(agent) {
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agent.key}`
      },
      body: JSON.stringify({
        model: 'gpt-5.6-terra',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (response.status === 429) {
      console.warn(`[BLOCKED] ${agent.name} (Budget Exceeded): ${data.error?.message}`);
    } else if (response.status === 200) {
      const fallbackNote = data._fallback ? ` [fallback ${data._requested_model} -> ${data.model}]` : '';
      console.log(`[SUCCESS] ${agent.name} consumed ${data.usage.total_tokens} tokens on ${data.model}.${fallbackNote}`);
    } else if (response.status === 401) {
      console.error(`[AUTH ERROR] ${agent.name}: ${data.error?.message}`);
    } else {
      console.error(`[ERROR] ${agent.name} failed:`, data.error?.message || 'Unknown error');
    }
  } catch (err) {
    console.error(`[CONNECTION FAILED] Could not contact Gateway at ${GATEWAY_URL}`);
  }
}

async function start() {
  await fetchSwarmKeys();

  console.log('Standalone Agent Swarm simulator client started.');
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
