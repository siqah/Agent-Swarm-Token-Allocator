import { useCallback } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import { formatNumber } from '../../utils/formatters';
import headerStyles from '../layout/Header.module.css';

const MAX_BUDGET = 1_000_000_000_000;

export default function BudgetInput() {
  const { totalBudget } = useAllocation();
  const dispatch = useAllocationDispatch();

  const presets = [
    { label: '1M', value: 1_000_000, color: 'var(--color-budget)' },
    { label: '5M', value: 5_000_000, color: 'var(--color-engineering)' },
    { label: '10M', value: 10_000_000, color: 'var(--color-marketing)' },
    { label: '50M', value: 50_000_000, color: 'var(--color-sales)' },
  ];

  const handleChange = useCallback(
    (e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      const value = parseInt(raw, 10);
      if (!isNaN(value)) {
        dispatch({ type: ACTIONS.SET_TOTAL_BUDGET, payload: Math.min(value, MAX_BUDGET) });
      }
    },
    [dispatch]
  );

  return (
    <div className={headerStyles.budgetGroup}>
      <label htmlFor="budget-input" className={headerStyles.inputLabel}>
        Budget
      </label>
      <input
        id="budget-input"
        type="text"
        value={formatNumber(totalBudget)}
        onChange={handleChange}
        className={headerStyles.inputField}
        aria-label="Total monthly token budget"
        maxLength={15}
        title={`Max ${formatNumber(MAX_BUDGET)}`}
      />
      <div className={headerStyles.presetGroup}>
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() =>
              dispatch({ type: ACTIONS.SET_TOTAL_BUDGET, payload: preset.value })
            }
            style={{ '--preset-color': preset.color }}
            className={`${headerStyles.presetButton} ${
              totalBudget === preset.value ? headerStyles.presetButtonActive : ''
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
