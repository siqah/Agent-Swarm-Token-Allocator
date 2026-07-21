# Agent Swarm Token Allocator — Pitch

## Problem

Every company building multi-agent AI systems has the same three unsolved problems:

1. **Budget chaos** — Each agent calls LLMs independently. Nobody knows which agent spent what until the bill arrives. No tool to set per-agent budgets and enforce them in real-time.
2. **Provider lock-in without fallback** — Agent A uses GPT-5. When it exhausts its budget or hits rate limits, it fails. No automatic fallback to Claude, Gemini, or Groq.
3. **Scattered key management** — Every provider requires separate API keys. Rotating them means touching every agent. No unified auth layer.

Existing tools solve one piece in isolation: Portkey (observability, SaaS), Helicone (logging, SaaS), LiteLLM (proxy only, no UI), OpenRouter (consumer, no budgets). None combine budget enforcement + multi-provider routing + visual DAG orchestration + operational dashboard in a self-hostable package.

## Solution

An open-core LLM gateway + budget control plane + visual DAG orchestrator that sits between agents and LLM providers:

```
Agents → Virtual Swarm Keys → Gateway → OpenAI / Anthropic / Google / Groq
                                  ↑
                  Dashboard (React Flow canvas + cost charts)
```

**What it does:**

- **Enforces token budgets** — Set allocation per agent. The gateway blocks (429) when an agent exhausts its budget.
- **Routes across providers** — GPT → Claude → Gemini → Groq fallback chain. One endpoint, multiple providers. Load-balanced across keys.
- **Manages keys centrally** — Virtual swarm keys decouple agents from provider keys. Rotate in one place, zero agent downtime.
- **Visual DAG orchestration** — Drag agents onto a canvas, connect them into pipelines, run workflows with parallel branching and SSE streaming.
- **Caches semantically** — Tri-gram similarity cache catches duplicate prompts across agents.
- **Routes by intent** — `POST /v1/swarm/task` auto-classifies and routes to the best-matching agent.
- **Streams responses** — Full SSE streaming, same interface as OpenAI.

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
| LiteLLM | Open-source proxy | No UI, no budget model, no task routing, no DAG orchestration |
| OpenRouter | Consumer gateway | No per-agent budgets, no department hierarchy |

Our differentiation: **budget-aware multi-provider gateway + visual DAG planner + operational dashboard + self-hostable open core** — none of the above combine all four.

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

- Fully functional open-source release
- Multi-provider support: OpenAI, Anthropic, Google, Groq
- Visual DAG workflow editor and execution engine
- Streaming, semantic caching, user auth, task routing all shipped
- Mock mode works out of the box (no API keys needed for evaluation)

## Ask

Seeking $500k–$1M pre-seed to:
- Build hosted SaaS control plane (multi-tenant gateway, billing, org management)
- Add SSO/SAML, audit logging, compliance features
- Hire for enterprise sales and customer onboarding
- Expand provider support (AWS Bedrock, Azure OpenAI, Mistral, Cohere)

**Contact:** [your email]

---

*"Budget enforcement + multi-provider fallback + visual DAG orchestration + operational dashboard — in one box, under your control."*
