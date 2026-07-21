# Demo Quickstart — Mock & Real

## One command, mock mode

```bash
# Terminal 1: Backend
cd server && npm install && npm start

# Terminal 2: Frontend
npm install && npm run dev
```

Dashboard at `http://localhost:5173`, gateway at `http://localhost:3001`.

No API keys needed. Everything works:
- Visual DAG planner with drag-and-drop agents
- Workflow execution with SSE streaming
- Cost dashboard with per-agent token breakdown
- Run inspector with expand/copy logs
- Budget enforcement and alerts
- Task routing via `/v1/swarm/task`
- Request logs, cache stats, provider key management
- All endpoints return realistic mock data

## Add real providers live (no restart)

While the dashboard is running, add a provider key:

```bash
# Get the admin token
TOKEN=$(curl -s http://localhost:3001/api/init | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token")

# Add an OpenAI key
curl -X POST http://localhost:3001/api/providers/openai/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "sk-your-real-key"}'
```

Or use the dashboard UI: open Provider Keys panel and click Add Key.

Once a key is added, the gateway switches from mock to real automatically. Same endpoints — responses now come from the actual LLM.

## Demo flow

| Step | What happens |
|---|---|
| `npm run dev & npm start --prefix server` | Starts in mock mode |
| Open dashboard, drag agents onto canvas | Build a workflow DAG |
| Click Run | SSE streams mock responses |
| Open cost dashboard | Token breakdown and charts |
| Add a provider key via API or UI | Live provider activated instantly |
| Send chat requests through the proxy | Hits real LLM through the gateway |

## How mock/real switching works

The gateway checks provider availability per-request:

- **No provider keys loaded** — mock responses (canned text + fake token counts)
- **Provider key loaded** — real API call with budget enforcement, caching, fallback
- **Key removed** — falls back to mock automatically

No config files, no restart, no reload. Instant and per-provider.
