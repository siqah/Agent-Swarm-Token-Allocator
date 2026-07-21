# Production Plan

Current state: hackathon prototype. Target: production SaaS + self-host. Estimated 10–12 weeks for a single senior engineer.

---

## Phase 1 — Hardening (Weeks 1–2)

Make the prototype production-safe without changing architecture.

| Task | Why |
|---|---|
| **Persist sessions** — move from in-memory `Map` to SQLite via the existing `sessions` table schema | Login breaks on restart |
| **Rate-limit auth endpoints** — add `authLimiter` to `/api/register`, `/api/login` | Brute-force attack vector |
| **Structured logging** — add `pino` or `winston` with log levels, file output, JSON format | Can't debug production issues |
| **Error monitoring** — integrate Sentry | Blind to production errors |
| **Provider key validation** — `GET /api/providers/:name/validate` that actually calls the provider with a tiny test prompt | Users add invalid keys silently |
| **Health check endpoint** — `GET /api/health` with DB connectivity, provider status, cache status | Load balancer / k8s probe |
| **Add frontend tests** — Vitest setup for at least the context/reducer logic | No regression safety net |

**Exit criteria:** Clean restart, known error paths are logged and monitored, auth endpoints throttled, provider keys validated on entry, health endpoint responds.

---

## Phase 2 — Foundation (Weeks 3–5)

Architecture changes needed before multi-tenancy or scale.

| Task | Why |
|---|---|
| **Replace SQLite with PostgreSQL** — the single-writer limitation of SQLite blocks horizontal scaling. Use Drizzle's built-in PostgreSQL support; migration should be ~2 days of work. | Scale, concurrency, reliability |
| **Add Redis** — for rate limiting (replace in-memory), session store, and cache backend. Same docker-compose / Helm chart. | Stateless gateway, shared state |
| **Move cache to Redis** — replace the in-memory Map for semantic caching with Redis. `MAX_RESPONSE_SIZE` guard stays. | Cache survives restarts, shared across instances |
| **Move rate limiter to Redis** — replace in-memory counters with Redis-backed sliding window. | Rate limits work across multiple gateway instances |
| **Move sessions to PostgreSQL or Redis** — stop using in-memory Map. | Login survives restart, multi-instance auth |
| **Request log persistence** — replace the in-memory ring buffer with a `request_logs` table in PostgreSQL. | Historical query, debugging, audit |
| **Database migrations** — set up Drizzle Kit migration workflow (generate / push / migrate). | Schema changes are safe and repeatable |
| **Graceful shutdown** — `SIGTERM` handler that drains connections, flushes cache, closes DB. | Zero-downtime deploys |

**Exit criteria:** All state is in PostgreSQL or Redis. Two gateway instances can run behind a load balancer and share state. Migrations are automated. Graceful shutdown works.

---

## Phase 3 — Multi-Tenancy (Weeks 5–7)

Single-org → multi-org.

| Task | Why |
|---|---|
| **Org model** — add `organizations` table. Every user, workflow, run, and config belongs to an `org_id`. | Foundation for billing, isolation, collaboration |
| **Invite system** — org admins can invite users by email. Join via token. | Team collaboration |
| **Row-level isolation** — all queries filter by `org_id` via Drizzle middleware or explicit WHERE. Never leak data across orgs. | Security, compliance |
| **API key scoping** — swarm keys can be scoped to read-only, time-limited, or per-agent. | Fine-grained access control |
| **Audit log** — log every admin action (budget change, key rotation, user invite) to an `audit_log` table with `org_id`, `actor_id`, `action`, `details`. | Compliance, SOC2 |

**Exit criteria:** Two orgs can use the same gateway instance with complete data isolation. Invite flow works. Audit trail is recorded.

---

## Phase 4 — Operations (Weeks 7–9)

Monitoring, billing, and operational tooling.

| Task | Why |
|---|---|
| **Prometheus metrics** — expose `/metrics` with request count, latency histograms, cache hit rate, active sessions, budget exhaustion count. | Grafana dashboards, alerting |
| **Budget alert webhooks** — POST to Slack / Discord / email when a budget crosses warning or hard limit. Current webhook module supports this but needs delivery confirmation and retry. | Proactive notification |
| **Scheduled budget reset** — monthly or quarterly auto-renew of budgets. Cron job or `node-cron` in the server process. | Recurring budgets without manual intervention |
| **Usage forecasting** — simple linear projection based on N-day average burn rate. Show "estimated exhaustion date" on the cost dashboard. | Plan budget refreshes |
| **Stripe billing integration** — per-org subscription tiers (Free / Pro / Enterprise), metered billing based on tokens proxied. | Revenue |

**Exit criteria:** Metrics dashboard operational. Alerts fire correctly. Budgets auto-renew. Basic billing flow works.

---

## Phase 5 — Scale & DX (Weeks 9–12)

Performance, deployment, and developer experience.

| Task | Why |
|---|---|
| **Connection pooling** — use `pg-pool` or Drizzle's built-in pooling for PostgreSQL. | Handle concurrent requests efficiently |
| **Response caching at HTTP level** — add `Cache-Control` headers and an optional CDN (Cloudflare, Fastly) for cacheable GET endpoints. | Reduce load, improve latency |
| **Deployment artifacts** — production `Dockerfile` (multi-stage: build frontend, copy to nginx or serve via Express static), `docker-compose.prod.yml` with PostgreSQL + Redis, Helm chart for Kubernetes. | Easy deploy |
| **Terraform module** — AWS ECS (Fargate) or Google Cloud Run with RDS PostgreSQL, ElastiCache Redis, and CloudFront CDN. | Infrastructure-as-code |
| **Python SDK** — `pip install swarm-sdk` with `SwarmGateway(url, api_key)` class that wraps `/v1/chat/completions` and `/v1/swarm/task`. | Developer adoption |
| **API docs site** — publish the OpenAPI spec as a docs page (Stoplight, Redoc, or custom). | Developer onboarding |
| **Example apps** — Next.js chatbot, FastAPI agent, LangChain integration example. | Show, don't tell |

**Exit criteria:** Production deployment with Terraform. Python SDK published. API docs live. Example apps in the repo.

---

## Effort Summary

| Phase | Weeks | Focus |
|---|---|---|
| 1 — Hardening | 2 | Logging, monitoring, validation, auth rate limiting |
| 2 — Foundation | 3 | PostgreSQL, Redis, stateless gateway, migrations |
| 3 — Multi-tenancy | 2 | Orgs, isolation, audit, key scoping |
| 4 — Operations | 2 | Metrics, alerts, billing, forecasting |
| 5 — Scale & DX | 3 | Deployment, SDK, docs, examples |

**Total: 10–12 weeks for one senior engineer.**

## What Not to Build

These are intentionally excluded from the plan:

- **RAG / vector search** — that's a separate product
- **Agent code execution** — LangChain / CrewAI territory
- **Fine-tuning / model training** — we're a proxy, not a provider
- **Custom model hosting** — vLLM, TGI, etc.
- **Browser-based agent IDE** — too broad, maintain a clear scope
