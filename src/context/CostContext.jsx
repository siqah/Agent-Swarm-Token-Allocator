/**
 * CostContext — Derived cost calculations from AllocationContext.
 * Recomputes automatically when allocations, budget, or model change.
 */

import { createContext, useContext, useMemo } from 'react';
import { useAllocation } from './AllocationContext';
import { calculateAllCosts } from '../utils/costCalculator';

const CostContext = createContext(null);

export function CostProvider({ children }) {
  const state = useAllocation();

  const costs = useMemo(() => calculateAllCosts(state), [state]);

  const value = useMemo(
    () => ({
      costs,
      totalCost: costs.get('__total__')?.totalCost || 0,
      getCost: (id) => costs.get(id) || null,
    }),
    [costs]
  );

  return <CostContext.Provider value={value}>{children}</CostContext.Provider>;
}

export function useCosts() {
  const context = useContext(CostContext);
  if (!context) {
    throw new Error('useCosts must be used within a CostProvider');
  }
  return context;
}
