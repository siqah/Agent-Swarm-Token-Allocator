/**
 * Number and currency formatting utilities.
 */

/**
 * Formats a number with commas and optional decimal places.
 * e.g. 1234567 → "1,234,567"
 */
export function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a number as compact (K, M, B).
 * e.g. 2400000 → "2.4M"
 */
export function formatCompact(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

/**
 * Formats a number as USD currency.
 * e.g. 482.5 → "$482.50"
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a percentage with 1 decimal place.
 * e.g. 42.567 → "42.6%"
 */
export function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

/**
 * Formats tokens as a human-readable string.
 * e.g. 2400000 → "2.4M tokens"
 */
export function formatTokens(value) {
  return `${formatCompact(value)} tokens`;
}
