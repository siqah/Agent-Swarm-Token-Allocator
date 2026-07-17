/**
 * CostCard — Displays per-agent cost breakdown.
 */

import { useCosts } from '../../context/CostContext';
import { useAlerts } from '../../hooks/useAlerts';
import { formatCurrency, formatCompact, formatPercent } from '../../utils/formatters';
import styles from './CostCard.module.css';

export function TotalCostCard() {
  const { totalCost, costs } = useCosts();
  const totalData = costs.get('__total__');

  return (
    <div className={styles.totalCard}>
      <div className={styles.totalLabel}>Estimated Monthly Cost</div>
      <div className={styles.totalValue}>{formatCurrency(totalCost)}</div>
      <div className={styles.totalSub}>
        {formatCompact(totalData?.totalTokens || 0)} tokens/mo
      </div>
    </div>
  );
}

export function AgentCostCard({ agent, department }) {
  const { getCost } = useCosts();
  const alerts = useAlerts();
  const cost = getCost(agent.id);
  const alert = alerts.get(agent.id);

  const cardClass = [
    styles.costCard,
    alert?.level === 'warning' ? styles.cardWarning : '',
    alert?.level === 'danger' ? styles.cardDanger : '',
  ]
    .filter(Boolean)
    .join(' ');

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue(department.colorVar)
    .trim();

  return (
    <div className={cardClass}>
      <div className={styles.cardHeader}>
        <span className={styles.agentLabel}>
          <span>{agent.icon}</span>
          {agent.name}
        </span>
        <span
          className={styles.deptTag}
          style={{
            background: `${color}22`,
            color: color,
          }}
        >
          {department.name}
        </span>
      </div>

      <div className={styles.costValue}>
        {cost ? formatCurrency(cost.totalCost) : '$0.00'}
      </div>

      <div className={styles.subStats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Tokens</span>
          <span className={styles.statValue}>
            {cost ? formatCompact(cost.totalTokens) : '0'}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Effective</span>
          <span className={styles.statValue}>
            {alert ? formatPercent(alert.effectivePercent) : '0%'}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Input</span>
          <span className={styles.statValue}>
            {cost ? formatCurrency(cost.inputCost) : '$0.00'}
          </span>
        </div>
      </div>
    </div>
  );
}
