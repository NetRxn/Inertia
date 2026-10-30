'use client';

import { useEffect, useRef } from 'react';

/**
 * The scroll behaviour for the story page, kept to one effect so the chapters stay
 * server-rendered markup. It sets three things the CSS reads:
 * - `--scroll` on the root (0–1), for the progress line;
 * - `--p` on each [data-gravity] section (0–1), how far the bodies have fallen into orbit;
 * - `.isIn` on each [data-reveal] element once it has scrolled into view.
 * Without JavaScript every chapter is simply visible and the gravity scene shows its end state.
 */
export function StoryMotion({ className, children }: { className?: string; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.dataset.motion = 'on';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      el.querySelectorAll('svg').forEach((svg) => svg.pauseAnimations?.());
    }

    const reveals = el.querySelectorAll<HTMLElement>('[data-reveal]');
    const revealer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('isIn');
            revealer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    reveals.forEach((node) => revealer.observe(node));

    const chapters = Array.from(el.querySelectorAll<HTMLElement>('[data-chapter]'));
    const dots = Array.from(el.querySelectorAll<HTMLAnchorElement>('[data-chapter-link]'));
    const gravity = Array.from(el.querySelectorAll<HTMLElement>('[data-gravity]'));

    let frame = 0;
    function update() {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      el!.style.setProperty('--scroll', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));

      for (const section of gravity) {
        const rect = section.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        const raw = travel > 0 ? -rect.top / travel : 1;
        // Hold the scattered picture a moment, then fall in over most of the scroll.
        const p = Math.min(1, Math.max(0, (raw - 0.08) / 0.72));
        section.style.setProperty('--p', p.toFixed(4));
        section.dataset.stage = p < 0.34 ? '1' : p < 0.8 ? '2' : '3';
      }

      const middle = window.innerHeight * 0.45;
      let current = chapters[0]?.id;
      for (const chapter of chapters) {
        if (chapter.getBoundingClientRect().top <= middle) current = chapter.id;
      }
      for (const dot of dots) {
        if (dot.hash === `#${current}`) dot.setAttribute('aria-current', 'step');
        else dot.removeAttribute('aria-current');
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      revealer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
