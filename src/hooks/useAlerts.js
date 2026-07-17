/**
 * useAlerts — Monitors agent allocations against thresholds.
 * Returns alert status for each agent.
 */

import { useMemo } from 'react';
import { useAllocation } from '../context/AllocationContext';

/**
 * @typedef {'normal' | 'warning' | 'danger'} AlertLevel
 */

/**
 * Computes alert status for every agent based on effective allocation.
 * @returns {Map<string, { level: AlertLevel, effectivePercent: number }>}
 */
export function useAlerts() {
  const state = useAllocation();

  return useMemo(() => {
    const alerts = new Map();
    const { departments, thresholds } = state;

    departments.forEach((dept) => {
      dept.agents.forEach((agent) => {
        const effectivePercent =
          (dept.allocation / 100) * (agent.allocation / 100) * 100;

        let level = 'normal';
        if (effectivePercent >= thresholds.danger) {
          level = 'danger';
        } else if (effectivePercent >= thresholds.warning) {
          level = 'warning';
        }

        alerts.set(agent.id, {
          level,
          effectivePercent: Math.round(effectivePercent * 100) / 100,
        });
      });
    });

    return alerts;
  }, [state]);
}
