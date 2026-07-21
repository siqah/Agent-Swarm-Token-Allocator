# Demo & Monetization Guide

## Quick Demo (30 seconds, no API keys needed)

```bash
git clone <repo> && cd Agent-Swarm-Token-Allocator
npm install && npm install --prefix server
npm run dev &   # Frontend at :5173
npm start --prefix server &  # Backend at :3001
```

Open `http://localhost:5173`. Everything works in mock mode:

- Visual DAG planner — drag agents onto canvas, connect them, run workflows
- Cost dashboard — per-agent token breakdown with charts
- Run inspector — expand/copy agent responses and token usage
- Test `POST /v1/chat/completions` through the proxy
- Test `POST /v1/swarm/task` with auto-classification
- Browse request logs, cache stats, provider key management

No API keys required — the gateway returns mock responses automatically.

## Adding Real Providers (while running)

Add a provider key via the Provider Keys panel in the UI. Once a key is added, the gateway switches from mock to real for that provider. No restart needed.

Optional env vars (all have mock fallbacks):

| Env var | What it does |
|---|---|
| `OPENAI_API_KEY` | Enables real GPT calls |
| `ANTHROPIC_API_KEY` | Enables Claude fallback |
| `GOOGLE_API_KEY` | Enables Gemini fallback |
| `GROQ_API_KEY` | Enables Groq / Llama fallback |

Without any of these, mock mode provides a fully functional demo.

## Making Money

### 1. Hosted SaaS

Virtual keys map directly to customer tenants:

```
Customer A → gateway namespace → their agents, their provider keys, their budgets
                                  ↓
                           Single endpoint per customer
```

Pricing tiers:
- **Free**: 1 department, 2 agents, mock-only, 7-day log retention
- **Pro**: $200/mo — unlimited agents, real providers, 30-day logs, semantic cache
- **Enterprise**: Custom — dedicated gateway, SSO/SAML, SLA, audit logs, on-prem

### 2. Enterprise License

MIT license. Enterprises with 50+ agents will pay for managed deployment, SSO, audit retention, and dedicated support. $5k–$20k/year.

### 3. Consulting & Setup

- **Setup workshop** ($2k) — deploy, configure agents, train prompt classifier
- **Custom classifier tuning** ($3k) — train routing for their domain
- **Provider optimization** ($1k) — benchmark latency/cost across providers

### 4. Whitelabel Reseller

Agencies managing AI for clients embed this as their agent management console. $50/mo per client org.

## Demo Script (5 minutes)

| Time | What to show |
|---|---|
| 0:00 | Open dashboard, explain layout: canvas, agent library, config panel |
| 0:30 | Drag agents onto canvas, connect them, configure prompts |
| 1:00 | Run the workflow — watch SSE streaming and cost tick up |
| 1:30 | Open cost dashboard — per-agent breakdown, charts, budget bar |
| 2:00 | Open run inspector — expand agent responses, see token usage |
| 2:30 | Send curl: `curl -X POST http://localhost:3001/v1/chat/completions -H "Authorization: Bearer swarm-xxx" -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}'` |
| 3:00 | Show logs, cache stats, provider key management |
| 3:30 | Add a real API key via Provider Keys panel — show live provider call |
| 4:00 | Sum up: DAG planner + multi-provider proxy + cost control in one box |
