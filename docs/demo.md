# Demo & Monetization Guide

## Quick Demo (30 seconds, no API keys needed)

```bash
git clone <repo> && cd Agent-Swarm-Token-Allocator
docker compose up -d
```

Open `http://localhost:80`. Everything works in mock mode:

- Sankey dashboard with live token burn animation
- Drag sliders to reallocate budgets
- Watch agents hit budget limits and get 429-blocked
- See cross-provider fallback chains in action
- Test `POST /v1/swarm/task` with auto-classification
- Browse request logs, cache stats, provider key management

No API keys required — the gateway falls back to mock responses automatically.

## Letting Others Demo Their Own Instance

Push to GitHub. The one-liner in the README works for anyone with Docker:

```bash
git clone https://github.com/<your-org>/Agent-Swarm-Token-Allocator.git
cd Agent-Swarm-Token-Allocator
docker compose up -d
```

Optional env vars (all have sensible defaults or mock fallbacks):

| Env var | What it does |
|---|---|
| `OPENAI_API_KEY` | Enables real GPT calls |
| `ANTHROPIC_API_KEY` | Enables Claude fallback |
| `GOOGLE_API_KEY` | Enables Gemini fallback |
| `GROQ_API_KEY` | Enables Groq / Llama fallback |
| `DATABASE_URL` | PostgreSQL for persistence (defaults to local JSON) |
| `CONTROL_PLANE_TOKEN` | Admin API auth (auto-generated if unset) |

Without any of these, mock mode provides a fully functional demo.

## Making Money

### 1. Hosted SaaS

Charge per agent per month or per token proxied. The virtual key system maps directly to customer tenants:

```
Customer A → gateway namespace → their agents, their provider keys, their budgets
                                 ↓
                          Single OpenAI-compatible endpoint per customer
```

Pricing tiers:
- **Free**: 1 department, 2 agents, mock-only, 7-day log retention
- **Pro**: $200/mo — unlimited agents, real providers, 30-day logs, semantic cache
- **Enterprise**: Custom — dedicated gateway, SSO/SAML, SLA, audit logs, on-prem option

Infrastructure cost per customer is near-zero (just a Postgres row + a few env vars). Margin is high.

### 2. Enterprise License

The code is MIT, but enterprises with 50+ agents will pay for:

- Managed deployment with SLA uptime guarantee
- SSO/SAML integration (Okta, Azure AD)
- 90-day+ audit log retention
- Dedicated support channel
- Custom provider integrations

Price: $5k–$20k/year per deployment.

### 3. Consulting & Setup

Most teams don't want to configure provider keys, train the prompt classifier, or tune cache thresholds. Billable services:

- **Setup workshop** ($2k) — deploy, configure agents, classify their prompts
- **Custom classifier tuning** ($3k) — train keyword/topic routing for their domain
- **Provider optimization** ($1k) — benchmark latency/cost across providers for their use case

### 4. Whitelabel Reseller

Agencies managing AI for clients embed this as their agent management console. You white-label the dashboard, they charge their clients. You charge per resold seat ($50/mo per client org).

## Demo Script (5 minutes)

| Time | What to show |
|---|---|
| 0:00 | Open dashboard, explain Sankey: budget → departments → agents |
| 0:30 | Drag a slider — show proportional normalization, cost update |
| 1:00 | Click "Start Simulation" — watch tokens burn, see alerts fire |
| 1:30 | Send a curl command: `curl -X POST http://localhost:3001/v1/chat/completions -H "Authorization: Bearer swarm-xxx" -d '{"model":"gpt-5.6-terra","messages":[{"role":"user","content":"hello"}]}'` |
| 2:00 | Show the 429 when budget exhausts, explain fallback chain |
| 2:30 | Run `node agents/cli.js list` — show auto-resolved keys |
| 3:00 | Run `node agents/cli.js task "fix this security bug"` — show auto-routing |
| 3:30 | Open `/api/logs`, `/api/cache`, `/api/status` — show observability |
| 4:00 | Add a real API key via Provider Keys panel — show live provider call |
| 4:30 | Sum up: what makes this unique (budget enforcement + multi-provider + routing in one box) |
