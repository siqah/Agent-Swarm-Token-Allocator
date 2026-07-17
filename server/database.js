/**
 * database.js — Multi-source database adapter with automatic PostgreSQL
 * connection pooling and graceful local JSON-file fallback.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environmental config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const DB_FILE = path.join(__dirname, 'db.json');
const { Pool } = pg;

const DEFAULTS = {
  totalBudget: 10000000,
  selectedModel: 'gpt-5.6-terra',
  thresholds: { warning: 80, danger: 95 },
  departments: [
    {
      id: 'engineering',
      name: 'Engineering',
      allocation: 40,
      agents: [
        { id: 'code-review', name: 'Code Review Agent', allocation: 60 },
        { id: 'debug-agent', name: 'Debug Agent', allocation: 40 }
      ]
    },
    {
      id: 'marketing',
      name: 'Marketing',
      allocation: 25,
      agents: [
        { id: 'content-agent', name: 'Content Agent', allocation: 55 },
        { id: 'seo-agent', name: 'SEO Agent', allocation: 45 }
      ]
    },
    {
      id: 'sales',
      name: 'Sales',
      allocation: 20,
      agents: [
        { id: 'lead-scoring', name: 'Lead Scoring Agent', allocation: 50 },
        { id: 'email-drafter', name: 'Email Drafter Agent', allocation: 50 }
      ]
    },
    {
      id: 'operations',
      name: 'Operations',
      allocation: 15,
      agents: [
        { id: 'data-analysis', name: 'Data Analysis Agent', allocation: 65 },
        { id: 'reporting', name: 'Reporting Agent', allocation: 35 }
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
  simulationActive: false
};

class Database {
  constructor() {
    this.data = { ...DEFAULTS };
    this.isPostgres = false;
    this.pool = null;
    this.init();
  }

  async init() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.log('⚠️ No DATABASE_URL found. Running with local JSON database.');
      this.loadJson();
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3000 // 3 seconds timeout
      });

      // Probe Postgres connection
      const client = await this.pool.connect();
      client.release();

      this.isPostgres = true;
      console.log('🐘 Connected to PostgreSQL database successfully.');

      // Initialize Postgres schema tables
      await this.initSchema();
      // Hydrate state from Postgres
      await this.hydrateFromPostgres();
    } catch (err) {
      console.warn('⚠️ PostgreSQL connection failed. Falling back to local JSON database.');
      this.isPostgres = false;
      this.loadJson();
    }
  }

  async initSchema() {
    try {
      // Configuration table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS config (
          key VARCHAR(50) PRIMARY KEY,
          value JSONB NOT NULL
        )
      `);

      // Agent usage statistics table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS agent_usage (
          agent_id VARCHAR(50) PRIMARY KEY,
          input_tokens BIGINT DEFAULT 0,
          output_tokens BIGINT DEFAULT 0,
          total_tokens BIGINT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (err) {
      console.error('Error initializing PostgreSQL schema:', err);
    }
  }

  async hydrateFromPostgres() {
    try {
      // Load configuration
      const configRes = await this.pool.query("SELECT value FROM config WHERE key = 'main'");
      if (configRes.rows.length > 0) {
        const stored = configRes.rows[0].value;
        this.data.totalBudget = stored.totalBudget;
        this.data.selectedModel = stored.selectedModel;
        this.data.departments = stored.departments;
        this.data.thresholds = stored.thresholds || this.data.thresholds;
        this.data.simulationActive = stored.simulationActive ?? false;
      } else {
        // Save initial default configurations to SQL config table
        await this.saveConfigToPostgres();
      }

      // Load agent usage statistics
      const usageRes = await this.pool.query("SELECT * FROM agent_usage");
      
      // Initialize usage block to zero
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
      console.error('Error hydrating state from PostgreSQL:', err);
    }
  }

  async saveConfigToPostgres() {
    try {
      const payload = {
        totalBudget: this.data.totalBudget,
        selectedModel: this.data.selectedModel,
        departments: this.data.departments,
        thresholds: this.data.thresholds,
        simulationActive: this.data.simulationActive
      };
      await this.pool.query(
        "INSERT INTO config (key, value) VALUES ('main', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [payload]
      );
    } catch (err) {
      console.error('Failed to save config to PostgreSQL:', err);
    }
  }

  loadJson() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.saveJson();
      }
    } catch (err) {
      console.error('Error loading JSON database:', err);
      this.data = { ...DEFAULTS };
    }
  }

  saveJson() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving JSON database:', err);
    }
  }

  get() {
    return this.data;
  }

  updateConfig(config) {
    if (config.totalBudget !== undefined) this.data.totalBudget = config.totalBudget;
    if (config.selectedModel !== undefined) this.data.selectedModel = config.selectedModel;
    if (config.departments !== undefined) this.data.departments = config.departments;
    if (config.thresholds !== undefined) this.data.thresholds = config.thresholds;

    if (this.isPostgres) {
      this.saveConfigToPostgres();
    } else {
      this.saveJson();
    }
    return this.data;
  }

  recordUsage(agentId, promptTokens, completionTokens) {
    // Record in local cache
    if (!this.data.usage[agentId]) {
      this.data.usage[agentId] = { input: 0, output: 0, total: 0 };
    }

    this.data.usage[agentId].input += promptTokens;
    this.data.usage[agentId].output += completionTokens;
    this.data.usage[agentId].total += (promptTokens + completionTokens);

    if (this.isPostgres) {
      // Upsert into SQL agent_usage database
      const total = promptTokens + completionTokens;
      this.pool.query(`
        INSERT INTO agent_usage (agent_id, input_tokens, output_tokens, total_tokens, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (agent_id) DO UPDATE SET
          input_tokens = agent_usage.input_tokens + $2,
          output_tokens = agent_usage.output_tokens + $3,
          total_tokens = agent_usage.total_tokens + $4,
          updated_at = NOW()
      `, [agentId, promptTokens, completionTokens, total])
      .catch(err => console.error('Failed to log usage in SQL agent_usage table:', err));
    } else {
      this.saveJson();
    }

    return this.data.usage[agentId];
  }

  setSimulationActive(active) {
    this.data.simulationActive = !!active;
    if (this.isPostgres) {
      this.saveConfigToPostgres();
    } else {
      this.saveJson();
    }
    return this.data.simulationActive;
  }

  resetUsage() {
    Object.keys(this.data.usage).forEach((key) => {
      this.data.usage[key] = { input: 0, output: 0, total: 0 };
    });

    if (this.isPostgres) {
      this.pool.query("UPDATE agent_usage SET input_tokens = 0, output_tokens = 0, total_tokens = 0")
        .catch(err => console.error('Failed to clear SQL agent_usage counters:', err));
    } else {
      this.saveJson();
    }
    return this.data.usage;
  }
}

export const db = new Database();
