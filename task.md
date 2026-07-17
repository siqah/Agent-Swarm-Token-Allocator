# Agent Swarm Token Allocator — Tasks

## Phase 1: Foundation (Core Sankey + Sliders)
- [x] 1.1 Scaffold React + Vite project
- [x] 1.2 Design system (`tokens.css`, `global.css`, `animations.css`)
- [x] 1.3 Default config data (`defaultConfig.js`)
- [x] 1.4 State management (`AllocationContext.jsx`)
- [x] 1.5 Sankey layout hook (`useSankeyLayout.js`)
- [x] 1.6 Sankey components (`SankeyDiagram`, `SankeyNode`, `SankeyLink`, `SankeyTooltip`)
- [x] 1.7 Slider controls (`SliderGroup`, `AllocationSlider`)
- [x] 1.8 App shell + layout components (`App.jsx`, `Header`, `Sidebar`, `MetricsPanel`)

## Phase 2: Intelligence (Cost + Alerts)
- [x] 2.1 Pricing data (`pricing.js`)
- [x] 2.2 Cost calculator (`costCalculator.js`)
- [x] 2.3 Cost context (`CostContext.jsx`)
- [x] 2.4 Cost cards (`CostCard.jsx`)
- [x] 2.5 Alert hook (`useAlerts.js`)
- [x] 2.6 Alert components (`AlertToast.jsx`)
- [x] 2.7 Budget input (`BudgetInput.jsx`)
- [x] 2.8 Model selector (`ModelSelector.jsx`)

## Phase 3: Polish (Export + Demo)
- [x] 3.1 Export config utility (`exportConfig.js`)
- [x] 3.2 Export button (`ExportButton.jsx`)
- [x] 3.3 Simulate Live Usage button (wired in footer)
- [x] 3.4 Animations (`animations.css`)
- [x] 3.5 Responsive layout (grid + media queries)
- [ ] 3.6 Final visual polish pass

## Phase 4: Hackathon Submission
- [ ] 4.1 README with enterprise architecture diagram
- [x] 4.2 Production build verification ✅ (builds in 1s, 227KB JS gzipped to 71KB)
