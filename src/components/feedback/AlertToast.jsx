/**
 * AlertToast — Slide-in toast notification for threshold alerts.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAlerts } from '../../hooks/useAlerts';

export default function AlertToast() {
  const alerts = useAlerts();
  const [toasts, setToasts] = useState([]);
  const [prevAlerts, setPrevAlerts] = useState(new Map());

  // Detect newly-triggered danger alerts
  useEffect(() => {
    const newToasts = [];

    alerts.forEach((alert, agentId) => {
      const prev = prevAlerts.get(agentId);
      if (alert.level === 'danger' && prev?.level !== 'danger') {
        newToasts.push({
          id: `${agentId}-${Date.now()}`,
          agentId,
          message: `${agentId} has exceeded ${alert.effectivePercent.toFixed(1)}% allocation!`,
          level: 'danger',
          timestamp: Date.now(),
        });
      }
    });

    if (newToasts.length > 0) {
      setToasts((prev) => [...prev, ...newToasts].slice(-5)); // keep max 5
    }

    setPrevAlerts(new Map(alerts));
  }, [alerts]);

  // Auto-dismiss toasts after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);

    return () => clearTimeout(timer);
  }, [toasts]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--space-5)',
        right: 'var(--space-5)',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        maxWidth: '360px',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: 'oklch(0.18 0.04 25 / 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid oklch(0.65 0.25 25 / 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            boxShadow: 'var(--shadow-elevated)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            animation: 'slideInRight 300ms var(--ease-out-quint)',
            cursor: 'pointer',
          }}
          onClick={() => dismissToast(toast.id)}
        >
          <span style={{ fontSize: '1.25rem' }}>🚨</span>
          <div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'oklch(0.65 0.25 25)',
                marginBottom: '2px',
              }}
            >
              Budget Alert
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
              }}
            >
              {toast.message}
            </div>
          </div>
          <span
            style={{
              marginLeft: 'auto',
              color: 'var(--text-muted)',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
}
