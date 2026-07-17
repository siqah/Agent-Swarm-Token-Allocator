/**
 * useSankeyLayout — Transforms allocation state into D3 Sankey layout data.
 * D3 computes positions; React renders SVG elements.
 */

import { useMemo } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

/**
 * Computes the Sankey diagram layout from allocation state.
 *
 * @param {object} state - The allocation state (departments, totalBudget)
 * @param {number} width - SVG canvas width
 * @param {number} height - SVG canvas height
 * @returns {{ nodes: Array, links: Array, sankeyLinkPath: Function }}
 */
export function useSankeyLayout(state, width, height) {
  return useMemo(() => {
    if (!width || !height || width < 100 || height < 100) {
      return { nodes: [], links: [], sankeyLinkPath: () => '' };
    }

    const { totalBudget, departments } = state;

    // ── Build nodes ────────────────────────
    const nodes = [];
    const nodeMap = new Map();

    // Column 0: Total Budget (source)
    const budgetNode = {
      id: 'budget',
      name: 'Token Budget',
      category: 'budget',
      colorVar: '--color-budget',
      column: 0,
    };
    nodes.push(budgetNode);
    nodeMap.set('budget', 0);

    // Column 1: Departments
    departments.forEach((dept) => {
      nodeMap.set(dept.id, nodes.length);
      nodes.push({
        id: dept.id,
        name: dept.name,
        icon: dept.icon,
        category: 'department',
        colorVar: dept.colorVar,
        allocation: dept.allocation,
        column: 1,
      });
    });

    // Column 2: Agents
    departments.forEach((dept) => {
      dept.agents.forEach((agent) => {
        nodeMap.set(agent.id, nodes.length);
        nodes.push({
          id: agent.id,
          name: agent.name,
          icon: agent.icon,
          category: 'agent',
          colorVar: dept.colorVar,
          departmentId: dept.id,
          allocation: agent.allocation,
          effectiveAllocation: (dept.allocation / 100) * (agent.allocation / 100) * 100,
          column: 2,
        });
      });
    });

    // ── Build links ────────────────────────
    const links = [];

    // Budget → Departments
    departments.forEach((dept) => {
      const value = totalBudget * (dept.allocation / 100);
      if (value > 0) {
        links.push({
          source: 'budget',
          target: dept.id,
          value: Math.max(value, 1), // d3-sankey requires value > 0
          sourceId: 'budget',
          targetId: dept.id,
          sourceColorVar: '--color-budget',
          targetColorVar: dept.colorVar,
        });
      }
    });

    // Departments → Agents
    departments.forEach((dept) => {
      const deptTokens = totalBudget * (dept.allocation / 100);
      dept.agents.forEach((agent) => {
        const value = deptTokens * (agent.allocation / 100);
        if (value > 0) {
          links.push({
            source: dept.id,
            target: agent.id,
            value: Math.max(value, 1),
            sourceId: dept.id,
            targetId: agent.id,
            sourceColorVar: dept.colorVar,
            targetColorVar: dept.colorVar,
          });
        }
      });
    });

    // ── Compute layout ─────────────────────
    const sankeyGenerator = sankey()
      .nodeId((d) => d.id)
      .nodeWidth(18)
      .nodePadding(16)
      .nodeSort(null) // preserve insertion order
      .extent([
        [1, 24],
        [width - 1, height - 24],
      ]);

    const graph = sankeyGenerator({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    return {
      nodes: graph.nodes,
      links: graph.links,
      sankeyLinkPath: sankeyLinkHorizontal(),
    };
  }, [state, width, height]);
}
