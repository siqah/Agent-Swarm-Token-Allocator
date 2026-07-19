const GATEWAY = process.env.SWARM_GATEWAY || 'http://localhost:3001';

export class Agent {
  #gateway;
  #key;

  constructor(opts = {}) {
    this.#gateway = opts.gateway || GATEWAY;
    this.#key = opts.key || process.env.SWARM_KEY || null;
    this.name = opts.name || 'unnamed';
    this.dept = opts.dept || null;
    this.agentId = opts.agentId || null;
    this.deptId = opts.deptId || null;
  }

  async #resolveKey() {
    if (this.#key) return this.#key;
    const keys = await Agent.list({ gateway: this.#gateway });
    const match = keys.find(k =>
      (this.agentId && k.agentId === this.agentId) ||
      (this.name && k.name === this.name)
    );
    if (!match) throw new Error(`Agent "${this.name || this.agentId}" not found. Run \`swarm-agent list\` to see available agents.`);
    this.#key = match.key;
    this.agentId = match.agentId;
    this.deptId = match.deptId;
    this.name = match.name;
    return this.#key;
  }

  async chat(messages, opts = {}) {
    const key = await this.#resolveKey();
    const res = await fetch(`${this.#gateway}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.model || process.env.SWARM_MODEL || 'gpt-5.6-terra',
        messages: Array.isArray(messages) ? messages : [{ role: 'user', content: String(messages) }],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens,
        stream: false,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new AgentError(data.error?.message || 'Request failed', res.status);
    return data;
  }

  async *stream(messages, opts = {}) {
    const key = await this.#resolveKey();
    const res = await fetch(`${this.#gateway}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.model || process.env.SWARM_MODEL || 'gpt-5.6-terra',
        messages: Array.isArray(messages) ? messages : [{ role: 'user', content: String(messages) }],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.max_tokens,
        stream: true,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new AgentError(data.error?.message || 'Stream request failed', res.status);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;
        try { yield JSON.parse(payload); } catch { /* skip malformed */ }
      }
    }
  }

  async task(prompt, opts = {}) {
    const key = await this.#resolveKey();
    const res = await fetch(`${this.#gateway}/v1/swarm/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        prompt: String(prompt),
        model: opts.model || process.env.SWARM_MODEL || 'gpt-5.6-terra',
        stream: opts.stream || false,
        temperature: opts.temperature ?? 0.7,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new AgentError(data.error?.message || 'Task routing failed', res.status);
    return data;
  }

  async usage() {
    const key = await this.#resolveKey();
    const res = await fetch(`${this.#gateway}/api/status`);
    const data = await res.json();
    return data.usage?.[this.agentId] || { input: 0, output: 0, total: 0 };
  }

  static async list(opts = {}) {
    const gateway = opts?.gateway || GATEWAY;
    const res = await fetch(`${gateway}/api/status`);
    const data = await res.json();
    const keys = data.swarmKeys || {};
    return Object.entries(keys).map(([key, info]) => ({
      key,
      name: info.name,
      agentId: info.agentId,
      deptId: info.deptId,
    }));
  }
}

export class AgentError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AgentError';
    this.status = status;
  }
}

// ── Default agents for coding / testing / pushing ──────────
// These auto-resolve from the gateway when you call .chat() or .task()
export const agents = {
  list: Agent.list,
  coder: new Agent({ name: 'Coder Agent' }),
  tester: new Agent({ name: 'Tester Agent' }),
  pusher: new Agent({ name: 'Pusher Agent' }),
};
