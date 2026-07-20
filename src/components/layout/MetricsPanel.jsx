/**
 * MetricsPanel — Right sidebar with total cost and per-agent cost cards.
 */

import { useState, memo } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import { TotalCostCard, AgentCostCard } from '../feedback/CostCard';
import GatewayLogs from '../feedback/GatewayLogs';
import ConnectionDetails from '../feedback/ConnectionDetails';
import ProviderKeys from '../feedback/ProviderKeys';
import ExportButton from '../feedback/ExportButton';
import ImportButton from '../feedback/ImportButton';
import styles from './MetricsPanel.module.css';

function MetricsPanelInner() {
  const { departments } = useAllocation();
  const [showKeys, setShowKeys] = useState(false);
  const [showProviderKeys, setShowProviderKeys] = useState(false);

  return (
    <aside className={styles.metricsPanel}>
      <TotalCostCard />

      <div className={styles.divider} />

      <button
        className={styles.toggleSection}
        onClick={() => setShowKeys(!showKeys)}
      >
        <span>Connection Details</span>
        <span className={`${styles.chevron} ${showKeys ? styles.chevronOpen : ''}`}>▶</span>
      </button>

      {showKeys && (
        <>
          <ConnectionDetails />
          <div className={styles.divider} />
        </>
      )}

      <button
        className={styles.toggleSection}
        onClick={() => setShowProviderKeys(!showProviderKeys)}
      >
        <span>Provider API Keys</span>
        <span className={`${styles.chevron} ${showProviderKeys ? styles.chevronOpen : ''}`}>▶</span>
      </button>

      {showProviderKeys && (
        <>
          <ProviderKeys />
          <div className={styles.divider} />
        </>
      )}

      <span className={styles.sectionTitle}>Agent Breakdown</span>

      <div className={`${styles.agentCards} stagger-children`}>
        {departments.map((dept) =>
          dept.agents.map((agent) => (
            <AgentCostCard
              key={agent.id}
              agent={agent}
              department={dept}
            />
          ))
        )}
      </div>

      <div className={styles.divider} />

      <GatewayLogs />

      <div className={styles.divider} />

      <div className={styles.exportRow}>
        <ExportButton />
        <ImportButton />
      </div>
    </aside>
  );
}

export default memo(MetricsPanelInner);
