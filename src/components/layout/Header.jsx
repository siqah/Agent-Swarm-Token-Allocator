import BudgetInput from '../controls/BudgetInput';
import ModelSelector from '../controls/ModelSelector';
import styles from './Header.module.css';

export default function Header({ connected = true }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src="/favicon.svg" alt="Swarm Control" className={styles.logo} />
        <span className={styles.appName}>Swarm Control</span>
        <span className={styles.separator}>/</span>
        <span className={styles.workspace}>sandbox-01</span>
        <span className={`${styles.gatewayBadge} ${connected ? '' : styles.disconnected}`}>
          <span className={`${styles.liveDot} ${connected ? '' : styles.dotOffline}`} />
          gateway
        </span>
      </div>

      <div className={styles.headerControls}>
        <BudgetInput />
        <ModelSelector />
      </div>
    </header>
  );
}
