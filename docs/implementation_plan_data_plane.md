# Implementation Plan — Data Plane, Swarm, & LLM Integration

We are expanding the frontend prototype to implement the full enterprise vision: the **LLM API Gateway Proxy (Data Plane)**, the **Swarm Agent Simulators**, and **Real-Time Database Sync**.

---

## User Review Required

> [!IMPORTANT]
> **OpenAI API Key requirement:** The Gateway will forward calls to the real OpenAI API if a `OPENAI_API_KEY` env var is present. If it is missing, the Gateway will automatically return a high-fidelity **Mock Chat Completion response** with realistic token counts. This keeps the project completely testable for judges and developers with zero API costs.

> [!IMPORTANT]
> **Server tech stack:** We will build a lightweight Node.js Express server running on port `3001`. It will use a JSON-file-based database (`db.json`) for persistence, ensuring zero external database setup (no PostgreSQL/Redis installations needed for the demo).

---

## Architecture Flow

```
┌─────────────────────────┐               ┌────────────────────────┐
│  ALLOCATOR DASHBOARD    │               │  LLM API GATEWAY       │
│  (React Frontend, 5173) │               │  (Express Server, 3001)│
├─────────────────────────┤               ├────────────────────────┤
│ Slider Changes          │───POST config─▶ Check Budget Limits    │
│ Sankey & Cost Display   │◀──GET status──│ Forward to OpenAI      │
└─────────────────────────┘               └───────────┬────────────┘
                                                      ▲
                                                      │ Intercept
                                                      │ Prompt
                                          ┌───────────┴────────────┐
                                          │  AGENT SWARM           │
                                          │  (Background Simulator)│
                                          └────────────────────────┘
```

---

## Proposed Changes

### 1. Server Folder Structure

We will add a new server module in the workspace:

```text
Agent-Swarm-Token-Allocator/
├── server/
│   ├── package.json
│   ├── index.js               # Express Gateway & Control APIs
│   ├── database.js            # JSON-file database coordinator
│   └── db.json                # Local database store (git-ignored)
└── agents/
    ├── package.json
    └── swarm.js               # Background agent execution loop
```

---

### 2. The Database Schema — `server/db.json`

Stores the active configuration and accumulates token spending:

```json
{
  "totalBudget": 10000000,
  "selectedModel": "gpt-5.6-terra",
  "departments": [
    {
      "id": "engineering",
      "allocation": 40,
      "agents": [
        {"id": "code-review", "allocation": 60},
        {"id": "debug-agent", "allocation": 40}
      ]
    }
  ],
  "usage": {
    "code-review": { "input": 125000, "output": 85000, "total": 210000 },
    "debug-agent": { "input": 50000, "output": 25000, "total": 75000 }
  },
  "simulationActive": false
}
```

---

### 3. LLM API Gateway Endpoints — `server/index.js`

| Method | Endpoint | Description |
|---|---|---|
| **POST** | `/v1/chat/completions` | Intercepts prompt, validates budget limits, forwards to OpenAI (or returns mock response), logs token usage. |
| **POST** | `/api/config` | Saves the budget and department/agent allocation limits. |
| **GET** | `/api/status` | Returns the current allocations, budgets, and aggregated token usage statistics. |
| **POST** | `/api/simulation/toggle` | Toggles the background Agent Swarm simulator script. |
| **POST** | `/api/usage/reset` | Resets cumulative token usage back to 0. |

**Gateway Budget Interception Logic:**
```
For request from Agent X (dept Y):
1. Compute agentMonthlyBudget = totalBudget × (dept% / 100) × (agent% / 100)
2. Get agentUsedTokens = usage[agentId].total
3. If (agentUsedTokens + estimatedPromptTokens) > agentMonthlyBudget:
     Return 429 Too Many Requests (Budget Exceeded)
4. Else:
     Call OpenAI API (or mock)
     Read prompt_tokens and completion_tokens from OpenAI response usage metadata
     Increment usage[agentId] by actual tokens consumed
     Forward OpenAI response back to Agent
```

---

### 4. Agent Swarm Simulator — `agents/swarm.js`

A background execution script that:
- Runs in a loop when `simulationActive === true`.
- Simulates different agents sending requests to `http://localhost:3001/v1/chat/completions`.
- Adds headers identifying the agent (e.g. `X-Agent-ID: code-review`, `X-Department-ID: engineering`).
- Randomly generates prompts and handles potential `429 Budget Exceeded` errors gracefully (logs warning).

---

### 5. Frontend Integration & Telemetry

We will modify the React application to sync with the gateway server:

1. **Vite Proxy Config**: Update `vite.config.js` to proxy `/api/*` and `/v1/*` requests to `http://localhost:3001` to prevent CORS issues.
2. **Initial Hydration**: Fetch current configuration and usage statistics from `/api/status` on mount.
3. **Reactive Updates**: Whenever a slider changes, POST the updated configuration to `/api/config`.
4. **Real-Time Telemetry**: Implement a polling hook (every 1 second) that queries `/api/status` to fetch active token usage. Use this data instead of the mock frontend timer to update the Sankey diagram widths, link flow animations, cost displays, and alerts.
5. **Simulation Trigger**: The "Simulate Live Usage" button will trigger `POST /api/simulation/toggle` so that the server spins up the background agents.

---

## Verification Plan

### Automated Verification
- Verify the server routes run without syntax or execution errors.
- Verify the mock completions return structured usage payload containing `prompt_tokens` and `completion_tokens`.

### Manual Demo Steps
1. Start the server: `node server/index.js`
2. Start the Vite app: `npm run dev`
3. Drag a department slider (e.g. Engineering) to 5%, reducing its budget limit.
4. Click **"Simulate Live Usage"**.
5. Watch the active token count tick up on the metrics panel.
6. The Code Review / Debug Agent should quickly exceed its 5% budget limit, triggering a **429 Budget Exceeded** toast notification on the dashboard and coloring the node red.
7. Click **"Export Config"** and verify the generated JSON reflects the real-time server database state.
