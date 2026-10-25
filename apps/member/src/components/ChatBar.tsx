import styles from './ChatBar.module.css';

/**
 * The bar pinned to the bottom of every member page where members will ask the DAO
 * questions. It is a placeholder until the chat arrives (Task 9), so it takes no input.
 */
export function ChatBar() {
  return (
    <div className={styles.dock}>
      <div className={`in-glass ${styles.bar}`}>
        <span className="in-dot" aria-hidden="true" />
        <span className={styles.prompt}>Ask the DAO anything…</span>
      </div>
    </div>
  );
}
