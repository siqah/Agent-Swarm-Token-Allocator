/**
 * Graph utilities for workflow DAG processing.
 * Parses workflow graph JSON, performs topological sort,
 * detects cycles, and groups nodes by execution level.
 */

/**
 * Parse graph JSON into adjacency list and node map.
 * @param {object} graphJson - { nodes: [...], edges: [...] }
 * @returns {{ adjacency: Map, inDegree: Map, nodeMap: Map }}
 */
export function parseGraph(graphJson) {
  const { nodes = [], edges = [] } = typeof graphJson === 'string'
    ? JSON.parse(graphJson) : graphJson;

  const nodeMap = new Map();
  const adjacency = new Map();
  const inDegree = new Map();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) {
      throw new Error(`Edge references unknown node: ${edge.source} → ${edge.target}`);
    }
    adjacency.get(edge.source).push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  return { adjacency, inDegree, nodeMap };
}

/**
 * Topological sort using Kahn's algorithm.
 * @returns {string[]} Ordered node IDs
 * @throws {Error} If graph contains a cycle
 */
export function topologicalSort(adjacency, inDegree) {
  const queue = [];
  const sorted = [];

  // Find all nodes with no incoming edges
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) queue.push(nodeId);
  }

  // Clone inDegree so we don't mutate the original
  const remaining = new Map(inDegree);

  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    for (const neighbor of adjacency.get(current) || []) {
      remaining.set(neighbor, remaining.get(neighbor) - 1);
      if (remaining.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== adjacency.size) {
    throw new Error('Workflow graph contains a cycle. Remove circular dependencies.');
  }

  return sorted;
}

/**
 * Group nodes into execution levels (layers of independent nodes).
 * Nodes at the same level can run in parallel.
 * @returns {string[][]} Array of arrays, each inner array contains node IDs that can run concurrently
 */
export function getExecutionLevels(adjacency, inDegree) {
  const levels = [];
  const remaining = new Map(inDegree);

  // Start with nodes that have no dependencies
  let currentLevel = [];
  for (const [nodeId, deg] of remaining) {
    if (deg === 0) currentLevel.push(nodeId);
  }

  while (currentLevel.length > 0) {
    levels.push([...currentLevel]);

    const nextLevel = [];

    for (const nodeId of currentLevel) {
      for (const neighbor of adjacency.get(nodeId) || []) {
        remaining.set(neighbor, remaining.get(neighbor) - 1);
        if (remaining.get(neighbor) === 0) {
          nextLevel.push(neighbor);
        }
      }
    }

    currentLevel = nextLevel;
  }

  // Check if all nodes were processed
  const totalProcessed = levels.reduce((sum, level) => sum + level.length, 0);
  if (totalProcessed !== adjacency.size) {
    throw new Error('Workflow graph contains a cycle. Remove circular dependencies.');
  }

  return levels;
}

/**
 * Detect if graph has cycles.
 * @returns {boolean}
 */
export function detectCycles(adjacency, inDegree) {
  try {
    topologicalSort(adjacency, inDegree);
    return false;
  } catch {
    return true;
  }
}

/**
 * Get predecessor nodes (who feeds into a given node).
 * @param {string} nodeId
 * @returns {string[]} Array of predecessor node IDs
 */
export function getPredecessors(adjacency, nodeId) {
  const predecessors = [];
  for (const [source, targets] of adjacency) {
    if (targets.includes(nodeId)) {
      predecessors.push(source);
    }
  }
  return predecessors;
}

/**
 * Validate that a graph is a valid workflow.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGraph(graphJson) {
  const errors = [];

  try {
    const graph = typeof graphJson === 'string' ? JSON.parse(graphJson) : graphJson;

    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      errors.push('Graph must contain a "nodes" array.');
      return { valid: false, errors };
    }

    if (graph.nodes.length === 0) {
      errors.push('Workflow must contain at least one agent node.');
      return { valid: false, errors };
    }

    // Check node uniqueness
    const nodeIds = new Set();
    for (const node of graph.nodes) {
      if (!node.id) errors.push('All nodes must have an "id" field.');
      if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: "${node.id}".`);
      nodeIds.add(node.id);
      if (!node.data?.name) errors.push(`Node "${node.id}" is missing a name.`);
    }

    // Check edges reference valid nodes
    for (const edge of graph.edges || []) {
      if (!nodeIds.has(edge.source)) errors.push(`Edge source "${edge.source}" is not a valid node.`);
      if (!nodeIds.has(edge.target)) errors.push(`Edge target "${edge.target}" is not a valid node.`);
      if (edge.source === edge.target) errors.push(`Self-loop detected on node "${edge.source}".`);
    }

    // Check for cycles
    if (errors.length === 0) {
      const { adjacency, inDegree } = parseGraph(graph);
      if (detectCycles(adjacency, inDegree)) {
        errors.push('Workflow contains a cycle. Agent workflows must be acyclic (DAG).');
      }
    }
  } catch (err) {
    errors.push(`Invalid graph JSON: ${err.message}`);
  }

  return { valid: errors.length === 0, errors };
}
