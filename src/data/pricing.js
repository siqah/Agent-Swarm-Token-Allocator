/**
 * OpenAI Model Pricing Table
 * All prices are in USD per 1,000,000 tokens.
 * Updated: July 2026
 */

export const MODELS = {
  'gpt-5.6-sol': {
    name: 'GPT-5.6 Sol',
    tier: 'flagship',
    input: 5.00,
    output: 30.00,
    cached: 0.50,
    description: 'Most capable — complex reasoning & code',
  },
  'gpt-5.6-terra': {
    name: 'GPT-5.6 Terra',
    tier: 'balanced',
    input: 2.50,
    output: 15.00,
    cached: 0.25,
    description: 'Balanced performance & cost',
  },
  'gpt-5.6-luna': {
    name: 'GPT-5.6 Luna',
    tier: 'efficient',
    input: 1.00,
    output: 6.00,
    cached: 0.10,
    description: 'Fast & efficient for simple tasks',
  },
  'gpt-5.4-nano': {
    name: 'GPT-5.4 Nano',
    tier: 'economy',
    input: 0.20,
    output: 1.25,
    cached: 0.02,
    description: 'Ultra-low cost for high-volume tasks',
  },
};

/**
 * Returns the pricing object for a given model ID.
 * Falls back to GPT-5.6 Terra if model not found.
 */
export function getModelPricing(modelId) {
  return MODELS[modelId] || MODELS['gpt-5.6-terra'];
}

/**
 * Returns an array of [id, model] entries sorted by tier for the dropdown.
 */
export function getModelOptions() {
  return Object.entries(MODELS).map(([id, model]) => ({
    id,
    ...model,
  }));
}
