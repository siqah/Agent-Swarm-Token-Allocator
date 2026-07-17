/**
 * Export Config — Generates a downloadable JSON configuration file
 * from the current allocation state.
 */

import { calculateAllCosts } from './costCalculator';
import { getModelPricing } from '../data/pricing';

/**
 * Generate the full configuration object from current state.
 */
export function generateConfig(state) {
  const costs = calculateAllCosts(state);
  const modelPricing = getModelPricing(state.selectedModel);

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    total_budget_tokens: state.totalBudget,
    selected_model: {
      id: state.selectedModel,
      name: modelPricing.name,
      input_price_per_1m: modelPricing.input,
      output_price_per_1m: modelPricing.output,
    },
    total_estimated_monthly_cost_usd: costs.get('__total__').totalCost,
    thresholds: { ...state.thresholds },
    departments: state.departments.map((dept) => {
      const deptCost = costs.get(dept.id);
      return {
        id: dept.id,
        name: dept.name,
        allocation_percent: dept.allocation,
        monthly_tokens: deptCost?.totalTokens || 0,
        estimated_monthly_cost_usd: deptCost?.totalCost || 0,
        agents: dept.agents.map((agent) => {
          const agentCost = costs.get(agent.id);
          const effectivePercent = (dept.allocation / 100) * (agent.allocation / 100) * 100;
          return {
            id: agent.id,
            name: agent.name,
            allocation_percent: agent.allocation,
            effective_percent: Math.round(effectivePercent * 100) / 100,
            monthly_tokens: agentCost?.totalTokens || 0,
            estimated_monthly_cost_usd: agentCost?.totalCost || 0,
            alert_status:
              effectivePercent >= state.thresholds.danger
                ? 'danger'
                : effectivePercent >= state.thresholds.warning
                ? 'warning'
                : 'normal',
          };
        }),
      };
    }),
  };
}

/**
 * Download the config as a JSON file.
 */
export function downloadConfig(state) {
  const config = generateConfig(state);
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `swarm-config-${timestamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Copy the config JSON to clipboard.
 */
export async function copyConfigToClipboard(state) {
  const config = generateConfig(state);
  const json = JSON.stringify(config, null, 2);
  await navigator.clipboard.writeText(json);
  return json;
}
