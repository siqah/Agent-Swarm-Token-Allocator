/**
 * SankeyLink — Renders a gradient path between two Sankey nodes.
 */

import { useId } from 'react';

export default function SankeyLink({ link, pathGenerator, isHighlighted, isSimulating }) {
  const gradientId = useId();

  const sourceColor = getComputedStyle(document.documentElement)
    .getPropertyValue(link.sourceColorVar || link.source.colorVar || '--color-budget')
    .trim();

  const targetColor = getComputedStyle(document.documentElement)
    .getPropertyValue(link.targetColorVar || link.target.colorVar || '--color-budget')
    .trim();

  const pathD = pathGenerator(link);
  const strokeWidth = Math.max(1, link.width);

  return (
    <g className="sankey-link">
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse"
          x1={link.source.x1} x2={link.target.x0}>
          <stop offset="0%" stopColor={sourceColor || '#38bdf8'} stopOpacity={0.6} />
          <stop offset="100%" stopColor={targetColor || '#38bdf8'} stopOpacity={0.6} />
        </linearGradient>
      </defs>

      {/* Link path */}
      <path
        d={pathD}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        opacity={isHighlighted === null ? 0.45 : isHighlighted ? 0.8 : 0.12}
        style={{
          transition: 'opacity 200ms ease, stroke-width 200ms ease',
          strokeDasharray: isSimulating ? '8 4' : 'none',
          animation: isSimulating ? 'flowRight 0.8s linear infinite' : 'none',
        }}
      />

      {/* Hover hit area (invisible, wider for easier mouse targeting) */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth, 12)}
        style={{ cursor: 'pointer' }}
      />

      {/* Real-time flowing token packet particle */}
      {isSimulating && strokeWidth >= 1.5 && (
        <circle r={Math.min(4, Math.max(2, strokeWidth / 3.5))} fill="#ffffff" filter="url(#glow-particle)">
          <animateMotion path={pathD} dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}
