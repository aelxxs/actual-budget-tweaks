# Changelog


## v0.1.90

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.89...v0.1.90)

### 🩹 Fixes

- Parse each bridge response once and batch budget cell reads ([8b893ce](https://github.com/aelxxs/actual-budget-tweaks/commit/8b893ce))
- Replace :has() rules that restyled the whole page on every change ([80a234c](https://github.com/aelxxs/actual-budget-tweaks/commit/80a234c))
- Keep month cards smooth on large budgets ([15453de](https://github.com/aelxxs/actual-budget-tweaks/commit/15453de))
- Count every month header click while a large budget is still rendering ([3959227](https://github.com/aelxxs/actual-budget-tweaks/commit/3959227))
- Style the header from its first frame ([25c91fc](https://github.com/aelxxs/actual-budget-tweaks/commit/25c91fc))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.89 ([38ca51f](https://github.com/aelxxs/actual-budget-tweaks/commit/38ca51f))
- Add a large test budget generator ([f1615f4](https://github.com/aelxxs/actual-budget-tweaks/commit/f1615f4))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.89

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.88...v0.1.89)

### 🩹 Fixes

- Keep each budget's template breakdown to itself, and split the Insights overview maths out ([80f1af8](https://github.com/aelxxs/actual-budget-tweaks/commit/80f1af8))
- Unmount flow bars, theme panels, popovers and the release toast instead of only removing their nodes ([c95812e](https://github.com/aelxxs/actual-budget-tweaks/commit/c95812e))
- Bring back the Income Breakdown widget as its own setting, without polling ([50441ed](https://github.com/aelxxs/actual-budget-tweaks/commit/50441ed))
- Inject the API bridge when ABT is enabled on an already open page ([08c042a](https://github.com/aelxxs/actual-budget-tweaks/commit/08c042a))
- Follow privacy mode from Actual's store, so ABT's amounts hide when the sidebar balance isn't rendered ([5d3a6b3](https://github.com/aelxxs/actual-budget-tweaks/commit/5d3a6b3))
- Keep sidebar shortcuts and tickers with the budget they were added in ([9875783](https://github.com/aelxxs/actual-budget-tweaks/commit/9875783))

### 💅 Refactors

- Share loadCurrentBudgetId through the API bridge ([10f7a31](https://github.com/aelxxs/actual-budget-tweaks/commit/10f7a31))
- Share one budget table watcher across Month cards, Category filter, template insights and Insights ([252f39c](https://github.com/aelxxs/actual-budget-tweaks/commit/252f39c))
- Share budget cell reads and month helpers, dating the sidebar trend and upcoming schedules in local time ([df6d8af](https://github.com/aelxxs/actual-budget-tweaks/commit/df6d8af))
- Follow routes for column widths through the shared DOM watcher instead of polling ([47a3712](https://github.com/aelxxs/actual-budget-tweaks/commit/47a3712))
- Share mount teardown, side panel bodies and Actual's id pattern ([f96f16e](https://github.com/aelxxs/actual-budget-tweaks/commit/f96f16e))
- Move row scanners onto the budget table watcher and stop privacy mode polling ([51645de](https://github.com/aelxxs/actual-budget-tweaks/commit/51645de))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.88 ([16a7367](https://github.com/aelxxs/actual-budget-tweaks/commit/16a7367))

### 🎨 Styles

- Give Schedules a clipboard icon so it stands apart from the Spending Calendar ([8e132e6](https://github.com/aelxxs/actual-budget-tweaks/commit/8e132e6))
- Size the calendar's month like the Reports title and zero the Reports header's inline margins ([bf84863](https://github.com/aelxxs/actual-budget-tweaks/commit/bf84863))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.88

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.87...v0.1.88)

### 🚀 Enhancements

- Mark the tweaks that can change your budget ([abf38cc](https://github.com/aelxxs/actual-budget-tweaks/commit/abf38cc))

### 🩹 Fixes

- Hide Daily Available in privacy mode and read the balance without its redacted copy ([53e3dbe](https://github.com/aelxxs/actual-budget-tweaks/commit/53e3dbe))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.87 ([2b55c6c](https://github.com/aelxxs/actual-budget-tweaks/commit/2b55c6c))
- Document settings sync and AI use ([9584269](https://github.com/aelxxs/actual-budget-tweaks/commit/9584269))

### 🎨 Styles

- Inset every page's content by the budget page's 13px gutter ([d155251](https://github.com/aelxxs/actual-budget-tweaks/commit/d155251))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.87

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.86...v0.1.87)

### 🚀 Enhancements

- Add a Transaction Inspector side panel showing the selected transaction's payee history, rules and schedule ([6e1a8f2](https://github.com/aelxxs/actual-budget-tweaks/commit/6e1a8f2))
- Switch the account toolbar's actions to icons when their labels don't fit on one line ([e635d68](https://github.com/aelxxs/actual-budget-tweaks/commit/e635d68))
- Keep the Reports header in view with a border and a breadcrumb title ([4b88b40](https://github.com/aelxxs/actual-budget-tweaks/commit/4b88b40))

### 🩹 Fixes

- Keep fixed-length privacy amounts on one line so long notes don't wrap into a tall column ([a82a7ce](https://github.com/aelxxs/actual-budget-tweaks/commit/a82a7ce))
- Hide only the amounts in the Insights coverage and pace lines so their words stay readable in fixed-length privacy ([8aaa240](https://github.com/aelxxs/actual-budget-tweaks/commit/8aaa240))
- Keep the account search's clear button small instead of sizing it like the toolbar's icon buttons ([5bf667d](https://github.com/aelxxs/actual-budget-tweaks/commit/5bf667d))
- Left-align the fixed-length privacy mark on the account header balance ([f9fd41b](https://github.com/aelxxs/actual-budget-tweaks/commit/f9fd41b))
- Retry live sidebar balances that fail to load instead of showing 0, and unfold the sidebar after a reload drops the panel that folded it ([dcb47e1](https://github.com/aelxxs/actual-budget-tweaks/commit/dcb47e1))
- Compute Daily Available from the balance in any number format, and hide it when there's nothing to spread ([eefe4fe](https://github.com/aelxxs/actual-budget-tweaks/commit/eefe4fe))
- Give the month header's month picker the same height as the controls beside it ([4568845](https://github.com/aelxxs/actual-budget-tweaks/commit/4568845))
- Keep the live sidebar folded until both Reconcile and the Inspector have closed ([0d6d347](https://github.com/aelxxs/actual-budget-tweaks/commit/0d6d347))
- Close the gap above the sticky Reports header in Firefox ([3ba47ac](https://github.com/aelxxs/actual-budget-tweaks/commit/3ba47ac))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.86 ([dd8cffc](https://github.com/aelxxs/actual-budget-tweaks/commit/dd8cffc))
- Refresh the README screenshots, showing light or dark to match the reader's GitHub theme ([af45a16](https://github.com/aelxxs/actual-budget-tweaks/commit/af45a16))
- Refresh the website hero and theme demo ([e8b6980](https://github.com/aelxxs/actual-budget-tweaks/commit/e8b6980))
- Tighten the README with feature highlights and sidecar setup, and drop the settings shot ([f5e2cbb](https://github.com/aelxxs/actual-budget-tweaks/commit/f5e2cbb))

### 🎨 Styles

- Show the account balance details as labelled stat columns instead of boxed chips ([84c4baa](https://github.com/aelxxs/actual-budget-tweaks/commit/84c4baa))
- Give the calendar header ABT's header border and divider colors ([93873fc](https://github.com/aelxxs/actual-budget-tweaks/commit/93873fc))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.86

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.85...v0.1.86)

### 🚀 Enhancements

- Thin scrollbars tinted to match the theme ([23250cd](https://github.com/aelxxs/actual-budget-tweaks/commit/23250cd))
- Keep desktop-only features and styles out of Actual's mobile view ([201b838](https://github.com/aelxxs/actual-budget-tweaks/commit/201b838))
- Optional totals on the live sidebar's account groups ([608fc68](https://github.com/aelxxs/actual-budget-tweaks/commit/608fc68))
- Group Payees, Tags, Rules and Bank Sync under Settings, ready for Actual's new settings pages ([c354ee2](https://github.com/aelxxs/actual-budget-tweaks/commit/c354ee2))
- Open sidebar settings from the budget menu, right-click or command palette instead of the footer ([34592ff](https://github.com/aelxxs/actual-budget-tweaks/commit/34592ff))
- Settings page grouped by where tweaks show up, with section jump, Changed filter and reset ([250fb8a](https://github.com/aelxxs/actual-budget-tweaks/commit/250fb8a))
- Clearer light and dark theme slots when matching the system, and a real preview for Actual's own theme ([3f4ed37](https://github.com/aelxxs/actual-budget-tweaks/commit/3f4ed37))
- Pick a privacy style by preview, with a same-length option for scribbles and dots ([8d2cb85](https://github.com/aelxxs/actual-budget-tweaks/commit/8d2cb85))
- Dim settings that need Live sidebar or Budget Insights while those are off ([7bc2c71](https://github.com/aelxxs/actual-budget-tweaks/commit/7bc2c71))
- Preview what a tweak does from its settings row, for nine readability tweaks ([00fb35d](https://github.com/aelxxs/actual-budget-tweaks/commit/00fb35d))
- Measure template bars against Actual's monthly target, read live, with a redesigned popover and Hide Funded Bars ([3628646](https://github.com/aelxxs/actual-budget-tweaks/commit/3628646))

### 🩹 Fixes

- Readable icon picker when opened from the sidebar in light themes ([179b4e1](https://github.com/aelxxs/actual-budget-tweaks/commit/179b4e1))
- Bring back Sidebar Density for the live sidebar ([615e474](https://github.com/aelxxs/actual-budget-tweaks/commit/615e474))
- Hide account icons in the live sidebar when Account Icon Picker is off ([52d15f6](https://github.com/aelxxs/actual-budget-tweaks/commit/52d15f6))
- Keep rolling number digits level by snapping their rows to whole pixels ([f8f6309](https://github.com/aelxxs/actual-budget-tweaks/commit/f8f6309))
- Keep text fields full width under fixed-length privacy styles ([1043c29](https://github.com/aelxxs/actual-budget-tweaks/commit/1043c29))

### 💅 Refactors

- Keep the Budget settings button in the category column header only ([c9aed42](https://github.com/aelxxs/actual-budget-tweaks/commit/c9aed42))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.85 ([4fa2c85](https://github.com/aelxxs/actual-budget-tweaks/commit/4fa2c85))

### 🎨 Styles

- Align live sidebar rows under their headers, rounder corners, no active pill ([6d169a9](https://github.com/aelxxs/actual-budget-tweaks/commit/6d169a9))
- Fit the server status chip's hover to its label, keeping its reserved width on the wrapper ([471e99d](https://github.com/aelxxs/actual-budget-tweaks/commit/471e99d))
- Keep the empty category drop hint off the panel edge in split mode ([5d09294](https://github.com/aelxxs/actual-budget-tweaks/commit/5d09294))
- Give every search bar the account toolbar's search look ([22d1ade](https://github.com/aelxxs/actual-budget-tweaks/commit/22d1ade))
- Centre nested account dots between the sub-category caret and label, and lift carets to the caps ([ff14f09](https://github.com/aelxxs/actual-budget-tweaks/commit/ff14f09))
- Make the settings sub-links a step smaller than the top-level links ([99f5166](https://github.com/aelxxs/actual-budget-tweaks/commit/99f5166))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.85

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.84...v0.1.85)

### 🚀 Enhancements

- Sync ABT settings to the budget's synced preferences ([43ace08](https://github.com/aelxxs/actual-budget-tweaks/commit/43ace08))
- Reconcile back button, and collapse the live sidebar while reconciling ([b2c1245](https://github.com/aelxxs/actual-budget-tweaks/commit/b2c1245))
- Turn the live sidebar on by default and collapse it to the rail in narrow windows ([ab885bc](https://github.com/aelxxs/actual-budget-tweaks/commit/ab885bc))
- Suggest the live sidebar once to people who have it off ([e64c198](https://github.com/aelxxs/actual-budget-tweaks/commit/e64c198))
- Sync account groups, account order and budget icons with each budget ([e04784f](https://github.com/aelxxs/actual-budget-tweaks/commit/e04784f))
- Stack side panels so closing one restores the panel underneath ([aa467ac](https://github.com/aelxxs/actual-budget-tweaks/commit/aa467ac))
- Recap imported transactions after a sync and categorize them in the side panel ([cc9b977](https://github.com/aelxxs/actual-budget-tweaks/commit/cc9b977))
- Mark new transactions with an accent bar instead of bold colored text ([c90614d](https://github.com/aelxxs/actual-budget-tweaks/commit/c90614d))

### 🩹 Fixes

- Anchor toolbar and titlebar CSS on JS-set attributes to stop fast-scroll blanking ([5daebd5](https://github.com/aelxxs/actual-budget-tweaks/commit/5daebd5))
- Find the account toolbar and reconcile lock in JS instead of :has() ([4fd4db1](https://github.com/aelxxs/actual-budget-tweaks/commit/4fd4db1))
- Keep sidebar tooltips hidden after a click focuses the button ([ce8fa7c](https://github.com/aelxxs/actual-budget-tweaks/commit/ce8fa7c))
- Open the calendar at the top when the page underneath was scrolled ([0fe8c47](https://github.com/aelxxs/actual-budget-tweaks/commit/0fe8c47))
- Keep the side panel after the page so a remounted page keeps its layout ([d7c8bd4](https://github.com/aelxxs/actual-budget-tweaks/commit/d7c8bd4))
- Stop re-adopting synced settings whose keys Chrome stores in another order ([ba55ca6](https://github.com/aelxxs/actual-budget-tweaks/commit/ba55ca6))
- Drop the stale category-notes wording from the template empty states ([d581dbd](https://github.com/aelxxs/actual-budget-tweaks/commit/d581dbd))
- Sync the sidebar shortcut list with the budget ([c3bc8ab](https://github.com/aelxxs/actual-budget-tweaks/commit/c3bc8ab))
- Pass the live sidebar's sync results to Actual so new transactions show up ([7a96748](https://github.com/aelxxs/actual-budget-tweaks/commit/7a96748))
- Keep fast scrolling smooth in transaction tables with tags ([fb55aff](https://github.com/aelxxs/actual-budget-tweaks/commit/fb55aff))

### 💅 Refactors

- Remove legacy onChange setting lifecycle ([0d10743](https://github.com/aelxxs/actual-budget-tweaks/commit/0d10743))
- Define all ABT tokens in ui.css and drop the panel-accent alias ([6cff472](https://github.com/aelxxs/actual-budget-tweaks/commit/6cff472))
- Unify ABT colour tokens on an ink and accent tint scale ([316df7a](https://github.com/aelxxs/actual-budget-tweaks/commit/316df7a))
- Split sidebar.css by area and scope palette and hover-card styles ([d808315](https://github.com/aelxxs/actual-budget-tweaks/commit/d808315))
- Move sidebar styles into their Svelte components ([af06244](https://github.com/aelxxs/actual-budget-tweaks/commit/af06244))
- Put ABT type and corner radii on shared scales ([7db1bdc](https://github.com/aelxxs/actual-budget-tweaks/commit/7db1bdc))
- Replace hashed Actual selectors in base.css with stable hooks ([8487c07](https://github.com/aelxxs/actual-budget-tweaks/commit/8487c07))
- Replace hashed Actual selectors in features with stable hooks ([25f897c](https://github.com/aelxxs/actual-budget-tweaks/commit/25f897c))
- Drop broad :has() selectors from base.css and background pattern ([0bf908a](https://github.com/aelxxs/actual-budget-tweaks/commit/0bf908a))
- Move shared settings rows, tabs and popovers onto ui.css primitives ([53f1ab4](https://github.com/aelxxs/actual-budget-tweaks/commit/53f1ab4))
- Remove the native sidebar styling features ([be9cbef](https://github.com/aelxxs/actual-budget-tweaks/commit/be9cbef))
- Reduce Account Icon Picker to the account page title ([6baa1c1](https://github.com/aelxxs/actual-budget-tweaks/commit/6baa1c1))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.84 ([85a2d89](https://github.com/aelxxs/actual-budget-tweaks/commit/85a2d89))
- Audit cleanup — lint, formatting, tests, dead code ([f44be7c](https://github.com/aelxxs/actual-budget-tweaks/commit/f44be7c))
- Add a token check that flags raw tints, font sizes and radii ([6ae2cdd](https://github.com/aelxxs/actual-budget-tweaks/commit/6ae2cdd))
- Flag hashed Actual classes in check:tokens and add AGENTS.md ([4fc5ef4](https://github.com/aelxxs/actual-budget-tweaks/commit/4fc5ef4))
- Mark styling phase 1 done and make phases 2-3 opportunistic ([5ee8b22](https://github.com/aelxxs/actual-budget-tweaks/commit/5ee8b22))
- List Sync recap and Quiet New Transactions on the features page ([f2a9763](https://github.com/aelxxs/actual-budget-tweaks/commit/f2a9763))

### 🎨 Styles

- Use the purple accent for checked switches ([d72da6b](https://github.com/aelxxs/actual-budget-tweaks/commit/d72da6b))
- Refresh the icon picker to match the command palette ([6306aa0](https://github.com/aelxxs/actual-budget-tweaks/commit/6306aa0))
- Even out the budget page's padding around the cards and table ([f148bac](https://github.com/aelxxs/actual-budget-tweaks/commit/f148bac))
- Match the budget summary cards' gap to the page padding ([d55a313](https://github.com/aelxxs/actual-budget-tweaks/commit/d55a313))
- Shrink the caret on the selected transactions button ([5ce6899](https://github.com/aelxxs/actual-budget-tweaks/commit/5ce6899))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.84

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.83...v0.1.84)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.83 ([534b8ad](https://github.com/aelxxs/actual-budget-tweaks/commit/534b8ad))

## v0.1.83

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.82...v0.1.83)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.82 ([f9a9df5](https://github.com/aelxxs/actual-budget-tweaks/commit/f9a9df5))

## v0.1.82

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.81...v0.1.82)

### 🩹 Fixes

- Resolve issue with to budget being misaligned ([47946f1](https://github.com/aelxxs/actual-budget-tweaks/commit/47946f1))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.81 ([1cadba4](https://github.com/aelxxs/actual-budget-tweaks/commit/1cadba4))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.81

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.80...v0.1.81)

### 🚀 Enhancements

- Follow Actual's date format and first day of week ([d71c852](https://github.com/aelxxs/actual-budget-tweaks/commit/d71c852))
- Shared settings dialog pieces ([7c555b3](https://github.com/aelxxs/actual-budget-tweaks/commit/7c555b3))
- Budget settings dialog ([c66d2cd](https://github.com/aelxxs/actual-budget-tweaks/commit/c66d2cd))
- Sidebar settings dialog ([197ab1e](https://github.com/aelxxs/actual-budget-tweaks/commit/197ab1e))
- Split layout by default for the Live sidebar ([ee2a1c2](https://github.com/aelxxs/actual-budget-tweaks/commit/ee2a1c2))
- Rolling numbers ([f82103f](https://github.com/aelxxs/actual-budget-tweaks/commit/f82103f))
- Live Insights overview and one-step Fund targets ([7537546](https://github.com/aelxxs/actual-budget-tweaks/commit/7537546))
- Steadier month cards with a rolling To Budget ([8b7af88](https://github.com/aelxxs/actual-budget-tweaks/commit/8b7af88))
- Add privacy style feature ([3834db0](https://github.com/aelxxs/actual-budget-tweaks/commit/3834db0))
- Add rolling number animation ([a24ee92](https://github.com/aelxxs/actual-budget-tweaks/commit/a24ee92))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.80 ([3388b37](https://github.com/aelxxs/actual-budget-tweaks/commit/3388b37))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.80

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.79...v0.1.80)

### 🚀 Enhancements

- Insights follows month changes without polling, with skeletons ([0837d5e](https://github.com/aelxxs/actual-budget-tweaks/commit/0837d5e))
- Resize grips for the side panel and Live sidebar ([2ab6da5](https://github.com/aelxxs/actual-budget-tweaks/commit/2ab6da5))
- Sync button and a reworked Live sidebar footer ([b7624e5](https://github.com/aelxxs/actual-budget-tweaks/commit/b7624e5))
- Modern Titlebar setting ([2ada94e](https://github.com/aelxxs/actual-budget-tweaks/commit/2ada94e))
- Live shortcuts editor ([6de15cb](https://github.com/aelxxs/actual-budget-tweaks/commit/6de15cb))

### 🩹 Fixes

- Keep Insights open across pages and drop the calendar's URL ([c92343f](https://github.com/aelxxs/actual-budget-tweaks/commit/c92343f))
- Month header shortens its labels only when it's narrow ([421da13](https://github.com/aelxxs/actual-budget-tweaks/commit/421da13))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.79 ([a56c72e](https://github.com/aelxxs/actual-budget-tweaks/commit/a56c72e))

### 🎨 Styles

- Quieter Insights header, tabs and template toolbar ([0c60a02](https://github.com/aelxxs/actual-budget-tweaks/commit/0c60a02))
- Built-in tabs and spaced sections in the side panel ([7f883b3](https://github.com/aelxxs/actual-budget-tweaks/commit/7f883b3))
- Month header fits narrower widths ([30d1880](https://github.com/aelxxs/actual-budget-tweaks/commit/30d1880))
- More room on the right of the Live sidebar's rows ([3b8f6b0](https://github.com/aelxxs/actual-budget-tweaks/commit/3b8f6b0))
- Text field and dialog primitives ([c397372](https://github.com/aelxxs/actual-budget-tweaks/commit/c397372))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.79

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.78...v0.1.79)

### 🩹 Fixes

- Smooth switching between the budget page and the calendar ([9181fbd](https://github.com/aelxxs/actual-budget-tweaks/commit/9181fbd))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.78 ([cad3796](https://github.com/aelxxs/actual-budget-tweaks/commit/cad3796))

### 🎨 Styles

- Quieter month header controls ([d37293a](https://github.com/aelxxs/actual-budget-tweaks/commit/d37293a))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.78

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.77...v0.1.78)

### 🚀 Enhancements

- Experimental month header for the budget page ([48f3557](https://github.com/aelxxs/actual-budget-tweaks/commit/48f3557))
- Experimental single-month summary and category filter ([249e733](https://github.com/aelxxs/actual-budget-tweaks/commit/249e733))
- Compact multi-month cards and shared UI primitives ([67a95b9](https://github.com/aelxxs/actual-budget-tweaks/commit/67a95b9))
- Template actions in Budget Actions and tidier month controls ([5a81ea1](https://github.com/aelxxs/actual-budget-tweaks/commit/5a81ea1))

### 🔥 Performance

- Refresh only the months whose cells changed ([392f43c](https://github.com/aelxxs/actual-budget-tweaks/commit/392f43c))

### 💅 Refactors

- Share the content grid selector and side panel header height ([3ba5428](https://github.com/aelxxs/actual-budget-tweaks/commit/3ba5428))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.77 ([161e153](https://github.com/aelxxs/actual-budget-tweaks/commit/161e153))

### 🎨 Styles

- Smaller category dots and a darker single-month table ([ac4ffa9](https://github.com/aelxxs/actual-budget-tweaks/commit/ac4ffa9))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.77

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.76...v0.1.77)

### 🚀 Enhancements

- Goal funding in the balance menu and balance status pills ([0b8ecb8](https://github.com/aelxxs/actual-budget-tweaks/commit/0b8ecb8))
- Default to the Midnight theme ([7c5e52a](https://github.com/aelxxs/actual-budget-tweaks/commit/7c5e52a))

### 🔥 Performance

- Skip the Add account scan while the live sidebar is active ([dc289b4](https://github.com/aelxxs/actual-budget-tweaks/commit/dc289b4))
- Cut repeated full-page scans in DOM watchers ([45e3ac5](https://github.com/aelxxs/actual-budget-tweaks/commit/45e3ac5))

### 🩹 Fixes

- Restore chart slot 8 and lift pastel chart colors ([eda8819](https://github.com/aelxxs/actual-budget-tweaks/commit/eda8819))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.76 ([f328c18](https://github.com/aelxxs/actual-budget-tweaks/commit/f328c18))

### 🎨 Styles

- Side panel cards use the current-month color and tabs the panel border ([63e59e2](https://github.com/aelxxs/actual-budget-tweaks/commit/63e59e2))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.76

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.75...v0.1.76)

### 🩹 Fixes

- Sidecar shim storage removal and Yahoo chart requests ([0adefa4](https://github.com/aelxxs/actual-budget-tweaks/commit/0adefa4))
- Harden the sidecar proxy ([cb8640f](https://github.com/aelxxs/actual-budget-tweaks/commit/cb8640f))

### 📖 Documentation

- Add self-hosting page for the sidecar ([616f2b8](https://github.com/aelxxs/actual-budget-tweaks/commit/616f2b8))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.75 ([3be8cfa](https://github.com/aelxxs/actual-budget-tweaks/commit/3be8cfa))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.75

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.74...v0.1.75)

### 🩹 Fixes

- Build the sidecar image natively instead of under QEMU ([a2c0ddf](https://github.com/aelxxs/actual-budget-tweaks/commit/a2c0ddf))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.74

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.73...v0.1.74)

### 🚀 Enhancements

- Read live sidebar signals from both native sidebar designs ([8aa164e](https://github.com/aelxxs/actual-budget-tweaks/commit/8aa164e))

### 🩹 Fixes

- Open the calendar correctly while a side panel is open ([917426d](https://github.com/aelxxs/actual-budget-tweaks/commit/917426d))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.73

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.72...v0.1.73)

### 🚀 Enhancements

- Budget view options in the budget table header ([74bdae3](https://github.com/aelxxs/actual-budget-tweaks/commit/74bdae3))
- Calendar polish ([1d20477](https://github.com/aelxxs/actual-budget-tweaks/commit/1d20477))
- Remove Toggle Columns in favour of Actual's native column manager ([ba71c7f](https://github.com/aelxxs/actual-budget-tweaks/commit/ba71c7f))
- Theme Actual's new sidebar, date picker and sync highlight tokens ([3cd1844](https://github.com/aelxxs/actual-budget-tweaks/commit/3cd1844))

### 🩹 Fixes

- Match theme gallery background to its settings card ([3da9be8](https://github.com/aelxxs/actual-budget-tweaks/commit/3da9be8))
- Point website Firefox links to GitHub releases ([4ad541f](https://github.com/aelxxs/actual-budget-tweaks/commit/4ad541f))
- Adapt column resizing to Actual's new transaction table ([1d64874](https://github.com/aelxxs/actual-budget-tweaks/commit/1d64874))

### 💅 Refactors

- Split the spending calendar into modules ([882952d](https://github.com/aelxxs/actual-budget-tweaks/commit/882952d))
- Drive alternating transaction rows with Actual's row token ([e41448e](https://github.com/aelxxs/actual-budget-tweaks/commit/e41448e))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.72 ([d659476](https://github.com/aelxxs/actual-budget-tweaks/commit/d659476))

### 🎨 Styles

- Restore darker activity bar in split sidebar layout ([c2ce112](https://github.com/aelxxs/actual-budget-tweaks/commit/c2ce112))
- Refine built-in theme surface layering ([8115243](https://github.com/aelxxs/actual-budget-tweaks/commit/8115243))
- Put spending calendar cells on the table background ([d1ebbe9](https://github.com/aelxxs/actual-budget-tweaks/commit/d1ebbe9))
- Brighten live sidebar account amounts ([a07b1ab](https://github.com/aelxxs/actual-budget-tweaks/commit/a07b1ab))
- Follow app border radius in side panel cards ([235cf82](https://github.com/aelxxs/actual-budget-tweaks/commit/235cf82))
- Follow app border radius across extension surfaces ([4a74112](https://github.com/aelxxs/actual-budget-tweaks/commit/4a74112))
- Lighten side panel close button and add hover state ([8e0a016](https://github.com/aelxxs/actual-budget-tweaks/commit/8e0a016))
- Shorter column resize handle with accent hover and drag states ([2759a88](https://github.com/aelxxs/actual-budget-tweaks/commit/2759a88))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.72

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.71...v0.1.72)

### 🚀 Enhancements

- Extend sidebar density to the live sidebar, nav links, and search ([23f9eca](https://github.com/aelxxs/actual-budget-tweaks/commit/23f9eca))
- Unify live sidebar rails and move layout choice to settings ([4ad3be6](https://github.com/aelxxs/actual-budget-tweaks/commit/4ad3be6))
- Rename template plan panel to Budget Insights ([64b062e](https://github.com/aelxxs/actual-budget-tweaks/commit/64b062e))

### 🔥 Performance

- Render live sidebar accounts without waiting on uncategorized counts ([c279d6c](https://github.com/aelxxs/actual-budget-tweaks/commit/c279d6c))

### 🩹 Fixes

- Add Cache-Control header to serveStatic for improved asset caching ([09f72b2](https://github.com/aelxxs/actual-budget-tweaks/commit/09f72b2))
- Respect sidebar search setting in the live sidebar ([f68ea0d](https://github.com/aelxxs/actual-budget-tweaks/commit/f68ea0d))
- Ack API bridge requests to stop duplicate re-sends ([bb5af4a](https://github.com/aelxxs/actual-budget-tweaks/commit/bb5af4a))
- Reserve budget status line while it loads ([ad07fd3](https://github.com/aelxxs/actual-budget-tweaks/commit/ad07fd3))
- Blur account hover card amounts in privacy mode ([da9516d](https://github.com/aelxxs/actual-budget-tweaks/commit/da9516d))
- Scope settings page chevron style so it doesn't leak to other carets ([b9718d4](https://github.com/aelxxs/actual-budget-tweaks/commit/b9718d4))
- Use theme-derived border for side panel and header border ([fd886b2](https://github.com/aelxxs/actual-budget-tweaks/commit/fd886b2))
- Hide insights button when the panel is restored open on reload ([f8f4eb5](https://github.com/aelxxs/actual-budget-tweaks/commit/f8f4eb5))
- Restore saved side panel width when the panel opens ([352aada](https://github.com/aelxxs/actual-budget-tweaks/commit/352aada))
- Let background pattern show around the spending calendar ([022043a](https://github.com/aelxxs/actual-budget-tweaks/commit/022043a))
- Extend background pattern selectors ([2d04d65](https://github.com/aelxxs/actual-budget-tweaks/commit/2d04d65))

### 💅 Refactors

- Shared panel components for the insights side panel ([94c9cda](https://github.com/aelxxs/actual-budget-tweaks/commit/94c9cda))
- Use shared panel components in calendar day panel and theme creator ([37fb86c](https://github.com/aelxxs/actual-budget-tweaks/commit/37fb86c))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.71 ([708edc9](https://github.com/aelxxs/actual-budget-tweaks/commit/708edc9))
- Update Firefox auto-update manifest for v0.1.71 ([441f6fc](https://github.com/aelxxs/actual-budget-tweaks/commit/441f6fc))
- Remove debug logging from live sidebar ([75d2cd4](https://github.com/aelxxs/actual-budget-tweaks/commit/75d2cd4))
- Add each-block keys and clear lint warnings ([70e8d20](https://github.com/aelxxs/actual-budget-tweaks/commit/70e8d20))

### 🎨 Styles

- Narrow live sidebar rail to 4rem ([8086477](https://github.com/aelxxs/actual-budget-tweaks/commit/8086477))
- Derive side panel colors from the theme ([ed91621](https://github.com/aelxxs/actual-budget-tweaks/commit/ed91621))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.71

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.70...v0.1.71)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.70 ([782434d](https://github.com/aelxxs/actual-budget-tweaks/commit/782434d))

## v0.1.70

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.69...v0.1.70)

### 🩹 Fixes

- Account for assigned funds in next month goal coverage ([eebbc07](https://github.com/aelxxs/actual-budget-tweaks/commit/eebbc07))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.69 ([9ce212a](https://github.com/aelxxs/actual-budget-tweaks/commit/9ce212a))

### ❤️ Contributors

- Zeldridge <malware-01-poppers@icloud.com>

## v0.1.69

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.68...v0.1.69)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.68 ([2342108](https://github.com/aelxxs/actual-budget-tweaks/commit/2342108))

## v0.1.68

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.67...v0.1.68)

### 🚀 Enhancements

- Add selectable next-month coverage calculation ([9d22eb5](https://github.com/aelxxs/actual-budget-tweaks/commit/9d22eb5))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.67 ([6ae8379](https://github.com/aelxxs/actual-budget-tweaks/commit/6ae8379))

### ❤️ Contributors

- Zeldridge <github@mail.zeldridge.com>

## v0.1.67

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.66...v0.1.67)

### 🩹 Fixes

- Simplify proxy handling by removing unnecessary HTML checks and accept-encoding adjustments ([9720358](https://github.com/aelxxs/actual-budget-tweaks/commit/9720358))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.66 ([6f34d8f](https://github.com/aelxxs/actual-budget-tweaks/commit/6f34d8f))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.66

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.65...v0.1.66)

### 🩹 Fixes

- Update Content Security Policy and request headers for improved proxy handling ([7c30283](https://github.com/aelxxs/actual-budget-tweaks/commit/7c30283))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.65 ([2f23d6f](https://github.com/aelxxs/actual-budget-tweaks/commit/2f23d6f))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.65

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.64...v0.1.65)

### 🚀 Enhancements

- Add Docker support with build and deployment configurations ([5dd98e9](https://github.com/aelxxs/actual-budget-tweaks/commit/5dd98e9))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.64 ([5c5ee7d](https://github.com/aelxxs/actual-budget-tweaks/commit/5c5ee7d))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.64

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.63...v0.1.64)

### 🩹 Fixes

- Correct goal funding check in overview tab ([356d0ed](https://github.com/aelxxs/actual-budget-tweaks/commit/356d0ed))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.63 ([e76bfc5](https://github.com/aelxxs/actual-budget-tweaks/commit/e76bfc5))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.63

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.62...v0.1.63)

### 🚀 Enhancements

- Remove AI slop from README ([70c36d0](https://github.com/aelxxs/actual-budget-tweaks/commit/70c36d0))

### 🩹 Fixes

- Resolve overflow issue with dropdown content ([0a225b9](https://github.com/aelxxs/actual-budget-tweaks/commit/0a225b9))
- Resolve color contrast issue in automations ui ([3a5f696](https://github.com/aelxxs/actual-budget-tweaks/commit/3a5f696))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.62 ([62531dd](https://github.com/aelxxs/actual-budget-tweaks/commit/62531dd))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.62

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.61...v0.1.62)

### 🚀 Enhancements

- **theme:** Add "Actual default" native theme option ([9d72d60](https://github.com/aelxxs/actual-budget-tweaks/commit/9d72d60))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.61 ([4a9ed52](https://github.com/aelxxs/actual-budget-tweaks/commit/4a9ed52))

### ❤️ Contributors

- Matt Farrell <mfarrell@squareup.com>

## v0.1.61

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.60...v0.1.61)

### 🚀 Enhancements

- Implement account balance synchronization in sidebar ([50a323b](https://github.com/aelxxs/actual-budget-tweaks/commit/50a323b))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.60 ([ada64f7](https://github.com/aelxxs/actual-budget-tweaks/commit/ada64f7))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.60

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.59...v0.1.60)

### 🚀 Enhancements

- Reduce padding in sidebar footer ([293da53](https://github.com/aelxxs/actual-budget-tweaks/commit/293da53))
- Reduce padding in sidebar add account button ([9b4bb49](https://github.com/aelxxs/actual-budget-tweaks/commit/9b4bb49))
- Add color switcher to command menu ([be8e1ff](https://github.com/aelxxs/actual-budget-tweaks/commit/be8e1ff))
- Add pnpm new-feature scaffold script ([c0c9b40](https://github.com/aelxxs/actual-budget-tweaks/commit/c0c9b40))

### 📖 Documentation

- Add CONTRIBUTING.md and website docs (contributing + architecture) ([1d6898b](https://github.com/aelxxs/actual-budget-tweaks/commit/1d6898b))
- Rewrite docs pages to be scannable, not prose-heavy ([d9b5b41](https://github.com/aelxxs/actual-budget-tweaks/commit/d9b5b41))
- Fold website docs back into CONTRIBUTING.md, drop the docs pages ([917886b](https://github.com/aelxxs/actual-budget-tweaks/commit/917886b))
- Reposition README and website around community contribution ([1e7a8a1](https://github.com/aelxxs/actual-budget-tweaks/commit/1e7a8a1))

### 🏡 Chore

- Add ESLint + Prettier, PR-gated CI, and lower feature-registration friction ([d0082f9](https://github.com/aelxxs/actual-budget-tweaks/commit/d0082f9))
- Update Firefox auto-update manifest for v0.1.59 ([55911d6](https://github.com/aelxxs/actual-budget-tweaks/commit/55911d6))
- Add PR/issue templates, upgrade in-extension bug report to a form ([d10fd92](https://github.com/aelxxs/actual-budget-tweaks/commit/d10fd92))
- Add MIT license ([821e4a2](https://github.com/aelxxs/actual-budget-tweaks/commit/821e4a2))

### 🎨 Styles

- Format entire codebase with Prettier ([e60ff2c](https://github.com/aelxxs/actual-budget-tweaks/commit/e60ff2c))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.59

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.58...v0.1.59)

### 🩹 Fixes

- Missed transactions not clearing when posted to spending calendar ([281f820](https://github.com/aelxxs/actual-budget-tweaks/commit/281f820))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.58 ([a4b5d0b](https://github.com/aelxxs/actual-budget-tweaks/commit/a4b5d0b))
- Useless notes ([5749b4a](https://github.com/aelxxs/actual-budget-tweaks/commit/5749b4a))

### ❤️ Contributors

- CrazyStill ([@CrazyStill](https://github.com/CrazyStill))

## v0.1.58

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.57...v0.1.58)

### 🚀 Enhancements

- Enhance sidebar transition handling for improved user experience ([32401d5](https://github.com/aelxxs/actual-budget-tweaks/commit/32401d5))
- Update active account text color ([e4db545](https://github.com/aelxxs/actual-budget-tweaks/commit/e4db545))
- Implement custom overlay scrollbar for improved scrolling experience in accounts ([14cee4f](https://github.com/aelxxs/actual-budget-tweaks/commit/14cee4f))
- Add padding to scrollable accounts section in sidebar ([7ac0cb7](https://github.com/aelxxs/actual-budget-tweaks/commit/7ac0cb7))
- Add keyboard shortcuts for undo and redo actions in footer ([8251d9d](https://github.com/aelxxs/actual-budget-tweaks/commit/8251d9d))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.57 ([729dadb](https://github.com/aelxxs/actual-budget-tweaks/commit/729dadb))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.57

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.56...v0.1.57)

### 🚀 Enhancements

- Browse future months in spending calendar ([ca46c30](https://github.com/aelxxs/actual-budget-tweaks/commit/ca46c30))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.56 ([abf8eb6](https://github.com/aelxxs/actual-budget-tweaks/commit/abf8eb6))

### ❤️ Contributors

- CrazyStill ([@CrazyStill](https://github.com/CrazyStill))

## v0.1.56

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.55...v0.1.56)

### 🚀 Enhancements

- Add filter for off-budget accounts in spending calendar ([47d0ebe](https://github.com/aelxxs/actual-budget-tweaks/commit/47d0ebe))
- Implement Switch component for improved toggle functionality ([9f64384](https://github.com/aelxxs/actual-budget-tweaks/commit/9f64384))
- Add @types/d3 and extend SendMethodMap interface for budget cell operations ([7a9c3ff](https://github.com/aelxxs/actual-budget-tweaks/commit/7a9c3ff))

### 🩹 Fixes

- Resolve issue with transaction query only respecting upper bound on date ([042223c](https://github.com/aelxxs/actual-budget-tweaks/commit/042223c))
- Limit displayed transactions to three and update more indicator accordingly ([bead75f](https://github.com/aelxxs/actual-budget-tweaks/commit/bead75f))

### 💅 Refactors

- Replace inline type definitions with imported types for transactions ([6ee384d](https://github.com/aelxxs/actual-budget-tweaks/commit/6ee384d))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.55 ([b86ef73](https://github.com/aelxxs/actual-budget-tweaks/commit/b86ef73))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.55

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.54...v0.1.55)

### 🚀 Enhancements

- Implement command palette and integrate with sidebar search functionality ([39a3192](https://github.com/aelxxs/actual-budget-tweaks/commit/39a3192))

### 🩹 Fixes

- Update sidebar borders to use computed color ([33a6961](https://github.com/aelxxs/actual-budget-tweaks/commit/33a6961))
- Adjust padding-right for sidebar account drop target ([c1682e1](https://github.com/aelxxs/actual-budget-tweaks/commit/c1682e1))
- Adjust top position for fixed element in template plan CSS ([533430b](https://github.com/aelxxs/actual-budget-tweaks/commit/533430b))
- Defer focus and select calls to ensure element is laid out ([592cae4](https://github.com/aelxxs/actual-budget-tweaks/commit/592cae4))
- Defer focus call to ensure element is laid out before focusing ([6dbae8f](https://github.com/aelxxs/actual-budget-tweaks/commit/6dbae8f))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.54 ([4044713](https://github.com/aelxxs/actual-budget-tweaks/commit/4044713))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.54

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.53...v0.1.54)

### 🚀 Enhancements

- Budget icon becomes icon picker in vscode layout mode ([3fdd210](https://github.com/aelxxs/actual-budget-tweaks/commit/3fdd210))

### 🩹 Fixes

- Turn input into plain JSON before saving in setValue ([1eb3e6d](https://github.com/aelxxs/actual-budget-tweaks/commit/1eb3e6d))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.53 ([f544817](https://github.com/aelxxs/actual-budget-tweaks/commit/f544817))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.53

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.52...v0.1.53)

### 🩹 Fixes

- Optimize loading of sidebar accounts and icons by refreshing budget context concurrently ([2338e0b](https://github.com/aelxxs/actual-budget-tweaks/commit/2338e0b))
- Ensure correct group and assignment updates by using returned values from related functions ([60ebda3](https://github.com/aelxxs/actual-budget-tweaks/commit/60ebda3))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.52 ([d1c76ec](https://github.com/aelxxs/actual-budget-tweaks/commit/d1c76ec))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.52

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.51...v0.1.52)

### 🚀 Enhancements

- Add unicode-emoji-json dependency and update global.css font import ([3709481](https://github.com/aelxxs/actual-budget-tweaks/commit/3709481))
- Implement custom tooltip functionality in ExperimentalSidebar ([c52406b](https://github.com/aelxxs/actual-budget-tweaks/commit/c52406b))
- Add Overview tab to template plan side panel ([43a10d2](https://github.com/aelxxs/actual-budget-tweaks/commit/43a10d2))
- Add a dispatch bridge for Actual's real action-creators ([6da937f](https://github.com/aelxxs/actual-budget-tweaks/commit/6da937f))
- Rebuild the sidebar with live data (experimental) ([9855e09](https://github.com/aelxxs/actual-budget-tweaks/commit/9855e09))

### 🩹 Fixes

- Reload no longer reopens side panel empty ([0be5479](https://github.com/aelxxs/actual-budget-tweaks/commit/0be5479))
- Update transaction color descriptions and styles for better clarity ([b8931b6](https://github.com/aelxxs/actual-budget-tweaks/commit/b8931b6))
- Update Firefox installation link to point to latest release ([d941948](https://github.com/aelxxs/actual-budget-tweaks/commit/d941948))
- Add missing lucide-svelte dependency for the sidebar ([1607c3a](https://github.com/aelxxs/actual-budget-tweaks/commit/1607c3a))
- Let the active account dot show its real sync status color ([30cbae5](https://github.com/aelxxs/actual-budget-tweaks/commit/30cbae5))

### 💅 Refactors

- Reformat actual-schema.ts and drop unused SendMethodMap overloads ([75e1c8e](https://github.com/aelxxs/actual-budget-tweaks/commit/75e1c8e))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.51 ([990ec9d](https://github.com/aelxxs/actual-budget-tweaks/commit/990ec9d))
- Remove Star History section from README.md ([4858194](https://github.com/aelxxs/actual-budget-tweaks/commit/4858194))

### 🎨 Styles

- Align sidebar header height with the main app header ([e2d0397](https://github.com/aelxxs/actual-budget-tweaks/commit/e2d0397))
- Remove hover shadow on the budget summary card ([9ae72ec](https://github.com/aelxxs/actual-budget-tweaks/commit/9ae72ec))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.51

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.50...v0.1.51)

### 🚀 Enhancements

- Add experimental sidebar demo ([ead8eb5](https://github.com/aelxxs/actual-budget-tweaks/commit/ead8eb5))
- Enable client-side loading for ExperimentalSidebar component ([d6afd6b](https://github.com/aelxxs/actual-budget-tweaks/commit/d6afd6b))
- Add account icon picker with emoji, logo, and upload options ([455a5cc](https://github.com/aelxxs/actual-budget-tweaks/commit/455a5cc))

### 🩹 Fixes

- Improve TypeScript loading logic in generate-features-manifest script ([44c5e40](https://github.com/aelxxs/actual-budget-tweaks/commit/44c5e40))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.50 ([cc1635b](https://github.com/aelxxs/actual-budget-tweaks/commit/cc1635b))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.50

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.49...v0.1.50)

### 🚀 Enhancements

- Add temporary sidebar testing page ([a1a23e5](https://github.com/aelxxs/actual-budget-tweaks/commit/a1a23e5))
- Add experimental sidebar component and integrate into the experimental sidebar page ([76e39af](https://github.com/aelxxs/actual-budget-tweaks/commit/76e39af))
- Add TrendChart component for visualizing monthly trends and update features manifest ([19730ba](https://github.com/aelxxs/actual-budget-tweaks/commit/19730ba))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.49 ([437f2fb](https://github.com/aelxxs/actual-budget-tweaks/commit/437f2fb))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.49

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.48...v0.1.49)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.48 ([ec5a153](https://github.com/aelxxs/actual-budget-tweaks/commit/ec5a153))

## v0.1.48

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.47...v0.1.48)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.47 ([8d26caa](https://github.com/aelxxs/actual-budget-tweaks/commit/8d26caa))

## v0.1.47

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.46...v0.1.47)

### 🩹 Fixes

- Unmount insights popover on close to prevent stacked schedule modals ([f31c3ee](https://github.com/aelxxs/actual-budget-tweaks/commit/f31c3ee))
- Resolve all svelte-check errors and warnings ([ab1cacc](https://github.com/aelxxs/actual-budget-tweaks/commit/ab1cacc))
- Show refill-to-limit templates as balance vs cap in insights progress ([bbb574e](https://github.com/aelxxs/actual-budget-tweaks/commit/bbb574e))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.46 ([d507417](https://github.com/aelxxs/actual-budget-tweaks/commit/d507417))

### ❤️ Contributors

- Ansidian <andysu1551@gmail.com>

## v0.1.46

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.45...v0.1.46)

### 🚀 Enhancements

- Add category progress indicators with popover details ([05556fb](https://github.com/aelxxs/actual-budget-tweaks/commit/05556fb))
- Add gauge and progress ring icons to ICONS ([13ef07b](https://github.com/aelxxs/actual-budget-tweaks/commit/13ef07b))
- Add goal_def property to Category interface and define GoalDefEntry type ([6b78dd8](https://github.com/aelxxs/actual-budget-tweaks/commit/6b78dd8))
- Refactor category template handling to use goal_def directives and improve data parsing ([683dbe6](https://github.com/aelxxs/actual-budget-tweaks/commit/683dbe6))
- Enhance budget status indicators with fully spent and current month checks ([9cecc4f](https://github.com/aelxxs/actual-budget-tweaks/commit/9cecc4f))

### 🩹 Fixes

- Improve CSS selector specificity for emoji button visibility ([a5920c9](https://github.com/aelxxs/actual-budget-tweaks/commit/a5920c9))
- Add class to status div for improved styling ([4c4d4c0](https://github.com/aelxxs/actual-budget-tweaks/commit/4c4d4c0))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.45 ([3fc6f1a](https://github.com/aelxxs/actual-budget-tweaks/commit/3fc6f1a))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.45

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.44...v0.1.45)

### 🚀 Enhancements

- Add description/icon/group metadata to all settings ([2012e12](https://github.com/aelxxs/actual-budget-tweaks/commit/2012e12))
- Extract shared OptionPicker; redesign Checkbox and Select rows ([6b7f70c](https://github.com/aelxxs/actual-budget-tweaks/commit/6b7f70c))
- Reorganize settings panel with subgroups and collapsed sections ([a28a5da](https://github.com/aelxxs/actual-budget-tweaks/commit/a28a5da))
- Add contextual sidebar settings menu popover ([0cc35e5](https://github.com/aelxxs/actual-budget-tweaks/commit/0cc35e5))
- Add /features page listing every setting ([3c16ef1](https://github.com/aelxxs/actual-budget-tweaks/commit/3c16ef1))

### 💅 Refactors

- Convert Report Card Color and Sidebar Spacing to fit their data ([0b78526](https://github.com/aelxxs/actual-budget-tweaks/commit/0b78526))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.44 ([5b1d9bb](https://github.com/aelxxs/actual-budget-tweaks/commit/5b1d9bb))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.44

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.43...v0.1.44)

### 🚀 Enhancements

- Introduce mountToPanelBody utility for better side panel content handling ([7fc345d](https://github.com/aelxxs/actual-budget-tweaks/commit/7fc345d))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.43 ([49b3826](https://github.com/aelxxs/actual-budget-tweaks/commit/49b3826))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.43

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.42...v0.1.43)

### 🚀 Enhancements

- Implement side panel state management and API for dynamic content updates ([e219c44](https://github.com/aelxxs/actual-budget-tweaks/commit/e219c44))
- Add privacy-mode core feature ported from legacy main-world script ([265a8df](https://github.com/aelxxs/actual-budget-tweaks/commit/265a8df))
- Add chevronLeft/chevronRight icons ([8af960e](https://github.com/aelxxs/actual-budget-tweaks/commit/8af960e))
- Extract shared Tabs component ([393fef8](https://github.com/aelxxs/actual-budget-tweaks/commit/393fef8))
- Rewrite Template Apply Breakdown as an isolated-world Svelte feature ([2d5046e](https://github.com/aelxxs/actual-budget-tweaks/commit/2d5046e))

### 🩹 Fixes

- Keep side panel scroll contained to its own content, not the whole drawer ([7ff822f](https://github.com/aelxxs/actual-budget-tweaks/commit/7ff822f))

### 💅 Refactors

- Port template-plan business logic to isolated-world utilities ([0081cb7](https://github.com/aelxxs/actual-budget-tweaks/commit/0081cb7))
- Port dashboard-widgets utility from legacy main-world script ([51f09c7](https://github.com/aelxxs/actual-budget-tweaks/commit/51f09c7))
- Migrate ThemeCreator to shared Tabs component ([904652c](https://github.com/aelxxs/actual-budget-tweaks/commit/904652c))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.42 ([e3c7c59](https://github.com/aelxxs/actual-budget-tweaks/commit/e3c7c59))
- Remove dead markup/CSS selectors ([c6a1f49](https://github.com/aelxxs/actual-budget-tweaks/commit/c6a1f49))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.42

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.41...v0.1.42)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.41 ([c7ac7f0](https://github.com/aelxxs/actual-budget-tweaks/commit/c7ac7f0))

## v0.1.41

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.40...v0.1.41)

### 🚀 Enhancements

- Add Icon component and icon rendering functionality ([9f143fc](https://github.com/aelxxs/actual-budget-tweaks/commit/9f143fc))
- Replace inline SVGs with Icon component for improved consistency and maintainability ([eb4d94d](https://github.com/aelxxs/actual-budget-tweaks/commit/eb4d94d))
- Implement tooltip functionality with dynamic positioning and styling ([f4192d6](https://github.com/aelxxs/actual-budget-tweaks/commit/f4192d6))
- Add budget totals label styling with dynamic label management ([d418a36](https://github.com/aelxxs/actual-budget-tweaks/commit/d418a36))
- Add tooltip styling and budget totals label to core scripts and readability ([de4941c](https://github.com/aelxxs/actual-budget-tweaks/commit/de4941c))
- Add toggle button for insights visibility and update icon definitions ([fbb074f](https://github.com/aelxxs/actual-budget-tweaks/commit/fbb074f))
- Update sidebar styles for improved layout and responsiveness ([f6bc205](https://github.com/aelxxs/actual-budget-tweaks/commit/f6bc205))
- Enhance tab styles and improve layout consistency in theme editor ([c4304a7](https://github.com/aelxxs/actual-budget-tweaks/commit/c4304a7))
- Add icon.svg to project configuration ([790a13b](https://github.com/aelxxs/actual-budget-tweaks/commit/790a13b))
- Implement release notification feature with changelog parsing and UI integration ([be96bd6](https://github.com/aelxxs/actual-budget-tweaks/commit/be96bd6))

### 🩹 Fixes

- Redeploy website after release workflow completes, not on its trigger push ([ab2c7c8](https://github.com/aelxxs/actual-budget-tweaks/commit/ab2c7c8))
- Ensure release notes are set only on update events ([6fafc39](https://github.com/aelxxs/actual-budget-tweaks/commit/6fafc39))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.40 ([603fdc7](https://github.com/aelxxs/actual-budget-tweaks/commit/603fdc7))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.40

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.39...v0.1.40)

### 🚀 Enhancements

- Update Firefox auto-update manifest handling to use GitHub API for content management ([fa7103f](https://github.com/aelxxs/actual-budget-tweaks/commit/fa7103f))
- Add TypeScript types for Actual Budget internal API and enhance API bridge functions ([f646cca](https://github.com/aelxxs/actual-budget-tweaks/commit/f646cca))
- Add createDebouncedObserver function for optimized MutationObserver callbacks ([f9dabf3](https://github.com/aelxxs/actual-budget-tweaks/commit/f9dabf3))
- Implement alternating transaction row colors ([f760e83](https://github.com/aelxxs/actual-budget-tweaks/commit/f760e83))
- Add logger utility with scoped logging functionality ([9890547](https://github.com/aelxxs/actual-budget-tweaks/commit/9890547))
- Implement route-watcher utility for SPA navigation handling ([c380cff](https://github.com/aelxxs/actual-budget-tweaks/commit/c380cff))
- Add watchDom utility for observing DOM changes with debounced callbacks ([0371547](https://github.com/aelxxs/actual-budget-tweaks/commit/0371547))
- Add popover utility for positioning and outside click handling ([b09fd1f](https://github.com/aelxxs/actual-budget-tweaks/commit/b09fd1f))
- Implement runtime settings management with activation and deactivation logic ([aa4b80e](https://github.com/aelxxs/actual-budget-tweaks/commit/aa4b80e))
- Add functionality to use current page URL in popup and make enabling instant ([fb66067](https://github.com/aelxxs/actual-budget-tweaks/commit/fb66067))

### 🩹 Fixes

- Streamline Firefox auto-update manifest update process ([53dee6d](https://github.com/aelxxs/actual-budget-tweaks/commit/53dee6d))
- Improve error handling in updateUncategorizedBadges function ([7854b8d](https://github.com/aelxxs/actual-budget-tweaks/commit/7854b8d))
- Handle different initialization types for settings in content script ([ec55695](https://github.com/aelxxs/actual-budget-tweaks/commit/ec55695))
- Reorder imports and include missing alternatingTransactionRows in readability and scripts ([2a15e17](https://github.com/aelxxs/actual-budget-tweaks/commit/2a15e17))
- Rename group_id to group in Category interface ([ff85b4b](https://github.com/aelxxs/actual-budget-tweaks/commit/ff85b4b))

### 💅 Refactors

- Replace MutationObserver with createDebouncedObserver for improved performance in various settings ([87a5994](https://github.com/aelxxs/actual-budget-tweaks/commit/87a5994))
- Remove imageWidgets and modernSidebarStates settings from the appearance module ([78c0eef](https://github.com/aelxxs/actual-budget-tweaks/commit/78c0eef))
- Migrate all features to the shared runtime and utility layer ([6984f56](https://github.com/aelxxs/actual-budget-tweaks/commit/6984f56))
- Speed up setting bootstap by running in parallel ([fdca5ce](https://github.com/aelxxs/actual-budget-tweaks/commit/fdca5ce))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.39 ([9c71883](https://github.com/aelxxs/actual-budget-tweaks/commit/9c71883))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>
- GitHub Actions ([@github-actions-up-and-running](https://github.com/github-actions-up-and-running))

## v0.1.39

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.38...v0.1.39)

### 🚀 Enhancements

- Update deployment workflow to submit only to Chrome Web Store and refine auto-update manifest ([1a212e3](https://github.com/aelxxs/actual-budget-tweaks/commit/1a212e3))
- Refactor budget card styling logic and integrate API for dynamic data fetching ([828eb32](https://github.com/aelxxs/actual-budget-tweaks/commit/828eb32))
- Add IconPickerPopover component for emoji, logo, and image uploads ([71ed5ac](https://github.com/aelxxs/actual-budget-tweaks/commit/71ed5ac))
- Integrate IconPickerPopover for category icon management and enhance emoji button functionality ([866a174](https://github.com/aelxxs/actual-budget-tweaks/commit/866a174))
- Refactor account icon picker to use IconPickerPopover and remove EmojiPicker component ([dc4ff91](https://github.com/aelxxs/actual-budget-tweaks/commit/dc4ff91))
- Adjust category dot size and hover effect for improved UI consistency ([a1c14f7](https://github.com/aelxxs/actual-budget-tweaks/commit/a1c14f7))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.38 ([bbfbe72](https://github.com/aelxxs/actual-budget-tweaks/commit/bbfbe72))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>
- GitHub Actions ([@github-actions-up-and-running](https://github.com/github-actions-up-and-running))

## v0.1.38

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.37...v0.1.38)

### 🚀 Enhancements

- Update GeckoSettings with unique extension ID ([97aca98](https://github.com/aelxxs/actual-budget-tweaks/commit/97aca98))
- Update deployment workflows and add Firefox auto-update manifest ([a5b87f7](https://github.com/aelxxs/actual-budget-tweaks/commit/a5b87f7))
- Enhance budget readiness checks and improve opacity settings for UI elements ([fa3378c](https://github.com/aelxxs/actual-budget-tweaks/commit/fa3378c))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.37

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.36...v0.1.37)

### 🚀 Enhancements

- Implement currency formatting utility and integrate across components ([4d18c11](https://github.com/aelxxs/actual-budget-tweaks/commit/4d18c11))
- Add retry mechanism to API bridge for race condition handling ([f104876](https://github.com/aelxxs/actual-budget-tweaks/commit/f104876))
- Add uncategorized transaction badges to sidebar accounts ([8894bd3](https://github.com/aelxxs/actual-budget-tweaks/commit/8894bd3))
- Add RSU tracker widget and fix shortcuts modal overflow ([c2c769a](https://github.com/aelxxs/actual-budget-tweaks/commit/c2c769a))
- Highlight uncategorized transaction rows with yellow tint ([e3ef1e2](https://github.com/aelxxs/actual-budget-tweaks/commit/e3ef1e2))
- Add shared category color persistence utility ([3b1bfd6](https://github.com/aelxxs/actual-budget-tweaks/commit/3b1bfd6))
- Add category color dots to budget page and transaction tables ([1040a06](https://github.com/aelxxs/actual-budget-tweaks/commit/1040a06))
- Add category emoji picker for budget page categories ([df58f68](https://github.com/aelxxs/actual-budget-tweaks/commit/df58f68))
- Add import/export settings functionality and update UI components ([fa6134d](https://github.com/aelxxs/actual-budget-tweaks/commit/fa6134d))
- Add interactive compatibility checklist for verifying extension features ([06a065a](https://github.com/aelxxs/actual-budget-tweaks/commit/06a065a))
- Add tag styling feature for enhanced UI customization ([8243e49](https://github.com/aelxxs/actual-budget-tweaks/commit/8243e49))
- Add Firefox XPI signing step and update artifact upload process ([955c968](https://github.com/aelxxs/actual-budget-tweaks/commit/955c968))

### 🩹 Fixes

- Use toLocaleString in FlowBar instead of fmtMoney ([dcee265](https://github.com/aelxxs/actual-budget-tweaks/commit/dcee265))

### 💅 Refactors

- Migrate spending calendar from appearance to workflows ([dc366b7](https://github.com/aelxxs/actual-budget-tweaks/commit/dc366b7))
- Migrate category template insights from main-world to API bridge ([e992559](https://github.com/aelxxs/actual-budget-tweaks/commit/e992559))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.36

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.35...v0.1.36)

### 🚀 Enhancements

- Add budget card styling component with FlowBar visualization ([e9263e8](https://github.com/aelxxs/actual-budget-tweaks/commit/e9263e8))
- Add transaction deduplication and count display in calendar component ([32360d0](https://github.com/aelxxs/actual-budget-tweaks/commit/32360d0))

### 🩹 Fixes

- Resolve calculator chaining bug where consecutive operators reset display to 0 ([0a970fe](https://github.com/aelxxs/actual-budget-tweaks/commit/0a970fe))

### 🎨 Styles

- Update padding and font size in calendar component for improved layout ([3acc7d4](https://github.com/aelxxs/actual-budget-tweaks/commit/3acc7d4))
- Increase dot size for upcoming transactions in calendar component ([43e6cc2](https://github.com/aelxxs/actual-budget-tweaks/commit/43e6cc2))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.35

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.34...v0.1.35)

### 🩹 Fixes

- Remove unnecessary id from gecko settings in wxt.config.ts ([6cca12c](https://github.com/aelxxs/actual-budget-tweaks/commit/6cca12c))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.34

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.33...v0.1.34)

### 🚀 Enhancements

- Implement auto theme switching based on system preference in theme customizer ([9e8ec4b](https://github.com/aelxxs/actual-budget-tweaks/commit/9e8ec4b))

### 🩹 Fixes

- Improve error handling for fetch requests in background and theme customizer ([5f089f7](https://github.com/aelxxs/actual-budget-tweaks/commit/5f089f7))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.33

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.32...v0.1.33)

### 🚀 Enhancements

- Add main layout and components for the Actual Budget Tweaks website ([01cb37f](https://github.com/aelxxs/actual-budget-tweaks/commit/01cb37f))
- Enhance website components with new community section and call-to-action ([8eebb91](https://github.com/aelxxs/actual-budget-tweaks/commit/8eebb91))
- Implement collapsible sidebar groups and modernize sidebar icons ([db54929](https://github.com/aelxxs/actual-budget-tweaks/commit/db54929))
- Add actual API bridge scripts and enhance background fetch handling ([b1fb908](https://github.com/aelxxs/actual-budget-tweaks/commit/b1fb908))
- Implement API request handling with query, send, and navigate functions ([2ce1909](https://github.com/aelxxs/actual-budget-tweaks/commit/2ce1909))
- Add favicon utility function to generate favicon URLs ([6cdf412](https://github.com/aelxxs/actual-budget-tweaks/commit/6cdf412))
- Implement sidebar search bar with customizable settings ([f1d5c03](https://github.com/aelxxs/actual-budget-tweaks/commit/f1d5c03))
- Add spending calendar feature with sidebar integration and transaction types ([3d30c12](https://github.com/aelxxs/actual-budget-tweaks/commit/3d30c12))
- Add sidebar shortcuts feature with drag-and-drop functionality ([ee4610f](https://github.com/aelxxs/actual-budget-tweaks/commit/ee4610f))
- Modern sidebar redesign ([08a93f9](https://github.com/aelxxs/actual-budget-tweaks/commit/08a93f9))
- Add sidebar search, shortcuts, and spending calendar features to settings ui ([c4b581c](https://github.com/aelxxs/actual-budget-tweaks/commit/c4b581c))

### 🩹 Fixes

- Update currencyCode initialization and formatting logic in fmtMoney function ([a8dd70f](https://github.com/aelxxs/actual-budget-tweaks/commit/a8dd70f))
- Update minimum sidebar width to allow for zero width ([8bd8d30](https://github.com/aelxxs/actual-budget-tweaks/commit/8bd8d30))
- Adjust padding and border-radius for sidebar search bar styling ([3060982](https://github.com/aelxxs/actual-budget-tweaks/commit/3060982))

### 🏡 Chore

- Update Node.js version to 24 in deployment workflow ([67d49f8](https://github.com/aelxxs/actual-budget-tweaks/commit/67d49f8))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.32

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.31...v0.1.32)

### 🚀 Enhancements

- Implement background script for message handling and fetch requests ([a4de93a](https://github.com/aelxxs/actual-budget-tweaks/commit/a4de93a))
- **theme:** Enhance theme editor with export functionality and user theme management ([aad00a8](https://github.com/aelxxs/actual-budget-tweaks/commit/aad00a8))

### 💅 Refactors

- Remove deprecated settings and scripts ([acab628](https://github.com/aelxxs/actual-budget-tweaks/commit/acab628))
- Remove modernSidebarStates from appearance and scripts ([7d01778](https://github.com/aelxxs/actual-budget-tweaks/commit/7d01778))
- Update Theme import paths and remove unused palette files ([8cc94e9](https://github.com/aelxxs/actual-budget-tweaks/commit/8cc94e9))
- Enhance bug reporting feature with modal and improved submission format ([640a8b0](https://github.com/aelxxs/actual-budget-tweaks/commit/640a8b0))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.31

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.30...v0.1.31)

### 🚀 Enhancements

- Move content scripts out of public and into src; begin typescript migration ([177b5b3](https://github.com/aelxxs/actual-budget-tweaks/commit/177b5b3))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.30

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.29...v0.1.30)

### 🚀 Enhancements

- Add side panel functionality with resizing and dynamic content ([dd2f0c3](https://github.com/aelxxs/actual-budget-tweaks/commit/dd2f0c3))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.29

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.28...v0.1.29)

### 🩹 Fixes

- Harden custom dashboard widget injection ([3f8a9c5](https://github.com/aelxxs/actual-budget-tweaks/commit/3f8a9c5))

### ❤️ Contributors

- Andy Su <andysu1551@gmail.com>

## v0.1.28

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.27...v0.1.28)

## v0.1.27

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.26...v0.1.27)

### 🩹 Fixes

- Improve template apply breakdown ([c7378b6](https://github.com/aelxxs/actual-budget-tweaks/commit/c7378b6))
- Align template priority breakdown ([8d5c771](https://github.com/aelxxs/actual-budget-tweaks/commit/8d5c771))
- Remove svelte prop warnings ([a07930a](https://github.com/aelxxs/actual-budget-tweaks/commit/a07930a))
- Normalize select stored value type ([a0d52d2](https://github.com/aelxxs/actual-budget-tweaks/commit/a0d52d2))
- Resolve type check errors ([cbe6b3b](https://github.com/aelxxs/actual-budget-tweaks/commit/cbe6b3b))

### 🏡 Chore

- Decompose template breakdown scripts ([27ec774](https://github.com/aelxxs/actual-budget-tweaks/commit/27ec774))

### ❤️ Contributors

- Andy Su <andysu1551@gmail.com>

## v0.1.26

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.25...v0.1.26)

## v0.1.25

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.24...v0.1.25)

## v0.1.24

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.23...v0.1.24)

### 🚀 Enhancements

- Implement search functionality and enhance settings organization ([f49100e](https://github.com/aelxxs/actual-budget-tweaks/commit/f49100e))

### 💅 Refactors

- Update CSS class names and improve styling for budget and report components ([86300a1](https://github.com/aelxxs/actual-budget-tweaks/commit/86300a1))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.23

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.22...v0.1.23)

### 🚀 Enhancements

- Enhance balance handling and column resizing ([ff1fb27](https://github.com/aelxxs/actual-budget-tweaks/commit/ff1fb27))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.22

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.21...v0.1.22)

### 🚀 Enhancements

- Add resizable transaction columns functionality ([9fe8864](https://github.com/aelxxs/actual-budget-tweaks/commit/9fe8864))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.21

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.20...v0.1.21)

## v0.1.20

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.19...v0.1.20)

## v0.1.19

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.18...v0.1.19)

## v0.1.18

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.17...v0.1.18)

### 🩹 Fixes

- **config:** Correct output directory path in wxt configuration ([6589a66](https://github.com/aelxxs/actual-budget-tweaks/commit/6589a66))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.17

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.16...v0.1.17)

### 🚀 Enhancements

- Add budget and report card border settings with customizable styles; update css ([957fd9a](https://github.com/aelxxs/actual-budget-tweaks/commit/957fd9a))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.16

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.15...v0.1.16)

### 🚀 Enhancements

- Enhance Color Transactions with inflow/upcoming coloring ([8d64511](https://github.com/aelxxs/actual-budget-tweaks/commit/8d64511))
- Add Category Template Insights tweak ([0007986](https://github.com/aelxxs/actual-budget-tweaks/commit/0007986))
- Add Dim Reconciled Transactions tweak ([9e70fe2](https://github.com/aelxxs/actual-budget-tweaks/commit/9e70fe2))
- **color-transactions:** Include account column in upcoming row tint ([43f6931](https://github.com/aelxxs/actual-budget-tweaks/commit/43f6931))
- **popup:** Redo popup with status ([13c50d2](https://github.com/aelxxs/actual-budget-tweaks/commit/13c50d2))
- Add schedule highlight redirect to open edit modal ([99c5c83](https://github.com/aelxxs/actual-budget-tweaks/commit/99c5c83))
- Add Template Apply Breakdown tweak ([c00dc73](https://github.com/aelxxs/actual-budget-tweaks/commit/c00dc73))
- Add Improve Notification Contrast tweak ([bbe7b47](https://github.com/aelxxs/actual-budget-tweaks/commit/bbe7b47))

### 🩹 Fixes

- Restore income breakdown report and scroll bug ([a6301c3](https://github.com/aelxxs/actual-budget-tweaks/commit/a6301c3))
- Handle extension context invalidation gracefully ([b2437a3](https://github.com/aelxxs/actual-budget-tweaks/commit/b2437a3))
- **cti:** Gate initial data load on backend readiness ([4386185](https://github.com/aelxxs/actual-budget-tweaks/commit/4386185))
- Scope content script injection to configured Actual URL ([14acf86](https://github.com/aelxxs/actual-budget-tweaks/commit/14acf86))
- **ib:** Toggle transaction popover when clicking the same node ([4867057](https://github.com/aelxxs/actual-budget-tweaks/commit/4867057))
- Lazy-load Svelte runtime to avoid CSP errors on non-Actual pages ([be73d0c](https://github.com/aelxxs/actual-budget-tweaks/commit/be73d0c))
- **settings:** Hydrate select dropdowns with persisted value ([6aa7386](https://github.com/aelxxs/actual-budget-tweaks/commit/6aa7386))

### ❤️ Contributors

- Andy Su <andysu1551@gmail.com>

## v0.1.15

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.14...v0.1.15)

### 🩹 Fixes

- Improve buggy behaviour caused by bad css ([234ce75](https://github.com/aelxxs/actual-budget-tweaks/commit/234ce75))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.14

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.13...v0.1.14)

### 🩹 Fixes

- Notice text ([a55b0de](https://github.com/aelxxs/actual-budget-tweaks/commit/a55b0de))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.13

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.12...v0.1.13)

### 🚀 Enhancements

- Styling updates ([b807887](https://github.com/aelxxs/actual-budget-tweaks/commit/b807887))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.12

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.11...v0.1.12)

### 🩹 Fixes

- Update page background ([86dff5e](https://github.com/aelxxs/actual-budget-tweaks/commit/86dff5e))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.11

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.10...v0.1.11)

### 🚀 Enhancements

- Fix note and table styling ([2df6c4e](https://github.com/aelxxs/actual-budget-tweaks/commit/2df6c4e))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.10

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.9...v0.1.10)

### 🩹 Fixes

- Ci ([3870262](https://github.com/aelxxs/actual-budget-tweaks/commit/3870262))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.9

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.8...v0.1.9)

### 🩹 Fixes

- Ci ([f75d82f](https://github.com/aelxxs/actual-budget-tweaks/commit/f75d82f))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.8

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.7...v0.1.8)

### 🩹 Fixes

- Ci ([857f1f4](https://github.com/aelxxs/actual-budget-tweaks/commit/857f1f4))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.7

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.6...v0.1.7)

### 🩹 Fixes

- Ci ([8bc315a](https://github.com/aelxxs/actual-budget-tweaks/commit/8bc315a))
- Ci ([75f0e5e](https://github.com/aelxxs/actual-budget-tweaks/commit/75f0e5e))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

