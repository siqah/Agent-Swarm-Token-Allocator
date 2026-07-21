import { config, models, fallbackChains, usage } from './schema.js';
import { logger } from '../lib/logger.js';

const DEFAULT_CONFIG = {
  totalBudget: '10000000',
  selectedModel: 'gpt-5.6-terra',
  thresholds: JSON.stringify({ warning: 80, danger: 95 }),
  simulationActive: 'false',
  departments: JSON.stringify([
    {
      id: 'engineering', name: 'Engineering', colorVar: '--color-engineering', allocation: 40,
      agents: [
        { id: 'code-review', name: 'Code Review Agent', allocation: 60, description: 'Reviews pull requests and suggests improvements' },
        { id: 'debug-agent', name: 'Debug Agent', allocation: 40, description: 'Diagnoses bugs and proposes fixes' }
      ]
    },
    {
      id: 'marketing', name: 'Marketing', colorVar: '--color-marketing', allocation: 25,
      agents: [
        { id: 'content-agent', name: 'Content Agent', allocation: 55, description: 'Generates blog posts, social media, and copy' },
        { id: 'seo-agent', name: 'SEO Agent', allocation: 45, description: 'Optimizes content for search engine ranking' }
      ]
    },
    {
      id: 'sales', name: 'Sales', colorVar: '--color-sales', allocation: 20,
      agents: [
        { id: 'lead-scoring', name: 'Lead Scoring Agent', allocation: 50, description: 'Evaluates and ranks potential customer leads' },
        { id: 'email-drafter', name: 'Email Drafter Agent', allocation: 50, description: 'Drafts personalized outreach emails' }
      ]
    },
    {
      id: 'operations', name: 'Operations', colorVar: '--color-operations', allocation: 15,
      agents: [
        { id: 'data-analysis', name: 'Data Analysis Agent', allocation: 65, description: 'Analyzes datasets and generates insights' },
        { id: 'reporting', name: 'Reporting Agent', allocation: 35, description: 'Creates automated reports and summaries' }
      ]
    }
  ]),
};

const DEFAULT_MODELS = [
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'openai', tier: 'flagship', inputPrice: 5.00, outputPrice: 30.00, cachedPrice: 0.50, description: 'Most capable — complex reasoning & code' },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'openai', tier: 'balanced', inputPrice: 2.50, outputPrice: 15.00, cachedPrice: 0.25, description: 'Balanced performance & cost' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'openai', tier: 'efficient', inputPrice: 1.00, outputPrice: 6.00, cachedPrice: 0.10, description: 'Fast & efficient for simple tasks' },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', provider: 'openai', tier: 'economy', inputPrice: 0.20, outputPrice: 1.25, cachedPrice: 0.02, description: 'Ultra-low cost for high-volume tasks' },
  { id: 'o1-preview', name: 'o1 Preview', provider: 'openai', tier: 'premium', inputPrice: 15.00, outputPrice: 60.00, cachedPrice: 0, description: 'Advanced reasoning preview' },
  { id: 'o1-mini', name: 'o1 Mini', provider: 'openai', tier: 'efficient', inputPrice: 3.00, outputPrice: 12.00, cachedPrice: 0, description: 'Compact reasoning model' },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'openai', tier: 'efficient', inputPrice: 1.10, outputPrice: 4.40, cachedPrice: 0, description: 'Fast reasoning model' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', tier: 'balanced', inputPrice: 3.00, outputPrice: 15.00, cachedPrice: 0, description: 'Balanced capability & speed' },
  { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'anthropic', tier: 'efficient', inputPrice: 1.00, outputPrice: 5.00, cachedPrice: 0, description: 'Fast & affordable' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', tier: 'premium', inputPrice: 15.00, outputPrice: 75.00, cachedPrice: 0, description: 'Most capable Anthropic model' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', tier: 'efficient', inputPrice: 0.10, outputPrice: 0.40, cachedPrice: 0, description: 'Fast Google model' },
  { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'google', tier: 'balanced', inputPrice: 1.25, outputPrice: 5.00, cachedPrice: 0, description: 'Balanced Google model' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', tier: 'balanced', inputPrice: 1.25, outputPrice: 5.00, cachedPrice: 0, description: 'Previous-gen pro model' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', tier: 'economy', inputPrice: 0.075, outputPrice: 0.30, cachedPrice: 0, description: 'Budget-friendly Google model' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'groq', tier: 'balanced', inputPrice: 0.59, outputPrice: 0.79, cachedPrice: 0, description: 'Open-weight 70B model' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', provider: 'groq', tier: 'economy', inputPrice: 0.05, outputPrice: 0.08, cachedPrice: 0, description: 'Lightweight open model' },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'groq', tier: 'economy', inputPrice: 0.24, outputPrice: 0.24, cachedPrice: 0, description: 'Mistral MoE model' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'groq', tier: 'balanced', inputPrice: 0.55, outputPrice: 2.19, cachedPrice: 0, description: 'DeepSeek reasoning model' },
];

const DEFAULT_FALLBACKS = {
  'gpt-5.6-sol': ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-nano'],
  'gpt-5.6-terra': ['gpt-5.6-luna', 'gpt-5.4-nano'],
  'gpt-5.6-luna': ['gpt-5.4-nano'],
  'gpt-5.4-nano': ['claude-3.5-haiku', 'gemini-1.5-flash', 'llama-3.1-8b'],
  'claude-3.5-sonnet': ['claude-3.5-haiku', 'gpt-5.6-luna', 'gemini-1.5-flash'],
  'claude-3.5-haiku': ['gpt-5.4-nano', 'llama-3.1-8b'],
  'claude-3-opus': ['claude-3.5-sonnet', 'gpt-5.6-terra'],
  'gemini-2.0-flash': ['gemini-1.5-flash', 'gpt-5.4-nano', 'llama-3.1-8b'],
  'gemini-2.0-pro': ['gemini-1.5-pro', 'claude-3.5-haiku', 'gpt-5.6-luna'],
  'gemini-1.5-pro': ['gemini-1.5-flash', 'gpt-5.4-nano'],
  'gemini-1.5-flash': ['gpt-5.4-nano', 'llama-3.1-8b'],
  'llama-3.3-70b': ['llama-3.1-8b', 'mixtral-8x7b', 'gpt-5.4-nano'],
  'llama-3.1-8b': ['gpt-5.4-nano'],
  'mixtral-8x7b': ['llama-3.1-8b', 'gpt-5.4-nano'],
  'deepseek-r1': ['llama-3.3-70b', 'gpt-5.6-luna'],
};

const DEFAULT_AGENTS = [
  'code-review', 'debug-agent', 'content-agent', 'seo-agent',
  'lead-scoring', 'email-drafter', 'data-analysis', 'reporting'
];

export function seed(db) {
  // Only seed if config table is empty
  const existing = db.select().from(config).limit(1).all();
  if (existing.length > 0) {
    logger.info('Database already seeded. Skipping.');
    return;
  }

  logger.info('Seeding database with defaults...');

  // Config
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    db.insert(config).values({ key, value: String(value) }).run();
  }

  // Models
  for (const m of DEFAULT_MODELS) {
    db.insert(models).values(m).run();
  }

  // Fallback chains
  for (const [modelId, fallbacks] of Object.entries(DEFAULT_FALLBACKS)) {
    fallbacks.forEach((fbId, idx) => {
      db.insert(fallbackChains).values({
        modelId,
        fallbackModelId: fbId,
        priority: idx,
      }).run();
    });
  }

  // Usage entries for default agents
  for (const agentId of DEFAULT_AGENTS) {
    db.insert(usage).values({
      agentId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }).run();
  }

  logger.info('Database seeded successfully.');
}
