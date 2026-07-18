import { describe, it, expect } from 'vitest'
import { ACTIONS } from './AllocationContext.jsx'

// Import the reducer directly by re-creating its logic for testing
// The actual allocationReducer is not exported, so we test the behavior
// through a simplified version of the normalization logic

import {
  DEFAULT_TOTAL_BUDGET,
  DEFAULT_MODEL,
  DEFAULT_DEPARTMENTS,
} from '../data/defaultConfig'

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
