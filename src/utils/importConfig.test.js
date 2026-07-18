import { describe, it, expect } from 'vitest'
import { parseImportConfig } from './importConfig.js'

const validInput = JSON.stringify({
  totalBudget: 5_000_000,
  selectedModel: 'gpt-5.6-luna',
  thresholds: { warning: 50, danger: 80 },
  departments: [
    {
      id: 'eng',
      name: 'Engineering',
      allocation: 60,
      agents: [
        { id: 'a1', name: 'Reviewer', allocation: 70, description: 'Reviews code' },
        { id: 'a2', name: 'Debugger', allocation: 30 },
      ],
    },
  ],
})

describe('parseImportConfig', () => {
  it('parses valid JSON', () => {
    const result = parseImportConfig(validInput)
    expect(result.totalBudget).toBe(5_000_000)
    expect(result.selectedModel).toBe('gpt-5.6-luna')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseImportConfig('not json')).toThrow('Invalid JSON')
  })

  it('throws on missing departments', () => {
    expect(() => parseImportConfig('{"totalBudget":100}')).toThrow('must contain a "departments" array')
  })

  it('throws on empty departments', () => {
    expect(() => parseImportConfig('{"departments":[]}')).toThrow('must contain a "departments" array')
  })

  it('parses legacy snake_case fields', () => {
    const legacy = JSON.stringify({
      total_budget_tokens: 3_000_000,
      selected_model: { id: 'gpt-5.4-nano' },
      departments: [{ allocation_percent: 100, agents: [{ allocation_percent: 100 }] }],
    })
    const result = parseImportConfig(legacy)
    expect(result.totalBudget).toBe(3_000_000)
    expect(result.selectedModel).toBe('gpt-5.4-nano')
    expect(result.departments[0].allocation).toBe(100)
    expect(result.departments[0].agents[0].allocation).toBe(100)
  })

  it('generates ids when missing', () => {
    const input = JSON.stringify({
      departments: [{ name: 'Dept A', allocation: 100, agents: [{ name: 'Bot' }] }],
    })
    const result = parseImportConfig(input)
    expect(result.departments[0].id).toBeTruthy()
    expect(result.departments[0].agents[0].id).toBeTruthy()
  })

  it('applies defaults for missing fields', () => {
    const minimal = JSON.stringify({
      departments: [{ allocation: 100, agents: [{ allocation: 100 }] }],
    })
    const result = parseImportConfig(minimal)
    expect(result.totalBudget).toBe(10_000_000)
    expect(result.selectedModel).toBe('gpt-4o')
    expect(result.thresholds.warning).toBe(60)
    expect(result.thresholds.danger).toBe(85)
  })

  it('parses thresholds', () => {
    const result = parseImportConfig(validInput)
    expect(result.thresholds.warning).toBe(50)
    expect(result.thresholds.danger).toBe(80)
  })
})
