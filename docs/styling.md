# Styling

ABT's own UI is built from the tokens and primitives in [`src/lib/styles/ui.css`](../src/lib/styles/ui.css) and the components in [`src/lib/components`](../src/lib/components). `pnpm check:tokens` (also in CI) enforces most of the rules below. A deliberate exception carries a `raw:` comment on the same line.

## Tokens

| Need                | Use                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Spacing             | `--abt-space-1..6` (2, 4, 8, 12, 16, 24px); `--abt-page-gutter` for page insets           |
| Text size           | `--abt-text-2xs..xl` (9–16px); display sizes of 17px and up stay raw                      |
| Corners             | `--abt-radius-sm`, `--abt-radius`, `--abt-radius-lg`, `--abt-radius-pill`                 |
| Fills and hairlines | `--abt-ink-1..5`, or what components read: `--abt-fill`, `--abt-fill-hover`, `--abt-line` |
| Secondary text      | `--abt-muted`; fainter: `--abt-soft`, `--abt-subtle`                                      |
| Selected and accent | `--abt-accent-1..4`, `--abt-accent-text`, `--abt-selected-bg/fg`                          |
| Status tints        | `--abt-positive-1..4`, `--abt-warning-1..4`, `--abt-danger-1..4`                          |
| Elevation           | `--abt-shadow-sm` (tooltips, toasts), `--abt-shadow` (popovers, menus), `--abt-shadow-lg` |

Ink steps follow the surface: the page, `.sidebar`, `.abt-popover`, and `.abt-on-sidebar` (a floating surface in the sidebar's colours) each set their own `--abt-ink`. A custom property mixes where it's declared, so a new surface with its own ink goes on the selector list in `ui.css` that redeclares the steps.

`--color-pageTextSubdued` is for matching Actual's own secondary text: adapter CSS, input placeholders, and previews that mirror Actual's tables. ABT's components use `--abt-muted`.

Marks smaller than about 8px (bars, swatches, dots) may use 1–3px corners.

## Primitives

- Layout: `abt-stack`, `abt-cluster`, `abt-repel`.
- Controls: `abt-btn` (with `--sm`, `--icon`, `--ghost`, `--pill`, and tones `abt-tone-accent`, `abt-tone-danger`), `abt-btn-group`, `abt-seg`, `abt-input`, `abt-card`.
- Floating: `abt-popover` for every popover and menu surface, with `abt-menu` for item lists; `Dialog.svelte` for dialogs.
- Behaviour: `positionPopover` and `onOutsideClick` in `src/lib/dom/popover.ts`, `portal` in `src/lib/dom/svelte.ts`.

Write component CSS only where a component differs from these, with a one-line comment saying why. Components don't set outer margins; parents space children with `gap`.

## ABT's own UI

Scoped Svelte CSS in the component. A global string in TypeScript (a setting's `css`) is for adapter CSS, and for elements TypeScript creates itself.

## Adapter CSS

CSS that restyles Actual's own DOM lives in `public/css/base.css` and in each feature's `css`.

- Anchor on a `data-testid`, ARIA role or label, `href`, structure under `[data-abt-content-grid]`, or a `data-abt-*` marker set in JS (most in `src/features/core/native-hooks.ts`). Test ids come from `src/lib/actual-dom.ts`. Never Actual's hashed `.css-xxxxx` classes; they change with every release.
- No broad `:has()`. One whose subject matches many elements reruns on every DOM change; set a marker in JS instead.
- Use tokens for values, and comment any `!important` or structural selector that isn't obvious.

## Checking a change

Before and after screenshots on the test budget, in a light and a dark theme. For adapter CSS, every Actual page the feature touches.
