A glass icon is a transparent, floating tile that holds one outline glyph over its own coloured light.

- Markup: `<span class="in-gicon in-gicon--{signal|ion|pollen|moss|tide|ink}"><svg viewBox="0 0 24 24">…</svg></span>`. Add `in-gicon--sm` for a 36px, non-floating tile inside cards and lists.
- The consumer provides the glyph: a 24px outline icon (Lucide or Phosphor regular), stroke inherited from the tile, and an accessible label (`aria-label` on the tile, or visible text beside it).
- The hue follows meaning: `signal` needs a human, `ion` the agent, `pollen` ideas, `moss` credit and done, `tide` votes and questions, `ink` neutral navigation.
- Large tiles drift ±2px on a 7s loop. Stagger `animation-delay` so no two float in sync; at most five floating icons in view.
- Place them over the dot grid or coloured light so the glass reads. Don't put a glass icon on a solid fill.
