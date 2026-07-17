/**
 * Default configuration for the Agent Swarm Token Allocator.
 * 4 departments × 2 agents each = 8 total agents.
 * All allocations are percentages that must sum to 100 within their group.
 */

export const DEFAULT_TOTAL_BUDGET = 10_000_000; // tokens/month
export const DEFAULT_MODEL = 'gpt-5.6-terra';

export const DEFAULT_THRESHOLDS = {
  warning: 80,  // percentage — amber alert
  danger: 95,   // percentage — red alert
};

export const DEFAULT_INPUT_RATIO = 0.70;  // 70% of tokens are input
export const DEFAULT_OUTPUT_RATIO = 0.30; // 30% of tokens are output

export const DEFAULT_DEPARTMENTS = [
  {
    id: 'engineering',
    name: 'Engineering',
    icon: '🔧',
    colorVar: '--color-engineering',
    allocation: 40,
    agents: [
      {
        id: 'code-review',
        name: 'Code Review Agent',
        icon: '🔍',
        allocation: 60,
        description: 'Reviews pull requests and suggests improvements',
      },
      {
        id: 'debug-agent',
        name: 'Debug Agent',
        icon: '🐛',
        allocation: 40,
        description: 'Diagnoses bugs and proposes fixes',
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: '📢',
    colorVar: '--color-marketing',
    allocation: 25,
    agents: [
      {
        id: 'content-agent',
        name: 'Content Agent',
        icon: '✍️',
        allocation: 55,
        description: 'Generates blog posts, social media, and copy',
      },
      {
        id: 'seo-agent',
        name: 'SEO Agent',
        icon: '🔎',
        allocation: 45,
        description: 'Optimizes content for search engine ranking',
      },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    icon: '💼',
    colorVar: '--color-sales',
    allocation: 20,
    agents: [
      {
        id: 'lead-scoring',
        name: 'Lead Scoring Agent',
        icon: '🎯',
        allocation: 50,
        description: 'Evaluates and ranks potential customer leads',
      },
      {
        id: 'email-drafter',
        name: 'Email Drafter Agent',
        icon: '📧',
        allocation: 50,
        description: 'Drafts personalized outreach emails',
      },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    icon: '📊',
    colorVar: '--color-operations',
    allocation: 15,
    agents: [
      {
        id: 'data-analysis',
        name: 'Data Analysis Agent',
        icon: '📈',
        allocation: 65,
        description: 'Analyzes datasets and generates insights',
      },
      {
        id: 'reporting',
        name: 'Reporting Agent',
        icon: '📋',
        allocation: 35,
        description: 'Creates automated reports and summaries',
      },
    ],
  },
];
