# Contributing

## Local setup

1. `pnpm install`
2. `pnpm dev` — starts WXT's dev server, building to `.output/chrome-mv3-dev` and rebuilding on save.
3. Load it as an unpacked extension: `chrome://extensions` → enable Developer Mode → **Load unpacked** → select `.output/chrome-mv3-dev`.
4. Open an Actual Budget instance in a tab (self-hosted, or [app.actualbudget.org](https://actualbudget.org)) and set its URL from the extension's popup if it doesn't detect it automatically.

`pnpm dev:firefox` / `pnpm build:firefox` exist for Firefox, loaded via `about:debugging` → **This Firefox** → **Load Temporary Add-on**.

## Adding a feature

Every feature is one call to `defineSetting()` (see `src/features/types.ts`), exported as a named const and listed in `src/features/index.ts`. Scaffold one:

```
pnpm new-feature <category> <kebab-name> "<Label>" <checkbox|select|custom> [--section "<Title>"] [--component]
```

- `category` is `layout` / `readability` / `appearance` / `workflows` / `mobile` — the folder under `src/features/` it goes in.
- `--section` is the settings-page section it's listed under (a `title` in `scriptSections`). It defaults to Mobile for mobile features and Experimental otherwise.
- `--component` generates a folder + companion `.svelte` file, for a feature that needs its own component rather than a plain checkbox/select row.

This creates the setting file and registers it in `src/features/index.ts` for you. From there, fill in `description`/`icon`, and implement `init`/`css`.

### Where code goes

A feature keeps everything it owns in its folder:

| File                | Holds                                                         |
| ------------------- | ------------------------------------------------------------- |
| `index.ts`          | The `defineSetting()` and its `init`: wiring to Actual's page |
| `data.ts`           | Queries and pure logic, with no DOM, so it can be unit tested |
| `state.svelte.ts`   | Rune state shared by the feature's components                 |
| `PascalCase.svelte` | Its UI                                                        |
| `css.ts`            | Adapter CSS, or styles for elements TypeScript creates itself |

Past about 15 files, group them into `components/`, `lib/` and `styles/`, as the sidebar does.

Code that two or more features use goes in `src/lib`, which never imports from `src/features` (ESLint enforces it):

- `lib/actual/`: talking to Actual (the API bridge, budget cells, pages, its settings page) and `templates/`, the logic behind budget templates.
- `lib/dom/`: DOM helpers, the shared watcher, popovers, mounting.
- `lib/format/`: money, dates, months, numbers.
- `lib/components/` and `lib/styles/`: shared UI.
- `lib/` itself: storage, logging, ids and small pure helpers.

### Desktop and mobile

Below 512px, Actual renders a separate mobile app with its own markup, so a setting declares where it runs with `platform`: `"desktop"` (the default), `"mobile"` or `"all"`. The runtime starts and stops each one as the window crosses that width, and scopes its `css` to match (`desktopOnly()` / `mobileOnly()` in `src/lib/actual/pages.ts`). Mobile-only tweaks live in `src/features/mobile/` and are listed in the Mobile section; `pnpm new-feature mobile …` sets that up, `platform` included.

## Conventions

- **Page-gate inside the watcher, not around it.** Register a permanent `watchDom()` callback (`src/lib/dom/dom-watcher.ts`) in `init` that checks `matchesPage()` (`src/lib/actual/pages.ts`) and returns early on the wrong page — not a start/stop pair triggered by route changes.
- **Cleanup is on you.** Whatever `init` sets up (listeners, observers, injected DOM) is only undone by whatever cleanup function you return from it. Toggle the setting off and confirm nothing's left behind before opening a PR.
- **Prefer `data-testid` selectors over structural CSS** where Actual's DOM exposes one — less likely to break on an Actual update than `nth-child`/hashed-class selectors. No `data-testid`? Structural CSS is fine, just know it's the more fragile choice.
- **Conventional commits** (`feat:`, `fix:`, `chore:`) — this repo uses [changelogen](https://github.com/unjs/changelogen), which builds `CHANGELOG.md` and bumps the version from commit messages on every merge to `main`.

The Actual API bridge (`src/lib/actual/actual-api.ts` — `query`/`send`/`dispatch`/`navigate`) is generic: it forwards whatever table/method name you give it. Typed autocomplete comes from `ActualTable`/`SendMethodMap` in `src/lib/types/actual-schema.ts` — needing an untyped table or method is usually a type-only change there, not a change to the runtime bridge.

## Before opening a PR

Run `pnpm format && pnpm check && pnpm lint` — CI runs the same checks (plus both builds) on every PR. Test against a real Actual instance; none of those checks catch a selector that stopped matching or a popover that doesn't close.
