import { formatCompact } from '../../utils/formatters';
import styles from './SankeyNode.module.css';

export default function SankeyNode({ node, alertLevel, isHovered, onHover, onLeave }) {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue(node.colorVar)
    .trim();

  const nodeHeight = Math.max(node.y1 - node.y0, 2);
  const nodeWidth = node.x1 - node.x0;

  return (
    <g
      className={styles.node}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={onLeave}
    >
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

      {isHovered && (
        <rect
          x={node.x0 - 4}
          y={node.y0 - 4}
          width={nodeWidth + 8}
          height={nodeHeight + 8}
          rx={8}
          fill={color || '#38bdf8'}
          opacity={0.15}
          style={{ pointerEvents: 'none' }}
        />
      )}

      <rect
        x={node.x0}
        y={node.y0}
        width={nodeWidth}
        height={nodeHeight}
        rx={4}
        fill="var(--bg-elevated)"
        stroke="var(--border-subtle)"
        strokeWidth={1}
        opacity={isHovered ? 0.95 : 0.70}
        style={{
          transition: 'opacity var(--duration-fast) var(--ease-out-quint)',
        }}
      />

      <rect
        x={node.column === 2 ? node.x0 : node.x1 - 3}
        y={node.y0}
        width={3}
        height={nodeHeight}
        rx={1.5}
        fill={color || '#38bdf8'}
        opacity={isHovered ? 1 : 0.8}
        style={{
          filter: isHovered ? `drop-shadow(0 0 6px ${color})` : 'none',
          transition: 'opacity var(--duration-fast) var(--ease-out-quint), filter var(--duration-fast) var(--ease-out-quint)',
        }}
      />

      {nodeHeight > 20 && (
        <text
          x={node.column === 2 ? node.x1 + 8 : node.x0 - 8}
          y={(node.y0 + node.y1) / 2}
          textAnchor={node.column === 2 ? 'start' : 'end'}
          dominantBaseline="middle"
          fill="oklch(0.92 0.005 260)"
          fontSize="10"
          fontFamily="var(--font-mono)"
          fontWeight="500"
          style={{ pointerEvents: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          {node.name}
        </text>
      )}

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
