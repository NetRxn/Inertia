'use client';

import { useEffect, useRef } from 'react';

/**
 * A <details> that opens itself when the page's hash names it, so a source
 * chip linking to /docs#meeting-<id> lands on that meeting's notes, open.
 */
export function HashDetails({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash !== `#${id}` || !ref.current) return;
      ref.current.open = true;
      ref.current.scrollIntoView({ block: 'start' });
    };
    openIfTargeted();
    window.addEventListener('hashchange', openIfTargeted);
    return () => window.removeEventListener('hashchange', openIfTargeted);
  }, [id]);

  return (
    <details ref={ref} id={id} className={className}>
      {children}
    </details>
  );
}
