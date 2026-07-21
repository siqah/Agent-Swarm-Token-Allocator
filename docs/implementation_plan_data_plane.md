# Implementation Plan — Data Plane, Providers & LLM Integration

## Architecture

```
┌─────────────────┐       ┌──────────────────────┐
│  Frontend        │       │  Express Server:3001 │
│  :5173           │──────▶│                      │
│  React Flow DAG  │◀──────│  /v1/chat/completions│
│  Cost Dashboard  │  SSE  │  /v1/swarm/task      │
│  Run Inspector   │       │  /api/workflows      │
└─────────────────┘       │  /api/runs            │
                           │  /api/cost/*          │
                           │  /api/providers/*     │
                           │  /api/auth/*          │
                           └──────────┬───────────┘
                                      │
                           ┌──────────┴───────────┐
                           │  Provider Layer       │
                           │  OpenAI / Anthropic   │
                           │  Google / Groq        │
                           │  Mock fallback        │
                           └──────────────────────┘
```

## Key Design Decisions

### Database: SQLite (not JSON file)
- `better-sqlite3` for synchronous, fast local storage
- Drizzle ORM for typed queries without heavy overhead
- No external dependencies (PostgreSQL, Redis) — zero-config startup

### Mock Mode
- When no provider keys are loaded, all LLM calls return structured mock responses
- Realistic token counts, finish reasons, response text
- No API keys needed to demo the full product

### Provider Interface
Each provider implements `call()` and `stream()`:
```
call({ model, messages, temperature, key }) → { id, choices, usage }
stream({ model, messages, temperature, key }) → AsyncIterable<chunk>
```

### Cache Layer
- Semantic caching based on tri-gram similarity
- Configurable threshold and TTL
- Cache stats exposed via `/api/cache`
- `MAX_RESPONSE_SIZE` guard to prevent oversized cached entries

### Rate Limiting
- Per-endpoint configurable limits (`apiLimiter`, `controlPlaneLimiter`, `swarmKeyLimiter`)
- In-memory using `bottleneck`-style queues
- 429 responses with `Retry-After` headers

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/chat/completions` | OpenAI-compatible proxy |
| POST | `/v1/swarm/task` | Auto-classify and route prompts |
| GET | `/api/workflows` | List saved workflow DAGs |
| POST | `/api/workflows` | Save a new workflow |
| PUT | `/api/workflows/:id` | Update a workflow |
| GET | `/api/workflows/:id` | Get workflow with agents |
| GET | `/api/runs` | List execution history |
| GET | `/api/runs/:id` | Get run details with logs |
| POST | `/api/runs` | Execute a workflow |
| GET | `/api/runs/:id/stream` | SSE stream for a run |
| GET | `/api/cost/run/:runId` | Run cost breakdown |
| GET | `/api/cost/session/:sessionId` | Session cost total |
| GET | `/api/providers` | Provider status and keys |
| POST | `/api/providers/:name/keys` | Add a provider key |
| DELETE | `/api/providers/:name/keys` | Remove a provider key |
| GET | `/api/models` | List available models |
| GET | `/api/models/sync` | Sync models from OpenRouter |
| GET | `/api/cache` | Cache stats |
| GET | `/api/status` | Server health |
| POST | `/api/register` | Register user |
| POST | `/api/login` | Log in |
| POST | `/api/logout` | Log out |

## SSE Streaming Protocol

```
GET /api/runs/:id/stream

data: {"type":"agent_start","agentId":"node-1","agentName":"Code Reviewer"}
data: {"type":"token","agentId":"node-1","text":"Analyzing..."}
data: {"type":"agent_complete","agentId":"node-1","output":"...","tokens":450}
data: {"type":"run_complete","runId":"run-abc","totalTokens":1200,"totalCost":0.03}
```

## Testing

```bash
# Frontend tests
npm test

# Server tests
npm test --prefix server
```

Server tests use Node's built-in test runner. Client tests use Vitest + jsdom.
