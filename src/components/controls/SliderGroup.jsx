/**
 * SliderGroup — A department with its allocation slider and nested agent sliders.
 */

import { useState, useCallback } from 'react';
import { useAllocationDispatch } from '../../context/AllocationContext';
import { useAlerts } from '../../hooks/useAlerts';
import { ACTIONS } from '../../context/AllocationContext';
import AllocationSlider from './AllocationSlider';
import AlertBadge from '../feedback/AlertBadge';
import { formatPercent } from '../../utils/formatters';
import styles from './SliderGroup.module.css';

export default function SliderGroup({ department }) {
  const dispatch = useAllocationDispatch();
  const alerts = useAlerts();
  const [isOpen, setIsOpen] = useState(true);

  const handleDeptChange = useCallback(
    (value) => {
      dispatch({
        type: ACTIONS.SET_DEPT_ALLOCATION,
        payload: { deptId: department.id, value },
      });
    },
    [dispatch, department.id]
  );

  const handleAgentChange = useCallback(
    (agentId, value) => {
      dispatch({
        type: ACTIONS.SET_AGENT_ALLOCATION,
        payload: { deptId: department.id, agentId, value },
      });
    },
    [dispatch, department.id]
  );

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue(department.colorVar)
    .trim();

  return (
    <div className={styles.sliderGroup}>
      {/* Department header */}
      <div className={styles.groupHeader} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.groupIcon}>{department.icon}</span>
        <span className={styles.groupName}>{department.name}</span>
        <span className={styles.groupPercent} style={{ color }}>
          {formatPercent(department.allocation)}
        </span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          ▶
        </span>
      </div>

      {/* Department slider — uses extracted AllocationSlider */}
      <AllocationSlider
        value={department.allocation}
        color={color}
        onChange={handleDeptChange}
        aria-label={`${department.name} allocation`}
      />

      {/* Agent sliders (collapsible) */}
      {isOpen && (
        <div className={styles.agentSliders}>
          {department.agents.map((agent) => {
            const alert = alerts.get(agent.id);
            return (
              <div key={agent.id} className={styles.sliderRow}>
                <span className={styles.sliderLabel}>
                  {agent.icon} {agent.name}
                  <AlertBadge level={alert?.level} />
                </span>
                <input
                  type="range"
                  className={styles.slider}
                  min="0"
                  max="100"
                  step="0.5"
                  value={agent.allocation}
                  onChange={(e) => handleAgentChange(agent.id, parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, ${color} 0%, ${color} ${agent.allocation}%, var(--bg-elevated) ${agent.allocation}%, var(--bg-elevated) 100%)`,
                  }}
                  aria-label={`${agent.name} allocation`}
                />
                <span className={styles.sliderValue}>{formatPercent(agent.allocation)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
