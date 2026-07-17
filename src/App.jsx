/**
 * App — Root layout shell with providers and 3-column responsive grid.
 */

import { useState, useCallback } from 'react';
import { AllocationProvider } from './context/AllocationContext';
import { CostProvider } from './context/CostContext';
import { useSimulation } from './hooks/useSimulation';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import SankeyDiagram from './components/sankey/SankeyDiagram';
import MetricsPanel from './components/layout/MetricsPanel';
import AlertToast from './components/feedback/AlertToast';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/animations.css';

/* The simulation hook needs to be inside the provider tree */
function AppContent() {
  const [isSimulating, setIsSimulating] = useState(false);
  const { usedTokens, elapsed, reset } = useSimulation(isSimulating);

  const toggleSimulation = useCallback(() => {
    setIsSimulating((prev) => {
      if (prev) reset(); // Reset data when stopping
      return !prev;
    });
  }, [reset]);

  return (
    <div className="app-shell">
      {/* Header */}
      <Header />

      {/* Main 3-column responsive grid */}
      <main className="app-main">
        <Sidebar />

        {/* Center: Sankey Diagram */}
        <section className="app-center">
          <SankeyDiagram isSimulating={isSimulating} />
        </section>

        <MetricsPanel />
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span className="footer-brand">
          <span className="codex-badge">Built with Codex</span>
          Agent Swarm Token Allocator
          {isSimulating && (
            <span className="sim-timer mono">
              ⏱ {elapsed.toFixed(1)}s
            </span>
          )}
        </span>

        <button
          className={`sim-button ${isSimulating ? 'sim-active' : ''}`}
          onClick={toggleSimulation}
        >
          {isSimulating ? '⏹ Stop Simulation' : '▶ Simulate Live Usage'}
        </button>
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
