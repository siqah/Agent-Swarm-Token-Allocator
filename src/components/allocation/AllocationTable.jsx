import { useMemo } from 'react';
import { formatCompact, formatPercent } from '../../utils/formatters';
import { useAlerts } from '../../hooks/useAlerts';
import styles from './AllocationTable.module.css';

export default function AllocationTable({
  state,
  viewMode = 'allocated',
  isSimulating = false,
  hoveredNodeId,
  onHoverNode,
}) {
  const alerts = useAlerts();
  const isConsumption = viewMode === 'consumption';
  const { totalBudget, departments, usage = {} } = state;

  const deptTotals = useMemo(() => {
    return departments.map((dept) => {
      const deptValue = isConsumption
        ? dept.agents.reduce((s, a) => s + Math.max(usage[a.id]?.total || 0, 0), 0)
        : totalBudget * (dept.allocation / 100);

      const agents = dept.agents.map((agent) => {
        const agentValue = isConsumption
          ? Math.max(usage[agent.id]?.total || 0, 0)
          : totalBudget * (dept.allocation / 100) * (agent.allocation / 100);
        const alert = alerts.get(agent.id);
        return { ...agent, value: agentValue, alert };
      });

      return { ...dept, value: deptValue, agents };
    });
  }, [departments, totalBudget, usage, isConsumption, alerts]);

  const maxValue = useMemo(
    () => Math.max(...deptTotals.map((d) => d.value), 1),
    [deptTotals]
  );

  return (
    <div className={styles.table}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.budgetLabel}>
            {isConsumption ? 'Active Consumption' : 'Token Budget'}
          </span>
          <span className={styles.budgetValue}>{formatCompact(totalBudget)}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.viewLabel} ${isSimulating ? styles.viewLabelLive : ''}`}>
            {isSimulating ? '● LIVE' : viewMode.toUpperCase()}
          </span>
        </div>
      </div>

      <div className={styles.body}>
        {deptTotals.map((dept) => {
          const deptPct = totalBudget > 0 ? (dept.value / totalBudget) * 100 : 0;
          const maxAgentValue = Math.max(...dept.agents.map((a) => a.value), 1);

          return (
            <div key={dept.id} className={styles.deptGroup}>
              <div
                className={`${styles.deptRow} ${hoveredNodeId === dept.id ? styles.rowHighlighted : ''}`}
                onMouseEnter={() => onHoverNode(dept.id)}
                onMouseLeave={() => onHoverNode(null)}
              >
                <div className={styles.rowInfo}>
                  <span
                    className={styles.colorDot}
                    style={{ background: `var(${dept.colorVar})` }}
                  />
                  <span className={styles.deptName}>{dept.name}</span>
                  <span className={styles.pct}>{isConsumption ? formatPercent(deptPct) : `${dept.allocation}%`}</span>
                </div>
                <div className={styles.barWrap}>
                    <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${isSimulating ? styles.barFlow : ''}`}
                      style={{
                        width: `${(dept.value / maxValue) * 100}%`,
                        background: `var(${dept.colorVar})`,
                      }}
                    />
                  </div>
                  <span className={`${styles.tokenValue} ${isSimulating ? styles.tokenLive : ''}`}>{formatCompact(dept.value)}</span>
                </div>
              </div>

              <div className={styles.agentList}>
                {dept.agents.map((agent) => {
                  const agentPct = dept.value > 0 ? (agent.value / dept.value) * 100 : 0;
                  const alertLevel = agent.alert?.level || 'normal';

                  return (
                    <div
                      key={agent.id}
                      className={`${styles.agentRow} ${hoveredNodeId === agent.id ? styles.rowHighlighted : ''}`}
                      onMouseEnter={() => onHoverNode(agent.id)}
                      onMouseLeave={() => onHoverNode(null)}
                    >
                      <div className={styles.rowInfo}>
                        <span className={`${styles.alertDot} ${styles[alertLevel]}`} />
                        <span className={styles.agentName}>{agent.name}</span>
                        <span className={styles.pct}>
                          {isConsumption ? formatPercent(agentPct) : `${agent.allocation}%`}
                        </span>
                      </div>
                      <div className={styles.barWrap}>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${isSimulating ? styles.barFlow : ''}`}
                            style={{
                              width: `${(agent.value / maxValue) * 100}%`,
                              background: `var(${dept.colorVar})`,
                              opacity: 0.6,
                            }}
                          />
                        </div>
                        <span className={`${styles.tokenValue} ${isSimulating ? styles.tokenLive : ''}`}>{formatCompact(agent.value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
