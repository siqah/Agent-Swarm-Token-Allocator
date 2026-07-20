import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let processChatCompletion, estimateCost;

before(async () => {
  process.env.TEST_MODE = '1';
  process.env.CONTROL_PLANE_TOKEN = 'test-ctrl-token';
  const mod = await import('../index.js');
  processChatCompletion = mod.processChatCompletion;
  estimateCost = mod.estimateCost;
});

describe('index.js – estimateCost', () => {
  it('calculates cost for 1M tokens at sol pricing', async () => {
    const cost = await estimateCost('gpt-5.6-sol', 500000, 500000);
    assert.equal(cost, 17.50);
  });

  it('calculates cost for 1M tokens at nano pricing', async () => {
    const cost = await estimateCost('gpt-5.4-nano', 500000, 500000);
    assert.equal(cost, 0.725);
  });

  it('falls back to terra pricing for unknown models', async () => {
    const cost = await estimateCost('unknown-model', 1000000, 0);
    assert.equal(cost, 2.50);
  });

  it('returns 0 for zero tokens', async () => {
    const cost = await estimateCost('gpt-5.6-terra', 0, 0);
    assert.equal(cost, 0);
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

  it('sol cost > terra cost at same token volume', async () => {
    const deptAlloc = 0.4;
    const agentAlloc = 0.6;
    const totalBudget = 10000000;
    const agentLimit = totalBudget * deptAlloc * agentAlloc;

    const solCost = await estimateCost('gpt-5.6-sol', agentLimit, agentLimit);
    const terraCost = await estimateCost('gpt-5.6-terra', agentLimit, agentLimit);

    assert.ok(solCost > terraCost, 'Sol should be more expensive than Terra');
  });
});
