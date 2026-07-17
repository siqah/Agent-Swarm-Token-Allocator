/**
 * ModelSelector — Dropdown to select the OpenAI model for pricing.
 */

import { useCallback } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import { getModelOptions } from '../../data/pricing';

export default function ModelSelector() {
  const { selectedModel } = useAllocation();
  const dispatch = useAllocationDispatch();
  const models = getModelOptions();

  const handleChange = useCallback(
    (e) => {
      dispatch({ type: ACTIONS.SET_MODEL, payload: e.target.value });
    },
    [dispatch]
  );

  const tierColors = {
    flagship: 'oklch(0.65 0.25 25)',
    balanced: 'oklch(0.75 0.15 200)',
    efficient: 'oklch(0.78 0.17 150)',
    economy: 'oklch(0.82 0.18 80)',
  };

  return (
    <div className="model-selector-wrapper">
      <label
        htmlFor="model-selector"
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 'var(--weight-medium)',
        }}
      >
        Model
      </label>

      <select
        id="model-selector"
        value={selectedModel}
        onChange={handleChange}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2) var(--space-3)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          outline: 'none',
          width: '100%',
          transition: 'border-color var(--duration-fast)',
        }}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} — ${model.input}/${model.output} per 1M
          </option>
        ))}
      </select>
    </div>
  );
}
