/**
 * ConnectionDetails — Shows baseURL and per-agent Virtual Swarm Keys.
 * Developers copy these to do a one-line SDK swap.
 */

import { useState, useCallback } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import styles from './ConnectionDetails.module.css';

const GATEWAY_URL = 'http://localhost:3000/v1';

export default function ConnectionDetails() {
  const { departments } = useAllocation();
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopyKey = useCallback(async (key) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = key;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }, []);

  const allAgents = departments.flatMap((dept) =>
    dept.agents.map((agent) => ({ ...agent, deptName: dept.name }))
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Connect Your Agents</span>
        <span className={styles.subtitle}>One-line SDK swap</span>
      </div>

      <div className={styles.baseUrlRow}>
        <span className={styles.label}>baseURL</span>
        <code className={styles.url}>{GATEWAY_URL}</code>
        <button
          className={styles.copyUrl}
          onClick={() => handleCopyKey(GATEWAY_URL)}
        >
          {copiedKey === GATEWAY_URL ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className={styles.keyList}>
        {allAgents.map((agent) => (
          <div key={agent.id} className={styles.keyRow}>
            <div className={styles.keyInfo}>
              <span className={styles.agentName}>{agent.name}</span>
              <span className={styles.deptLabel}>{agent.deptName}</span>
            </div>
            <code className={styles.keyValue}>
              {agent.swarmKey || '—'}
            </code>
            {agent.swarmKey && (
              <button
                className={`${styles.copyBtn} ${copiedKey === agent.swarmKey ? styles.copied : ''}`}
                onClick={() => handleCopyKey(agent.swarmKey)}
                title="Copy Virtual Swarm Key"
              >
                {copiedKey === agent.swarmKey ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
