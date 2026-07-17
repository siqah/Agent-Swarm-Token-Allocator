/**
 * BudgetInput — Numeric input for the total monthly token budget.
 */

import { useCallback } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import { formatNumber } from '../../utils/formatters';

export default function BudgetInput() {
  const { totalBudget } = useAllocation();
  const dispatch = useAllocationDispatch();

  const handleChange = useCallback(
    (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      const value = parseInt(raw, 10);
      if (!isNaN(value)) {
        dispatch({ type: ACTIONS.SET_TOTAL_BUDGET, payload: value });
      }
    },
    [dispatch]
  );

  const presets = [
    { label: '1M', value: 1_000_000 },
    { label: '5M', value: 5_000_000 },
    { label: '10M', value: 10_000_000 },
    { label: '50M', value: 50_000_000 },
  ];

  return (
    <div className="budget-input-wrapper">
      <label
        htmlFor="budget-input"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 'var(--weight-medium)',
        }}
      >
        Monthly Token Budget
      </label>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <input
          id="budget-input"
          type="text"
          value={formatNumber(totalBudget)}
          onChange={handleChange}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-semibold)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            color: 'var(--text-primary)',
            width: '140px',
            outline: 'none',
            transition: 'border-color var(--duration-fast)',
          }}
          aria-label="Total monthly token budget"
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() =>
              dispatch({ type: ACTIONS.SET_TOTAL_BUDGET, payload: preset.value })
            }
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background:
                totalBudget === preset.value
                  ? 'oklch(0.75 0.12 250 / 0.2)'
                  : 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color:
                totalBudget === preset.value
                  ? 'oklch(0.75 0.12 250)'
                  : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all var(--duration-fast)',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
