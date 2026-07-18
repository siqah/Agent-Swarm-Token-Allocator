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
  const [editingDept, setEditingDept] = useState(false);
  const [editDeptName, setEditDeptName] = useState(department.name);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editAgentName, setEditAgentName] = useState('');
  const deptInputRef = useRef(null);
  const agentInputRef = useRef(null);

  useEffect(() => {
    if (editingDept && deptInputRef.current) {
      deptInputRef.current.focus();
      deptInputRef.current.select();
    }
  }, [editingDept]);

  useEffect(() => {
    if (editingAgent && agentInputRef.current) {
      agentInputRef.current.focus();
      agentInputRef.current.select();
    }
  }, [editingAgent]);

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

  const handleRemoveDept = useCallback((e) => {
    e.stopPropagation();
    dispatch({ type: ACTIONS.REMOVE_DEPT, payload: department.id });
  }, [dispatch, department.id]);

  const handleAddAgent = useCallback((e) => {
    e.stopPropagation();
    dispatch({ type: ACTIONS.ADD_AGENT, payload: department.id });
  }, [dispatch, department.id]);

  const handleRemoveAgent = useCallback((agentId, e) => {
    e.stopPropagation();
    dispatch({ type: ACTIONS.REMOVE_AGENT, payload: { deptId: department.id, agentId } });
  }, [dispatch, department.id]);

  const startEditDept = useCallback((e) => {
    e.stopPropagation();
    setEditDeptName(department.name);
    setEditingDept(true);
  }, [department.name]);

  const finishEditDept = useCallback(() => {
    setEditingDept(false);
    const trimmed = editDeptName.trim();
    if (trimmed && trimmed !== department.name) {
      dispatch({
        type: ACTIONS.RENAME_DEPT,
        payload: { deptId: department.id, name: trimmed },
      });
    }
  }, [editDeptName, department.id, department.name, dispatch]);

  const handleDeptKeyDown = useCallback((e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      setEditDeptName(department.name);
      setEditingDept(false);
    }
  }, [department.name]);

  const startEditAgent = useCallback((agentId, agentName, e) => {
    e.stopPropagation();
    setEditingAgent(agentId);
    setEditAgentName(agentName);
  }, []);

  const finishEditAgent = useCallback(() => {
    const agentId = editingAgent;
    setEditingAgent(null);
    const trimmed = editAgentName.trim();
    if (trimmed && agentId) {
      dispatch({
        type: ACTIONS.RENAME_AGENT,
        payload: { deptId: department.id, agentId, name: trimmed },
      });
    }
  }, [editAgentName, editingAgent, department.id, dispatch]);

  const handleAgentKeyDown = useCallback((e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      setEditingAgent(null);
    }
  }, []);

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
        {editingDept ? (
          <input
            ref={deptInputRef}
            className={styles.nameInput}
            value={editDeptName}
            onChange={(e) => setEditDeptName(e.target.value)}
            onBlur={finishEditDept}
            onKeyDown={handleDeptKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.groupName} onClick={startEditDept}>
            {department.name}
          </span>
        )}
        <span className={styles.groupPercent} style={{ color }}>
          {formatPercent(department.allocation)}
        </span>
        {department.agents.length === 1 && department.agents[0].allocation === 100 ? null : (
          <button
            className={styles.actionButton}
            onClick={handleRemoveDept}
            title="Remove department"
          >
            ×
          </button>
        )}
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
                  {editingAgent === agent.id ? (
                    <input
                      ref={agentInputRef}
                      className={styles.agentNameInput}
                      value={editAgentName}
                      onChange={(e) => setEditAgentName(e.target.value)}
                      onBlur={finishEditAgent}
                      onKeyDown={handleAgentKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={styles.agentName} onClick={(e) => startEditAgent(agent.id, agent.name, e)}>
                      {agent.name}
                    </span>
                  )}
                  <AlertBadge level={alert?.level} />
                </span>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleAgentChange(agent.id, Math.max(0, agent.allocation - 5)); }}
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
                  onClick={(e) => { e.stopPropagation(); handleAgentChange(agent.id, Math.min(100, agent.allocation + 5)); }}
                  className={`${styles.adjustButton} ${styles.increaseButton}`}
                  style={{ '--accent-color': color }}
                >
                  +
                </button>

                <span className={styles.sliderValue}>{formatPercent(agent.allocation)}</span>

                {department.agents.length > 1 && (
                  <button
                    className={styles.actionButton}
                    onClick={(e) => handleRemoveAgent(agent.id, e)}
                    title="Remove agent"
                  >
                    ×
                  </button>
                )}

                {agent.swarmKey && (
                  <button
                    className={`${styles.keyButton} ${copiedKey === agent.swarmKey ? styles.keyCopied : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleCopyKey(agent.swarmKey); }}
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
          <button
            className={styles.addAgentButton}
            onClick={(e) => { e.stopPropagation(); handleAddAgent(e); }}
          >
            + Add agent
          </button>
        </div>
      )}
    </div>
  );
}
