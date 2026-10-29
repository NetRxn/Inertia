import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { StoryMotion } from './StoryMotion';
import styles from './story.module.css';

export const metadata: Metadata = {
  title: 'Inertia · the idea',
  description: 'A short scroll through what Inertia is for: connecting what an organization knows with the people who move it.',
};

const CHAPTERS = [
  { id: 'start', label: 'Start' },
  { id: 'at-rest', label: 'At rest' },
  { id: 'new-force', label: 'A new force' },
  { id: 'gravity', label: 'Gravity' },
  { id: 'realms', label: 'Three realms' },
  { id: 'asks', label: 'The ask' },
  { id: 'velocity', label: 'Velocity' },
  { id: 'in-motion', label: 'In motion' },
];

type Hue = 'signal' | 'ion' | 'pollen' | 'moss' | 'tide';

/**
 * The things an organization already has, scattered (s) and then in orbit (o) around
 * a ratified initiative. Coordinates are in cqmin from the centre of the gravity stage.
 */
const BODIES: { kind: string; name: string; hue: Hue; s: [number, number]; o: [number, number] }[] = [
  { kind: 'idea', name: "Ana's empty-lot plan", hue: 'pollen', s: [-36, -40], o: [-21.7, -12.5] },
  { kind: 'meet', name: 'Wednesday notes', hue: 'ion', s: [30, -46], o: [10.6, -39.6] },
  { kind: 'chat', name: 'Garden thread', hue: 'ion', s: [-48, 4], o: [-41, 0] },
  { kind: 'drive', name: 'Budget sheet', hue: 'tide', s: [44, -14], o: [21.7, -12.5] },
  { kind: 'sql', name: 'Past applications', hue: 'ion', s: [46, 26], o: [41, 0] },
  { kind: 'vote', name: 'Nov 12 quorum', hue: 'tide', s: [-42, 40], o: [-29, 29] },
  { kind: 'grant', name: 'Draft v3', hue: 'moss', s: [10, 48], o: [29, 29] },
  { kind: 'person', name: 'Dana, nearby', hue: 'signal', s: [-6, -24], o: [0, 25] },
];

const SCATTERED = [
  { kind: 'meet', name: 'Wednesday notes', note: 'Nobody rereads them', hue: 'ion' },
  { kind: 'chat', name: 'A 214-message thread', note: 'Scrolled away by Friday', hue: 'ion' },
  { kind: 'idea', name: "Ana's idea from March", note: 'Still a good one', hue: 'pollen' },
  { kind: 'drive', name: 'budget_FINAL_v2.xlsx', note: 'Which one is current?', hue: 'tide' },
  { kind: 'vote', name: 'A vote few people saw', note: 'Quorum by a hair', hue: 'tide' },
  { kind: 'person', name: 'Someone who wanted to help', note: "Didn't know where", hue: 'signal' },
] as const;

const LOOP = [
  { name: 'Listen', hue: 'ion', text: 'Reads meetings, chat and shared files where people already work.' },
  { name: 'Connect', hue: 'tide', text: "Ties what was said to the initiatives the group ratified." },
  { name: 'Ask', hue: 'signal', text: 'Asks one person for the one thing an agent can’t do.' },
  { name: 'Credit', hue: 'moss', text: 'Shows credit for an idea as clearly as credit for code.' },
  { name: 'Remember', hue: 'pollen', text: 'Writes back what was learned, so the next run starts ahead.' },
] as const;

function vars(v: Record<string, string | number>): CSSProperties {
  return v as CSSProperties;
}

/** The mark, drawn with the tokens so it follows the theme; its satellite travels the ring. */
function Mark({ className }: { className?: string }) {
  const ring = 'M4 48 A44 13 0 1 1 92 48 A44 13 0 1 1 4 48';
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <g transform="rotate(-18 48 48)">
        <path d="M4 48 A44 13 0 0 1 92 48" className={styles.markRing} />
        <circle cx="48" cy="48" r="22" className={styles.markBody} />
        <path d="M4 48 A44 13 0 0 0 92 48" className={styles.markRing} />
        <circle r="6" className={styles.markSat}>
          <animateMotion dur="9s" repeatCount="indefinite" path={ring} />
        </circle>
      </g>
    </svg>
  );
}

export default function StoryPage() {
  return (
    <StoryMotion className={`in-tex in-tex--grain ${styles.page}`}>
      <div className={styles.lights} aria-hidden="true">
        <span className={styles.lightSignal} />
        <span className={styles.lightIon} />
        <span className={styles.lightTide} />
      </div>
      <div className={styles.progress} aria-hidden="true" />

      <header className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label="Inertia home">
          <Mark className={styles.brandMark} />
          <span>inertia</span>
        </Link>
        <Link href="/" className="in-btn in-btn--secondary">
          Open the app
        </Link>
      </header>

      <nav className={styles.chapters} aria-label="Chapters">
        <ol>
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`} data-chapter-link title={c.label}>
                <span>{c.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <main>
        {/* 00 · Hero */}
        <section id="start" data-chapter className={`in-tex in-tex--stars ${styles.hero}`}>
          <div className={styles.heroCopy} data-reveal>
            <p className={`in-label ${styles.eyebrow}`}>Inertia · a short tour</p>
            <h1 className={styles.heroTitle}>
              Organizations have mass.
              <br />
              <span className={styles.heroAccent}>Give yours momentum.</span>
            </h1>
            <p className={styles.lede}>
              Every organization is full of energy: conversations, notes, half-finished ideas, people who want to help.
              Inertia connects all of it, and keeps it moving.
            </p>
          </div>
          <div className={styles.heroMark} data-reveal>
            <div className={styles.heroOrbitOuter} />
            <div className={styles.heroOrbitInner} />
            <Mark className={styles.heroMarkSvg} />
          </div>
          <a href="#at-rest" className={`in-label ${styles.scrollCue}`}>
            Scroll to begin
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </a>
        </section>

        {/* 01 · At rest */}
        <section id="at-rest" data-chapter className={styles.chapter}>
          <div className={styles.copy} data-reveal>
            <p className={`in-label ${styles.num}`}>01 · At rest</p>
            <h2 className={styles.title}>The knowledge is already there. It just isn’t going anywhere.</h2>
            <p className={styles.body}>
              Decisions live in meeting notes nobody rereads. Ideas sit in chat threads that scroll away by Friday. The
              people who could help don’t know they’re needed, and the few who do know end up carrying everything.
            </p>
            <p className={styles.body}>
              That isn’t a people problem. It’s physics: a body at rest stays at rest until something acts on it.
            </p>
          </div>
          <div className={`in-tex in-tex--stars ${styles.drift}`} data-reveal>
            {SCATTERED.map((item, i) => (
              <div key={item.name} className={`in-glass ${styles.driftCard}`} style={vars({ '--i': i })}>
                <span className={styles.kind} data-hue={item.hue}>
                  <i />
                  {item.kind}
                </span>
                <strong>{item.name}</strong>
                <span className={styles.driftNote}>{item.note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 02 · A new force */}
        <section id="new-force" data-chapter className={styles.chapter}>
          <div className={styles.copy} data-reveal>
            <p className={`in-label ${styles.num}`}>02 · A new force</p>
            <h2 className={styles.title}>Software teams found a new kind of thrust.</h2>
            <p className={styles.body}>
              In the last two years, the people who build software started working alongside agents that read, draft,
              check and remember. One engineer now moves like a small team.
            </p>
            <p className={styles.body}>
              That leverage has mostly stayed inside engineering. The organizer, the treasurer, the volunteer and the
              neighbour with one good idea are still doing it the old way.
            </p>
          </div>
          <div className={styles.compare} data-reveal>
            <figure className={`in-glass ${styles.compareCard}`}>
              <svg viewBox="0 0 160 120" className={styles.compareSvg} aria-hidden="true">
                <ellipse cx="80" cy="60" rx="64" ry="20" transform="rotate(-14 80 60)" className={styles.blueRing} />
                <circle cx="80" cy="60" r="16" className={styles.blueBody} />
                <g className={styles.fastSpin}>
                  <circle r="5" className={styles.blueSat}>
                    <animateMotion
                      dur="2.4s"
                      repeatCount="indefinite"
                      path="M16 60 A64 20 0 1 1 144 60 A64 20 0 1 1 16 60"
                    />
                  </circle>
                </g>
              </svg>
              <figcaption>
                <span className="in-chip in-chip--ion">With agents</span>
                <strong>People who build software</strong>
                <span>Ship, check and iterate in hours.</span>
              </figcaption>
            </figure>
            <figure className={`in-glass ${styles.compareCard}`}>
              <svg viewBox="0 0 160 120" className={styles.compareSvg} aria-hidden="true">
                <ellipse cx="80" cy="60" rx="64" ry="20" transform="rotate(-14 80 60)" className={styles.stillRing} />
                <circle cx="80" cy="60" r="16" className={styles.stillBody} />
                <circle cx="22" cy="72" r="5" className={styles.stillSat} />
              </svg>
              <figcaption>
                <span className="in-chip in-chip--tide">Without</span>
                <strong>Everyone else in the room</strong>
                <span>Waiting for the next meeting.</span>
              </figcaption>
            </figure>
          </div>
          <p className={styles.bridge} data-reveal>
            Inertia brings that same leverage to everyone else, without asking anyone to learn to code or to prompt.
          </p>
        </section>

        {/* 03 · Gravity (scroll-driven) */}
        <section
          id="gravity"
          data-chapter
          data-gravity
          data-stage="3"
          className={styles.gravity}
          style={vars({ '--p': 1 })}
        >
          <div className={styles.gravitySticky}>
            <div className={styles.gravityCopy}>
              <p className={`in-label ${styles.num}`}>03 · Gravity</p>
              <div className={styles.captions}>
                <div className={styles.caption} data-step="1">
                  <h2 className={styles.title}>Inertia listens where you already talk.</h2>
                  <p className={styles.body}>
                    Meetings, chat, the shared drive, past applications. It reads; nobody has to move anything.
                  </p>
                </div>
                <div className={styles.caption} data-step="2">
                  <h2 className={styles.title}>It connects what was said to what you agreed to do.</h2>
                  <p className={styles.body}>
                    An idea from March, a budget line and Wednesday’s notes turn out to be about the same thing.
                  </p>
                </div>
                <div className={styles.caption} data-step="3">
                  <h2 className={styles.title}>Everything falls into orbit around a goal people ratified.</h2>
                  <p className={styles.body}>
                    Organizational data and the people who move it, held by one steady pull.
                  </p>
                  <div className={styles.chips}>
                    <span className="in-chip in-chip--moss">8 sources in orbit</span>
                    <span className="in-chip in-chip--signal">1 person needed</span>
                    <span className="in-chip in-chip--tide">Vote Nov 12</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.stage} aria-hidden="true">
              <svg viewBox="-50 -50 100 100" className={styles.stageSvg}>
                <circle r="41" className={styles.orbitOuter} />
                <circle r="25" className={styles.orbitInner} />
                <g className={styles.stageSpin}>
                  <circle cx="41" cy="0" r="1.4" className={styles.stageMoon} />
                </g>
                <path d="M-18 0 A18 5 0 0 1 18 0" transform="rotate(-16)" className={styles.planetBand} />
                <circle r="11" className={styles.planet} />
                <path d="M-18 0 A18 5 0 0 0 18 0" transform="rotate(-16)" className={styles.planetBand} />
              </svg>
              <span className={`in-label ${styles.planetLabel}`}>Community Garden Grant</span>
              {BODIES.map((b) => (
                <span
                  key={b.name}
                  className={`in-glass ${styles.body3}`}
                  style={vars({ '--sx': b.s[0], '--sy': b.s[1], '--ox': b.o[0], '--oy': b.o[1] })}
                >
                  <span className={styles.kind} data-hue={b.hue}>
                    <i />
                    {b.kind}
                  </span>
                  <span className={styles.bodyName}>{b.name}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 04 · Three realms */}
        <section id="realms" data-chapter className={styles.chapter}>
          <div className={styles.copy} data-reveal>
            <p className={`in-label ${styles.num}`}>04 · Three realms</p>
            <h2 className={styles.title}>One orbit, three kinds of mass.</h2>
            <p className={styles.body}>
              Everything in Inertia belongs to the people, the agent or the organization. Each keeps its own voice, so
              you always know whose words you’re reading.
            </p>
          </div>
          <div className={styles.realms}>
            <article className={`${styles.realm} ${styles.realmPeople} in-tex in-tex--weave`} data-reveal>
              <picture>
                <source srcSet="/logos/inertia-realm-people-on-light.svg" media="(prefers-color-scheme: light)" />
                <img src="/logos/inertia-realm-people-on-dark.svg" alt="" width="56" height="56" />
              </picture>
              <p className="in-label">People · the horizon</p>
              <h3>Your words stay yours.</h3>
              <blockquote>“What if the empty lot on 5th became garden plots?”</blockquote>
              <p>Ideas are quoted and credited by name, never paraphrased into tickets.</p>
            </article>
            <article className={`in-glass ${styles.realm} ${styles.realmAgent}`} data-reveal>
              <picture>
                <source srcSet="/logos/inertia-realm-agent-on-light.svg" media="(prefers-color-scheme: light)" />
                <img src="/logos/inertia-realm-agent-on-dark.svg" alt="" width="56" height="56" />
              </picture>
              <p className="in-label">Agent · the blueprint</p>
              <h3>Reads, drafts, checks, remembers.</h3>
              <p className={styles.monoLine}>source · meet / wed notes · cited</p>
              <p>Cites where every answer came from. Prepares and critiques; never approves as a person.</p>
            </article>
            <article className={`in-glass in-tex in-tex--stars ${styles.realm} ${styles.realmOrg}`} data-reveal>
              <picture>
                <source srcSet="/logos/inertia-realm-org-on-light.svg" media="(prefers-color-scheme: light)" />
                <img src="/logos/inertia-realm-org-on-dark.svg" alt="" width="56" height="56" />
              </picture>
              <p className="in-label">Organization · the planet</p>
              <h3>Goals the group ratified.</h3>
              <p className={styles.orgLine}>Initiatives with projects in orbit</p>
              <p>Steady, diplomatic, always there. The existing systems stay the source of truth.</p>
            </article>
          </div>
        </section>

        {/* 05 · The ask */}
        <section id="asks" data-chapter className={`${styles.chapter} ${styles.split}`}>
          <div className={styles.copy} data-reveal>
            <p className={`in-label ${styles.num}`}>05 · The agent asks</p>
            <h2 className={styles.title}>Nobody has to catch up first.</h2>
            <p className={styles.body}>
              The agent does the reading, drafting and checking. Then it asks one person for the one thing an agent
              can’t do: a decision, a photo, a creative idea, a real-world action.
            </p>
            <p className={styles.body}>
              Why you, how long, what it’s for. Saying “not now” is always free. Every size of contribution counts.
            </p>
          </div>
          <div className={`in-tex in-tex--orbits ${styles.askStage}`} data-reveal>
            <section className="in-ask in-glass" aria-label="Example: Inertia asks">
              <div className="in-ask__head">
                <span className="in-dot" />
                <span className="in-label">Inertia · asks you</span>
                <span className="in-chip in-chip--signal">~15 min</span>
              </div>
              <div className="in-ask__body">
                <span className="in-gicon in-gicon--signal in-gicon--sm" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </span>
                <div>
                  <h3 className="in-ask__title">Photograph the garden plots</h3>
                  <p className="in-ask__why">
                    The grant draft needs one current photo. You’re 0.4 mi away this week and you said you’d help with
                    outreach.
                  </p>
                </div>
              </div>
              <div className="in-ask__ctx in-mono">
                <span>
                  initiative · <b>Community Garden Grant</b>
                </span>
                <span>source · meet / wed notes · drafted by agent</span>
                <span>
                  credit · <b>shown on your profile</b>
                </span>
              </div>
              <div className="in-ask__actions">
                <span className="in-btn in-btn--primary">Take it</span>
                <span className="in-btn in-btn--secondary">Not now</span>
                <span className="in-btn in-btn--quiet">Suggest someone</span>
              </div>
            </section>
          </div>
        </section>

        {/* 06 · Velocity */}
        <section id="velocity" data-chapter className={styles.chapter}>
          <div className={styles.copy} data-reveal>
            <p className={`in-label ${styles.num}`}>06 · Velocity</p>
            <h2 className={styles.title}>Faster, and the same speed next month.</h2>
            <p className={styles.body}>
              Most organizations move in bursts: a big meeting, a flurry of work, then quiet until the next one. Inertia
              keeps the small things moving in between, so progress compounds instead of restarting.
            </p>
          </div>
          <figure className={`in-glass ${styles.chart}`} data-reveal>
            <svg viewBox="0 0 600 230" className={styles.chartSvg} role="img" aria-labelledby="velocity-title">
              <title id="velocity-title">
                Illustration: progress in bursts that fades between meetings, against steady compounding momentum.
              </title>
              {[120, 260, 400, 540].map((x) => (
                <g key={x}>
                  <line x1={x} x2={x} y1="20" y2="196" className={styles.tick} />
                  <text x={x} y="216" textAnchor="middle" className={styles.tickLabel}>
                    meeting
                  </text>
                </g>
              ))}
              <line x1="20" x2="580" y1="196" y2="196" className={styles.axis} />
              <path
                pathLength={1}
                d="M20 190 L112 188 L120 152 L138 154 L252 174 L260 134 L278 137 L392 162 L400 122 L418 126 L532 152 L540 112 L580 116"
                className={styles.burst}
              />
              <path pathLength={1} d="M20 190 C 200 168, 380 96, 580 28" className={styles.momentum} />
              <circle cx="580" cy="28" r="6" className={styles.momentumDot} />
            </svg>
            <figcaption className={styles.legend}>
              <span>
                <i className={styles.legendBurst} /> In bursts
              </span>
              <span>
                <i className={styles.legendMomentum} /> With momentum
              </span>
            </figcaption>
          </figure>

          <div className={styles.loop}>
            <div className={styles.loopFigure} data-reveal>
              <svg viewBox="0 0 300 300" aria-hidden="true">
                <circle cx="150" cy="150" r="110" className={styles.loopRing} />
                <g className={styles.loopSpin}>
                  <circle cx="150" cy="40" r="7" className={styles.loopSat} />
                </g>
                {[
                  [150, 40],
                  [254.6, 116],
                  [214.7, 239],
                  [85.3, 239],
                  [45.4, 116],
                ].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="11" className={styles.loopNode} data-hue={LOOP[i].hue} />
                ))}
                <circle cx="150" cy="150" r="54" className={styles.loopCore} />
              </svg>
              <span className={`in-label ${styles.loopCenter}`}>Every run starts ahead</span>
            </div>
            <ol className={styles.loopList}>
              {LOOP.map((step, i) => (
                <li key={step.name} data-reveal style={vars({ '--i': i })}>
                  <span className={styles.kind} data-hue={step.hue}>
                    <i />
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <strong>{step.name}</strong>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 07 · Close */}
        <section id="in-motion" data-chapter className={`in-tex in-tex--stars ${styles.close}`}>
          <div className={styles.closeMark} data-reveal>
            <Mark className={styles.closeMarkSvg} />
            <svg viewBox="0 0 200 200" className={styles.closeHalo} aria-hidden="true">
              <circle cx="100" cy="100" r="96" />
            </svg>
          </div>
          <div className={styles.closeCopy} data-reveal>
            <p className={`in-label ${styles.num}`}>07 · In motion</p>
            <h2 className={styles.closeTitle}>A body in motion stays in motion.</h2>
            <p className={styles.lede}>
              That’s the whole idea. Connect what your organization knows to the people who move it, give everyone the
              same leverage, and let the momentum carry.
            </p>
            <div className={styles.cta}>
              <Link href="/" className="in-btn in-btn--primary">
                Open Inertia
              </Link>
              <a href="#start" className="in-btn in-btn--quiet">
                Back to the start
              </a>
            </div>
          </div>
        </section>
      </main>
    </StoryMotion>
  );
}
