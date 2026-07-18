import { memo, useCallback, useState, useMemo, useRef } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import SliderGroup from '../controls/SliderGroup';
import styles from './Sidebar.module.css';

const Sidebar = memo(function Sidebar({ onHoverNode }) {
  const { departments } = useAllocation();
  const dispatch = useAllocationDispatch();
  const [confirmReset, setConfirmReset] = useState(false);
  const [search, setSearch] = useState('');
  const [dragIndex, setDragIndex] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return departments;
    const q = search.toLowerCase();
    return departments.filter((d) => {
      if (d.name.toLowerCase().includes(q)) return true;
      return d.agents.some((a) => a.name.toLowerCase().includes(q));
    });
  }, [departments, search]);

  const handleAddDept = useCallback(() => {
    dispatch({ type: ACTIONS.ADD_DEPT });
  }, [dispatch]);

  const handleReset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    dispatch({ type: ACTIONS.RESET });
  }, [confirmReset, dispatch]);

  const cancelReset = useCallback(() => {
    setConfirmReset(false);
  }, []);

  const handleDragStart = useCallback((idx) => {
    setDragIndex(idx);
  }, []);

  const handleDrop = useCallback((toIndex) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    const fromIndex = departments.findIndex((d) => d.id === filtered[dragIndex].id);
    const toIdx = departments.findIndex((d) => d.id === filtered[toIndex].id);
    if (fromIndex !== -1 && toIdx !== -1 && fromIndex !== toIdx) {
      dispatch({ type: ACTIONS.MOVE_DEPT, payload: { fromIndex, toIndex: toIdx } });
    }
    setDragIndex(null);
  }, [dragIndex, departments, filtered, dispatch]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarTitle}>Allocation</span>
      </div>

      {departments.length > 0 && (
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className={styles.groupList}>
        {departments.length === 0 ? (
          <div className={styles.emptyState}>
            <span>No departments yet</span>
            <button className={styles.addDeptButtonEmpty} onClick={handleAddDept}>
              + Add new field
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <span>No matches for &ldquo;{search}&rdquo;</span>
          </div>
        ) : (
          <>
            {filtered.map((dept, idx) => (
              <div
                key={dept.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                className={dragIndex === idx ? styles.dragging : undefined}
              >
                <SliderGroup department={dept} onHoverNode={onHoverNode} />
              </div>
            ))}
            <button className={styles.addDeptButton} onClick={handleAddDept}>
              + Add new field
            </button>
          </>
        )}
      </div>

      <div className={styles.resetRow}>
        {confirmReset ? (
          <>
            <span className={styles.confirmText}>Reset all?</span>
            <button className={styles.confirmButton} onClick={handleReset}>
              Yes
            </button>
            <button className={styles.cancelButton} onClick={cancelReset}>
              No
            </button>
          </>
        ) : (
          <button className={styles.resetButton} onClick={handleReset}>
            Reset to defaults
          </button>
        )}
      </div>
    </aside>
  );
});

export default Sidebar;
