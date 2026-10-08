# Styling migration

Move ABT's styles onto shared primitives in [`src/lib/styles/ui.css`](../src/lib/styles/ui.css): tokens, layout utilities (`abt-stack`, `abt-cluster`, `abt-repel`), and controls (`abt-btn`, `abt-btn-group`, `abt-seg`, `abt-card`, `abt-popover`, `abt-menu`).

## Rules

- Use the primitives by default. Write component CSS only where a component genuinely differs, with a one-line comment saying why.
- No raw sizes or colour mixes where a token exists.
- Components don't set outer margins; parents space children with `gap`.
- CSS that restyles Actual's own DOM is adapter code: keep it in a labelled block, use tokens for its values, and comment any `!important` or structural selector that isn't obvious.
- Anchor adapter CSS on a `data-testid`, ARIA role or label, `href`, structure under `[data-abt-content-grid]`, or a `data-abt-*` marker set in JS (most in `src/features/core/native-hooks.ts`). Never Actual's hashed `.css-xxxxx` classes; they change with every release.
- No broad `:has()`. A `:has()` whose subject matches many elements reruns on every DOM change; set a marker in JS instead.
- `pnpm check:tokens` (also in CI) enforces the token and hashed-class rules. A deliberate exception carries a `raw:` comment on the same line.

## Starting point

| Form                                      | Where                                                                                                                 | Notes                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Svelte-scoped CSS                         | sidebar-shortcuts (1,112 lines), spending-calendar (538), release-notification (207), `src/lib/components`            | Most of the duplicated buttons and popovers                      |
| Global CSS in TS strings for ABT's own UI | template-plan `css.ts` (595 lines, 83 `abt-tab-*` classes), category-template-insights (266), category-progress (267) | Should be scoped Svelte CSS on primitives                        |
| Global stylesheets                        | `workflows/sidebar/sidebar.css` (585 px values), `public/css/income-breakdown.css` (546 lines)                        |                                                                  |
| Adapter CSS                               | `public/css/base.css`, layout and readability features                                                                | Hashed `.css-xxxxx` selectors broke on Actual releases (removed) |

Across all of it: ~1,500 raw px values, eight `pageText` mix percentages (3–20%) for fill, hairline and track, three radius systems (`--abt-radius`, raw `--border-radius`, ~90 hardcoded 2–6px), ~18 overlay implementations, 6 segmented controls, and `--color-tableRowBackgroundHover` used as a button hover in 6 places.

## Decisions before phase 1

1. **Radius:** `--abt-radius`, `--abt-radius-sm`, and pill only. Raw `--border-radius` only where matching Actual's own elements matters.
2. **Fills:** map the eight `pageText` percentages onto `--abt-fill`, `--abt-fill-hover`, `--abt-line`, and `--abt-panel-track`.
3. **Secondary text:** when to use `--color-pageTextSubdued` versus `--abt-muted` (103 uses of the former).

## Phases

| Phase | Scope                                                                                                                                                                                                   | Status                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 0     | Tokens and utilities; budget-month-header, budget-summary-row, budget-category-filter                                                                                                                   | Done                                      |
| 1     | `src/lib/components`: setting rows on a shared `abt-setting` primitive; Tabs with icons and a trailing slot; IconPickerPopover and MonthPicker on `abt-popover`, `abt-input` and `abt-btn`              | Done                                      |
| 2     | template-plan (Insights panel; move `css.ts` into scoped Svelte CSS), sidebar-shortcuts (Modal, ToolPopover, buttons), spending-calendar, release-notification                                          | As touched                                |
| 3     | budget-view-options, goal-funding, category-template-insights, category-progress, category-color-dots, emoji and icon pickers, sidebar-settings-menu, side-panel shell                                  | As touched                                |
| 4     | Adapter layer: `base.css`, layout and readability features, sidebar-redesign, `sidebar.css`. Replace hashed selectors with `data-testid`, ARIA, or structural hooks; group by feature; tokenise values. | Done; `base.css` values not yet tokenised |
| 5     | Guardrails: `pnpm check:tokens` flags raw values that have a token and hashed selectors; anchoring rules above                                                                                          | Done                                      |

## Phases 2 and 3

Opportunistic: when a feature in them changes for another reason, move it onto the primitives in the same pass, as its own commit.

## Per change

- One feature per commit, visual changes only.
- Before-and-after screenshots in the Test Budget; for phase 4, every Actual page the feature touches.
