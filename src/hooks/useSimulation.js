/**
 * useSimulation — Simulates live token burn-down for the demo.
 * Randomly "burns" tokens from agents every 500ms, updating
 * the Sankey diagram, cost cards, and triggering alerts in real-time.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../context/AllocationContext';

/**
 * @param {boolean} isActive - Whether the simulation is currently running
 * @returns {{ usedTokens: Map, burnRate: Map, elapsed: number, reset: Function }}
 */
export function useSimulation(isActive) {
  const state = useAllocation();
  const dispatch = useAllocationDispatch();
  const intervalRef = useRef(null);
  const [usedTokens, setUsedTokens] = useState(new Map());
  const [elapsed, setElapsed] = useState(0);

  // Build a list of all agent IDs on mount
  const agentIds = useRef([]);
  useEffect(() => {
    const ids = [];
    state.departments.forEach((dept) => {
      dept.agents.forEach((agent) => {
        ids.push({ deptId: dept.id, agentId: agent.id });
      });
    });
    agentIds.current = ids;
  }, [state.departments]);

  // Reset simulation data
  const reset = useCallback(() => {
    setUsedTokens(new Map());
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset when starting
    reset();

    // Every 500ms, simulate token usage
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 0.5);

      // Randomly nudge 1-3 department sliders slightly each tick
      // This simulates agents consuming their budget at different rates
      const numChanges = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < numChanges; i++) {
        const deptIndex = Math.floor(Math.random() * state.departments.length);
        const dept = state.departments[deptIndex];
        
        // Small random nudge: ±0.5 to ±2.0 percentage points
        const nudge = (Math.random() - 0.35) * 3; // Slight bias toward increase
        const newValue = Math.max(1, Math.min(98, dept.allocation + nudge));

        dispatch({
          type: ACTIONS.SET_DEPT_ALLOCATION,
          payload: { deptId: dept.id, value: newValue },
        });
      }

      // Also occasionally nudge agent-level sliders (30% chance per tick)
      if (Math.random() < 0.3) {
        const randomAgent =
          agentIds.current[Math.floor(Math.random() * agentIds.current.length)];
        if (randomAgent) {
          const dept = state.departments.find((d) => d.id === randomAgent.deptId);
          const agent = dept?.agents.find((a) => a.id === randomAgent.agentId);
          if (agent) {
            const agentNudge = (Math.random() - 0.3) * 5;
            const newAgentValue = Math.max(1, Math.min(99, agent.allocation + agentNudge));

            dispatch({
              type: ACTIONS.SET_AGENT_ALLOCATION,
              payload: {
                deptId: randomAgent.deptId,
                agentId: randomAgent.agentId,
                value: newAgentValue,
              },
            });
          }
        }
      }

      // Track cumulative "tokens used" per agent
      setUsedTokens((prev) => {
        const next = new Map(prev);
        agentIds.current.forEach(({ agentId }) => {
          const current = next.get(agentId) || 0;
          // Random burst of 1K–50K tokens per tick
          const burst = Math.floor(Math.random() * 49000) + 1000;
          next.set(agentId, current + burst);
        });
        return next;
      });
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, dispatch, reset, state.departments]);

  return { usedTokens, elapsed, reset };
}
