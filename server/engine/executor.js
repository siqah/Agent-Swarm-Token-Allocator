/**
 * Workflow Execution Engine
 * Executes a workflow graph in topological order with parallel support.
 * Passes outputs from previous agents as context to downstream agents.
 * Emits SSE events for real-time UI updates.
 */

import { parseGraph, getExecutionLevels, getPredecessors } from './graph.js';
import {
  createRun, updateRun, createRunLog, updateRunLog, getRunLogs,
} from '../db/queries.js';
import { logger } from '../lib/logger.js';

// Active run SSE listeners: runId → Set<res>
const runListeners = new Map();

/**
 * Register an SSE listener for a run.
 */
export function addRunListener(runId, res) {
  if (!runListeners.has(runId)) {
    runListeners.set(runId, new Set());
  }
  runListeners.get(runId).add(res);
}

/**
 * Remove an SSE listener for a run.
 */
export function removeRunListener(runId, res) {
  const listeners = runListeners.get(runId);
  if (listeners) {
    listeners.delete(res);
    if (listeners.size === 0) runListeners.delete(runId);
  }
}

/**
 * Emit an SSE event to all listeners of a run.
 */
function emitRunEvent(runId, event, data) {
  const listeners = runListeners.get(runId);
  if (!listeners || listeners.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of listeners) {
    try {
      res.write(payload);
    } catch {
      listeners.delete(res);
    }
  }
}

/**
 * Execute a workflow graph.
 * @param {object} options
 * @param {number} options.workflowId
 * @param {object} options.graph - { nodes: [...], edges: [...] }
 * @param {function} options.chatFn - processChatCompletion function
 * @returns {object} The completed run record
 */
export async function executeWorkflow({ workflowId, graph, chatFn }) {
  const run = createRun(workflowId);
  const runId = run.id;

  logger.info(`[Executor] Starting run #${runId} for workflow #${workflowId}`);
  emitRunEvent(runId, 'run_started', { runId, workflowId, status: 'running' });

  try {
    // Update run status
    updateRun(runId, { status: 'running' });

    // Parse graph and get execution levels
    const { adjacency, inDegree, nodeMap } = parseGraph(graph);
    const levels = getExecutionLevels(adjacency, inDegree);

    // Store outputs per node for passing context downstream
    const nodeOutputs = new Map();
    let totalTokens = 0;
    let totalCost = 0;

    // Execute level by level
    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      const level = levels[levelIdx];
      logger.info(`[Executor] Run #${runId} — Level ${levelIdx + 1}: [${level.join(', ')}]`);

      // Execute all nodes at this level in parallel
      const promises = level.map(nodeId =>
        executeNode({
          runId,
          nodeId,
          nodeMap,
          adjacency,
          nodeOutputs,
          chatFn,
        })
      );

      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { nodeId, output, tokens, cost } = result.value;
          nodeOutputs.set(nodeId, output);
          totalTokens += tokens;
          totalCost += cost;
        }
      }
    }

    // Mark run as completed
    updateRun(runId, {
      status: 'completed',
      totalTokens,
      totalCost,
      completedAt: new Date().toISOString(),
    });

    const finalRun = { runId, status: 'completed', totalTokens, totalCost };
    emitRunEvent(runId, 'run_completed', finalRun);
    logger.info(`[Executor] Run #${runId} completed. Tokens: ${totalTokens}, Cost: $${totalCost.toFixed(6)}`);

    return finalRun;
  } catch (err) {
    logger.error(`[Executor] Run #${runId} failed:`, err.message);
    updateRun(runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
    });
    emitRunEvent(runId, 'run_failed', { runId, error: err.message });
    return { runId, status: 'failed', error: err.message };
  }
}

/**
 * Execute a single node in the workflow.
 */
async function executeNode({ runId, nodeId, nodeMap, adjacency, nodeOutputs, chatFn }) {
  const node = nodeMap.get(nodeId);
  if (!node) throw new Error(`Node "${nodeId}" not found in graph.`);

  const data = node.data || {};
  const agentName = data.name || data.label || nodeId;
  const model = data.model || 'gpt-5.6-terra';
  const systemPrompt = data.systemPrompt || '';
  const temperature = data.temperature ?? 0.7;

  // Create run log entry
  const logId = createRunLog({
    runId,
    agentNodeId: nodeId,
    agentName,
    model,
    systemPrompt,
  });

  emitRunEvent(runId, 'node_started', {
    runId, nodeId, agentName, model, logId,
  });

  try {
    // Build messages: system prompt + context from predecessor outputs + user prompt
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Gather context from predecessor nodes
    const predecessors = getPredecessors(adjacency, nodeId);
    for (const predId of predecessors) {
      const predOutput = nodeOutputs.get(predId);
      if (predOutput) {
        const predNode = nodeMap.get(predId);
        const predName = predNode?.data?.name || predId;
        messages.push({
          role: 'user',
          content: `[Output from "${predName}"]:\n${predOutput}`,
        });
      }
    }

    // If no predecessor context and node has a prompt, use it
    const userPrompt = data.prompt || data.userPrompt;
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
    } else if (predecessors.length === 0) {
      // Root node with no prompt — use a default
      messages.push({ role: 'user', content: `You are "${agentName}". Execute your task.` });
    }

    // If we have context but no explicit prompt, ask to process it
    if (predecessors.length > 0 && !userPrompt) {
      messages.push({
        role: 'user',
        content: 'Process the above context according to your role and provide your output.',
      });
    }

    updateRunLog(logId, { status: 'running' });

    // Execute the chat completion
    const result = await chatFn({
      model,
      messages,
      temperature,
      stream: false,
    });

    if (result.error) {
      throw new Error(result.error.message || 'Chat completion failed');
    }

    const responseText = result.choices?.[0]?.message?.content || '';
    const inputTokens = result.usage?.prompt_tokens || 0;
    const outputTokens = result.usage?.completion_tokens || 0;
    const totalTokens = result.usage?.total_tokens || 0;

    // Calculate cost (per 1M tokens pricing)
    const cost = 0; // Will be calculated by the route using model pricing

    // Update run log
    updateRunLog(logId, {
      status: 'completed',
      responseText,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      completedAt: new Date().toISOString(),
    });

    emitRunEvent(runId, 'node_completed', {
      runId, nodeId, agentName, model, logId,
      tokens: totalTokens,
      inputTokens,
      outputTokens,
      responsePreview: responseText.substring(0, 200),
    });

    logger.info(`[Executor] Node "${agentName}" completed. Tokens: ${totalTokens}`);

    return {
      nodeId,
      output: responseText,
      tokens: totalTokens,
      cost,
    };
  } catch (err) {
    logger.error(`[Executor] Node "${agentName}" failed:`, err.message);

    updateRunLog(logId, {
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date().toISOString(),
    });

    emitRunEvent(runId, 'node_error', {
      runId, nodeId, agentName, logId,
      error: err.message,
    });

    // Don't throw — let parallel nodes continue, but record failure
    return { nodeId, output: `[ERROR: ${err.message}]`, tokens: 0, cost: 0 };
  }
}
