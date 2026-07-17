/**
 * MetricsPanel — Right sidebar with total cost and per-agent cost cards.
 */

import { useAllocation } from '../../context/AllocationContext';
import { TotalCostCard, AgentCostCard } from '../feedback/CostCard';
import ExportButton from '../feedback/ExportButton';
import styles from './MetricsPanel.module.css';

export default function MetricsPanel() {
  const { departments } = useAllocation();

  return (
    <aside className={styles.metricsPanel}>
      <TotalCostCard />

      <div className={styles.divider} />

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

      <ExportButton />
    </aside>
  );
}
