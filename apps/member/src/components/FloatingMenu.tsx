'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './FloatingMenu.module.css';

type Section = { href: string; label: string; glyph: React.ReactNode };

// Rounded 24px outline glyphs at 1.75px stroke, per the design system's icon rule.
const SECTIONS: Section[] = [
  {
    href: '/agents',
    label: 'Agents',
    glyph: (
      <>
        <rect x="5" y="7" width="14" height="11" rx="3" />
        <path d="M12 3.5V7M9.5 12h.01M14.5 12h.01M9.5 15h5" />
      </>
    ),
  },
  {
    href: '/',
    label: 'Home',
    glyph: (
      <>
        <path d="M3.5 10.5 12 3.5l8.5 7" />
        <path d="M5.5 9v11h13V9" />
        <path d="M10 20v-5.5h4V20" />
      </>
    ),
  },
  {
    href: '/org',
    label: 'Organization',
    glyph: (
      <>
        <circle cx="12" cy="7" r="2.5" />
        <circle cx="6" cy="16" r="2.5" />
        <circle cx="18" cy="16" r="2.5" />
        <path d="M10.5 9 7.5 13.8M13.5 9l3 4.8M8.5 16h7" />
      </>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** The sticky glass pill of the three sections, Home in the middle, with the current one marked. */
export function FloatingMenu() {
  const pathname = usePathname();

  return (
    <nav className={`in-glass ${styles.menu}`} aria-label="Sections">
      <ul className={styles.list}>
        {SECTIONS.map((section) => {
          const active = isActive(pathname, section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={styles.link}
                aria-current={active ? 'page' : undefined}
                data-home={section.href === '/' ? '' : undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {section.glyph}
                </svg>
                <span>{section.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
