import { useState, useEffect, useCallback } from 'react';
import styles from './KeyboardShortcuts.module.css';

const SHORTCUTS = [
  { key: 'Ctrl+Z / Cmd+Z', label: 'Undo' },
  { key: 'Ctrl+Shift+Z / Cmd+Shift+Z', label: 'Redo' },
  { key: '?', label: 'Toggle shortcuts' },
  { key: 'R', label: 'Reset all allocations' },
  { key: 'S', label: 'Toggle simulation' },
  { key: 'Escape', label: 'Close panels / modals' },
];

export default function KeyboardShortcuts({ onUndo, onRedo, onReset, onToggleSim }) {
  const [open, setOpen] = useState(false);

  const handleKey = useCallback((e) => {
    const mod = e.metaKey || e.ctrlKey;

    if (e.key === '?' && !mod && !e.shiftKey) {
      e.preventDefault();
      setOpen((v) => !v);
      return;
    }

    if (e.key === 'Escape' && open) {
      setOpen(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Keyboard Shortcuts</span>
          <button className={styles.closeButton} onClick={() => setOpen(false)}>Esc</button>
        </div>
        <div className={styles.list}>
          {SHORTCUTS.map((s) => (
            <div key={s.key} className={styles.row}>
              <kbd className={styles.key}>{s.key}</kbd>
              <span className={styles.desc}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
