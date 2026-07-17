/**
 * GatewayLogs — Scrolled terminal panel displaying real-time LLM gateway requests.
 */

import { useState, useEffect, useRef } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import { useAlerts } from '../../hooks/useAlerts';

export default function GatewayLogs() {
  const { departments, simulationActive } = useAllocation();
  const alerts = useAlerts();
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!simulationActive) {
      setLogs([{ id: 'init', time: new Date().toLocaleTimeString(), text: 'Gateway standby, waiting for requests...', isBlocked: false }]);
      return;
    }

    setLogs([{ id: 'start', time: new Date().toLocaleTimeString(), text: 'Gateway active, intercepting chat completions...', isBlocked: false }]);

    // Get flat list of agents
    const allAgents = departments.flatMap((dept) =>
      dept.agents.map((agent) => ({ ...agent, deptId: dept.id }))
    );

    if (allAgents.length === 0) return;

    const interval = setInterval(() => {
      // Pick random agent
      const agent = allAgents[Math.floor(Math.random() * allAgents.length)];
      const alert = alerts.get(agent.id);
      const isBlocked = alert?.level === 'danger';

      const time = new Date().toLocaleTimeString();
      let text = '';

      if (isBlocked) {
        text = `${agent.id} ➔ 429 BLOCKED (allocation ceiling)`;
      } else {
        const inputTokens = Math.floor(Math.random() * 400) + 100;
        const outputTokens = Math.floor(Math.random() * 600) + 200;
        text = `${agent.id} ➔ 200 OK (in: ${inputTokens} | out: ${outputTokens})`;
      }

      setLogs((prev) => {
        const updated = [...prev, { id: Math.random().toString(), time, text, isBlocked }];
        // Cap at 20 logs to prevent memory build-up
        if (updated.length > 20) {
          return updated.slice(updated.length - 20);
        }
        return updated;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [simulationActive, departments, alerts]);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div
      style={{
        background: 'oklch(0.05 0.005 260)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--text-secondary)',
        minHeight: '140px',
        maxHeight: '140px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: 'inset 0 2px 8px oklch(0 0 0 / 0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '4px',
          marginBottom: '4px',
          color: 'var(--text-muted)',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}
      >
        <span>GATEWAY CONSOLE LOG</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: simulationActive ? 'var(--color-success)' : 'var(--text-muted)',
              boxShadow: simulationActive ? '0 0 6px var(--color-success)' : 'none',
              animation: simulationActive ? 'fadeIn 1s infinite alternate' : 'none',
            }}
          />
          {simulationActive ? 'STREAMING' : 'STANDBY'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {logs.map((log) => (
          <div key={log.id} style={{ lineBreak: 'anywhere' }}>
            <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>[{log.time}]</span>
            <span style={{ color: log.isBlocked ? 'var(--color-danger)' : log.id === 'start' || log.id === 'init' ? 'var(--color-info)' : 'var(--text-primary)' }}>
              {log.text}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
