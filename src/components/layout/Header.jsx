/**
 * Header — Logo, total budget input, model selector.
 */

import BudgetInput from '../controls/BudgetInput';
import ModelSelector from '../controls/ModelSelector';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src="/favicon.svg" alt="Swarm Control Logo" className={styles.logo} />
        <div className={styles.workspaceSelector}>
          <span className={styles.statusDot} />
          <span className={styles.workspaceText}>swarm-control / sandbox-01</span>
          <span className={styles.dropdownChevron}>▾</span>
        </div>
      </div>

      <div className={styles.headerControls}>
        <BudgetInput />
        <ModelSelector />
      </div>
    </header>
  );
}
