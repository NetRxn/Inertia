Textures give large grounds the feel of mid-century print — present, never loud.

- Classes: `in-tex` plus one of `in-tex--grain`, `in-tex--stars`, `in-tex--orbits`, `in-tex--weave`, on the element that owns the ground. The texture paints behind its children through a mask in a token colour, so it follows the theme. The consumer provides a positioned container; nothing else.
- **Grain** (`opacity-grain`) — print noise. The default for the page ground and hero areas; it can sit under everything.
- **Starfield** (`ink-muted` at `opacity-texture`) — sparse stars and sparkles. Empty states, onboarding, the board canvas at night.
- **Orbits** (`line`) — faint atomic rings. Agent spaces: the AgentAsk backdrop, loading screens.
- **Weave** (`line`) — a fine linen cross-hatch, like a Knoll upholstery swatch. Sidebars and profile headers.
- One texture per surface, plus grain if you like. Never under dense text tables or inside chips and buttons; never at higher opacity than the tokens set.
