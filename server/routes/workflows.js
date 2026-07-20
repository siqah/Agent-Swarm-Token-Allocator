import { Router } from 'express';
import {
  createWorkflow, getWorkflow, listWorkflows,
  updateWorkflow, deleteWorkflow, appendAuditLog,
} from '../db/queries.js';
import { validateGraph } from '../engine/graph.js';

const router = Router();

// POST /api/workflows — create workflow
router.post('/workflows', async (req, res, next) => {
  try {
    const { name, graph } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: { message: 'name is required and must be a string.', type: 'invalid_request_error', code: 'missing_fields' }
      });
    }

    const graphJson = graph || { nodes: [], edges: [] };

    // Validate graph if it has nodes
    if (graphJson.nodes && graphJson.nodes.length > 0) {
      const validation = validateGraph(graphJson);
      if (!validation.valid) {
        return res.status(400).json({
          error: { message: validation.errors.join(' '), type: 'invalid_request_error', code: 'invalid_graph' }
        });
      }
    }

    const workflow = createWorkflow(name, graphJson);
    appendAuditLog({ action: 'workflow_created', workflowId: workflow.id, name });
    res.status(201).json({ success: true, workflow });
  } catch (err) {
    next(err);
  }
});

// GET /api/workflows — list all workflows
router.get('/workflows', (req, res) => {
  const workflows = listWorkflows();
  res.status(200).json({
    workflows: workflows.map(w => ({
      ...w,
      graphJson: typeof w.graphJson === 'string' ? JSON.parse(w.graphJson) : w.graphJson,
    })),
  });
});

// GET /api/workflows/:id — get single workflow
router.get('/workflows/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const workflow = getWorkflow(id);
  if (!workflow) {
    return res.status(404).json({
      error: { message: 'Workflow not found.', type: 'not_found', code: 'not_found' }
    });
  }
  res.status(200).json({
    workflow: {
      ...workflow,
      graphJson: typeof workflow.graphJson === 'string' ? JSON.parse(workflow.graphJson) : workflow.graphJson,
    },
  });
});

// PUT /api/workflows/:id — update workflow
router.put('/workflows/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, graph } = req.body;

    // Validate graph if provided
    if (graph && graph.nodes && graph.nodes.length > 0) {
      const validation = validateGraph(graph);
      if (!validation.valid) {
        return res.status(400).json({
          error: { message: validation.errors.join(' '), type: 'invalid_request_error', code: 'invalid_graph' }
        });
      }
    }

    const updated = updateWorkflow(id, {
      name,
      graphJson: graph,
    });

    if (!updated) {
      return res.status(404).json({
        error: { message: 'Workflow not found.', type: 'not_found', code: 'not_found' }
      });
    }

    appendAuditLog({ action: 'workflow_updated', workflowId: id });
    res.status(200).json({
      success: true,
      workflow: {
        ...updated,
        graphJson: typeof updated.graphJson === 'string' ? JSON.parse(updated.graphJson) : updated.graphJson,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workflows/:id
router.delete('/workflows/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = deleteWorkflow(id);
    if (!deleted) {
      return res.status(404).json({
        error: { message: 'Workflow not found.', type: 'not_found', code: 'not_found' }
      });
    }
    appendAuditLog({ action: 'workflow_deleted', workflowId: id });
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
