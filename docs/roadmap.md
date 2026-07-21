# Roadmap

## Shipped (current state)

The project works end-to-end. A team can `npm install && npm start` and immediately manage agent budgets across multiple providers with a drag-and-drop DAG planner.

- [x] Visual DAG planner (React Flow canvas, save/load workflows)
- [x] Swarm execution engine (topological sort, parallel branches, SSE streaming)
- [x] Multi-provider proxy (OpenAI, Anthropic, Google, Groq)
- [x] Token cost dashboard (per-agent, per-run, session totals)
- [x] Provider key management (UI + API, mock fallback)
- [x] Semantic caching with configurable TTL
- [x] Rate limiting (per-endpoint, per-swarm-key)
- [x] User auth (register/login/session)
- [x] SQLite persistence (Drizzle ORM)
- [x] Task routing (`POST /v1/swarm/task`)
- [x] Alert webhooks (budget threshold notifications)
- [x] Provider health checks

## Short-term (next 2 weeks)

| Area | What |
|---|---|
| **Persistence** | Session tokens currently in-memory (lost on restart) |
| **Rate limiting** | Auth endpoints (`/api/register`, `/api/login`) have no rate limiting |
| **Error monitoring** | No Sentry or similar integration |
| **Logging** | Logger writes to stdout only — no structured files or log levels |
| **Provider health** | No endpoint to check if a provider key is valid before use |

## Medium-term (next month)

- Multi-tenancy with org/workspace model
- Usage analytics dashboard (cost trends over time)
- Exportable reports (CSV/PDF)
- Webhook/Slack/email budget alerts
- Prometheus metrics + Grafana
- Audit log for all admin actions
- CSRF protection on dashboard endpoints
- API key scoping (read-only, time-limited)
- Session refresh / rotation

## Long-term (next quarter)

- Horizontal scaling (stateless gateway, shared DB + Redis)
- Redis-backed rate limiting
- PostgreSQL-backed sessions
- Request log persistence to database
- Scheduled budget reset (monthly/quarterly auto-renew)
- Cost allocation tagging (chargeback to teams)
- Model-level pricing overrides
- A/B testing across models
- Prompt template management
- Custom classifier training UI
- Terraform module (AWS ECS / Google Cloud Run)
- Kubernetes Helm chart
- Python SDK

## Out of scope

- Building our own LLM — we're a proxy, not a provider
- Vector database / RAG — not a knowledge management tool
- Agent code execution (LangChain, CrewAI territory) — we route, budget, and orchestrate DAGs
- Model training or fine-tuning
