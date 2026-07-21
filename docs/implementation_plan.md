# Implementation Plan — Agent Swarm Token Allocator

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                   Frontend (Vite + React 19)          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ DAG       │  │ Cost     │  │ Run                │  │
│  │ Canvas    │  │ Dashboard│  │ Inspector          │  │
│  │ (React    │  │ (Recharts│  │ (Log viewer +      │  │
│  │  Flow)    │  │  charts) │  │  expand/copy)      │  │
│  └─────┬─────┘  └────┬─────┘  └─────────┬──────────┘  │
│        │              │                  │             │
│        └──────────────┴──────────────────┘             │
│                          │ /api/* /v1/*                │
└──────────────────────────┼────────────────────────────┘
                           │ Vite proxy (:5173 → :3001)
┌──────────────────────────┼────────────────────────────┐
│                   Backend (Express + SQLite)           │
│                          │                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LLM Gateway Proxy                               │  │
│  │  /v1/chat/completions → OpenAI / Anthropic / ... │  │
│  │  POST /v1/swarm/task (auto-classify + route)     │  │
│  │  Semantic cache, rate limiter, fallback chains   │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │  DAG Execution Engine                            │  │
│  │  Topological sort (Kahn's algorithm)             │  │
│  │  Parallel level execution, SSE streaming         │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │  SQLite (better-sqlite3 + Drizzle ORM)           │  │
│  │  Workflows, runs, agents, usage, auth            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | React 19 |
| Build tool | Vite 8 |
| Styling | Tailwind v4 |
| DAG canvas | React Flow (@xyflow/react 12) |
| Charts | Recharts |
| Backend | Express (Node.js) |
| Database | SQLite via better-sqlite3 |
| ORM | Drizzle ORM |
| LLM providers | OpenAI, Anthropic, Google, Groq |
| Proxy format | OpenAI-compatible `/v1/chat/completions` |
| Linter | oxlint (0.5s lint) |

## Project Structure

```
Agent-Swarm-Token-Allocator/
├── src/                          # Frontend (React + Vite)
│   ├── main.jsx
│   ├── App.jsx
│   ├── context/WorkflowContext.jsx
│   ├── components/
│   │   ├── canvas/               # DAG planner components
│   │   │   ├── AgentLibrary.jsx
│   │   │   ├── AgentNode.jsx
│   │   │   ├── AgentConfigPanel.jsx
│   │   │   └── WorkflowCanvas.jsx
│   │   ├── cost/CostDashboard.jsx
│   │   ├── inspector/RunInspector.jsx
│   │   └── layout/Header.jsx
│   └── index.css                 # Tailwind entry
├── server/                       # Backend (Express + SQLite)
│   ├── index.js                  # Entry point, routes, middleware
│   ├── db/
│   │   ├── index.js              # SQLite init + raw SQL
│   │   ├── schema.js             # Drizzle schema
│   │   └── queries.js            # Query functions
│   ├── lib/                      # Libraries
│   │   ├── cache.js              # Semantic caching
│   │   ├── encrypt.js            # Key encryption
│   │   ├── auth.js               # User auth
│   │   ├── logger.js             # Logging
│   │   ├── metrics.js            # Prometheus metrics
│   │   ├── rateLimiter.js        # Rate limiting
│   │   ├── validate.js           # Request validation
│   │   ├── webhook.js            # Alert webhooks
│   │   ├── classifier.js         # Prompt classifier
│   │   └── csrf.js               # CSRF protection
│   ├── providers/                # LLM provider implementations
│   │   ├── index.js              # Provider registry
│   │   ├── openai.js
│   │   ├── anthropic.js
│   │   ├── google.js
│   │   └── groq.js
│   ├── routes/
│   │   ├── workflows.js
│   │   └── runs.js
│   └── engine/
│       ├── executor.js           # DAG execution engine
│       └── graph.js              # Graph utilities
├── docs/                         # Documentation
│   ├── roadmap.md
│   ├── pitch.md
│   ├── demo.md
│   ├── demo-quickstart.md
│   ├── gotometer.md
│   └── ...
└── README.md
```

## State Management

Frontend uses `WorkflowContext` (React Context + `useReducer`) for workflow state: nodes, edges, current run, SSE streaming. Workflow fetch/save/execute are async actions within the context.

## DAG Execution Engine

The engine in `server/engine/executor.js`:
1. Accepts a workflow graph (nodes + edges)
2. Builds adjacency list and in-degree map
3. Runs Kahn's algorithm: processes nodes with in-degree 0 in parallel levels
4. Passes previous agent outputs as context to downstream agents
5. Streams results back via SSE as each agent completes

## Build Pipeline

```bash
npm run dev          # Vite dev server (:5173) with API proxy
npm run build        # Production build → dist/
npm run lint         # oxlint check (all files in ~0.5s)
npm run test         # Vitest (frontend unit tests)
npm test --prefix server  # Node test runner (server tests)
```
