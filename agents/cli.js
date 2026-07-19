#!/usr/bin/env node
import { Agent, agents } from './index.js';

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case 'list':
    case 'ls': {
      const list = await Agent.list();
      if (list.length === 0) {
        console.log('No agents found. Start the gateway server first.');
        return;
      }
      console.log('Available agents:\n');
      for (const a of list) {
        console.log(`  ${a.name.padEnd(25)} ${a.key}`);
      }
      break;
    }

    case 'run': {
      const agentName = args[0];
      const prompt = args.slice(1).join(' ');
      if (!agentName || !prompt) {
        console.error('Usage: swarm-agent run <agent-name> "<prompt>"');
        process.exit(1);
      }
      const agent = new Agent({ name: agentName });
      const res = await agent.chat(prompt);
      console.log(`\n${res.choices?.[0]?.message?.content || '(no response)'}\n`);
      if (res.usage) {
        console.log(`Tokens: ${res.usage.total_tokens} (${res.usage.prompt_tokens} in / ${res.usage.completion_tokens} out)  Model: ${res.model}`);
      }
      break;
    }

    case 'task': {
      const prompt = args.join(' ');
      if (!prompt) {
        console.error('Usage: swarm-agent task "<prompt>"');
        process.exit(1);
      }
      const agent = agents.coder; // any valid key will do for auth
      const res = await agent.task(prompt);
      console.log(`\n${res.choices?.[0]?.message?.content || '(no response)'}\n`);
      if (res.usage) {
        const routed = res._classification
          ? `Routed to: ${res._classification.agentName} (${res._classification.deptName})`
          : '';
        console.log(`Tokens: ${res.usage.total_tokens}  Model: ${res.model}  ${routed}`);
      }
      break;
    }

    case 'chat': {
      const prompt = args.join(' ');
      if (!prompt) {
        console.error('Usage: swarm-agent chat "<prompt>"  (uses SWARM_KEY env or first agent)');
        process.exit(1);
      }
      const key = process.env.SWARM_KEY;
      if (!key) {
        // fallback: use first available agent
        const list = await Agent.list();
        if (list.length === 0) throw new Error('No agents found and no SWARM_KEY set.');
        const agent = new Agent({ key: list[0].key, name: list[0].name });
        const res = await agent.chat(prompt);
        console.log(`\n${res.choices?.[0]?.message?.content || '(no response)'}\n`);
      } else {
        const agent = new Agent({ key, name: 'custom' });
        const res = await agent.chat(prompt);
        console.log(`\n${res.choices?.[0]?.message?.content || '(no response)'}\n`);
      }
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default:
      console.log(`
Usage: swarm-agent <command> [options]

Commands:
  list                          List all available agents
  run <name> "<prompt>"         Run an agent by name with a prompt
  task "<prompt>"               Auto-classify prompt and route to best agent
  chat "<prompt>"               Chat via SWARM_KEY env var or first agent

Environment:
  SWARM_GATEWAY  Gateway URL (default: http://localhost:3001)
  SWARM_MODEL    Model to use (default: gpt-5.6-terra)
  SWARM_KEY      Swarm key for chat command
`);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
