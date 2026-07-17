import { useState, useCallback, useEffect } from 'react';
import { AllocationProvider, useAllocation, useAllocationDispatch, ACTIONS } from './context/AllocationContext';
import { CostProvider } from './context/CostContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import SankeyDiagram from './components/sankey/SankeyDiagram';
import MetricsPanel from './components/layout/MetricsPanel';
import AlertToast from './components/feedback/AlertToast';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/animations.css';

function AppContent() {
  const state = useAllocation();
  const dispatch = useAllocationDispatch();
  const [viewMode, setViewMode] = useState('allocated');
  const [elapsed, setElapsed] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  const isSimulating = state.simulationActive;

  // 1. Initial State Hydration on Mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        dispatch({ type: ACTIONS.SET_STATE, payload: data });
      })
      .catch((err) => console.error('Failed to sync initial status:', err));
  }, [dispatch]);

  // 2. Real-Time Telemetry Polling Loop (polls usage and simulation status every 1s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/status')
        .then((res) => res.json())
        .then((data) => {
          dispatch({
            type: ACTIONS.SET_STATE,
            payload: {
              usage: data.usage,
              simulationActive: data.simulationActive,
            },
          });
        })
        .catch((err) => console.error('Telemetry polling failed:', err));
    }, 1000);

    return () => clearInterval(interval);
  }, [dispatch]);

  // 3. Debounced Configuration Push to Server (triggered when budget/allocations change)
  useEffect(() => {
    // Skip if state is empty/unhydrated
    if (!state.departments || state.departments.length === 0) return;

    const timer = setTimeout(() => {
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalBudget: state.totalBudget,
          selectedModel: state.selectedModel,
          departments: state.departments,
          thresholds: state.thresholds,
        }),
      }).catch((err) => console.error('Failed to save config:', err));
    }, 300);

    return () => clearTimeout(timer);
  }, [state.totalBudget, state.selectedModel, state.departments, state.thresholds]);

  // 4. Local Timer simulation for elapsed duration
  useEffect(() => {
    if (!isSimulating) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSimulating]);

  // 5. Simulation Handlers
  const toggleSimulation = useCallback(() => {
    fetch('/api/simulation/toggle', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        dispatch({
          type: ACTIONS.SET_STATE,
          payload: { simulationActive: data.simulationActive },
        });
        if (data.simulationActive) {
          setViewMode('consumption'); // Auto-switch to live spend view
        }
      })
      .catch((err) => console.error('Failed to toggle simulation:', err));
  }, [dispatch]);

  const handleClearUsage = useCallback(() => {
    fetch('/api/usage/reset', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        dispatch({
          type: ACTIONS.SET_STATE,
          payload: { usage: data.usage },
        });
      })
      .catch((err) => console.error('Failed to reset usage:', err));
  }, [dispatch]);

  return (
    <div className="app-shell">
      {/* Header */}
      <Header />

      {/* Main 3-column responsive grid */}
      <main className="app-main">
        <Sidebar onHoverNode={setHoveredNodeId} />

        {/* Center: Sankey Diagram */}
        <section className="app-center">
          <SankeyDiagram 
            isSimulating={isSimulating} 
            viewMode={viewMode} 
            hoveredNodeId={hoveredNodeId}
            onHoverNode={setHoveredNodeId}
          />
        </section>

        <MetricsPanel />
      </main>

      {/* Footer (IDE Status Bar) */}
      <footer className="app-footer">
        <div className="status-bar-left">
          <span className="status-item">
            <span className="status-indicator-green">●</span>
            PG-DB: CONNECTED
          </span>
          <span className="status-divider">|</span>
          <span className="status-item">
            MODEL: {state.selectedModel ? state.selectedModel.toUpperCase() : 'NONE'}
          </span>
          {isSimulating && (
            <>
              <span className="status-divider">|</span>
              <span className="status-item timer-pulse">
                SIM: {elapsed}s ACTIVE
              </span>
            </>
          )}
        </div>

        <div className="status-bar-right">
          <button
            className="status-button"
            onClick={() => setViewMode((prev) => (prev === 'allocated' ? 'consumption' : 'allocated'))}
          >
            {viewMode === 'allocated' ? 'VIEW: LIMITS' : 'VIEW: LIVE SPEND'}
          </button>

          <button
            className="status-button"
            onClick={handleClearUsage}
            disabled={isSimulating}
          >
            RESET STATS
          </button>

          <button
            className={`status-button status-sim-trigger ${isSimulating ? 'sim-active' : ''}`}
            onClick={toggleSimulation}
          >
            {isSimulating ? 'STOP SIMULATION' : 'SIMULATE SWARM'}
          </button>
        </div>
      </footer>

      {/* Toast notifications */}
      <AlertToast />
    </div>
  );
}

export default function App() {
  return (
    <AllocationProvider>
      <CostProvider>
        <AppContent />
      </CostProvider>
    </AllocationProvider>
  );
}
