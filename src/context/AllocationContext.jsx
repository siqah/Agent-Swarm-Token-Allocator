/**
 * AllocationContext — Central state management for the token allocator.
 * Uses useReducer with proportional normalization logic.
 */

import { createContext, useContext, useReducer } from 'react';
import {
  DEFAULT_TOTAL_BUDGET,
  DEFAULT_MODEL,
  DEFAULT_THRESHOLDS,
  DEFAULT_DEPARTMENTS,
} from '../data/defaultConfig';

// ── Context ──────────────────────────────────
const AllocationContext = createContext(null);
const AllocationDispatchContext = createContext(null);

// ── Initial State ────────────────────────────
const initialState = {
  totalBudget: DEFAULT_TOTAL_BUDGET,
  selectedModel: DEFAULT_MODEL,
  thresholds: { ...DEFAULT_THRESHOLDS },
  departments: DEFAULT_DEPARTMENTS.map((dept) => ({
    ...dept,
    agents: dept.agents.map((a) => ({ ...a })),
  })),
  simulationActive: false,
  usage: {},
};

// ── Action Types ─────────────────────────────
export const ACTIONS = {
  SET_TOTAL_BUDGET: 'SET_TOTAL_BUDGET',
  SET_MODEL: 'SET_MODEL',
  SET_DEPT_ALLOCATION: 'SET_DEPT_ALLOCATION',
  SET_AGENT_ALLOCATION: 'SET_AGENT_ALLOCATION',
  SET_THRESHOLDS: 'SET_THRESHOLDS',
  RENAME_DEPT: 'RENAME_DEPT',
  RESET: 'RESET',
  SET_STATE: 'SET_STATE',
};

// ── Normalization Helper ─────────────────────
/**
 * When one item in a group changes to `newValue`, proportionally
 * redistribute the remaining items so the total remains 100%.
 *
 * @param {Array} items - Array of objects with an `allocation` field
 * @param {number} changedIndex - Index of the item that changed
 * @param {number} newValue - New allocation percentage (0–100)
 * @returns {Array} New array with normalized allocations
 */
function normalizeAllocations(items, changedIndex, newValue) {
  const clamped = Math.max(0, Math.min(100, newValue));
  const remaining = 100 - clamped;

  const othersTotal = items.reduce(
    (sum, item, i) => (i === changedIndex ? sum : sum + item.allocation),
    0
  );

  return items.map((item, i) => {
    if (i === changedIndex) {
      return { ...item, allocation: clamped };
    }

    if (othersTotal === 0) {
      // Edge case: all others are 0, distribute equally
      const otherCount = items.length - 1;
      return { ...item, allocation: remaining / otherCount };
    }

    const proportion = item.allocation / othersTotal;
    return { ...item, allocation: Math.round(proportion * remaining * 100) / 100 };
  });
}

/**
 * Final pass to fix floating-point rounding: ensures the group sums to exactly 100.
 */
function fixRoundingError(items) {
  const total = items.reduce((sum, item) => sum + item.allocation, 0);
  const diff = 100 - total;

  if (Math.abs(diff) < 0.001) return items;

  // Apply the rounding error to the largest allocation
  const result = [...items];
  let maxIdx = 0;
  for (let i = 1; i < result.length; i++) {
    if (result[i].allocation > result[maxIdx].allocation) maxIdx = i;
  }
  result[maxIdx] = {
    ...result[maxIdx],
    allocation: Math.round((result[maxIdx].allocation + diff) * 100) / 100,
  };
  return result;
}

// ── Reducer ──────────────────────────────────
function allocationReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_TOTAL_BUDGET: {
      const value = Math.max(0, Math.round(action.payload));
      return { ...state, totalBudget: value };
    }

    case ACTIONS.SET_MODEL: {
      return { ...state, selectedModel: action.payload };
    }

    case ACTIONS.SET_DEPT_ALLOCATION: {
      const { deptId, value } = action.payload;
      const deptIndex = state.departments.findIndex((d) => d.id === deptId);
      if (deptIndex === -1) return state;

      const normalized = normalizeAllocations(state.departments, deptIndex, value);
      const fixed = fixRoundingError(normalized);

      return {
        ...state,
        departments: fixed.map((dept, i) => ({
          ...state.departments[i],
          allocation: dept.allocation,
        })),
      };
    }

    case ACTIONS.SET_AGENT_ALLOCATION: {
      const { deptId, agentId, value } = action.payload;
      const deptIndex = state.departments.findIndex((d) => d.id === deptId);
      if (deptIndex === -1) return state;

      const dept = state.departments[deptIndex];
      const agentIndex = dept.agents.findIndex((a) => a.id === agentId);
      if (agentIndex === -1) return state;

      const normalizedAgents = normalizeAllocations(dept.agents, agentIndex, value);
      const fixedAgents = fixRoundingError(normalizedAgents);

      const newDepartments = [...state.departments];
      newDepartments[deptIndex] = {
        ...dept,
        agents: fixedAgents.map((agent, i) => ({
          ...dept.agents[i],
          allocation: agent.allocation,
        })),
      };

      return { ...state, departments: newDepartments };
    }

    case ACTIONS.SET_THRESHOLDS: {
      return {
        ...state,
        thresholds: { ...state.thresholds, ...action.payload },
      };
    }

    case ACTIONS.RENAME_DEPT: {
      const { deptId, name } = action.payload;
      return {
        ...state,
        departments: state.departments.map((d) =>
          d.id === deptId ? { ...d, name } : d
        ),
      };
    }

    case ACTIONS.SET_STATE: {
      return {
        ...state,
        totalBudget: action.payload.totalBudget ?? state.totalBudget,
        selectedModel: action.payload.selectedModel ?? state.selectedModel,
        thresholds: action.payload.thresholds ?? state.thresholds,
        departments: action.payload.departments ?? state.departments,
        usage: action.payload.usage ?? state.usage,
        simulationActive: action.payload.simulationActive ?? state.simulationActive,
      };
    }

    case ACTIONS.RESET: {
      return {
        ...initialState,
        departments: DEFAULT_DEPARTMENTS.map((dept) => ({
          ...dept,
          agents: dept.agents.map((a) => ({ ...a })),
        })),
      };
    }

    default:
      return state;
  }
}

// ── Provider ─────────────────────────────────
export function AllocationProvider({ children }) {
  const [state, dispatch] = useReducer(allocationReducer, initialState);

  return (
    <AllocationContext.Provider value={state}>
      <AllocationDispatchContext.Provider value={dispatch}>
        {children}
      </AllocationDispatchContext.Provider>
    </AllocationContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────
export function useAllocation() {
  const context = useContext(AllocationContext);
  if (!context) {
    throw new Error('useAllocation must be used within an AllocationProvider');
  }
  return context;
}

export function useAllocationDispatch() {
  const context = useContext(AllocationDispatchContext);
  if (!context) {
    throw new Error('useAllocationDispatch must be used within an AllocationProvider');
  }
  return context;
}
