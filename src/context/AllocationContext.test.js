import { describe, it, expect } from 'vitest'
import { ACTIONS, allocationReducer } from './AllocationContext.jsx'

import {
  DEFAULT_TOTAL_BUDGET,
  DEFAULT_MODEL,
  DEFAULT_THRESHOLDS,
  DEFAULT_DEPARTMENTS,
} from '../data/defaultConfig'

const baseState = {
  totalBudget: DEFAULT_TOTAL_BUDGET,
  selectedModel: DEFAULT_MODEL,
  thresholds: { ...DEFAULT_THRESHOLDS },
  departments: DEFAULT_DEPARTMENTS.map((d) => ({
    ...d,
    agents: d.agents.map((a) => ({ ...a })),
  })),
  simulationActive: false,
  usage: {},
}

function normalizeAllocations(items, changedIndex, newValue) {
  const clamped = Math.max(0, Math.min(100, newValue))
  const remaining = 100 - clamped
  const othersTotal = items.reduce(
    (sum, item, i) => (i === changedIndex ? sum : sum + item.allocation), 0
  )
  return items.map((item, i) => {
    if (i === changedIndex) return { ...item, allocation: clamped }
    if (othersTotal === 0) {
      const otherCount = items.length - 1
      return { ...item, allocation: remaining / otherCount }
    }
    const proportion = item.allocation / othersTotal
    return { ...item, allocation: Math.round(proportion * remaining * 100) / 100 }
  })
}

function fixRoundingError(items) {
  const total = items.reduce((sum, item) => sum + item.allocation, 0)
  const diff = 100 - total
  if (Math.abs(diff) < 0.001) return items
  const result = [...items]
  let maxIdx = 0
  for (let i = 1; i < result.length; i++) {
    if (result[i].allocation > result[maxIdx].allocation) maxIdx = i
  }
  result[maxIdx] = {
    ...result[maxIdx],
    allocation: Math.round((result[maxIdx].allocation + diff) * 100) / 100,
  }
  return result
}

describe('normalizeAllocations', () => {
  const items = [
    { id: 'a', allocation: 30 },
    { id: 'b', allocation: 30 },
    { id: 'c', allocation: 40 },
  ]

  it('clamps to 0–100', () => {
    const result = normalizeAllocations(items, 0, 150)
    expect(result[0].allocation).toBe(100)
    expect(result[1].allocation + result[2].allocation).toBeCloseTo(0, 5)
  })

  it('redistributes proportionally', () => {
    const result = normalizeAllocations(items, 0, 50)
    expect(result[0].allocation).toBe(50)
    expect(result[1].allocation).toBe(21.43)
    expect(result[2].allocation).toBe(28.57)
  })

  it('sums to 100', () => {
    const result = normalizeAllocations(items, 1, 20)
    const total = result.reduce((s, i) => s + i.allocation, 0)
    expect(total).toBeCloseTo(100, 5)
  })
})

describe('fixRoundingError', () => {
  it('adjusts the largest item to fix rounding', () => {
    const items = [
      { id: 'a', allocation: 33.33 },
      { id: 'b', allocation: 33.33 },
      { id: 'c', allocation: 33.33 },
    ]
    const result = fixRoundingError(items)
    const total = result.reduce((s, i) => s + i.allocation, 0)
    expect(total).toBe(100)
  })
})

describe('config defaults', () => {
  it('has 4 departments', () => {
    expect(DEFAULT_DEPARTMENTS).toHaveLength(4)
  })

  it('departments sum to 100', () => {
    const total = DEFAULT_DEPARTMENTS.reduce((s, d) => s + d.allocation, 0)
    expect(total).toBe(100)
  })

  it('each department has agents summing to 100', () => {
    DEFAULT_DEPARTMENTS.forEach((dept) => {
      const total = dept.agents.reduce((s, a) => s + a.allocation, 0)
      expect(total).toBe(100)
    })
  })
})

describe('allocationReducer', () => {
  it('SET_TOTAL_BUDGET clamps to zero', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.SET_TOTAL_BUDGET, payload: -100 })
    expect(next.totalBudget).toBe(0)
  })

  it('SET_TOTAL_BUDGET rounds to integer', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.SET_TOTAL_BUDGET, payload: 12.75 })
    expect(next.totalBudget).toBe(13)
  })

  it('SET_MODEL updates model', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.SET_MODEL, payload: 'gpt-5.6-luna' })
    expect(next.selectedModel).toBe('gpt-5.6-luna')
  })

  it('SET_THRESHOLDS merges thresholds', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.SET_THRESHOLDS, payload: { warning: 50 } })
    expect(next.thresholds.warning).toBe(50)
    expect(next.thresholds.danger).toBe(95)
  })

  it('SET_DEPT_ALLOCATION clamps and normalizes', () => {
    const engIdx = baseState.departments.findIndex((d) => d.id === 'engineering')
    const next = allocationReducer(baseState, {
      type: ACTIONS.SET_DEPT_ALLOCATION,
      payload: { deptId: 'engineering', value: 100 },
    })
    expect(next.departments[engIdx].allocation).toBe(100)
    const otherTotal = next.departments
      .filter((_, i) => i !== engIdx)
      .reduce((s, d) => s + d.allocation, 0)
    expect(otherTotal).toBe(0)
  })

  it('SET_AGENT_ALLOCATION normalizes agent allocations', () => {
    const next = allocationReducer(baseState, {
      type: ACTIONS.SET_AGENT_ALLOCATION,
      payload: { deptId: 'engineering', agentId: 'code-review', value: 80 },
    })
    const eng = next.departments.find((d) => d.id === 'engineering')
    const cr = eng.agents.find((a) => a.id === 'code-review')
    const dbg = eng.agents.find((a) => a.id === 'debug-agent')
    expect(cr.allocation).toBe(80)
    expect(dbg.allocation).toBe(20)
  })

  it('ADD_DEPT creates new department and redistributes', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.ADD_DEPT })
    expect(next.departments).toHaveLength(baseState.departments.length + 1)
    const added = next.departments[next.departments.length - 1]
    expect(added.name).toBe('New Department')
    expect(added.allocation).toBe(5)
    const total = next.departments.reduce((s, d) => s + d.allocation, 0)
    expect(total).toBeCloseTo(100, 1)
  })

  it('REMOVE_DEPT removes and redistributes', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.REMOVE_DEPT, payload: 'engineering' })
    expect(next.departments).toHaveLength(baseState.departments.length - 1)
    expect(next.departments.find((d) => d.id === 'engineering')).toBeUndefined()
    const total = next.departments.reduce((s, d) => s + d.allocation, 0)
    expect(total).toBeCloseTo(100, 1)
  })

  it('REMOVE_DEPT returns state for unknown id', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.REMOVE_DEPT, payload: 'nonexistent' })
    expect(next).toBe(baseState)
  })

  it('ADD_AGENT creates new agent and redistributes', () => {
    const next = allocationReducer(baseState, { type: ACTIONS.ADD_AGENT, payload: 'engineering' })
    const eng = next.departments.find((d) => d.id === 'engineering')
    expect(eng.agents).toHaveLength(baseState.departments[0].agents.length + 1)
    const total = eng.agents.reduce((s, a) => s + a.allocation, 0)
    expect(total).toBeCloseTo(100, 1)
  })

  it('REMOVE_AGENT removes and redistributes', () => {
    const next = allocationReducer(baseState, {
      type: ACTIONS.REMOVE_AGENT,
      payload: { deptId: 'engineering', agentId: 'code-review' },
    })
    const eng = next.departments.find((d) => d.id === 'engineering')
    expect(eng.agents.find((a) => a.id === 'code-review')).toBeUndefined()
    const total = eng.agents.reduce((s, a) => s + a.allocation, 0)
    expect(total).toBe(100)
  })

  it('REMOVE_AGENT with last agent returns state', () => {
    const deptWithOne = { ...baseState, departments: [{ ...baseState.departments[0], agents: [{ id: 'x', name: 'X', allocation: 100, description: '' }] }] }
    const next = allocationReducer(deptWithOne, {
      type: ACTIONS.REMOVE_AGENT,
      payload: { deptId: 'engineering', agentId: 'x' },
    })
    expect(next).toBe(deptWithOne)
  })

  it('RENAME_DEPT updates name', () => {
    const next = allocationReducer(baseState, {
      type: ACTIONS.RENAME_DEPT,
      payload: { deptId: 'engineering', name: 'Eng' },
    })
    const dept = next.departments.find((d) => d.id === 'engineering')
    expect(dept.name).toBe('Eng')
  })

  it('RENAME_AGENT updates agent name', () => {
    const next = allocationReducer(baseState, {
      type: ACTIONS.RENAME_AGENT,
      payload: { deptId: 'engineering', agentId: 'code-review', name: 'CR Agent' },
    })
    const agent = next.departments.find((d) => d.id === 'engineering').agents.find((a) => a.id === 'code-review')
    expect(agent.name).toBe('CR Agent')
  })

  it('MOVE_DEPT reorders departments', () => {
    const next = allocationReducer(baseState, {
      type: ACTIONS.MOVE_DEPT,
      payload: { fromIndex: 0, toIndex: 2 },
    })
    expect(next.departments[2].id).toBe('engineering')
    expect(next.departments[0].id).not.toBe('engineering')
  })

  it('MOVE_AGENT reorders agents within department', () => {
    const next = allocationReducer(baseState, {
      type: ACTIONS.MOVE_AGENT,
      payload: { deptId: 'engineering', fromIndex: 0, toIndex: 1 },
    })
    const eng = next.departments.find((d) => d.id === 'engineering')
    expect(eng.agents[1].id).toBe('code-review')
    expect(eng.agents[0].id).toBe('debug-agent')
  })

  it('RESET returns initial config', () => {
    const modified = allocationReducer(baseState, { type: ACTIONS.SET_TOTAL_BUDGET, payload: 999 })
    expect(modified.totalBudget).toBe(999)
    const reset = allocationReducer(modified, { type: ACTIONS.RESET })
    expect(reset.totalBudget).toBe(DEFAULT_TOTAL_BUDGET)
    expect(reset.selectedModel).toBe(DEFAULT_MODEL)
    expect(reset.departments).toHaveLength(DEFAULT_DEPARTMENTS.length)
  })

  it('SET_STATE merges partial state', () => {
    const next = allocationReducer(baseState, {
      type: ACTIONS.SET_STATE,
      payload: { totalBudget: 42, simulationActive: true },
    })
    expect(next.totalBudget).toBe(42)
    expect(next.simulationActive).toBe(true)
    expect(next.selectedModel).toBe(DEFAULT_MODEL)
  })

  it('returns same state for unknown action', () => {
    const next = allocationReducer(baseState, { type: 'UNKNOWN' })
    expect(next).toBe(baseState)
  })
})
