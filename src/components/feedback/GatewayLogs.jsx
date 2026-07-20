import { useState, useEffect, useCallback } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import styles from './GatewayLogs.module.css';

export default function GatewayLogs() {
  const { simulationActive } = useAllocation();
  const [logs, setLogs] = useState([]);
  const [ctrlToken, setCtrlToken] = useState(null);

  useEffect(() => {
    fetch('/api/init').then((r) => r.json()).then((d) => {
      if (d.token) setCtrlToken(d.token);
    }).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (ctrlToken) headers['Authorization'] = `Bearer ${ctrlToken}`;
      const res = await fetch('/api/logs?limit=20', { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.entries) setLogs(data.entries);
    } catch {
      // Server unavailable
    }
  }, [ctrlToken]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Also listen on SSE stream for real-time updates
  useEffect(() => {
    const source = new EventSource('/api/stream');
    source.onmessage = () => {
      fetchLogs();
    };
    return () => source.close();
  }, [fetchLogs]);

  useEffect(() => {
    if (!simulationActive && logs.length === 0) {
      setLogs([{
        id: 'init', timestamp: new Date().toISOString(),
        agentName: '', model: '', totalTokens: 0,
        statusCode: 0, cached: false, error: null,
      }]);
    }
  }, [simulationActive, logs.length]);

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString();
  }

  function formatTokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n || 0);
  }

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
        {logs.length === 0 && (
          <div className={styles.logEntry}>
            <span className={styles.logTime}>[--:--:--]</span>
            <span className={styles.logInfo}>Gateway standby, waiting for requests...</span>
          </div>
        )}
        {logs.map((log, i) => {
          if (log.id === 'init') {
            return (
              <div key={log.id} className={styles.logEntry} style={{ animationDelay: `${i * 30}ms` }}>
                <span className={styles.logTime}>[{formatTime(log.timestamp)}]</span>
                <span className={styles.logInfo}>Gateway standby, waiting for requests...</span>
              </div>
            );
          }

          const isError = log.statusCode >= 400;
          const isCache = log.cached;
          const isFallback = log.fallback;
          let line = `${log.agentName || log.agentId || '?'} ➔ ${log.statusCode} ${isError ? log.error : 'OK'}`;
          if (log.totalTokens > 0) line += ` (${formatTokens(log.totalTokens)} tk)`;
          if (log.model) line += ` [${log.model}]`;
          if (log.provider && log.provider !== 'cache') line += ` via ${log.provider}`;
          if (isCache) line += ` ⚡${log.cacheType === 'semantic' ? 'semantic' : 'exact'} cache`;
          if (isFallback) line += ` ⚠ fallback from ${log.fallbackFrom}`;

          return (
            <div key={log.id || i} className={styles.logEntry} style={{ animationDelay: `${i * 30}ms` }}>
              <span className={styles.logTime}>[{formatTime(log.timestamp)}]</span>
              <span className={
                isError ? styles.logBlocked :
                isCache ? styles.logCache :
                styles.logSuccess
              }>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
