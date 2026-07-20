/**
 * AlertToast — Slide-in toast notification for threshold alerts.
 */

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAlerts } from '../../hooks/useAlerts';
import styles from './AlertToast.module.css';

export default function AlertToast() {
  const alerts = useAlerts();
  const [toasts, setToasts] = useState([]);
  const [prevAlerts, setPrevAlerts] = useState(new Map());

  useEffect(() => {
    const newToasts = [];

    alerts.forEach((alert, agentId) => {
      const prev = prevAlerts.get(agentId);
      if (alert.level === 'danger' && prev?.level !== 'danger') {
        newToasts.push({
          id: `${agentId}-${Date.now()}`,
          agentId,
          message: `${alert.agentName || agentId} in ${alert.deptName || '?'} has used ${alert.effectivePercent.toFixed(1)}% of its token budget!`,
          level: 'danger',
          timestamp: Date.now(),
        });
      }
    });

    if (newToasts.length > 0) {
      setToasts((prev) => [...prev, ...newToasts].slice(-5));
    }

    setPrevAlerts(new Map(alerts));
  }, [alerts]);

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
    <div className={styles.container}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={styles.toast}
            onClick={() => dismissToast(toast.id)}
          >
            <span className={styles.toastIcon}>!</span>
            <div>
              <div className={styles.toastTitle}>Budget Alert</div>
              <div className={styles.toastMessage}>{toast.message}</div>
            </div>
            <span className={styles.toastClose}>×</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
