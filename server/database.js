import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { runMigrations } from './migrate.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const DB_FILE = path.join(__dirname, 'db.json');
const DB_TEMP_FILE = DB_FILE + '.tmp';
const { Pool } = pg;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class Mutex {
  constructor() {
    this._locked = false;
    this._queue = [];
  }

  acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  release() {
    if (this._queue.length > 0) {
      this._queue.shift()();
    } else {
      this._locked = false;
    }
  }

  async withLock(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const DEFAULTS = {
  totalBudget: 10000000,
  selectedModel: 'gpt-5.6-terra',
  thresholds: { warning: 80, danger: 95 },
  departments: [
    {
      id: 'engineering',
      name: 'Engineering',
      colorVar: '--color-engineering',
      allocation: 40,
      agents: [
        { id: 'code-review', name: 'Code Review Agent', allocation: 60, description: 'Reviews pull requests and suggests improvements' },
        { id: 'debug-agent', name: 'Debug Agent', allocation: 40, description: 'Diagnoses bugs and proposes fixes' }
      ]
    },
    {
      id: 'marketing',
      name: 'Marketing',
      colorVar: '--color-marketing',
      allocation: 25,
      agents: [
        { id: 'content-agent', name: 'Content Agent', allocation: 55, description: 'Generates blog posts, social media, and copy' },
        { id: 'seo-agent', name: 'SEO Agent', allocation: 45, description: 'Optimizes content for search engine ranking' }
      ]
    },
    {
      id: 'sales',
      name: 'Sales',
      colorVar: '--color-sales',
      allocation: 20,
      agents: [
        { id: 'lead-scoring', name: 'Lead Scoring Agent', allocation: 50, description: 'Evaluates and ranks potential customer leads' },
        { id: 'email-drafter', name: 'Email Drafter Agent', allocation: 50, description: 'Drafts personalized outreach emails' }
      ]
    },
    {
      id: 'operations',
      name: 'Operations',
      colorVar: '--color-operations',
      allocation: 15,
      agents: [
        { id: 'data-analysis', name: 'Data Analysis Agent', allocation: 65, description: 'Analyzes datasets and generates insights' },
        { id: 'reporting', name: 'Reporting Agent', allocation: 35, description: 'Creates automated reports and summaries' }
      ]
    }
  ],
  usage: {
    'code-review': { input: 0, output: 0, total: 0 },
    'debug-agent': { input: 0, output: 0, total: 0 },
    'content-agent': { input: 0, output: 0, total: 0 },
    'seo-agent': { input: 0, output: 0, total: 0 },
    'lead-scoring': { input: 0, output: 0, total: 0 },
    'email-drafter': { input: 0, output: 0, total: 0 },
    'data-analysis': { input: 0, output: 0, total: 0 },
    'reporting': { input: 0, output: 0, total: 0 }
  },
  simulationActive: false,
  swarmKeys: {}
};

class Database {
  constructor(options = {}) {
    this.data = deepClone(DEFAULTS);
    this.isPostgres = false;
    this.pool = null;
    this._mutex = new Mutex();
    if (!options.skipInit) {
      this.init();
    }
  }

  withLock(fn) {
    return this._mutex.withLock(fn);
  }

  getTokenLimit(dept, agent) {
    return this.data.totalBudget * (dept.allocation / 100) * (agent.allocation / 100);
  }

  async init() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      logger.info('No DATABASE_URL found. Running with local JSON database.');
      await this.loadJson();
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3000
      });

      const client = await this.pool.connect();
      client.release();

      this.isPostgres = true;
      logger.info('Connected to PostgreSQL database successfully.');

      await this.initSchema();
      await this.hydrateFromPostgres();
      await this.ensureSwarmKeys();
    } catch (err) {
      logger.warn('PostgreSQL connection failed. Falling back to local JSON database.');
      this.isPostgres = false;
      await this.loadJson();
    }
  }

  async initSchema() {
    try {
      await runMigrations(this.pool);
    } catch (err) {
      logger.error('Error running database migrations:', err);
      throw err;
    }
  }

  async hydrateFromPostgres() {
    try {
      const configRes = await this.pool.query("SELECT value FROM config WHERE key = 'main'");
      if (configRes.rows.length > 0) {
        const stored = configRes.rows[0].value;
        this.data.totalBudget = stored.totalBudget;
        this.data.selectedModel = stored.selectedModel;
        this.data.departments = deepClone(stored.departments);
        this.data.thresholds = stored.thresholds || this.data.thresholds;
        this.data.simulationActive = stored.simulationActive ?? false;
        this.data.swarmKeys = stored.swarmKeys || {};
      } else {
        await this.saveConfigToPostgres();
      }

      const usageRes = await this.pool.query("SELECT * FROM agent_usage");

      Object.keys(this.data.usage).forEach(key => {
        this.data.usage[key] = { input: 0, output: 0, total: 0 };
      });

      usageRes.rows.forEach(row => {
        this.data.usage[row.agent_id] = {
          input: parseInt(row.input_tokens, 10) || 0,
          output: parseInt(row.output_tokens, 10) || 0,
          total: parseInt(row.total_tokens, 10) || 0
        };
      });
    } catch (err) {
      logger.error('Error hydrating state from PostgreSQL:', err);
    }
  }

  async saveConfigToPostgres() {
    try {
      const payload = {
        totalBudget: this.data.totalBudget,
        selectedModel: this.data.selectedModel,
        departments: this.data.departments,
        thresholds: this.data.thresholds,
        simulationActive: this.data.simulationActive,
        swarmKeys: this.data.swarmKeys
      };
      await this.pool.query(
        "INSERT INTO config (key, value) VALUES ('main', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [payload]
      );
    } catch (err) {
      logger.error('Failed to save config to PostgreSQL:', err);
    }
  }

  async loadJson() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        this.data = deepClone(JSON.parse(fileContent));
      } else {
        this.data = deepClone(DEFAULTS);
        this.saveJson();
      }
    } catch (err) {
      logger.error('Error loading JSON database:', err);
      this.data = deepClone(DEFAULTS);
    }
    if (!this.data.swarmKeys) {
      this.data.swarmKeys = {};
    }
    await this.ensureSwarmKeys();
  }

  saveJson() {
    try {
      const content = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_TEMP_FILE, content, 'utf8');
      fs.renameSync(DB_TEMP_FILE, DB_FILE);
    } catch (err) {
      logger.error('Error saving JSON database:', err);
    }
  }

  get() {
    return deepClone(this.data);
  }

  async updateConfig(config) {
    return this._mutex.withLock(async () => {
      if (config.totalBudget !== undefined) {
        if (typeof config.totalBudget !== 'number' || config.totalBudget < 0 || !Number.isFinite(config.totalBudget)) {
          throw new Error('totalBudget must be a non-negative number');
        }
        this.data.totalBudget = config.totalBudget;
      }
      if (config.selectedModel !== undefined) {
        if (typeof config.selectedModel !== 'string' || !config.selectedModel) {
          throw new Error('selectedModel must be a non-empty string');
        }
        this.data.selectedModel = config.selectedModel;
      }
      if (config.departments !== undefined) {
        if (!Array.isArray(config.departments) || config.departments.length === 0) {
          throw new Error('departments must be a non-empty array');
        }
        this.data.departments = deepClone(config.departments);
      }
      if (config.thresholds !== undefined) {
        if (typeof config.thresholds !== 'object' || config.thresholds === null) {
          throw new Error('thresholds must be an object');
        }
        this.data.thresholds = config.thresholds;
      }

      if (this.isPostgres) {
        await this.saveConfigToPostgres();
      } else {
        this.saveJson();
      }
      return deepClone(this.data);
    });
  }

  async recordUsage(agentId, promptTokens, completionTokens) {
    return this._mutex.withLock(async () => {
      if (!this.data.usage[agentId]) {
        this.data.usage[agentId] = { input: 0, output: 0, total: 0 };
      }

      this.data.usage[agentId].input += promptTokens;
      this.data.usage[agentId].output += completionTokens;
      this.data.usage[agentId].total += (promptTokens + completionTokens);

      if (this.isPostgres) {
        const total = promptTokens + completionTokens;
        try {
          await this.pool.query(`
            INSERT INTO agent_usage (agent_id, input_tokens, output_tokens, total_tokens, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (agent_id) DO UPDATE SET
              input_tokens = agent_usage.input_tokens + $2,
              output_tokens = agent_usage.output_tokens + $3,
              total_tokens = agent_usage.total_tokens + $4,
              updated_at = NOW()
          `, [agentId, promptTokens, completionTokens, total]);
        } catch (err) {
          logger.error('Failed to log usage in SQL agent_usage table:', err);
        }
      } else {
        this.saveJson();
      }

      return { ...this.data.usage[agentId] };
    });
  }

  async setSimulationActive(active) {
    return this._mutex.withLock(async () => {
      this.data.simulationActive = !!active;
      if (this.isPostgres) {
        await this.saveConfigToPostgres();
      } else {
        this.saveJson();
      }
      return this.data.simulationActive;
    });
  }

  async resetUsage() {
    return this._mutex.withLock(async () => {
      Object.keys(this.data.usage).forEach((key) => {
        this.data.usage[key] = { input: 0, output: 0, total: 0 };
      });

      if (this.isPostgres) {
        try {
          await this.pool.query("UPDATE agent_usage SET input_tokens = 0, output_tokens = 0, total_tokens = 0");
        } catch (err) {
          logger.error('Failed to clear SQL agent_usage counters:', err);
        }
      } else {
        this.saveJson();
      }
      return deepClone(this.data.usage);
    });
  }

  generateSwarmKey(agentId, _agentName) {
    const suffix = Math.random().toString(36).substring(2, 8);
    return `swarm-${agentId}-${suffix}`;
  }

  async ensureSwarmKeys() {
    return this._mutex.withLock(async () => {
      let changed = false;
      this.data.departments.forEach((dept) => {
        dept.agents.forEach((agent) => {
          if (!agent.swarmKey) {
            agent.swarmKey = this.generateSwarmKey(agent.id, agent.name);
            changed = true;
          }
          this.data.swarmKeys[agent.swarmKey] = {
            agentId: agent.id,
            deptId: dept.id,
            name: agent.name
          };
        });
      });
      if (changed) {
        if (this.isPostgres) {
          await this.saveConfigToPostgres();
        } else {
          this.saveJson();
        }
      }
    });
  }

  getAgentBySwarmKey(key) {
    return this.data.swarmKeys[key] || null;
  }

  async regenerateSwarmKeys() {
    return this._mutex.withLock(async () => {
      this.data.swarmKeys = {};
      this.data.departments.forEach((dept) => {
        dept.agents.forEach((agent) => {
          agent.swarmKey = this.generateSwarmKey(agent.id, agent.name);
          this.data.swarmKeys[agent.swarmKey] = {
            agentId: agent.id,
            deptId: dept.id,
            name: agent.name
          };
        });
      });
      if (this.isPostgres) {
        await this.saveConfigToPostgres();
      } else {
        this.saveJson();
      }
      return deepClone(this.data.swarmKeys);
    });
  }

  async createSwarmKey(agentId, deptId) {
    return this._mutex.withLock(async () => {
      const dept = this.data.departments.find((d) => d.id === deptId);
      const agent = dept?.agents.find((a) => a.id === agentId);
      if (!agent) return null;

      const newKey = this.generateSwarmKey(agentId, agent.name);
      agent.swarmKey = newKey;
      this.data.swarmKeys[newKey] = {
        agentId,
        deptId,
        name: agent.name,
      };

      if (this.isPostgres) {
        await this.saveConfigToPostgres();
      } else {
        this.saveJson();
      }
      return { key: newKey, agentId, deptId, name: agent.name };
    });
  }

  async revokeSwarmKey(key) {
    return this._mutex.withLock(async () => {
      const info = this.data.swarmKeys[key];
      if (!info) return null;

      delete this.data.swarmKeys[key];

      // Clear the swarmKey field on the agent
      this.data.departments.forEach((dept) => {
        dept.agents.forEach((agent) => {
          if (agent.swarmKey === key) {
            agent.swarmKey = null;
          }
        });
      });

      if (this.isPostgres) {
        await this.saveConfigToPostgres();
      } else {
        this.saveJson();
      }
      return info;
    });
  }

  async regenerateSingleSwarmKey(key) {
    return this._mutex.withLock(async () => {
      const info = this.data.swarmKeys[key];
      if (!info) return null;

      delete this.data.swarmKeys[key];
      const newKey = this.generateSwarmKey(info.agentId, info.name);

      this.data.swarmKeys[newKey] = { ...info };

      // Update the agent's swarmKey field
      this.data.departments.forEach((dept) => {
        dept.agents.forEach((agent) => {
          if (agent.swarmKey === key) {
            agent.swarmKey = newKey;
          }
        });
      });

      if (this.isPostgres) {
        await this.saveConfigToPostgres();
      } else {
        this.saveJson();
      }
      return { key: newKey, ...info };
    });
  }
}

export const db = new Database();
export { Database, deepClone, DEFAULTS };
