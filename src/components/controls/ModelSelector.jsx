/**
 * ModelSelector — Dropdown to select the OpenAI model for pricing.
 */

import { useCallback } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import { getModelOptions } from '../../data/pricing';
import headerStyles from '../layout/Header.module.css';

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

  return (
    <div className={headerStyles.inputWrapper}>
      <label
        htmlFor="model-selector"
        className={headerStyles.inputLabel}
      >
        Model
      </label>

      <select
        id="model-selector"
        value={selectedModel}
        onChange={handleChange}
        className={headerStyles.selectField}
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
