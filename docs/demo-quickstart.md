# Demo Quickstart — Mock & Real

## One command, mock mode

```bash
docker compose up -d
```

Dashboard at `http://localhost:80`, gateway at `http://localhost:3001`.

No API keys needed. Everything works:
- Sankey with live simulation
- Budget enforcement (429 blocks)
- Fallback chains
- Task routing
- Request logs, cache stats
- All API endpoints return realistic mock data

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

Once a key is added, the gateway switches from mock to real automatically. Same swarm keys, same endpoints — responses now come from the actual LLM.

## Demo flow

| Step | What happens |
|---|---|
| `docker compose up -d` | Starts in mock mode |
| Open dashboard, Start Simulation | Mock tokens burn, Sankey animates |
| Add a provider key via API or UI | Live provider activated instantly |
| Send chat requests with swarm keys | Hits real LLM through the gateway |
| Keep simulation running | Mixes mock + real seamlessly |

## How mock/real switching works

The gateway checks provider availability per-request:

- **No provider keys loaded** — mock responses (canned text + fake token counts)
- **Provider key loaded** — real API call with budget enforcement, caching, fallback
- **Key removed** — falls back to mock automatically

No config files, no restart, no reload. The switch is instant and per-provider.
