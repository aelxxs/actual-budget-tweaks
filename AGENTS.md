# Actual Budget Tweaks

A browser extension (WXT + Svelte 5) that layers optional tweaks onto Actual Budget's web app. Setup and adding a feature: [CONTRIBUTING.md](CONTRIBUTING.md). Styling rules and plan: [docs/styling-migration.md](docs/styling-migration.md).

## Pillars

What ABT is, and what every change should hold to.

1. **Opt-in and reversible.** Each tweak is one `defineSetting()` the user turns on by itself. Turning it off leaves Actual as it was: the runtime clears its `css`, and `init` returns a cleanup for everything else. Core scripts (`type: "core"`) are the only always-on code, and they add infrastructure (hooks, panels, sync), not visible changes.
2. **Actual stays in charge of the data.** ABT reads through the API bridge (`src/lib/utilities/actual-api.ts`) and writes to the budget only from an explicit user action. The one background write is ABT's own settings, synced through Actual's preferences (`src/features/settings-sync.ts`).
3. **Survives Actual releases.** Anchor on things Actual keeps stable (test ids, roles, hrefs, structure under `[data-abt-content-grid]`, or a `data-abt-*` marker set in JS), never hashed `.css-xxxxx` classes. When an anchor is missing, the feature does nothing rather than throwing.
4. **Feels native.** Colours come from Actual's theme variables (`--color-*`) so every theme works; corners follow the user's radius setting. ABT's own UI is built from the primitives and tokens in `src/lib/styles/ui.css`.
5. **Cheap at runtime.** One shared DOM watcher (`watchDom`), no polling, no broad `:has()`. Work that only matters on one page checks the page inside the watcher.
6. **One design language for ABT's own UI.** The purple accent (`--color-sidebarItemAccentSelected`) for selected states, shared components for settings (`Checkbox` switch, `OptionPicker`), and a one-line `description` on any setting the label doesn't explain.

## Working rules

- **Anchors:** inside containers ABT also appends to, use `div:last-of-type` / `div:first-of-type`, not `:last-child` / `:first-child`. Put new markers in `src/features/core/native-hooks.ts`.
- **Page gating:** check `matchesPage()` at the top of a permanent `watchDom()` callback, not a start/stop pair driven by `watchRoute`, which misses some in-app navigations.
- **Tokens:** use `--abt-text-*`, `--abt-radius*` and the ink and accent steps instead of raw values. `pnpm check:tokens` enforces this and bans hashed classes; a deliberate exception carries a `raw:` comment on the same line. The popup doesn't load `ui.css`, so it keeps raw values.
- **Comments:** only where the code can't explain itself (a constraint, a workaround), in one or two lines.
- **Commits:** conventional, using `feat:`, `fix:`, `style:`, `refactor:` or `chore:`. changelogen builds the changelog and version from them.
- **Verify:** `pnpm format && pnpm check && pnpm lint && pnpm check:tokens`, then look at the change in a running Actual instance on a test budget, not real financial data. None of the checks catch a selector that stopped matching.
