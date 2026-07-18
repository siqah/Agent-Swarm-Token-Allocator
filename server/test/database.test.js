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
      // Other instances should not be affected
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
    it('accepts a valid config update', () => {
      db.updateConfig({ totalBudget: 5000000 });
      assert.equal(db.get().totalBudget, 5000000);
    });

    it('throws for negative totalBudget', () => {
      assert.throws(() => db.updateConfig({ totalBudget: -100 }), /non-negative/);
    });

    it('throws for non-numeric totalBudget', () => {
      assert.throws(() => db.updateConfig({ totalBudget: 'abc' }), /non-negative/);
    });

    it('throws for NaN totalBudget', () => {
      assert.throws(() => db.updateConfig({ totalBudget: NaN }), /non-negative/);
    });

    it('throws for empty departments array', () => {
      assert.throws(() => db.updateConfig({ departments: [] }), /non-empty array/);
    });

    it('throws for non-array departments', () => {
      assert.throws(() => db.updateConfig({ departments: null }), /non-empty array/);
    });
  });

  describe('recordUsage', () => {
    it('accumulates token counts', () => {
      const result = db.recordUsage('test-agent', 100, 200);
      assert.equal(result.input, 100);
      assert.equal(result.output, 200);
      assert.equal(result.total, 300);
    });

    it('adds to existing counts', () => {
      db.recordUsage('test-agent', 50, 50);
      const result = db.recordUsage('test-agent', 10, 20);
      assert.equal(result.total, 430); // 300 + 100 + 30
    });
  });

  describe('regenerateSwarmKeys', () => {
    it('returns an object with key entries', () => {
      const keys = db.regenerateSwarmKeys();
      assert.ok(typeof keys === 'object');
      assert.ok(Object.keys(keys).length > 0);
    });

    it('keys match the swarm-{id} pattern', () => {
      const keys = db.regenerateSwarmKeys();
      for (const [key, info] of Object.entries(keys)) {
        assert.ok(key.startsWith('swarm-'), `Key ${key} should start with swarm-`);
        assert.ok(key.includes(info.agentId), `Key ${key} should contain agent ID ${info.agentId}`);
      }
    });
  });

  describe('simulation state', () => {
    it('setSimulationActive toggles correctly', () => {
      db.setSimulationActive(true);
      assert.equal(db.get().simulationActive, true);
      db.setSimulationActive(false);
      assert.equal(db.get().simulationActive, false);
    });
  });
});
