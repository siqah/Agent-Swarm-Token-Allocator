import { useState, useCallback, useRef, useEffect } from 'react';
import { useAllocationDispatch } from '../../context/AllocationContext';
import { useAlerts } from '../../hooks/useAlerts';
import { ACTIONS } from '../../context/AllocationContext';
import AllocationSlider from './AllocationSlider';
import AlertBadge from '../feedback/AlertBadge';
import { formatPercent } from '../../utils/formatters';
import styles from './SliderGroup.module.css';

export default function SliderGroup({ department, onHoverNode }) {
  const dispatch = useAllocationDispatch();
  const alerts = useAlerts();
  const [isOpen, setIsOpen] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(department.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleCopyKey = useCallback(async (key) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = key;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }, []);

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

  const startEditing = useCallback((e) => {
    e.stopPropagation();
    setEditName(department.name);
    setEditing(true);
  }, [department.name]);

  const finishEditing = useCallback(() => {
    setEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== department.name) {
      dispatch({
        type: ACTIONS.RENAME_DEPT,
        payload: { deptId: department.id, name: trimmed },
      });
    }
  }, [editName, department.id, department.name, dispatch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
    if (e.key === 'Escape') {
      setEditName(department.name);
      setEditing(false);
    }
  }, [department.name]);

  const color = getComputedStyle(document.documentElement)
    .getPropertyValue(department.colorVar)
    .trim();

  return (
    <div className={styles.sliderGroup}>
      <div
        className={styles.groupHeader}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => onHoverNode?.(department.id)}
        onMouseLeave={() => onHoverNode?.(null)}
      >
        {editing ? (
          <input
            ref={inputRef}
            className={styles.nameInput}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.groupName} onClick={startEditing}>
            {department.name}
          </span>
        )}
        <span className={styles.groupPercent} style={{ color }}>
          {formatPercent(department.allocation)}
        </span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          ▶
        </span>
      </div>

      <div
        onMouseEnter={() => onHoverNode?.(department.id)}
        onMouseLeave={() => onHoverNode?.(null)}
      >
        <AllocationSlider
          value={department.allocation}
          color={color}
          onChange={handleDeptChange}
          aria-label={`${department.name} allocation`}
        />
      </div>

      {isOpen && (
        <div className={styles.agentSliders}>
          {department.agents.map((agent, idx) => {
            const alert = alerts.get(agent.id);
            return (
              <div key={agent.id} style={{ animationDelay: `${idx * 40}ms` }}>
              <div
                className={styles.sliderRow}
                onMouseEnter={() => onHoverNode?.(agent.id)}
                onMouseLeave={() => onHoverNode?.(null)}
              >
                <span className={styles.sliderLabel}>
                  {agent.name}
                  <AlertBadge level={alert?.level} />
                </span>

                <button
                  type="button"
                  onClick={() => handleAgentChange(agent.id, Math.max(0, agent.allocation - 5))}
                  className={styles.adjustButton}
                  style={{ '--accent-color': color }}
                >
                  −
                </button>

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
                    '--accent-color': color,
                  }}
                  aria-label={`${agent.name} allocation`}
                />

                <button
                  type="button"
                  onClick={() => handleAgentChange(agent.id, Math.min(100, agent.allocation + 5))}
                  className={`${styles.adjustButton} ${styles.increaseButton}`}
                  style={{ '--accent-color': color }}
                >
                  +
                </button>

                <span className={styles.sliderValue}>{formatPercent(agent.allocation)}</span>
                {agent.swarmKey && (
                  <button
                    className={`${styles.keyButton} ${copiedKey === agent.swarmKey ? styles.keyCopied : ''}`}
                    onClick={() => handleCopyKey(agent.swarmKey)}
                    title={copiedKey === agent.swarmKey ? 'Copied!' : 'Copy Virtual Swarm Key'}
                  >
                    <code className={styles.swarmKeyText}>
                      {copiedKey === agent.swarmKey ? 'Copied!' : 'key'}
                    </code>
                  </button>
                )}
              </div>
              {agent.swarmKey && (
                <div
                  className={styles.keyRow}
                  onMouseEnter={() => onHoverNode?.(agent.id)}
                  onMouseLeave={() => onHoverNode?.(null)}
                >
                  <code className={styles.swarmKeyCode}>{agent.swarmKey}</code>
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
