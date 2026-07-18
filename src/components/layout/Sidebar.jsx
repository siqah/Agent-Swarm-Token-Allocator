import { memo } from 'react';
import { useAllocation, useAllocationDispatch, ACTIONS } from '../../context/AllocationContext';
import SliderGroup from '../controls/SliderGroup';
import styles from './Sidebar.module.css';

const Sidebar = memo(function Sidebar({ onHoverNode }) {
  const { departments } = useAllocation();
  const dispatch = useAllocationDispatch();

  return (
    <aside className={styles.sidebar}>
      <span className={styles.sidebarTitle}>Allocation</span>

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
