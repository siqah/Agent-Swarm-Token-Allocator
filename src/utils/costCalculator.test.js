import { describe, it, expect } from 'vitest'
import { calculateCost, calculateAllCosts } from './costCalculator'

describe('calculateCost', () => {
  it('returns zero for zero tokens', () => {
    const result = calculateCost(0, 'gpt-5.6-terra')
    expect(result.totalCost).toBe(0)
  })

  it('calculates cost for 1M tokens at terra pricing', () => {
    const result = calculateCost(1_000_000, 'gpt-5.6-terra', 0.7, 0.3)
    // 700K input × $2.50/M + 300K output × $15.00/M
    expect(result.totalCost).toBeCloseTo(6.25, 2)
  })

  it('uses default input/output ratios', () => {
    const result = calculateCost(1_000_000, 'gpt-5.6-sol')
    expect(result.inputTokens).toBe(700_000)
    expect(result.outputTokens).toBe(300_000)
  })
})

describe('calculateAllCosts', () => {
  const mockState = {
    totalBudget: 10_000_000,
    selectedModel: 'gpt-5.6-terra',
    departments: [
      {
        id: 'eng',
        name: 'Engineering',
        allocation: 50,
        agents: [
          { id: 'review', name: 'Review', allocation: 100 },
        ],
      },
    ],
  }

  it('returns a Map with department and total keys', () => {
    const costs = calculateAllCosts(mockState)
    expect(costs.has('eng')).toBe(true)
    expect(costs.has('__total__')).toBe(true)
  })

  it('includes agent costs', () => {
    const costs = calculateAllCosts(mockState)
    expect(costs.has('review')).toBe(true)
  })
})
