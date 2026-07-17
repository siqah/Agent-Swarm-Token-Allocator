/**
 * useAlerts — Monitors agent token consumption against budget.
 * Compares actual server usage against per-agent token limits.
 */

import { useMemo } from 'react';
import { useAllocation } from '../context/AllocationContext';

export function useAlerts() {
  const state = useAllocation();

  return useMemo(() => {
    const alerts = new Map();
    const { departments, totalBudget, usage, thresholds } = state;

    departments.forEach((dept) => {
      dept.agents.forEach((agent) => {
        const agentLimit = totalBudget * (dept.allocation / 100) * (agent.allocation / 100);
        const currentUsage = usage?.[agent.id]?.total || 0;
        const effectivePercent = agentLimit > 0 ? (currentUsage / agentLimit) * 100 : 0;

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
