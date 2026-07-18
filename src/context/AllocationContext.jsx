import { createContext, useContext, useReducer, useEffect } from 'react';
import {
  DEFAULT_TOTAL_BUDGET,
  DEFAULT_MODEL,
  DEFAULT_THRESHOLDS,
  DEFAULT_DEPARTMENTS,
} from '../data/defaultConfig';

const AllocationContext = createContext(null);
const AllocationDispatchContext = createContext(null);

export const ACTIONS = {
  SET_TOTAL_BUDGET: 'SET_TOTAL_BUDGET',
  SET_MODEL: 'SET_MODEL',
  SET_DEPT_ALLOCATION: 'SET_DEPT_ALLOCATION',
  SET_AGENT_ALLOCATION: 'SET_AGENT_ALLOCATION',
  SET_THRESHOLDS: 'SET_THRESHOLDS',
  RENAME_DEPT: 'RENAME_DEPT',
  ADD_DEPT: 'ADD_DEPT',
  REMOVE_DEPT: 'REMOVE_DEPT',
  RENAME_AGENT: 'RENAME_AGENT',
  ADD_AGENT: 'ADD_AGENT',
  REMOVE_AGENT: 'REMOVE_AGENT',
  RESET: 'RESET',
  SET_STATE: 'SET_STATE',
  UNDO: 'UNDO',
  REDO: 'REDO',
  MOVE_DEPT: 'MOVE_DEPT',
  MOVE_AGENT: 'MOVE_AGENT',
};

// ── Normalization Helper ─────────────────────
function normalizeAllocations(items, changedIndex, newValue) {
  const clamped = Math.max(0, Math.min(100, newValue));
  const remaining = 100 - clamped;
  const othersTotal = items.reduce(
    (sum, item, i) => (i === changedIndex ? sum : sum + item.allocation), 0
  );
  return items.map((item, i) => {
    if (i === changedIndex) return { ...item, allocation: clamped };
    if (othersTotal === 0) {
      const otherCount = items.length - 1;
      return { ...item, allocation: remaining / otherCount };
    }
    const proportion = item.allocation / othersTotal;
    return { ...item, allocation: Math.round(proportion * remaining * 100) / 100 };
  });
}

function fixRoundingError(items) {
  const total = items.reduce((sum, item) => sum + item.allocation, 0);
  const diff = 100 - total;
  if (Math.abs(diff) < 0.001) return items;
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

function redistribute(items, amount, excludeIndex = -1) {
  const others = items.filter((_, i) => i !== excludeIndex);
  const othersTotal = others.reduce((s, item) => s + item.allocation, 0);
  if (othersTotal === 0) {
    const share = amount / others.length;
    return items.map((item, i) =>
      i === excludeIndex ? item : { ...item, allocation: share }
    );
  }
  return items.map((item, i) => {
    if (i === excludeIndex) return item;
    const proportion = item.allocation / othersTotal;
    return { ...item, allocation: Math.round(proportion * amount * 100) / 100 };
  });
}

let _idCounter = Date.now();
function uid() { return `${++_idCounter}`; }

const DEPT_COLORS = ['--color-engineering', '--color-marketing', '--color-sales', '--color-operations', '--color-budget'];

// ── Present-only reducer (no past/future) ────
const initialPresent = {
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
      return { ...state, thresholds: { ...state.thresholds, ...action.payload } };
    }

    case ACTIONS.ADD_DEPT: {
      const newDept = {
        id: `dept-${uid()}`,
        name: 'New Department',
        colorVar: DEPT_COLORS[state.departments.length % DEPT_COLORS.length],
        allocation: 5,
        agents: [
          { id: `agent-${uid()}`, name: 'New Agent', allocation: 100, description: '' },
        ],
      };
      const depts = redistribute(state.departments, 95);
      return {
        ...state,
        departments: [...depts, newDept].map((d, i) => {
          const existing = state.departments[i];
          return i < state.departments.length
            ? { ...existing, allocation: d.allocation }
            : d;
        }),
      };
    }

    case ACTIONS.REMOVE_DEPT: {
      const removeDeptId = action.payload;
      const removed = state.departments.find((d) => d.id === removeDeptId);
      if (!removed) return state;
      const remaining = state.departments.filter((d) => d.id !== removeDeptId);
      const redistributed = redistribute(remaining, 100);
      return {
        ...state,
        departments: redistributed.map((d, i) => ({
          ...remaining[i],
          allocation: d.allocation,
        })),
      };
    }

    case ACTIONS.RENAME_AGENT: {
      const { deptId: raDeptId, agentId: raAgentId, name: raName } = action.payload;
      return {
        ...state,
        departments: state.departments.map((d) =>
          d.id === raDeptId
            ? { ...d, agents: d.agents.map((a) => (a.id === raAgentId ? { ...a, name: raName } : a)) }
            : d
        ),
      };
    }

    case ACTIONS.ADD_AGENT: {
      const addDeptId = action.payload;
      const deptIdx = state.departments.findIndex((d) => d.id === addDeptId);
      if (deptIdx === -1) return state;
      const dept = state.departments[deptIdx];
      const newAgent = {
        id: `agent-${uid()}`,
        name: 'New Agent',
        allocation: 10,
        description: '',
      };
      const agents = redistribute(dept.agents, 90);
      const newDepartments = [...state.departments];
      newDepartments[deptIdx] = {
        ...dept,
        agents: [...agents.map((a, i) => ({ ...dept.agents[i], allocation: a.allocation })), newAgent],
      };
      return { ...state, departments: newDepartments };
    }

    case ACTIONS.REMOVE_AGENT: {
      const { deptId: rDeptId, agentId: rAgentId } = action.payload;
      const rDeptIdx = state.departments.findIndex((d) => d.id === rDeptId);
      if (rDeptIdx === -1) return state;
      const rDept = state.departments[rDeptIdx];
      const remainingAgents = rDept.agents.filter((a) => a.id !== rAgentId);
      if (remainingAgents.length === 0) return state;
      const redistributedAgents = redistribute(remainingAgents, 100);
      const newDepts = [...state.departments];
      newDepts[rDeptIdx] = {
        ...rDept,
        agents: redistributedAgents.map((a, i) => ({
          ...remainingAgents[i],
          allocation: a.allocation,
        })),
      };
      return { ...state, departments: newDepts };
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

    case ACTIONS.MOVE_DEPT: {
      const { fromIndex, toIndex } = action.payload;
      const depts = [...state.departments];
      const [moved] = depts.splice(fromIndex, 1);
      depts.splice(toIndex, 0, moved);
      return { ...state, departments: depts };
    }

    case ACTIONS.MOVE_AGENT: {
      const { deptId, fromIndex, toIndex } = action.payload;
      const deptIdx = state.departments.findIndex((d) => d.id === deptId);
      if (deptIdx === -1) return state;
      const dept = state.departments[deptIdx];
      const agents = [...dept.agents];
      const [moved] = agents.splice(fromIndex, 1);
      agents.splice(toIndex, 0, moved);
      const newDepartments = [...state.departments];
      newDepartments[deptIdx] = { ...dept, agents };
      return { ...state, departments: newDepartments };
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
        ...initialPresent,
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

// ── Undoable wrapper ─────────────────────────
const TRACKED_ACTIONS = new Set([
  'SET_TOTAL_BUDGET', 'SET_MODEL', 'SET_DEPT_ALLOCATION', 'SET_AGENT_ALLOCATION',
  'SET_THRESHOLDS', 'RENAME_DEPT', 'ADD_DEPT', 'REMOVE_DEPT',
  'RENAME_AGENT', 'ADD_AGENT', 'REMOVE_AGENT', 'RESET',
  'MOVE_DEPT', 'MOVE_AGENT',
]);

function undoable(reducer) {
  return function(state, action) {
    if (action.type === ACTIONS.UNDO) {
      if (state.past.length === 0) return state;
      const { past, future, ...present } = state;
      const previous = past[past.length - 1];
      return {
        ...previous,
        past: past.slice(0, -1),
        future: [present, ...future],
      };
    }
    if (action.type === ACTIONS.REDO) {
      if (state.future.length === 0) return state;
      const { past, future, ...present } = state;
      const next = future[0];
      return {
        ...next,
        past: [...past, present],
        future: future.slice(1),
      };
    }

    const { past, future, ...present } = state;
    const newPresent = reducer(present, action);
    if (newPresent === present) return state;

    if (TRACKED_ACTIONS.has(action.type)) {
      return {
        ...newPresent,
        past: [...past, present],
        future: [],
      };
    }

    return { ...newPresent, past, future };
  };
}

// ── localStorage ─────────────────────────────
const STORAGE_KEY = 'swarm-allocator-state';

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.departments && Array.isArray(parsed.departments)) {
        return {
          ...initialPresent,
          ...parsed,
          departments: parsed.departments.map((d) => ({
            ...d,
            agents: d.agents ? d.agents.map((a) => ({ ...a })) : [],
          })),
        };
      }
    }
  } catch { }
  return initialPresent;
}

function getPresent(state) {
  const { past, future, ...present } = state;
  return present;
}

// ── Provider ─────────────────────────────────
const initialUndoableState = {
  ...loadSavedState(),
  past: [],
  future: [],
};

const undoingReducer = undoable(allocationReducer);

export function AllocationProvider({ children }) {
  const [state, dispatch] = useReducer(undoingReducer, initialUndoableState);

  useEffect(() => {
    const present = getPresent(state);
    const toSave = {
      totalBudget: present.totalBudget,
      selectedModel: present.selectedModel,
      thresholds: present.thresholds,
      departments: present.departments,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [state]);

  return (
    <AllocationContext.Provider value={state}>
      <AllocationDispatchContext.Provider value={dispatch}>
        {children}
      </AllocationDispatchContext.Provider>
    </AllocationContext.Provider>
  );
}

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
