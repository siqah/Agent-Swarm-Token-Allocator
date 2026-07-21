# Implementation Checklist

## Backend — Database & API
- [x] SQLite database with Drizzle ORM
- [x] Schema: users, workflows, agents, runs, run_logs, provider_keys, models, usage, audit_log, config, swarm_keys
- [x] CRUD routes: workflows, runs, provider keys, models, auth, config
- [x] Agents table (per-workflow agent nodes with model/prompt/temperature)
- [x] Workflow save/load includes agents
- [x] Cost endpoint aliases (`/cost/run/:runId`, `/cost/session/:sessionId`)

## Backend — LLM Proxy
- [x] OpenAI-compatible `/v1/chat/completions` proxy
- [x] Multi-provider support (OpenAI, Anthropic, Google, Groq)
- [x] Mock mode when no provider keys set
- [x] Semantic caching (tri-gram similarity, configurable TTL)
- [x] Rate limiting (per-endpoint, per-swarm-key)
- [x] Fallback chains across providers
- [x] Budget enforcement (429 when exhausted)
- [x] SSE streaming support
- [x] Task routing (`POST /v1/swarm/task`)
- [x] Provider health checks

## Backend — Auth & Security
- [x] User registration / login / session management
- [x] Password hashing (bcrypt)
- [x] Swarm API key authentication
- [x] CSRF protection
- [x] CORS configuration
- [x] Helmet security headers

## Frontend — DAG Planner
- [x] React Flow canvas with agent nodes
- [x] Agent library (drag-and-drop templates)
- [x] Agent configuration panel (prompt, model, temperature)
- [x] Edge connections between agents
- [x] Save/load workflows
- [x] Run workflows with SSE streaming
- [x] Run inspector with expand/copy log viewer

## Frontend — Cost Dashboard
- [x] Per-agent token breakdown
- [x] Model-level bar/pie charts (Recharts)
- [x] Cumulative session cost
- [x] Budget threshold indicators
- [x] Total budget bar

## Frontend — Polish
- [x] Loading skeletons (pending)
- [x] Keyboard shortcuts (pending)
- [x] Workflow name validation (pending)
- [x] Tailwind v4 design system with OKLCH tokens
- [x] Responsive layout
- [ ] Keyboard shortcuts (⌘S, ⌘⏎, Delete)
- [ ] Loading skeleton states
- [ ] Workflow name validation (server + client)
