import { logger } from './logger.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL || null;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;

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
