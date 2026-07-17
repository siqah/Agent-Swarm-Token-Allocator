/**
 * SankeyTooltip — Floating tooltip showing details on hover.
 */

import { formatCompact, formatCurrency, formatPercent } from '../../utils/formatters';
import { useCosts } from '../../context/CostContext';

export default function SankeyTooltip({ node, mousePosition }) {
  const { getCost } = useCosts();

  if (!node || !mousePosition) return null;

  const cost = getCost(node.id);

  return (
    <div
      className="sankey-tooltip"
      style={{
        position: 'fixed',
        left: mousePosition.x + 16,
        top: mousePosition.y - 8,
        zIndex: 'var(--z-tooltip)',
        pointerEvents: 'none',
        background: 'oklch(0.18 0.015 260 / 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid oklch(1 0 0 / 0.1)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 16px',
        maxWidth: '260px',
        boxShadow: 'var(--shadow-elevated)',
        animation: 'fadeIn 150ms ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {node.icon && <span style={{ fontSize: '16px' }}>{node.icon}</span>}
        <span style={{
          color: 'oklch(0.95 0.005 260)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
        }}>
          {node.name}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {node.value && (
          <TooltipRow label="Tokens/mo" value={formatCompact(node.value)} mono />
        )}
        {node.allocation !== undefined && (
          <TooltipRow label="Allocation" value={formatPercent(node.allocation)} />
        )}
        {node.effectiveAllocation !== undefined && (
          <TooltipRow label="Effective" value={formatPercent(node.effectiveAllocation)} />
        )}
        {cost?.totalCost !== undefined && (
          <TooltipRow label="Est. Cost" value={formatCurrency(cost.totalCost)} mono />
        )}
      </div>
    </div>
  );
}

function TooltipRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
      <span style={{ color: 'oklch(0.6 0.01 260)', fontSize: '12px' }}>{label}</span>
      <span style={{
        color: 'oklch(0.88 0.005 260)',
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}
