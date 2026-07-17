/**
 * ExportButton — Triggers JSON config download and clipboard copy.
 */

import { useState, useCallback } from 'react';
import { useAllocation } from '../../context/AllocationContext';
import { downloadConfig, copyConfigToClipboard } from '../../utils/exportConfig';

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
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      <button
        onClick={handleDownload}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'linear-gradient(135deg, oklch(0.55 0.15 250), oklch(0.45 0.18 270))',
          borderRadius: 'var(--radius-lg)',
          color: 'white',
          fontWeight: 'var(--weight-semibold)',
          fontSize: 'var(--text-sm)',
          border: 'none',
          cursor: 'pointer',
          transition: 'all var(--duration-fast) var(--ease-smooth)',
          boxShadow: '0 2px 8px oklch(0.45 0.18 270 / 0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 16px oklch(0.45 0.18 270 / 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px oklch(0.45 0.18 270 / 0.3)';
        }}
      >
        📤 Export Config
      </button>

      <button
        onClick={handleCopy}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-3)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          color: copied ? 'var(--color-success)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all var(--duration-fast)',
          fontSize: 'var(--text-sm)',
          minWidth: '44px',
        }}
        title="Copy to clipboard"
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
}
