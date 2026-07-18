import { describe, it, expect } from 'vitest'
import { formatNumber, formatCompact, formatCurrency, formatPercent, formatTokens } from './formatters'

describe('formatNumber', () => {
  it('formats with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats with decimals', () => {
    expect(formatNumber(1234.567, 2)).toBe('1,234.57')
  })
})

describe('formatCompact', () => {
  it('formats billions', () => {
    expect(formatCompact(2_400_000_000)).toBe('2.4B')
  })

  it('formats millions', () => {
    expect(formatCompact(2_400_000)).toBe('2.4M')
  })

  it('formats thousands', () => {
    expect(formatCompact(2_400)).toBe('2.4K')
  })

  it('returns string for small numbers', () => {
    expect(formatCompact(999)).toBe('999')
  })
})

describe('formatCurrency', () => {
  it('formats USD', () => {
    expect(formatCurrency(482.5)).toBe('$482.50')
  })
})

describe('formatPercent', () => {
  it('formats with one decimal', () => {
    expect(formatPercent(42.567)).toBe('42.6%')
  })
})

describe('formatTokens', () => {
  it('formats compact with suffix', () => {
    expect(formatTokens(2_400_000)).toBe('2.4M tokens')
  })
})
