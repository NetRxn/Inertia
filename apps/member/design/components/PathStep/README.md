A path shows an initiative's way forward as a row of steps: done, now, next.

- Markup: an `in-path` list of `in-step` items, each `in-step--done`, `in-step--now` or `in-step--next`, with an empty `in-step__node`, an `in-step__label` (mono) and an `in-step__title`.
- The consumer provides each step's short label ("Captured", "This week") and its title in plain words.
- Done: `moss` node with `halo-moss` and a moss connector. Now: a `signal` node with a `signal-wash` ring and halo — exactly one per path. Next: hollow `line-strong` node, title in `ink-muted`.
- Steps draw in left to right when a path is first ratified; after that they stay still.
- Vertical on narrow screens; at most six steps in view.
