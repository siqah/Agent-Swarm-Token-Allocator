import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase } from '../db/index.js';
import { dbCompat as db } from '../db/queries.js';

describe('db/queries.js', () => {
  before(() => {
    initDatabase();
  });

  describe('get() state snapshot', () => {
    it('returns valid state snapshot with totalBudget and departments', () => {
      const snapshot = db.get();
      assert.ok(typeof snapshot.totalBudget === 'number');
      assert.ok(Array.isArray(snapshot.departments));
    });
  });

  describe('updateConfig validation', () => {
    it('accepts a valid config update', () => {
      db.updateConfig({ totalBudget: 5000000 });
      assert.equal(db.get().totalBudget, 5000000);
    });

    it('throws for negative totalBudget', () => {
      assert.throws(
        () => db.updateConfig({ totalBudget: -100 }),
        /non-negative/
      );
    });

    it('throws for non-array departments', () => {
      assert.throws(
        () => db.updateConfig({ departments: null }),
        /array/
      );
    });
  });

  describe('recordUsage', () => {
    it('accumulates token counts without throwing', () => {
      db.recordUsage('code-review', 100, 200);
      const usage = db.get().usage['code-review'];
      assert.ok(usage);
      assert.ok(usage.total >= 300);
    });
  });

  describe('swarm keys CRUD', () => {
    it('createSwarmKey creates key for valid agent', () => {
      const result = db.createSwarmKey('code-review', 'engineering');
      assert.ok(result);
      assert.equal(result.agentId, 'code-review');
      assert.equal(result.deptId, 'engineering');
      assert.ok(result.key.startsWith('swarm-'));
    });

    it('returns null for unknown agent', () => {
      const result = db.createSwarmKey('nonexistent', 'engineering');
      assert.equal(result, null);
    });

    it('revokeSwarmKey revokes an existing key', () => {
      const created = db.createSwarmKey('content-agent', 'marketing');
      const revoked = db.revokeSwarmKey(created.key);
      assert.ok(revoked);
      assert.equal(db.getAgentBySwarmKey(created.key), null);
    });
  });
});
