# ⚡ Swarm Control — Agent Token Allocator

> **An interactive dashboard for managing LLM token budgets across AI agent fleets.**  
> Built for [OpenAI Build Week](https://openai.com) using React, D3.js Sankey diagrams, and Codex as our pair programmer.

---

## 🎯 What It Does

As companies deploy multiple AI agents (Code Review, Marketing, Data Analysis), managing how much compute each agent consumes is becoming a massive problem. **Swarm Control** solves this with:

- **🖥️ Interactive Sankey Diagram** — Visualize token flow from your monthly budget → departments → individual agents
- **🎚️ Proportional Sliders** — Drag to reallocate. Other sliders auto-normalize so the total always equals 100%
- **💰 Real-Time Cost Tracking** — See dollar costs update instantly based on OpenAI model pricing (Sol, Terra, Luna, Nano)
- **🚨 Threshold Alerts** — Agents crossing 80% allocation trigger amber warnings; 95% triggers red danger alerts with toast notifications
- **📤 JSON Config Export** — Download a config file that a real orchestrator could ingest
- **▶ Live Simulation** — Watch tokens burn down in real-time with animated Sankey flows

## 🏗️ Enterprise Architecture Vision

This dashboard is **Phase 1** (the Control Plane) of a full enterprise system:

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. CONTROL PLANE (This Dashboard)                              │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │ Slider UI    │───▶│ Sankey Viz    │    │ JSON Config      │  │
│  │ (React)      │    │ (D3.js)       │    │ (Export)         │  │
│  └──────────────┘    └───────────────┘    └────────┬─────────┘  │
├────────────────────────────────────────────────────┼────────────┤
│  2. DATA PLANE (Enterprise Proxy)                  ▼            │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │ Management   │◀──▶│ Redis/PG      │◀──▶│ Token Counter    │  │
│  │ API          │    │ Database      │    │ & Rate Limiter   │  │
│  └──────────────┘    └───────────────┘    └────────┬─────────┘  │
├────────────────────────────────────────────────────┼────────────┤
│  3. AGENT SWARM                                    │            │
│  🔧 Code Review  📢 Marketing  💼 Sales  📊 Ops   │            │
│      All agents route through the gateway ─────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  4. LLM PROVIDER                                                │
│  OpenAI GPT-5.6 Sol / Terra / Luna / Nano APIs                  │
└─────────────────────────────────────────────────────────────────┘
```

**How it works at scale:**

1. Manager sets budgets in the dashboard → generates `config.json`
2. Agents call your **LLM Gateway** (not OpenAI directly)
3. Gateway checks token budget → **approve** (forward to OpenAI) or **block** (429 Budget Exceeded)
4. Gateway logs usage → Dashboard reads DB → Sankey updates in real-time

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/your-team/Agent-Swarm-Token-Allocator.git
cd Agent-Swarm-Token-Allocator

# Install dependencies
npm install

# Start the dev server
npm run dev
# → Open http://localhost:5173
```

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Framework | React 19 | Component architecture, reactive state |
| Build | Vite 6 | <1s dev server, instant HMR |
| Visualization | D3.js v7 + d3-sankey | Sankey layout computation |
| Styling | Vanilla CSS + CSS Modules | OKLCH design tokens, glassmorphism |
| Fonts | Inter + JetBrains Mono | Body + monospace typography |
| State | useReducer + Context | Proportional normalization logic |
| Cost Engine | Custom calculator | Token × price per model |
| Export | Blob API | Client-side JSON download |

## 📁 Project Structure

```text
src/
├── context/          # AllocationContext (state) + CostContext (derived costs)
├── hooks/            # useSankeyLayout, useAlerts, useSimulation
├── components/
│   ├── sankey/       # SankeyDiagram, SankeyNode, SankeyLink, SankeyTooltip
│   ├── controls/     # SliderGroup, AllocationSlider, BudgetInput, ModelSelector
│   ├── feedback/     # CostCard, AlertToast, AlertBadge, ExportButton
│   └── layout/       # Header, Sidebar, MetricsPanel
├── utils/            # costCalculator, exportConfig, formatters
├── data/             # defaultConfig (4 dept × 2 agents), pricing (4 models)
└── styles/           # tokens.css, global.css, layout.css, animations.css
```

## 🤖 The Codex Story

> *"We used Codex as our pair programmer to generate the complex D3.js SVG calculations and mathematical normalizations for the slider state, cutting our frontend development time from 3 days to 4 hours."*

Key areas where Codex accelerated development:

- **D3 Sankey math** — SVG path computation, layout algorithms, gradient rendering
- **Normalization algorithm** — Ensuring slider groups always sum to exactly 100%
- **Cost engine** — Token-to-dollar conversion with configurable input/output ratios
- **Responsive architecture** — 3-breakpoint grid layout system

## 📄 License

MIT — Built for OpenAI Build Week 2026.
