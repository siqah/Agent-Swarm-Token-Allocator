import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Database, DEFAULTS } from '../database.js';

function freshDb() {
  return new Database({ skipInit: true });
}

describe('database.js', () => {
  let db;

  before(() => {
    db = freshDb();
  });

  describe('deepClone behavior (used internally)', () => {
    it('constructor creates an independent copy of DEFAULTS', () => {
      const d = freshDb();
      d.data.totalBudget = 999999;
      const d2 = freshDb();
      assert.notEqual(d2.data.totalBudget, 999999);
    });
  });

  describe('get() immutability', () => {
    it('returns a copy, not the internal reference', () => {
      const snapshot = db.get();
      snapshot.totalBudget = 999999;
      assert.notEqual(db.get().totalBudget, 999999);
    });

    it('deeply nested mutations do not affect internal state', () => {
      const snapshot = db.get();
      snapshot.departments[0].allocation = 99;
      assert.notEqual(db.get().departments[0].allocation, 99);
    });
  });

  describe('updateConfig validation', () => {
    it('accepts a valid config update', async () => {
      await db.updateConfig({ totalBudget: 5000000 });
      assert.equal(db.get().totalBudget, 5000000);
    });

    it('throws for negative totalBudget', async () => {
      await assert.rejects(
        () => db.updateConfig({ totalBudget: -100 }),
        /non-negative/
      );
    });

    it('throws for non-numeric totalBudget', async () => {
      await assert.rejects(
        () => db.updateConfig({ totalBudget: 'abc' }),
        /non-negative/
      );
    });

    it('throws for NaN totalBudget', async () => {
      await assert.rejects(
        () => db.updateConfig({ totalBudget: NaN }),
        /non-negative/
      );
    });

    it('throws for empty departments array', async () => {
      await assert.rejects(
        () => db.updateConfig({ departments: [] }),
        /non-empty array/
      );
    });

    it('throws for non-array departments', async () => {
      await assert.rejects(
        () => db.updateConfig({ departments: null }),
        /non-empty array/
      );
    });
  });

  describe('recordUsage', () => {
    it('accumulates token counts', async () => {
      const result = await db.recordUsage('test-agent', 100, 200);
      assert.equal(result.input, 100);
      assert.equal(result.output, 200);
      assert.equal(result.total, 300);
    });

    it('adds to existing counts', async () => {
      await db.recordUsage('test-agent', 50, 50);
      const result = await db.recordUsage('test-agent', 10, 20);
      assert.equal(result.total, 430); // 300 + 100 + 30
    });
  });

  describe('regenerateSwarmKeys', () => {
    it('returns an object with key entries', async () => {
      const keys = await db.regenerateSwarmKeys();
      assert.ok(typeof keys === 'object');
      assert.ok(Object.keys(keys).length > 0);
    });

    it('keys match the swarm-{id} pattern', async () => {
      const keys = await db.regenerateSwarmKeys();
      for (const [key, info] of Object.entries(keys)) {
        assert.ok(key.startsWith('swarm-'), `Key ${key} should start with swarm-`);
        assert.ok(key.includes(info.agentId), `Key ${key} should contain agent ID ${info.agentId}`);
      }
    });
  });

  describe('simulation state', () => {
    it('setSimulationActive toggles correctly', async () => {
      await db.setSimulationActive(true);
      assert.equal(db.get().simulationActive, true);
      await db.setSimulationActive(false);
      assert.equal(db.get().simulationActive, false);
    });
  });

  describe('createSwarmKey', () => {
    it('creates key for valid agent', async () => {
      const result = await db.createSwarmKey('code-review', 'engineering');
      assert.ok(result);
      assert.equal(result.agentId, 'code-review');
      assert.equal(result.deptId, 'engineering');
      assert.ok(result.key.startsWith('swarm-'));
    });

    it('returns null for unknown agent', async () => {
      const result = await db.createSwarmKey('nonexistent', 'engineering');
      assert.equal(result, null);
    });

    it('returns null for unknown department', async () => {
      const result = await db.createSwarmKey('code-review', 'fake-dept');
      assert.equal(result, null);
    });
  });

  describe('revokeSwarmKey', () => {
    it('revokes an existing key', async () => {
      const { key } = await db.createSwarmKey('content-agent', 'marketing');
      const revoked = await db.revokeSwarmKey(key);
      assert.ok(revoked);
      assert.equal(revoked.agentId, 'content-agent');
      // Key should no longer be valid
      assert.equal(db.getAgentBySwarmKey(key), null);
    });

    it('returns null for non-existent key', async () => {
      const result = await db.revokeSwarmKey('swarm-nonexistent-abc123');
      assert.equal(result, null);
    });
  });

  describe('regenerateSingleSwarmKey', () => {
    it('replaces an existing key', async () => {
      const { key: oldKey } = await db.createSwarmKey('lead-scoring', 'sales');
      const result = await db.regenerateSingleSwarmKey(oldKey);
      assert.ok(result);
      assert.equal(result.agentId, 'lead-scoring');
      // Old key should be invalid
      assert.equal(db.getAgentBySwarmKey(oldKey), null);
      // New key should be valid
      assert.ok(db.getAgentBySwarmKey(result.key));
    });

    it('returns null for non-existent key', async () => {
      const result = await db.regenerateSingleSwarmKey('swarm-nonexistent-abc123');
      assert.equal(result, null);
    });
  });
});
