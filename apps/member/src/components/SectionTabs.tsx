import Link from 'next/link';
import styles from './Tabs.module.css';

export type SectionTab = { href: string; label: string; current: boolean };

/** A row of tabs as links. `variant="chips"` is the smaller filter row inside a feed. */
export function SectionTabs({ tabs, label, variant = 'tabs' }: { tabs: SectionTab[]; label: string; variant?: 'tabs' | 'chips' }) {
  return (
    <nav className={variant === 'chips' ? styles.chips : styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={tab.current ? 'page' : undefined} scroll={false}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
