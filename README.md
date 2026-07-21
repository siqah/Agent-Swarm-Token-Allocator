# Agent Swarm Token Allocator

A self-hosted **LLM gateway + multi-agent orchestrator + cost control plane** — one box that routes, budgets, and visualises every LLM call across your agent fleet.

```
Planner Canvas (React Flow) → DAG Executor → Gateway Proxy → OpenAI / Anthropic / Google / Groq
                                                              ↑
Real-Time SSE Output Streaming & Cost Dashboard ─────────────┘
```

## What it solves

| Problem | Solution |
|---|---|
| **No per-agent budget control** | Set token budgets per agent, enforce them in real-time (429 when exhausted) |
| **Provider lock-in** | One endpoint → GPT → Claude → Gemini → Groq fallback chain. Load-balanced across keys. |
| **Key sprawl** | Virtual swarm keys decouple agents from provider keys. Rotate in one place. |
| **No observability** | Live cost breakdowns, token usage charts, per-run agent logs |
| **No multi-agent orchestration** | Visual DAG editor to chain agents, pass outputs, run parallel branches |

## Quick Start

```bash
# Terminal 1: Backend (port 3001)
cd server && npm install && npm start

# Terminal 2: Frontend (port 5173)
cd .. && npm install && npm run dev
```

Open `http://localhost:5173`. Everything works in **mock mode** — no API keys needed.

## Features

- **Visual DAG Planner** — Drag agents onto a React Flow canvas, connect them into pipelines, configure prompts/models/temperature. Save & load workflows to SQLite.
- **Swarm Execution Engine** — Runs workflow graphs in topological order (Kahn's algorithm), passes outputs between agents, supports parallel branches, streams results via SSE.
- **Cost Dashboard** — Per-agent token breakdown, model-level bar/pie charts, cumulative session cost, budget threshold alerts.
- **Multi-Provider Proxy** — OpenAI-compatible `/v1/chat/completions` endpoint routing across OpenAI, Anthropic, Google, and Groq with semantic caching, rate limiting, and fallback chains.
- **Provider Key Management** — Add/rotate/remove provider keys via UI or API. Mock mode falls back automatically when no keys are set.

## Quick Links

| Endpoint | Purpose |
|---|---|
| `GET /v1/chat/completions` | OpenAI-compatible proxy |
| `POST /v1/swarm/task` | Auto-classify and route prompts |
| `GET /api/workflows` | Saved DAG workflows |
| `GET /api/runs` | Execution history |
| `GET /api/cost/session/:sessionId` | Session token cost |
| `GET /api/providers` | Provider & key status |

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, Tailwind v4, React Flow, Recharts |
| Backend | Express, better-sqlite3, Drizzle ORM |
| AI Providers | OpenAI, Anthropic, Google, Groq (mock mode by default) |

## License

MIT
