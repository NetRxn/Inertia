'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './FloatingMenu.module.css';

type Section = { href: string; label: string; glyph: React.ReactNode };

// Rounded 24px outline glyphs at 1.75px stroke, per the design system's icon rule.
const SECTIONS: Section[] = [
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
    href: '/votes',
    label: 'Votes',
    glyph: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    href: '/work',
    label: 'Work',
    glyph: (
      <>
        <rect x="5" y="4.5" width="14" height="16" rx="2" />
        <path d="M9 3h6v3H9z" />
        <path d="M9 11h6M9 15h4" />
      </>
    ),
  },
  {
    href: '/funding',
    label: 'Funding',
    glyph: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.5 9.6c-.5-.8-1.4-1.3-2.5-1.3-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.5 1.9-1.1 0-2-.5-2.5-1.3" />
        <path d="M12 6.6v1.7M12 15.8v1.6" />
      </>
    ),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    glyph: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    href: '/docs',
    label: 'Docs',
    glyph: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4M9 12.5h6M9 16.5h6" />
      </>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    glyph: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
      </>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** The sticky glass pill of the six sections, with the current one marked. */
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
                aria-label={section.label}
                title={section.label}
                aria-current={active ? 'page' : undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {section.glyph}
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
