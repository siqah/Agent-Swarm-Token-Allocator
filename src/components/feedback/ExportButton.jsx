/**
 * ExportButton — Triggers JSON config download and clipboard copy.
 */

import { useState, useCallback } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import { downloadConfig, copyConfigToClipboard } from '../../utils/exportConfig';
import styles from './ExportButton.module.css';

export default function ExportButton() {
  const state = useAllocation();
  const [copied, setCopied] = useState(false);

  const handleDownload = useCallback(() => {
    downloadConfig(state);
  }, [state]);

  const handleCopy = useCallback(async () => {
    try {
      await copyConfigToClipboard(state);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [state]);

  return (
    <div className={styles.wrapper}>
      <button
        onClick={handleDownload}
        className={styles.downloadButton}
      >
        <span>📤</span> Export Config
      </button>

      <button
        onClick={handleCopy}
        className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
        title="Copy to clipboard"
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
}
