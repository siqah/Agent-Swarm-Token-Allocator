import { memo, useCallback } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import SliderGroup from '../controls/SliderGroup';
import styles from './Sidebar.module.css';

const Sidebar = memo(function Sidebar({ onHoverNode }) {
  const { departments } = useAllocation();
  const dispatch = useAllocationDispatch();

  const handleAddDept = useCallback(() => {
    dispatch({ type: ACTIONS.ADD_DEPT });
  }, [dispatch]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarTitle}>Allocation</span>
        <button className={styles.addButton} onClick={handleAddDept} title="Add department">
          +
        </button>
      </div>

      <div className={styles.groupList}>
        {departments.map((dept) => (
          <SliderGroup key={dept.id} department={dept} onHoverNode={onHoverNode} />
        ))}
      </div>

      <button
        className={styles.resetButton}
        onClick={() => dispatch({ type: ACTIONS.RESET })}
      >
        Reset to defaults
      </button>
    </aside>
  );
});

export default Sidebar;
