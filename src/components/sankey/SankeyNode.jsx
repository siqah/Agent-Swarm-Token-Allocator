/**
 * SankeyNode — Renders a single node rectangle in the Sankey diagram.
 */

import { formatCompact } from '../../utils/formatters';

export default function SankeyNode({ node, alertLevel, isHovered, onHover, onLeave }) {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue(node.colorVar)
    .trim();

  const nodeHeight = Math.max(node.y1 - node.y0, 2);
  const nodeWidth = node.x1 - node.x0;

  const glowClass =
    alertLevel === 'danger'
      ? 'node-danger'
      : alertLevel === 'warning'
      ? 'node-warning'
      : '';

  return (
    <g
      className={`sankey-node ${glowClass}`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={onLeave}
      style={{ cursor: 'pointer' }}
    >
      {/* Glow effect behind the node */}
      {alertLevel !== 'normal' && (
        <rect
          x={node.x0 - 3}
          y={node.y0 - 3}
          width={nodeWidth + 6}
          height={nodeHeight + 6}
          rx={6}
          fill="none"
          stroke={alertLevel === 'danger' ? 'oklch(0.65 0.25 25)' : 'oklch(0.82 0.18 80)'}
          strokeWidth={2}
          opacity={0.6}
        >
          <animate
            attributeName="opacity"
            values="0.6;0.2;0.6"
            dur={alertLevel === 'danger' ? '1.5s' : '2s'}
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Main node rectangle */}
      <rect
        x={node.x0}
        y={node.y0}
        width={nodeWidth}
        height={nodeHeight}
        rx={4}
        fill={color || '#38bdf8'}
        opacity={isHovered ? 1 : 0.85}
        style={{
          filter: isHovered ? `drop-shadow(0 0 8px ${color})` : 'none',
          transition: 'opacity 200ms ease, filter 200ms ease',
        }}
      />

      {/* Node label */}
      {nodeHeight > 20 && (
        <text
          x={node.column === 2 ? node.x1 + 8 : node.x0 - 8}
          y={(node.y0 + node.y1) / 2}
          textAnchor={node.column === 2 ? 'start' : 'end'}
          dominantBaseline="middle"
          fill="oklch(0.92 0.005 260)"
          fontSize="12"
          fontFamily="var(--font-body)"
          fontWeight="500"
          style={{ pointerEvents: 'none' }}
        >
          {node.icon && `${node.icon} `}
          {node.name}
        </text>
      )}

      {/* Token count below label */}
      {nodeHeight > 30 && node.value && (
        <text
          x={node.column === 2 ? node.x1 + 8 : node.x0 - 8}
          y={(node.y0 + node.y1) / 2 + 16}
          textAnchor={node.column === 2 ? 'start' : 'end'}
          dominantBaseline="middle"
          fill="oklch(0.6 0.01 260)"
          fontSize="10"
          fontFamily="var(--font-mono)"
          style={{ pointerEvents: 'none' }}
        >
          {formatCompact(node.value)} tokens
        </text>
      )}
    </g>
  );
}
