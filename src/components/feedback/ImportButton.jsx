import { useRef, useCallback, useState } from 'react';
import { useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import { parseImportConfig } from '../../utils/importConfig';
import styles from './ImportButton.module.css';

export default function ImportButton() {
  const dispatch = useAllocationDispatch();
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFile = useCallback((file) => {
    setError(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = parseImportConfig(e.target.result);
        dispatch({
          type: ACTIONS.SET_STATE,
          payload: {
            totalBudget: config.totalBudget,
            selectedModel: config.selectedModel,
            thresholds: config.thresholds,
            departments: config.departments,
          },
        });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } catch (err) {
        setError(err.message);
        setTimeout(() => setError(null), 4000);
      }
    };
    reader.readAsText(file);
  }, [dispatch]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div
      className={styles.zone}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        onChange={handleChange}
        className={styles.hiddenInput}
      />
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : success ? (
        <span className={styles.success}>Imported</span>
      ) : (
        <span className={styles.label}>Import Config</span>
      )}
    </div>
  );
}
