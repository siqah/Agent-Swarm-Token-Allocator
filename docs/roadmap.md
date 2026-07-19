# Roadmap — What's Missing

## Now (shippable as-is)

The project works end-to-end. A team can `docker compose up` and immediately manage agent budgets across multiple providers. Everything below is additive — nothing is broken.

## Short-term (next 2 weeks)

| Area | What's missing | Why it matters |
|---|---|---|
| **Persistence** | Session tokens are in-memory (lost on restart). Users table isn't persisted in PostgreSQL. | Login breaks after server restart. Can't run in production. |
| **DB migrations** | No migration for users table in `migrations/001_initial.sql`. | PostgreSQL mode doesn't persist users. |
| **Rate limiting** | Auth endpoints (`/api/register`, `/api/login`) have no rate limiting. | Brute-force attack vector. |
| **Error monitoring** | No Sentry or similar integration. | Blind to production errors. |
| **Logging** | Logger writes to stdout only. No structured log files or log levels for production. | Can't debug production issues. |
| **Provider health** | No endpoint to check if a provider key is valid. Keys are accepted without validation. | Users can add invalid keys silently. |

## Medium-term (next month)

### Multi-tenancy
- Org/workspace model — multiple teams on one gateway
- Per-tenant isolation in database
- Invite users to org (collaboration)
- Per-tenant billing tier enforcement

### Observability & Alerts
- Usage analytics dashboard (token burn over time, cost trends by department/agent)
- Exportable reports (CSV/PDF monthly summaries)
- Webhook/slack/email alerts when budgets cross thresholds
- Prometheus metrics + Grafana dashboard
- Audit log for all admin actions (who changed what budget when)

### Security
- CSRF protection on dashboard endpoints
- API key scoping (read-only, time-limited, per-agent)
- Session refresh / rotation
- HTTPS by default in Docker Compose (Let's Encrypt)

### Developer Experience
- TypeScript types package (`@swarm/types`)
- Python SDK (`pip install swarm-sdk`)
- Comprehensive API docs site (not just openapi.yml)
- Rate limit headers in responses (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Example apps — Next.js, FastAPI, LangChain integration

## Long-term (next quarter)

### Infrastructure
- Terraform module (AWS ECS / Google Cloud Run)
- Kubernetes Helm chart
- Backup/restore scripts for database
- Migration from JSON file to PostgreSQL only (remove single-node limitation)

### Features
- Scheduled budget reset (monthly/quarterly cycles auto-renew)
- Cost allocation tagging (chargeback to teams or clients)
- Model-level pricing overrides (discounts, markups)
- Per-agent provider selection (not just model-based routing)
- Usage forecasting (predict when budgets will exhaust)
- Prompt template management (save/reuse prompts per agent)
- A/B testing across models (compare cost + quality per prompt)
- Custom classifier training UI (tune keyword routing from dashboard)

### Scale
- Horizontal scaling for gateway (stateless, share DB + cache)
- Redis-backed rate limiting (replace in-memory)
- PostgreSQL-backed sessions (replace in-memory Map)
- Request log persistence to database (replace ring buffer)

## Never (explicitly out of scope)

- Building our own LLM — we're a proxy, not a provider
- Vector database for RAG — not a knowledge management tool
- Agent orchestration (LangChain, CrewAI territory) — we route and budget, we don't run workflows
- Model training or fine-tuning
