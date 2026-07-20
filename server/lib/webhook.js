import { logger } from './logger.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || null;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

// Track which thresholds have been notified per agent to avoid spam
const thresholdNotified = new Map();

export function resetThresholdNotified(agentId) {
  // Remove all entries for this agent (warning + danger)
  for (const key of thresholdNotified.keys()) {
    if (key.startsWith(agentId + ':')) thresholdNotified.delete(key);
  }
}

export function resetAllThresholdNotified() {
  thresholdNotified.clear();
}

export async function sendBudgetThresholdAlert(agentId, agentName, deptName, usage, limit, gatewayUrl) {
  if (!WEBHOOK_URL) return;
  const ratio = usage / limit;

  let level = null;
  if (ratio >= 0.95) level = 'danger';
  else if (ratio >= 0.80) level = 'warning';
  if (!level) return;

  const key = `${agentId}:${level}`;
  if (thresholdNotified.get(key)) return;
  thresholdNotified.set(key, Date.now());

  await sendAlert(`budget_${level}`, {
    agentId,
    agentName,
    deptName,
    usage,
    limit,
    ratio: Math.round(ratio * 100) + '%',
    gatewayUrl,
  });
}

export async function sendAlert(event, payload) {
  if (!WEBHOOK_URL) return;

  const body = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (WEBHOOK_SECRET) {
      headers['X-Webhook-Secret'] = WEBHOOK_SECRET;
    }

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn(`Webhook returned ${res.status} for event "${event}"`);
    }
  } catch (err) {
    logger.warn(`Webhook failed for event "${event}": ${err.message}`);
  }
}

export function formatSlackMessage(event, payload) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `:warning: ${event.replace(/_/g, ' ').toUpperCase()}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Agent:* ${payload.agentName || 'unknown'}` },
        { type: 'mrkdwn', text: `*Department:* ${payload.deptName || 'unknown'}` },
      ],
    },
  ];

  if (payload.usage !== undefined) {
    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Tokens Used:* ${payload.usage.toLocaleString()}` },
        { type: 'mrkdwn', text: `*Limit:* ${payload.limit ? payload.limit.toLocaleString() : 'N/A'}` },
      ],
    });
  }

  if (payload.error) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Error:* ${payload.error}` },
    });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Gateway · ${payload.gatewayUrl || 'unknown'}` }],
  });

  return { text: event.replace(/_/g, ' '), blocks };
}

// Slack shortcut: sends alert formatted as Slack Block Kit
export async function sendSlackAlert(event, payload) {
  if (!WEBHOOK_URL) return;
  await sendAlert(event, formatSlackMessage(event, payload));
}
