import { useState, useCallback, useEffect } from 'react';
import { AllocationProvider, useAllocation, useAllocationDispatch, ACTIONS } from './context/AllocationContext';
import { CostProvider } from './context/CostContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import SankeyDiagram from './components/sankey/SankeyDiagram';
import MetricsPanel from './components/layout/MetricsPanel';
import AlertToast from './components/feedback/AlertToast';
import ErrorBoundary from './components/feedback/ErrorBoundary';
import KeyboardShortcuts from './components/feedback/KeyboardShortcuts';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/animations.css';

function SkeletonBlock({ width, height, style }) {
  return (
    <div className="skeleton-block" style={{ width, height, ...style }} />
  );
}

function AppContent() {
  const state = useAllocation();
  const dispatch = useAllocationDispatch();
  const [viewMode, setViewMode] = useState('allocated');
  const [elapsed, setElapsed] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [ctrlToken, setCtrlToken] = useState(null);

  const isSimulating = state.simulationActive;

  const totalTokens = Object.values(state.usage || {}).reduce(
    (sum, u) => sum + (u.total || 0), 0
  );

  function formatTokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  function authHeaders() {
    return ctrlToken
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctrlToken}` }
      : { 'Content-Type': 'application/json' };
  }

  async function fetchInit() {
    try {
      const res = await fetch('/api/init');
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setConnected(true);
      setCtrlToken(data.token || null);
      return data;
    } catch {
      setConnected(false);
      return null;
    }
  }

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
    fetchInit().then((data) => {
      if (data) {
        const { token, ...rest } = data;
        dispatch({ type: ACTIONS.SET_STATE, payload: rest });
      }
      setLoading(false);
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
        headers: authHeaders(),
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
    fetch('/api/simulation/toggle', { method: 'POST', headers: authHeaders() })
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
  }, [dispatch, ctrlToken]);

  const handleClearUsage = useCallback(() => {
    fetch('/api/usage/reset', { method: 'POST', headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        dispatch({ type: ACTIONS.SET_STATE, payload: { usage: data.usage } });
      })
      .catch(() => setConnected(false));
  }, [dispatch, ctrlToken]);

  const handleKeyDown = useCallback((e) => {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      dispatch({ type: ACTIONS.UNDO });
      return;
    }

    if ((mod && e.key === 'z' && e.shiftKey) || (mod && e.key === 'Z')) {
      e.preventDefault();
      dispatch({ type: ACTIONS.REDO });
      return;
    }

    if (e.key === 'r' && !mod) {
      e.preventDefault();
      dispatch({ type: ACTIONS.RESET });
      return;
    }

    if (e.key === 's' && !mod) {
      e.preventDefault();
      toggleSimulation();
      return;
    }
  }, [dispatch, toggleSimulation]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">
        {loading ? (
          <>
            <div className="skeleton-sidebar">
              <SkeletonBlock width="100%" height={24} style={{ marginBottom: 16 }} />
              {[1,2,3,4].map((i) => (
                <SkeletonBlock key={i} width="100%" height={80} style={{ marginBottom: 8, borderRadius: 6 }} />
              ))}
            </div>
            <div className="skeleton-center">
              <SkeletonBlock width="80%" height={24} style={{ marginBottom: 24 }} />
              <SkeletonBlock width="100%" height={360} style={{ borderRadius: 8 }} />
            </div>
            <div className="skeleton-metrics">
              <SkeletonBlock width="100%" height={24} style={{ marginBottom: 16 }} />
              {[1,2,3].map((i) => (
                <SkeletonBlock key={i} width="100%" height={64} style={{ marginBottom: 8, borderRadius: 6 }} />
              ))}
            </div>
          </>
        ) : (
          <>
            <ErrorBoundary>
              <Sidebar onHoverNode={setHoveredNodeId} />
            </ErrorBoundary>
            <ErrorBoundary>
              <section className="app-center">
                <SankeyDiagram 
                  isSimulating={isSimulating} 
                  viewMode={viewMode} 
                  hoveredNodeId={hoveredNodeId}
                  onHoverNode={setHoveredNodeId}
                />
              </section>
            </ErrorBoundary>
            <ErrorBoundary>
              <MetricsPanel />
            </ErrorBoundary>
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="status-bar-left">
          <span className="status-item">
            <span className={`status-indicator ${connected ? 'status-indicator-green animate-live-pulse' : 'status-indicator-red'}`}>●</span>
            {connected ? 'GATEWAY ONLINE' : 'GATEWAY OFFLINE'}
          </span>
          <span className="status-divider">|</span>
          <span className="status-item">
            MODEL: {state.selectedModel ? state.selectedModel.toUpperCase() : 'NONE'}
          </span>
          <span className="status-divider">|</span>
          <span className="status-item">
            TK: {formatTokens(totalTokens)}
          </span>
          {isSimulating && (
            <>
              <span className="status-divider">|</span>
              <span className="status-item timer-pulse">
                SIM: {elapsed}s
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
      <KeyboardShortcuts />
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
