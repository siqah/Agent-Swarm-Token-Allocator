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
        <div className={styles.logo}>⚡</div>
        <div>
          <h1 className={styles.title}>Swarm Control</h1>
          <p className={styles.subtitle}>Agent Token Allocator</p>
        </div>
      </div>

      <div className={styles.headerControls}>
        <BudgetInput />
        <ModelSelector />
      </div>
    </header>
  );
}
