export const DEFAULT_TOTAL_BUDGET = 10_000_000;
export const DEFAULT_MODEL = 'gpt-5.6-terra';

export const DEFAULT_THRESHOLDS = {
  warning: 80,
  danger: 95,
};

export const DEFAULT_INPUT_RATIO = 0.70;
export const DEFAULT_OUTPUT_RATIO = 0.30;

export const DEFAULT_DEPARTMENTS = [
  {
    id: 'engineering',
    name: 'Engineering',
    colorVar: '--color-engineering',
    allocation: 40,
    agents: [
      {
        id: 'code-review',
        name: 'Code Review Agent',
        allocation: 60,
        description: 'Reviews pull requests and suggests improvements',
      },
      {
        id: 'debug-agent',
        name: 'Debug Agent',
        allocation: 40,
        description: 'Diagnoses bugs and proposes fixes',
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    colorVar: '--color-marketing',
    allocation: 25,
    agents: [
      {
        id: 'content-agent',
        name: 'Content Agent',
        allocation: 55,
        description: 'Generates blog posts, social media, and copy',
      },
      {
        id: 'seo-agent',
        name: 'SEO Agent',
        allocation: 45,
        description: 'Optimizes content for search engine ranking',
      },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    colorVar: '--color-sales',
    allocation: 20,
    agents: [
      {
        id: 'lead-scoring',
        name: 'Lead Scoring Agent',
        allocation: 50,
        description: 'Evaluates and ranks potential customer leads',
      },
      {
        id: 'email-drafter',
        name: 'Email Drafter Agent',
        allocation: 50,
        description: 'Drafts personalized outreach emails',
      },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    colorVar: '--color-operations',
    allocation: 15,
    agents: [
      {
        id: 'data-analysis',
        name: 'Data Analysis Agent',
        allocation: 65,
        description: 'Analyzes datasets and generates insights',
      },
      {
        id: 'reporting',
        name: 'Reporting Agent',
        allocation: 35,
        description: 'Creates automated reports and summaries',
      },
    ],
  },
];
