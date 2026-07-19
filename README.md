# Agent Swarm Token Allocator

Full-stack LLM gateway + budget control plane for multi-agent fleets. Set budgets in a Sankey dashboard — agents call the gateway, which enforces allocation, routes across providers, caches semantically, and handles fallback when one model exhausts its budget.

```
Manager sets budgets → Dashboard (React) → Gateway (Express) → OpenAI / Anthropic / Google / Groq
                                                                      ↑
Agents call via SDK → swarm-xxx key, gateway checks token budget ─────┘
```

## Features

| Layer | Capabilities |
|---|---|
| **Dashboard** | Sankey diagram, proportional sliders, live token simulation, cost tracking, threshold alerts, JSON config export/import, request logs, provider key management |
| **Gateway API** | `POST /v1/chat/completions` (OpenAI-compatible), `POST /v1/swarm/task` (auto-routing), streaming SSE, semantic cache, rate limiting, Prometheus metrics |
| **Multi-Provider** | OpenAI, Anthropic, Google, Groq — each with `call()` and `stream()`. Model→provider routing by prefix, cross-provider fallback chain |
| **Budget Enforcement** | Department→agent percentage tree. Per-key budget overrides. Real-time blocking at 429 when exhausted |
| **Auth** | User registration/login (scrypt password hashing, session tokens). Department-scoped key access. Control plane token for admin endpoints |
| **Virtual Keys** | CRUD for swarm keys, regenerate single/all, budget override set/remove. Load-balanced key rotation across provider keys |
| **Semantic Cache** | Tri-gram embedding + cosine similarity (0.85 threshold). Exact MD5 match (5min TTL). Configurable via env |
| **Streaming** | SSE chunks forwarded from provider, usage tracked on final chunk, `X-Fallback-*` headers |
| **Task Routing** | `POST /v1/swarm/task` classifies prompt by keyword matching against agent name/description, routes to best agent |
| **SDK** | `agents/` package — `Agent` class with `.chat()`, `.stream()`, `.task()`. CLI: `swarm-agent list`, `swarm-agent run <name> "<prompt>"` |
| **Infrastructure** | Docker Compose (app + API + Postgres), nginx with CSP + SSE proxy, CI pipeline, health checks |

## Quick Start

```bash
npm install && npm run dev            # Frontend at :5173
npm install --prefix server           # Server at :3001
echo "OPENAI_API_KEY=sk-..." > server/.env
npm start --prefix server
```

Open `http://localhost:5173` — the dashboard auto-connects to the gateway.

## Project Structure

```
├── src/                   React dashboard (Vite)
│   ├── components/        controls/, feedback/, layout/, sankey/
│   ├── context/           AllocationContext, CostContext
│   ├── utils/             costCalculator, export/import config, formatters
│   └── styles/            CSS modules + design tokens
├── server/                Express API gateway
│   ├── index.js           routes, streaming, budget logic
│   ├── lib/               auth, cache, classifier, logger, metrics, rateLimiter, validate
│   ├── database.js        JSON + PostgreSQL persistence
│   └── providers/         openai, anthropic, google, groq + routing/fallback
├── agents/                Developer SDK (Agent class + CLI)
│   ├── index.js           Agent: .chat(), .stream(), .task()
│   └── cli.js             swarm-agent list/run/task/chat
├── docs/                  Implementation plans, OpenAPI spec
└── infra/                 Docker, nginx config
```

## SDK Usage

```js
import { Agent } from './agents/index.js';

const coder = new Agent({ name: 'Coder Agent' });
const reply = await coder.chat('Write a React hook');
```

```bash
SWARM_KEY=swarm-xxx node agents/cli.js chat "hello"
```

## API

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /v1/chat/completions` | Swarm key | OpenAI-compatible chat, streaming supported |
| `POST /v1/swarm/task` | Swarm key | Auto-classify prompt, route to best agent |
| `POST /api/register` | — | Create user account |
| `POST /api/login` | — | Login, get session token |
| `GET /api/user/keys` | Session | List keys scoped to user's department |
| `GET/POST /api/keys` | Control token | CRUD virtual swarm keys |
| `GET/POST/DELETE /api/providers/:name/keys` | Control token | Manage provider API keys |
| `GET /api/status` | — | Full config + usage snapshot |
| `GET /api/stream` | — | Server-sent events for live dashboard updates |
| `GET /api/logs` | Control token | Request log ring buffer |
| `GET /api/cache` | Control token | Cache hit/miss stats |

Full OpenAPI spec at `docs/openapi.yml`.

## License

MIT
