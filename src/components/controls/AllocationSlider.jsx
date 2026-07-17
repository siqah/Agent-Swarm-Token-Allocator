/**
 * AllocationSlider — A single reusable range slider with label and value display.
 */

import { useCallback } from 'react';
import { formatPercent } from '../../utils/formatters';
import styles from './SliderGroup.module.css';

export default function AllocationSlider({
  label,
  icon,
  value,
  color,
  onChange,
  alertLevel,
  'aria-label': ariaLabel,
}) {
  const handleChange = useCallback(
    (e) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  return (
    <div className={styles.sliderRow}>
      {label && (
        <span className={styles.sliderLabel}>
          {icon && `${icon} `}
          {label}
          {alertLevel === 'warning' && (
            <span className={`${styles.alertBadge} ${styles.alertWarning}`}> ⚠️</span>
          )}
          {alertLevel === 'danger' && (
            <span className={`${styles.alertBadge} ${styles.alertDanger}`}> 🚨</span>
          )}
        </span>
      )}
      <input
        type="range"
        className={styles.slider}
        min="0"
        max="100"
        step="0.5"
        value={value}
        onChange={handleChange}
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, var(--bg-elevated) ${value}%, var(--bg-elevated) 100%)`,
        }}
        aria-label={ariaLabel || label}
      />
      <span className={styles.sliderValue}>{formatPercent(value)}</span>
    </div>
  );
}
