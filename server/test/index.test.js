import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../database.js';

let processChatCompletion, estimateCost, MODEL_PRICING, FALLBACK_CHAIN;

before(async () => {
  process.env.TEST_MODE = '1';
  process.env.CONTROL_PLANE_TOKEN = 'test-ctrl-token';
  const mod = await import('../index.js');
  processChatCompletion = mod.processChatCompletion;
  estimateCost = mod.estimateCost;
  MODEL_PRICING = mod.MODEL_PRICING;
  FALLBACK_CHAIN = mod.FALLBACK_CHAIN;
});

describe('index.js – estimateCost', () => {
  it('calculates cost for 1M tokens at sol pricing', () => {
    const cost = estimateCost('gpt-5.6-sol', 500000, 500000);
    assert.equal(cost, 17.50);
  });

  it('calculates cost for 1M tokens at nano pricing', () => {
    const cost = estimateCost('gpt-5.4-nano', 500000, 500000);
    assert.equal(cost, 0.725);
  });

  it('falls back to terra pricing for unknown models', () => {
    const cost = estimateCost('unknown-model', 1000000, 0);
    assert.equal(cost, 2.50);
  });

  it('returns 0 for zero tokens', () => {
    assert.equal(estimateCost('gpt-5.6-terra', 0, 0), 0);
  });
});

describe('index.js – FALLBACK_CHAIN', () => {
  it('has 4 models in order from most to least expensive', () => {
    assert.deepEqual(FALLBACK_CHAIN, ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-nano']);
  });

  it('each model in chain exists in MODEL_PRICING', () => {
    FALLBACK_CHAIN.forEach((model) => {
      assert.ok(MODEL_PRICING[model], `Missing pricing for ${model}`);
    });
  });
});

describe('index.js – processChatCompletion (budget logic)', () => {
  it('returns 400 for unknown agent', async () => {
    const result = await processChatCompletion({
      agentId: 'nonexistent',
      deptId: 'fake',
      model: 'gpt-5.6-terra',
      messages: [{ role: 'user', content: 'hello' }],
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.error.code, 'invalid_agent_info');
  });

  it('returns 200 for valid agent with sufficient budget', async () => {
    const result = await processChatCompletion({
      agentId: 'code-review',
      deptId: 'engineering',
      model: 'gpt-5.6-sol',
      messages: [{ role: 'user', content: 'test' }],
    });
    assert.equal(result.statusCode, 200);
    assert.ok(result.usage.total_tokens > 0);
    assert.equal(result.model, 'gpt-5.6-sol');
  });

  it('sol cost > terra cost at same token volume', () => {
    const deptAlloc = 0.4;
    const agentAlloc = 0.6;
    const totalBudget = 10000000;
    const agentLimit = totalBudget * deptAlloc * agentAlloc;

    const solCost = estimateCost('gpt-5.6-sol', agentLimit, agentLimit);
    const terraCost = estimateCost('gpt-5.6-terra', agentLimit, agentLimit);

    assert.ok(solCost > terraCost, 'Sol should be more expensive than Terra');
  });
});

describe('index.js – pricing data integrity', () => {
  it('MODEL_PRICING has all fallback chain models', () => {
    FALLBACK_CHAIN.forEach((model) => {
      assert.ok(MODEL_PRICING[model], `${model} missing from MODEL_PRICING`);
    });
  });

  it('pricing values are positive', () => {
    Object.values(MODEL_PRICING).forEach((p) => {
      assert.ok(p.input > 0);
      assert.ok(p.output > 0);
    });
  });
});
