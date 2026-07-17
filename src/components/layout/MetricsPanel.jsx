/**
 * MetricsPanel — Right sidebar with total cost and per-agent cost cards.
 */

import { useState } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import { TotalCostCard, AgentCostCard } from '../feedback/CostCard';
import GatewayLogs from '../feedback/GatewayLogs';
import ConnectionDetails from '../feedback/ConnectionDetails';
import ExportButton from '../feedback/ExportButton';
import styles from './MetricsPanel.module.css';

export default function MetricsPanel() {
  const { departments } = useAllocation();
  const [showKeys, setShowKeys] = useState(false);

  return (
    <aside className={styles.metricsPanel}>
      <TotalCostCard />

      <div className={styles.divider} />

      <button
        className={styles.toggleSection}
        onClick={() => setShowKeys(!showKeys)}
      >
        <span>🔑 Connection Details</span>
        <span className={`${styles.chevron} ${showKeys ? styles.chevronOpen : ''}`}>▶</span>
      </button>

      {showKeys && (
        <>
          <ConnectionDetails />
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

      <ExportButton />
    </aside>
  );
}
