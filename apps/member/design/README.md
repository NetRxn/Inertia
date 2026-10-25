Inertia is an open-source agentic coordination layer for organizations — first built for FWTX DAO. It listens where members already talk, organizes ideas under ratified initiatives, and asks people only for what an agent can't do: a decision, a photo, a creative idea, a real-world action. It inverts the usual tool: **the system informs the people, not the other way round.**

The look is **techno mid-century modern**: a 1960s space-age control room built into the walnut den of a Wright house. Espresso ground with a faint dot grid, floating panes of glass, and the palette of an Eames-era living room — tomato, atomic teal, mustard, avocado, powder blue, walnut — lit like instrument lights. Optimistic, precise, never cold or threatening.

## Principles

- **Human before system.** Every idea shows who said it, in their own words. Quote people; don't paraphrase them into tickets.
- **The agent asks, it doesn't assign.** One clear ask at a time, with why it's you and how long it takes. Saying "not now" is always free.
- **Inviting, never demanding.** No red badges, countdowns or "overdue". Empty states ask a question.
- **Alive, not busy.** Light and glass move a little; one thing moves at a time.
- **Every size of contribution counts.** Show credit for an idea as clearly as credit for code.

## Three realms

Everything in Inertia belongs to one of three realms. Each has its own material, voice, colour, shape, texture and motion — and a screen should always make clear whose it is.

| | **People** — organic | **Agent** — atomic | **Organization** — planetary |
|---|---|---|---|
| Feels like | The den of a Frank Lloyd Wright house: warm wood, low lamplight, a hearth, comfortable | A lab instrument: technical, calculated, exact | A planet: steady, diplomatic, benevolent, always there |
| Material | **Hearth** — `hearth` ground, `hearth-edge`, solid and warm | **Glass** — floating, see-through, lit edges | **Space** — `void` with the starfield; glass panels for the view onto it |
| Voice | Serif — `idea`, `quote` (Newsreader italic) | Mono — `mono`, `label` (Martian Mono) | Grotesk — `display-xl` … `small` (Schibsted Grotesk) |
| Colour | `walnut`, `signal` (the ember), `pollen` (the lamp) | `ion` | `tide` (the sky), `moss` (growth) |
| Shape (the orbit, drawn as…) | A horizon: the walnut `in-prairie` double rule, generous `radius-lg` | A blueprint: fine strokes, outlined bodies, small precise radii | A planet: big calm discs, broad rings, moons |
| Texture | `in-tex--weave` and grain | `in-tex--orbits` | `in-tex--stars` |
| Motion | Settles slowly, 320ms ease-out with a little give | Quick and exact, 160ms, no overshoot; the presence dot breathes | Very slow and constant: orbits turn once in 90s |
| Components | IdeaCard, quotes, profiles | AgentAsk, GlassIcon, the presence dot | Initiative, PathStep, votes |

- The type rule follows from it: never set a member's words in mono, or the agent's words in serif. The organization — titles, structure, controls — speaks in grotesk; the wordmark is drawn from that face, lowercase.
- `signal` crosses realms on purpose: it is the people's ember, so it marks every moment a person is needed — even inside the agent's glass.
- Load from Google Fonts: `Schibsted+Grotesk:wght@400..700`, `Newsreader:ital,opsz,wght@1,6..72,400..500`, `Martian+Mono:wght@400;500`.

## Voice and copy

- Write like a sharp, warm facilitator: plain, second person, sentence case everywhere ("Take it", "Suggest someone").
- The agent is "Inertia" in UI, and speaks briefly: what it needs, why you, how long. "Need a photo of the garden plots for the grant. You're 0.4 mi away. ~15 min."
- Half-formed is welcome: "Rough is fine. You can change it later."
- Credit people by first name: "Dana and 4 others agree". Never "users".
- No exclamation marks, no emoji in UI text. Problems are calm, with a next step: "That didn't save — try again?"

## Colour

- `void` is the ground (dot grid in `line` at `space-4` pitch); `surface` and `surface-raised` are solid panels; floating things are **glass**.
- Text is `ink`; metadata and agent context `ink-muted`.
- Each hue has a meaning, a fill, a `-text` and a `-wash` (chip ground):
  - `signal` (tomato) — **a human is needed**: the primary action, the agent's ask, the "now" step. One per view.
  - `ion` (atomic teal) — **the agent**: its presence, things it captured or drafted.
  - `pollen` (mustard) — **ideas**: newly captured, highlighted, your vote.
  - `moss` (avocado) — **momentum**: agreement, credit, done.
  - `tide` (powder blue) — **open questions and votes**.
- `walnut` is wood — the people realm: Prairie rules, illustration, the cover, large shapes; never text or a state. `hearth` and `hearth-edge` are the people's warm surfaces.
- Fills take `on-bright` text. Text in a hue uses its `-text` token, on void, surface, glass or its `-wash`.
- Keep it mostly espresso (or cream): ~85% neutrals and glass; colour only where something is happening.
- No alarm red. Meaning is never colour alone — every chip has a word, every icon a label or tooltip.

## The one motif: the orbit

Inertia has a single image — **a body, its path, and a satellite**: mass in motion. Every mark, illustration and loading state is a version of it. No other emblems (no atoms with crossed orbits, no starbursts, no rockets).

- **The mark** — a `signal` body (the people), an `ink` ring (the organization's steady path), an `ion` satellite (the agent) travelling it. All three realms in one figure.
- **Each realm draws the same orbit its own way:**
  - **People — the horizon.** The ring laid flat into a walnut Prairie double rule; the body sits on it like the sun over a Wright den's long window; a `pollen` lamp for the satellite.
  - **Agent — the blueprint.** The same orbit as fine `ion` linework: an outlined body, a 2px ring, a solid satellite. Precise, drawn, calculated.
  - **Organization — the planet.** A broad `tide` body, a heavy `moss` ring, a `pollen` moon. The Initiative component is this figure at work, with projects as moons.
- Motion is the motif too: satellites travel their rings (agent: quick and exact; organization: one turn in 90s); a people-realm body only settles.
- Celebration is the satellite completing its orbit — the ring closes and glows `halo-moss` once. No confetti, no bursts.
- Compose larger pictures from flat cut-paper discs, pills and slabs (Saul Bass), always arranged as bodies and paths. Flat colour plus a whisper of texture; no gradients, no faux-wood photos.
- Interface chrome stays modern (glass, mono, dot grid); the motif lives in brand moments, roughly one per screen.

## Textures

Mid-century print surfaces, kept quiet (`Texture` component, `in-tex--*` classes).

- **Grain** at `opacity-grain` — the page ground and hero areas.
- **Starfield** — empty states, onboarding, the night board.
- **Orbits** — faint single-ring orbits; agent spaces: behind the AgentAsk, loading screens.
- **Weave** — a linen cross-hatch for sidebars and profile headers.
- One texture per surface (grain can join any). Textures sit on grounds, never on chips, buttons or dense text. If you notice it before the content, it's too strong.

## Glass and floating icons

- Glass = `glass` fill + `backdrop-filter: blur(var(--blur-glass)) saturate(140%)` + 1px `glass-edge` border + `shadow-float` (its inset line is the lit top edge). Hover: `glass-strong` + `shadow-lift`.
- Glass sits over something worth seeing through: the dot grid, coloured light, other cards. Never glass on glass on glass — two layers max.
- **Floating icons** (`GlassIcon`): a glass tile at `radius-md`, a 1.75px outline glyph in the hue's `-text` colour (3:1+ on glass in both themes), and that hue's `halo-*` beneath, so the icon hovers over its own light. They drift ±2px on a slow loop (6–8s) — stagger them; never in sync.
- Icon glyphs: rounded 24px outline set at 1.75px stroke (Lucide or Phosphor "regular" are close fits). No filled icons, no emoji.

## Shape, space and depth

- Corners: `radius-md` controls and icon tiles, `radius-lg` cards, `radius-xl` the agent panel, `radius-pill` chips and nodes.
- Space in `space-*` steps: cards at `space-6`, sections `space-8`, page margins `space-12`.
- Depth comes from glass, `shadow-float`/`shadow-lift` and halos. No gradients as decoration, no neon outlines.

## Motion

- Each realm moves its own way (see Three realms). Shared easing: `cubic-bezier(.2,.8,.2,1)`.
- Captured ideas drift in from the edge they came from; a chosen path draws its steps in order.
- The agent's presence dot breathes slowly (opacity, 3s) while it is working — that's its only idle motion.
- `prefers-reduced-motion`: fades only, no drift.

## Focus and accessibility

- Focus ring: 2px solid `ink`, 2px offset, on every interactive element, in both themes.
- All text pairs above hold 4.5:1 in Night and Day, including on glass over `void` and on each `-wash`. `line-strong` borders hold 3:1. `glass-edge` is decorative only.
- Night is the primary theme; Day is a full equal, not an afterthought.

## Logo

All in the **Logos** asset group, each as an `-on-dark` (cream ink, for Night) and `-on-light` (dark ink, for Day) file.

- **Mark** — the orbit: `signal` body, `ink` ring passing in front of it, `ion` satellite. The app icon and favicon.
- **Wordmark** — "inertia" in lowercase Schibsted Grotesk 600, outlined, tracked tight. The two i-dots are the satellite and the body: `ion` for the agent, `signal` for the person. Never recolour them to match.
- **Lockup** — mark + wordmark. The default for headers and sign-in.
- **Realm marks** — `realm-people` (horizon), `realm-agent` (blueprint), `realm-org` (planet): the same orbit in each realm's material. Use them to badge a realm — a section header, an empty state, an onboarding step — never in place of the main mark.
- Clear space: one x-height on every side. Minimum: mark 20px, wordmark 72px wide.
- Don't rotate, outline, add shadows, add a second ring, or place the marks on `signal` or `pollen` fills.

## Components

- **Logo** — the logos on their grounds, swapping with the theme.
- **Texture** — grain, starfield, orbits and weave grounds.
- **Button** — `signal` primary (one per view), glass secondary, quiet text.
- **GlassIcon** — the floating, transparent icon tile, in each hue.
- **AgentAsk** — agent: its single highest-value ask for this person.
- **IdeaCard** — people: a captured idea on a hearth, in its author's words.
- **Initiative** — organization: a ratified goal as a planet with its projects in orbit.
- **PathStep** — an initiative's path: done, now, next.
- Classes live in `components/bundle.css` (prefix `in-`); there is no JS bundle yet.
