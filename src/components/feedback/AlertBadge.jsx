/**
 * AlertBadge — Inline warning/danger indicator badge.
 */

import styles from './AlertBadge.module.css';

export default function AlertBadge({ level }) {
  if (level === 'normal' || !level) return null;

  return (
    <span
      className={`${styles.badge} ${
        level === 'danger' ? styles.danger : styles.warning
      }`}
    >
      {level === 'danger' ? '!!' : '!'}
    </span>
  );
}
