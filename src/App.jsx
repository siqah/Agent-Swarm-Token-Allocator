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
  const [connected, setConnected] = useState(true);

  const isSimulating = state.simulationActive;

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setConnected(true);
      return data;
    } catch {
      setConnected(false);
      return null;
    }
  }

  useEffect(() => {
    fetchStatus().then((data) => {
      if (data) {
        dispatch({ type: ACTIONS.SET_STATE, payload: data });
      }
    });
  }, [dispatch]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus().then((data) => {
        if (data) {
          dispatch({
            type: ACTIONS.SET_STATE,
            payload: {
              usage: data.usage,
              simulationActive: data.simulationActive,
            },
          });
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [dispatch]);

  useEffect(() => {
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
      }).catch(() => setConnected(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [state.totalBudget, state.selectedModel, state.departments, state.thresholds]);

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

  const toggleSimulation = useCallback(() => {
    fetch('/api/simulation/toggle', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        dispatch({
          type: ACTIONS.SET_STATE,
          payload: { simulationActive: data.simulationActive },
        });
        if (data.simulationActive) {
          setViewMode('consumption');
        }
      })
      .catch(() => setConnected(false));
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
      .catch(() => setConnected(false));
  }, [dispatch]);

  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">
        <Sidebar onHoverNode={setHoveredNodeId} />

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

      <footer className="app-footer">
        <div className="status-bar-left">
          <span className="status-item">
            <span className={`status-indicator ${connected ? 'status-indicator-green' : 'status-indicator-red'}`}>●</span>
            GATEWAY: {connected ? 'ONLINE' : 'OFFLINE'}
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
