/**
 * GatewayLogs — Terminal panel displaying real gateway activity from server telemetry.
 */

import { useState, useEffect, useRef } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import styles from './GatewayLogs.module.css';

export default function GatewayLogs() {
  const { departments, simulationActive, usage } = useAllocation();
  const [logs, setLogs] = useState([]);
  const [prevUsage, setPrevUsage] = useState({});
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!usage || Object.keys(usage).length === 0) return;

    const newLogs = [];
    const agentMap = {};
    departments.forEach((dept) => {
      dept.agents.forEach((agent) => {
        agentMap[agent.id] = { name: agent.name, deptId: dept.id };
      });
    });

    Object.entries(usage).forEach(([agentId, current]) => {
      const prev = prevUsage[agentId];
      if (!prev) return;

      const deltaInput = current.input - prev.input;
      const deltaOutput = current.output - prev.output;
      const deltaTotal = current.total - prev.total;

      if (deltaTotal > 0) {
        const agentInfo = agentMap[agentId];
        const time = new Date().toLocaleTimeString();
        let text = `${agentId} ➔ 200 OK (in: ${deltaInput} | out: ${deltaOutput})`;
        if (agentInfo) {
          text = `${agentId} ➔ 200 OK (in: ${deltaInput} | out: ${deltaOutput})`;
        }
        newLogs.push({ id: `${agentId}-${Date.now()}-${deltaTotal}`, time, text, isBlocked: false });
      }
    });

    if (newLogs.length > 0) {
      setLogs((prev) => {
        const updated = [...prev, ...newLogs];
        return updated.slice(-20);
      });
    }

    setPrevUsage(JSON.parse(JSON.stringify(usage)));
  }, [usage, departments]);

  // Detect when server is unreachable
  useEffect(() => {
    if (!simulationActive && logs.length === 0) {
      setLogs([{ id: 'init', time: new Date().toLocaleTimeString(), text: 'Gateway standby, waiting for requests...', isBlocked: false }]);
    }
  }, [simulationActive, logs.length]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>GATEWAY CONSOLE LOG</span>
        <span className={styles.statusBadge}>
          <span className={`${styles.dot} ${simulationActive ? styles.dotActive : styles.dotIdle}`} />
          {simulationActive ? 'STREAMING' : 'STANDBY'}
        </span>
      </div>

      <div className={styles.logList}>
        {logs.map((log) => (
          <div key={log.id} className={styles.logEntry}>
            <span className={styles.logTime}>[{log.time}]</span>
            <span className={
              log.isBlocked ? styles.logBlocked :
              log.id === 'start' || log.id === 'init' ? styles.logInfo :
              styles.logSuccess
            }>
              {log.text}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
