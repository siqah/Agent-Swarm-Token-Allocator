# Agent Swarm Token Allocator — Pitch

## Problem

Every company building multi-agent AI systems has the same three unsolved problems:

1. **Budget chaos** — Each agent calls LLMs independently. Nobody knows which agent spent what until the bill arrives. There is no tool to set per-agent budgets and enforce them in real-time.
2. **Provider lock-in without fallback** — Agent A uses GPT-5. When it exhausts its budget or hits rate limits, it fails. There's no automatic fallback to Claude, Gemini, or Groq.
3. **Scattered key management** — Every provider requires separate API keys. Rotating them means touching every agent. There's no unified auth layer.

Existing tools solve one piece in isolation: Portkey (observability, SaaS), Helicone (logging, SaaS), LiteLLM (proxy only, no UI), OpenRouter (consumer, no budgets). None combine budget enforcement + multi-provider routing + operational dashboard in a self-hostable package.

## Solution

An open-core LLM gateway + budget control plane that sits between agents and LLM providers:

```
Agents → Virtual Swarm Keys → Gateway → OpenAI / Anthropic / Google / Groq
                                  ↑
                         Dashboard (React + D3 Sankey)
```

**What it does:**

- **Enforces token budgets** — Set allocation per department and per agent via a Sankey dashboard. The gateway blocks (429) when an agent exhausts its budget.
- **Routes across providers** — GPT → Claude → Gemini → Groq fallback chain. One endpoint, multiple providers. Load-balanced across API keys.
- **Manages keys centrally** — Virtual swarm keys decouple agents from provider keys. Rotate provider keys in one place, zero agent downtime.
- **Caches semantically** — Tri-gram similarity cache catches duplicate prompts across agents. Configurable threshold and TTL.
- **Routes by intent** — `POST /v1/swarm/task` auto-classifies prompts and routes to the best-matching agent.
- **Streams responses** — Full SSE streaming support, same interface as OpenAI.

## Market

The LLM gateway market is growing with the agent ecosystem:

| Segment | Size | Need |
|---|---|---|
| Companies with 5+ AI agents | Thousands globally | Budget control, observability |
| AI-native startups | Hundreds | Multi-provider fallback, key management |
| Enterprises deploying AI | Rapidly growing | Compliance, audit, SSO, self-hosting |

Competitive landscape:

| Product | Type | Weakness vs us |
|---|---|---|
| Portkey | SaaS proxy | No budget enforcement, no self-host, no dashboard |
| Helicone | Observability | Observability only, no routing or enforcement |
| LiteLLM | Open-source proxy | No UI, no budget model, no task routing |
| OpenRouter | Consumer gateway | No per-agent budgets, no department hierarchy |

Our differentiation: **budget-aware multi-provider gateway + operational dashboard + self-hostable open core** — none of the above combine all three.

## Business Model

Open-core (MIT) with commercial offerings:

| Tier | Price | What |
|---|---|---|
| Open source | Free | Self-host, MIT license, all core features |
| Cloud (SaaS) | $200/mo Pro | Managed gateway, 30-day logs, priority support |
| Enterprise | $5k–$20k/yr | SSO, SLA, audit logs, dedicated support, on-prem |
| White-label | $50/mo per org | Reseller program for agencies |

Revenue drivers: managed hosting (high margin, low infrastructure cost per customer) + enterprise licensing (predictable annual contracts).

## Traction

- Fully functional open-source release with 87 passing tests (32 server + 55 frontend)
- Multi-provider support: OpenAI, Anthropic, Google, Groq
- Streaming, semantic caching, user auth, task routing all shipped
- Docker Compose one-liner deploy with mock mode (no API keys needed for evaluation)
- Developer SDK with Agent class and CLI

## Ask

Seeking $500k–$1M pre-seed to:

- Build hosted SaaS control plane (multi-tenant gateway, billing, org management)
- Add SSO/SAML, audit logging, compliance features
- Hire for enterprise sales and customer onboarding
- Expand provider support (AWS Bedrock, Azure OpenAI, Mistral, Cohere)

**Contact:** [your email]

---

*"Budget enforcement + multi-provider fallback + operational dashboard — in one box, under your control."*
