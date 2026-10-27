Buttons move work forward: taking an ask, proposing an idea, casting a vote.

- Classes: `in-btn` plus one of `in-btn--primary`, `in-btn--secondary`, `in-btn--quiet`. The consumer provides a sentence-case label, verb first ("Take it"), and an optional 18px outline icon before it.
- **Primary** (`signal` fill, `on-bright` text, `halo-signal`): one per view — the move where a human is needed.
- **Secondary** (glass, `glass-edge`): alternatives, "Not now", settings.
- **Quiet** (`signal-text`): low-stakes moves like "Suggest someone" or "See all".
- Radius `radius-md`; padding `space-3` × `space-6`. Focus: 2px `ink` ring, 2px offset.
- Don't stack two primaries; don't use a button where a link navigates.
