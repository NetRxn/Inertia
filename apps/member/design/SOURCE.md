# Where this design system comes from

This folder is a copy of Kyle's **Inertia** design system (v6, "one motif: the orbit", last changed 2026-10-24). The source is the claude.ai design system artifact `https://claude.ai/artifact/M7FUhjEs75LUrfE7S1scTy`.

- `README.md` is the brand book: realms, voice, colour, motif, textures, glass, motion and accessibility. Read it first.
- `tokens.json` holds every color (Night and Day themes), type, spacing, radius, shadow and motion token.
- `components/bundle.css` holds the `in-` classes. Each `components/<Name>/README.md` gives that component's guidelines, and its `preview.html` shows the reference markup.
- `assets/Logos/` holds the logo SVGs, with `-on-dark` files for Night and `-on-light` files for Day.

The artifact is the source of truth. If the system changes there, re-copy these files and don't edit them here. The app reads the tokens and classes from this folder, and Task 5 of the member app plan builds `globals.css` from them.
