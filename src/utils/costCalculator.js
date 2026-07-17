/**
 * Cost Calculator — Converts token allocations into dollar costs.
 */

import { getModelPricing } from '../data/pricing';
import { DEFAULT_INPUT_RATIO, DEFAULT_OUTPUT_RATIO } from '../data/defaultConfig';

/**
 * Calculate the cost for a given token count and model.
 * @param {number} tokens - Total tokens allocated
 * @param {string} modelId - Model ID from pricing table
 * @param {number} inputRatio - Fraction of tokens that are input (0–1)
 * @param {number} outputRatio - Fraction of tokens that are output (0–1)
 * @returns {{ inputCost: number, outputCost: number, totalCost: number, inputTokens: number, outputTokens: number }}
 */
export function calculateCost(
  tokens,
  modelId,
  inputRatio = DEFAULT_INPUT_RATIO,
  outputRatio = DEFAULT_OUTPUT_RATIO
) {
  const pricing = getModelPricing(modelId);

  const inputTokens = tokens * inputRatio;
  const outputTokens = tokens * outputRatio;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost,
  };
}

/**
 * Calculate costs for all agents across all departments.
 * @param {object} state - The full allocation state
 * @returns {Map<string, object>} Map of agentId → cost breakdown
 */
export function calculateAllCosts(state) {
  const { totalBudget, selectedModel, departments } = state;
  const costs = new Map();
  let totalMonthlyCost = 0;

  for (const dept of departments) {
    const deptTokens = totalBudget * (dept.allocation / 100);
    let deptCost = 0;

    for (const agent of dept.agents) {
      const agentTokens = deptTokens * (agent.allocation / 100);
      const cost = calculateCost(agentTokens, selectedModel);
      
      costs.set(agent.id, {
        ...cost,
        totalTokens: agentTokens,
        departmentId: dept.id,
        departmentName: dept.name,
        agentName: agent.name,
      });

      deptCost += cost.totalCost;
    }

    costs.set(dept.id, {
      totalTokens: deptTokens,
      totalCost: deptCost,
      departmentName: dept.name,
    });

    totalMonthlyCost += deptCost;
  }

  costs.set('__total__', { totalCost: totalMonthlyCost, totalTokens: totalBudget });

  return costs;
}
