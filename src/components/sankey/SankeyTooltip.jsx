import { formatCompact, formatCurrency, formatPercent } from '../../utils/formatters';
import { useCosts } from '../../context/CostContext';
import styles from './SankeyTooltip.module.css';

export default function SankeyTooltip({ node, mousePosition }) {
  const { getCost } = useCosts();

  if (!node || !mousePosition) return null;

  const cost = getCost(node.id);

  const tooltipWidth = 240;
  const tooltipHeight = 120;
  let left = mousePosition.x + 16;
  let top = mousePosition.y - 8;

  if (left + tooltipWidth > window.innerWidth - 8) {
    left = mousePosition.x - tooltipWidth - 8;
  }
  if (top + tooltipHeight > window.innerHeight - 8) {
    top = window.innerHeight - tooltipHeight - 8;
  }
  if (top < 8) top = 8;
  if (left < 8) left = 8;

  return (
    <div
      className={styles.tooltip}
      style={{
        left,
        top,
      }}
    >
      <div className={styles.header}>
        <span className={styles.name}>{node.name}</span>
      </div>

      <div className={styles.rows}>
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
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={`${styles.rowValue} ${mono ? styles.rowValueMono : ''}`}>
        {value}
      </span>
    </div>
  );
}
