# LLM Gateway & Agent Swarm Visual Planner

An LLM Gateway with a drag-and-drop Visual Planner canvas (React Flow), agent swarm DAG orchestration engine, and real-time token cost control.

```
Planner Canvas (React Flow) → DAG Executor (Topological Sort + Parallel Level Execution) → Gateway Proxy → OpenAI / Anthropic / Google / Groq
                                                                                               ↑
Real-Time SSE Output Streaming & Cost Breakdown Dashboard ─────────────────────────────────────┘
```

## Features

- **Visual Planner Canvas**: Drag & drop agent nodes from the template library, connect with edges to create DAG workflows, configure system prompts, model choice, and temperature sliders. Save & load workflows as JSON in SQLite.
- **Agent Swarm Orchestration Engine**: Executes workflow graphs in topological order using Kahn's algorithm, passes previous agent outputs as context to downstream agents, supports parallel execution for independent branching paths, and streams real-time SSE outputs to the UI.
- **Token Cost Breakdown Dashboard**: Tracks tokens per agent and per workflow run, displays cost breakdown by model with visual Recharts bar & pie charts, shows cumulative session cost, and sets per-agent budget alerts (e.g. 80% warning threshold).
- **Multi-Provider LLM Gateway Proxy**: OpenAI-compatible `/v1/chat/completions` proxy routing across OpenAI, Anthropic, Google, and Groq, with semantic caching, rate limiting, and fallback chains.

## Quick Start

```bash
# Terminal 1: Backend API
cd server
npm install
npm start                       # Running at :3001

# Terminal 2: Frontend UI
npm install
npm run dev                     # Running at :5173
```

Open `http://localhost:5173` to launch the Planner UI & Canvas.

## Database Schema (SQLite + Drizzle ORM)

- `workflows`: `id`, `name`, `graph_json`, `created_at`, `updated_at`
- `runs`: `id`, `workflow_id`, `status`, `total_tokens`, `total_cost`, `started_at`, `completed_at`
- `run_logs`: `id`, `run_id`, `agent_node_id`, `agent_name`, `model`, `system_prompt`, `input_tokens`, `output_tokens`, `total_tokens`, `cost`, `response_text`, `status`, `error_message`

## License

MIT
