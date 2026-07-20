import { Router } from 'express';
import {
  getRun, listRuns, getRunLogs, getWorkflow, appendAuditLog,
} from '../db/queries.js';
import { executeWorkflow, addRunListener, removeRunListener } from '../engine/executor.js';
import { validateGraph } from '../engine/graph.js';

const router = Router();

// POST /api/run — execute a workflow
router.post('/run', async (req, res, next) => {
  try {
    const { workflowId, graph: inlineGraph } = req.body;

    let graph;
    let wfId = workflowId;

    if (workflowId) {
      // Load from DB
      const workflow = getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({
          error: { message: 'Workflow not found.', type: 'not_found', code: 'not_found' }
        });
      }
      graph = typeof workflow.graphJson === 'string'
        ? JSON.parse(workflow.graphJson) : workflow.graphJson;
    } else if (inlineGraph) {
      // Use inline graph
      graph = inlineGraph;
      wfId = null;
    } else {
      return res.status(400).json({
        error: { message: 'workflowId or graph is required.', type: 'invalid_request_error', code: 'missing_fields' }
      });
    }

    // Validate
    const validation = validateGraph(graph);
    if (!validation.valid) {
      return res.status(400).json({
        error: { message: validation.errors.join(' '), type: 'invalid_request_error', code: 'invalid_graph' }
      });
    }

    // Execute in background — respond immediately with run ID
    // The chatFn is attached by the middleware in index.js
    const chatFn = req.chatFn;
    if (!chatFn) {
      return res.status(500).json({
        error: { message: 'Chat function not available.', type: 'server_error', code: 'internal_error' }
      });
    }

    // Start execution asynchronously
    const executePromise = executeWorkflow({
      workflowId: wfId,
      graph,
      chatFn,
    });

    // Get the run ID from the promise (it creates the run synchronously)
    const result = await executePromise;

    appendAuditLog({ action: 'workflow_executed', workflowId: wfId, runId: result.runId });

    res.status(200).json({
      success: true,
      run: result,
      logs: getRunLogs(result.runId),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/run/:id — get run status + logs
router.get('/run/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const run = getRun(id);
  if (!run) {
    return res.status(404).json({
      error: { message: 'Run not found.', type: 'not_found', code: 'not_found' }
    });
  }
  const logs = getRunLogs(id);
  res.status(200).json({ run, logs });
});

// GET /api/run/:id/stream — SSE stream for real-time agent outputs
router.get('/run/:id/stream', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const run = getRun(id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // If run is already completed, send final state and close
  if (run && (run.status === 'completed' || run.status === 'failed')) {
    const logs = getRunLogs(id);
    res.write(`event: run_${run.status}\ndata: ${JSON.stringify({ run, logs })}\n\n`);
    res.end();
    return;
  }

  // Register as listener
  addRunListener(id, res);

  // Send current logs
  if (run) {
    const logs = getRunLogs(id);
    res.write(`event: run_state\ndata: ${JSON.stringify({ run, logs })}\n\n`);
  }

  req.on('close', () => {
    removeRunListener(id, res);
  });
});

// GET /api/runs — list all runs
router.get('/runs', (req, res) => {
  const workflowId = req.query.workflowId
    ? parseInt(req.query.workflowId, 10)
    : null;
  const allRuns = listRuns(workflowId);
  res.status(200).json({ runs: allRuns });
});

// GET /api/cost/:runId — cost breakdown for a run
router.get('/cost/:runId', (req, res) => {
  const runId = parseInt(req.params.runId, 10);
  const run = getRun(runId);
  if (!run) {
    return res.status(404).json({
      error: { message: 'Run not found.', type: 'not_found', code: 'not_found' }
    });
  }
  const logs = getRunLogs(runId);

  const breakdown = logs.map(log => ({
    agentName: log.agentName,
    model: log.model,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    totalTokens: log.totalTokens,
    cost: log.cost,
    status: log.status,
  }));

  res.status(200).json({
    runId,
    status: run.status,
    totalTokens: run.totalTokens,
    totalCost: run.totalCost,
    breakdown,
  });
});

export default router;
