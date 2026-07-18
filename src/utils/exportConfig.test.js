import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateConfig } from './exportConfig.js'

vi.mock('../data/pricing', () => ({
  getModelPricing: vi.fn(() => ({ name: 'GPT-5.6 Terra', input: 2.5, output: 15 })),
}))

const sampleState = {
  totalBudget: 1_000_000,
  selectedModel: 'gpt-5.6-terra',
  thresholds: { warning: 60, danger: 85 },
  departments: [
    {
      id: 'eng',
      name: 'Engineering',
      allocation: 50,
      agents: [
        { id: 'a1', name: 'Agent 1', allocation: 60, description: '' },
        { id: 'a2', name: 'Agent 2', allocation: 40, description: '' },
      ],
    },
    {
      id: 'mkt',
      name: 'Marketing',
      allocation: 50,
      agents: [
        { id: 'a3', name: 'Agent 3', allocation: 100, description: '' },
      ],
    },
  ],
}

describe('generateConfig', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T12:00:00Z'))
  })

  it('returns schema_version and generated_at', () => {
    const config = generateConfig(sampleState)
    expect(config.schema_version).toBe('1.0')
    expect(config.generated_at).toBe('2026-07-18T12:00:00.000Z')
  })

  it('includes total_budget_tokens and selected_model', () => {
    const config = generateConfig(sampleState)
    expect(config.total_budget_tokens).toBe(1_000_000)
    expect(config.selected_model.id).toBe('gpt-5.6-terra')
    expect(config.selected_model.name).toBe('GPT-5.6 Terra')
  })

  it('includes thresholds', () => {
    const config = generateConfig(sampleState)
    expect(config.thresholds).toEqual({ warning: 60, danger: 85 })
  })

  it('includes all departments with allocation and cost', () => {
    const config = generateConfig(sampleState)
    expect(config.departments).toHaveLength(2)
    const eng = config.departments.find((d) => d.id === 'eng')
    expect(eng.name).toBe('Engineering')
    expect(eng.allocation_percent).toBe(50)
    expect(eng.monthly_tokens).toBe(500_000)
  })

  it('includes agents within departments', () => {
    const config = generateConfig(sampleState)
    const eng = config.departments.find((d) => d.id === 'eng')
    expect(eng.agents).toHaveLength(2)
    expect(eng.agents[0].effective_percent).toBe(30)
    expect(eng.agents[1].effective_percent).toBe(20)
  })

  it('sets agent alert_status based on thresholds', () => {
    const highState = {
      ...sampleState,
      departments: [
        {
          id: 'eng',
          name: 'Engineering',
          allocation: 90,
          agents: [{ id: 'a1', name: 'A', allocation: 100, description: '' }],
        },
      ],
    }
    const config = generateConfig(highState)
    expect(config.departments[0].agents[0].alert_status).toBe('danger')
  })

  it('includes total_estimated_monthly_cost_usd', () => {
    const config = generateConfig(sampleState)
    expect(config.total_estimated_monthly_cost_usd).toBeGreaterThan(0)
  })
})
