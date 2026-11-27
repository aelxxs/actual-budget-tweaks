# Changelog


## v0.1.112

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.111...v0.1.112)

### 🚀 Enhancements

- Show how old Reconcile's synced bank balance is, with Sync now once it's a day old, and say when the statement balance matches what's cleared ([09ed4a7](https://github.com/aelxxs/actual-budget-tweaks/commit/09ed4a7))
- Option to hide the budget header's column totals when month cards show them ([fe35c64](https://github.com/aelxxs/actual-budget-tweaks/commit/fe35c64))
- Pin a category group, an In categories card, Spent compared with last month, and a today mark on the pinned bar; cards fold their extras into three lines when narrow ([b11309d](https://github.com/aelxxs/actual-budget-tweaks/commit/b11309d))
- Open ABT's Tweaks from the sidebar's settings menu, which now always opens ([30b9621](https://github.com/aelxxs/actual-budget-tweaks/commit/30b9621))
- Pick a category icon from a curated set of line icons, drawn muted in the theme's colours ([0f2f187](https://github.com/aelxxs/actual-budget-tweaks/commit/0f2f187))
- The sync recap's caught-up state shows when each bank account last synced, with a Sync now button ([3e3ca95](https://github.com/aelxxs/actual-budget-tweaks/commit/3e3ca95))
- A Payoff panel on accounts that owe money, showing when the debt clears, what it costs and the payment a target month needs ([0f98a3a](https://github.com/aelxxs/actual-budget-tweaks/commit/0f98a3a))
- Show where the saved payoff plan ends beside the account's balance ([268bb21](https://github.com/aelxxs/actual-budget-tweaks/commit/268bb21))
- The payoff panel charts the balance down to zero and says what each alternative saves ([c3b58cf](https://github.com/aelxxs/actual-budget-tweaks/commit/c3b58cf))
- Loan payoff follows new transactions, adds the interest that's due, lists every debt's payoff and can be removed from the note ([7047dce](https://github.com/aelxxs/actual-budget-tweaks/commit/7047dce))
- The payoff chart leads in with the past year's balance, and the panel heads with the payoff date and interest to come ([97af884](https://github.com/aelxxs/actual-budget-tweaks/commit/97af884))
- The payoff panel leads with the payoff date, tries changes in one card and folds the loan's settings away ([f6ee9e8](https://github.com/aelxxs/actual-budget-tweaks/commit/f6ee9e8))
- The payoff panel shows how far the debt has come down and what the next payment is made of ([9dfc4d8](https://github.com/aelxxs/actual-budget-tweaks/commit/9dfc4d8))
- Sync recap's account chips show each account's icon ([241569b](https://github.com/aelxxs/actual-budget-tweaks/commit/241569b))
- Number field and slider primitives ([6e23078](https://github.com/aelxxs/actual-budget-tweaks/commit/6e23078))
- Fields can show the budget's currency symbol and a unit inside them, used by the loan payoff panel ([686b975](https://github.com/aelxxs/actual-budget-tweaks/commit/686b975))
- The Insights shortcut closes the panel when it's already open ([f7c40fa](https://github.com/aelxxs/actual-budget-tweaks/commit/f7c40fa))
- The website has a What's new page for the latest release ([822c497](https://github.com/aelxxs/actual-budget-tweaks/commit/822c497))

### 🩹 Fixes

- Keep an imported settings file from being undone by the open budget, and keep ABT on this server when the file came from another ([0eaefb8](https://github.com/aelxxs/actual-budget-tweaks/commit/0eaefb8))
- Give a sidebar of its own border lines firmed against its own background, so Theme Studio's Borders slider no longer turns a dark sidebar's lines near white ([10d1886](https://github.com/aelxxs/actual-budget-tweaks/commit/10d1886))
- Keep tints visible on light palette themes, which had made the fill token a solid surface ([72563c0](https://github.com/aelxxs/actual-budget-tweaks/commit/72563c0))
- Silence Svelte's stale-assignment warning in the category icons store ([2ddfc99](https://github.com/aelxxs/actual-budget-tweaks/commit/2ddfc99))
- Restore the budget table header's bottom border, lost when the Borders setting moved into the base styles ([e429773](https://github.com/aelxxs/actual-budget-tweaks/commit/e429773))
- Show how long ago an account synced in its hover card, which read Actual's millisecond timestamp as a date ([d5e1fcd](https://github.com/aelxxs/actual-budget-tweaks/commit/d5e1fcd))
- Keep the payoff chart's legend still while hovering ([020545c](https://github.com/aelxxs/actual-budget-tweaks/commit/020545c))
- Read every note for the debts list, as Actual's queries can't match part of an id ([064ebdf](https://github.com/aelxxs/actual-budget-tweaks/commit/064ebdf))
- The payoff panel's footer says what state the note is in, removed included ([0e31bb2](https://github.com/aelxxs/actual-budget-tweaks/commit/0e31bb2))
- The payoff panel's finish-by month starts ahead of the plan on a new loan too ([64cfe68](https://github.com/aelxxs/actual-budget-tweaks/commit/64cfe68))
- Using the finish-by payment keeps its month, rather than moving ahead of the new plan ([5ca9948](https://github.com/aelxxs/actual-budget-tweaks/commit/5ca9948))
- An input with a list of suggestions shows a dropdown arrow, not the date picker's calendar ([2e43396](https://github.com/aelxxs/actual-budget-tweaks/commit/2e43396))
- The payoff panel shows the next payment the same way before the first one ([1c9ae5b](https://github.com/aelxxs/actual-budget-tweaks/commit/1c9ae5b))
- The payoff panel's payment slider reaches ten times the payment ([7f08b54](https://github.com/aelxxs/actual-budget-tweaks/commit/7f08b54))
- The payoff panel takes a typed payment, splits the one being tried and drops the repeated account name ([1c1ed6a](https://github.com/aelxxs/actual-budget-tweaks/commit/1c1ed6a))
- A payoff plan counts the daily interest built up since the last posting ([ec70d7f](https://github.com/aelxxs/actual-budget-tweaks/commit/ec70d7f))
- Loan settings say why the charged rate isn't shown yet ([42147f2](https://github.com/aelxxs/actual-budget-tweaks/commit/42147f2))
- Loan payoff explains daily and monthly interest by the kinds of account that use them ([2408353](https://github.com/aelxxs/actual-budget-tweaks/commit/2408353))
- The payoff chart's top figure stays put in privacy mode, the first card is inset like the rest, and any payee can be picked for interest ([73db604](https://github.com/aelxxs/actual-budget-tweaks/commit/73db604))
- The payoff panel's figures keep their lines as a payment is tried ([562bff9](https://github.com/aelxxs/actual-budget-tweaks/commit/562bff9))
- The payoff panel keeps room for what trying a change adds, so nothing moves when it appears ([fa705dd](https://github.com/aelxxs/actual-budget-tweaks/commit/fa705dd))
- The collapsed accounts rail shows an emoji from the account's name instead of a broken character ([3817d55](https://github.com/aelxxs/actual-budget-tweaks/commit/3817d55))
- A schedule paid on its due day no longer also shows as upcoming in the Spending Calendar ([d624573](https://github.com/aelxxs/actual-budget-tweaks/commit/d624573))
- Insights' Coming up shows schedules with a range or approximate amount, as $40–$60 or ~$50 ([5800b15](https://github.com/aelxxs/actual-budget-tweaks/commit/5800b15))
- Loan payoff no longer suggests the opening balance's payee as the one charging interest ([d753a8f](https://github.com/aelxxs/actual-budget-tweaks/commit/d753a8f))
- The insights card settings menu closes when you switch tabs instead of staying stuck open ([20ba10b](https://github.com/aelxxs/actual-budget-tweaks/commit/20ba10b))
- The sidebar's Last synced hint stays current, including syncs Actual ran on its own ([18ba318](https://github.com/aelxxs/actual-budget-tweaks/commit/18ba318))

### 💅 Refactors

- Drop the Large and Pill corner steps, which ABT's capped radius tokens made look like Rounder (now Large) ([fd6e602](https://github.com/aelxxs/actual-budget-tweaks/commit/fd6e602))
- Fold the Borders setting into the base styles, where the borders replace Actual's shadows, and draw the top bar's line from the titlebar ([ecb6c27](https://github.com/aelxxs/actual-budget-tweaks/commit/ecb6c27))
- Type component props on the destructured variable, as newer Svelte no longer takes a type argument on $props ([1703d4c](https://github.com/aelxxs/actual-budget-tweaks/commit/1703d4c))
- Drop the payoff panel's list of every debt ([70392d2](https://github.com/aelxxs/actual-budget-tweaks/commit/70392d2))
- Drop the payoff panel's check of the rate against interest charged ([a9d5983](https://github.com/aelxxs/actual-budget-tweaks/commit/a9d5983))
- Loan payoff reads an account's ledger only where there's a plan, and drops what the reworked panel left unused ([8d69f98](https://github.com/aelxxs/actual-budget-tweaks/commit/8d69f98))
- Loan payoff keeps each loan's settings with ABT's budget data, not in the account's note ([0cd22fc](https://github.com/aelxxs/actual-budget-tweaks/commit/0cd22fc))
- CategoryPicker's searchable list becomes a general Picker ([80b5788](https://github.com/aelxxs/actual-budget-tweaks/commit/80b5788))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.111 ([48a7cb7](https://github.com/aelxxs/actual-budget-tweaks/commit/48a7cb7))
- Take docs screenshots with the demo settings, light Daylight theme and built-in Midnight for dark shots ([b545691](https://github.com/aelxxs/actual-budget-tweaks/commit/b545691))
- Regenerate guide, home and README screenshots ([80182b9](https://github.com/aelxxs/actual-budget-tweaks/commit/80182b9))
- Take docs screenshots in built-in Daylight instead of a custom Studio theme ([c46afad](https://github.com/aelxxs/actual-budget-tweaks/commit/c46afad))
- Regenerate screenshots in built-in Daylight ([a361b17](https://github.com/aelxxs/actual-budget-tweaks/commit/a361b17))
- Test the default finish-by month, and open a loan account's payoff panel in the smoke test ([385f759](https://github.com/aelxxs/actual-budget-tweaks/commit/385f759))
- The smoke test's loan owes an amount its payment can clear ([2ee8930](https://github.com/aelxxs/actual-budget-tweaks/commit/2ee8930))
- The smoke test drives loan payoff's what-ifs, note, interest and switch ([b683c51](https://github.com/aelxxs/actual-budget-tweaks/commit/b683c51))
- The smoke test checks loan payoff follows a transaction added behind it ([eb0d5f1](https://github.com/aelxxs/actual-budget-tweaks/commit/eb0d5f1))
- The loan payoff guide explains how to read the plan ([715c7b6](https://github.com/aelxxs/actual-budget-tweaks/commit/715c7b6))
- Docs-shots makes the Chrome Web Store screenshots and promo tiles with --store ([61bac91](https://github.com/aelxxs/actual-budget-tweaks/commit/61bac91))
- Abt.alexis.lol/support redirects to the support thread in Actual's Discord ([e0cb043](https://github.com/aelxxs/actual-budget-tweaks/commit/e0cb043))
- The extension has a short description, which the Chrome Web Store shows as its summary ([84f5fc2](https://github.com/aelxxs/actual-budget-tweaks/commit/84f5fc2))
- The website, README and What's new page link to sponsoring ABT ([af1a3db](https://github.com/aelxxs/actual-budget-tweaks/commit/af1a3db))
- Short links on abt.alexis.lol for sponsoring, Ko-fi, the repo and the Chrome listing ([0c7cb9d](https://github.com/aelxxs/actual-budget-tweaks/commit/0c7cb9d))
- Docs-shots --home also takes the landing page's feature screenshots, on a funded budget, and retries pages Actual rate-limits ([b1aafe1](https://github.com/aelxxs/actual-budget-tweaks/commit/b1aafe1))
- The smoke test picks the loan's finish-by month with ABT's month picker ([b736680](https://github.com/aelxxs/actual-budget-tweaks/commit/b736680))

### 🎨 Styles

- Follow Actual's wording: goals for what a category needs and automations for its rules, keeping templates for Actual's template actions ([184678c](https://github.com/aelxxs/actual-budget-tweaks/commit/184678c))
- Replace the last sparkle icons with plain ones, and drop the glow from the sidebar's drop lines ([4f10ce5](https://github.com/aelxxs/actual-budget-tweaks/commit/4f10ce5))
- Draw account emoji as system emoji text, like category emoji and Actual, in place of Twemoji images from a CDN ([0c30888](https://github.com/aelxxs/actual-budget-tweaks/commit/0c30888))
- Lift group rows in dark themes so they stand off the budget table instead of matching a hovered row ([f439f71](https://github.com/aelxxs/actual-budget-tweaks/commit/f439f71))
- Redraw tooltips with a rounded arrow, theme and sidebar colours and a short delay, and stop the browser's own tooltip showing over them ([2eb3d22](https://github.com/aelxxs/actual-budget-tweaks/commit/2eb3d22))
- Drop tooltips that only repeat what a control already shows ([439d58c](https://github.com/aelxxs/actual-budget-tweaks/commit/439d58c))
- Keep overdue amounts in the account hover card plain, and darken the Overdue heading so it reads on a light card ([1e4729a](https://github.com/aelxxs/actual-budget-tweaks/commit/1e4729a))
- Summary cards split the row's slack evenly, the calm actions card takes less, and To Budget's figure steps down on a narrow row without changing the row's height ([667ab19](https://github.com/aelxxs/actual-budget-tweaks/commit/667ab19))
- The sidebar search bar and shortcut tiles follow the Rounded corners setting ([06789d7](https://github.com/aelxxs/actual-budget-tweaks/commit/06789d7))
- What an alternative payoff plan changes reads as three figures: interest, time and the new date ([bee8a9f](https://github.com/aelxxs/actual-budget-tweaks/commit/bee8a9f))
- The narrow Spent card keeps its budgeted line, dropping the comparison with last month ([f6b300c](https://github.com/aelxxs/actual-budget-tweaks/commit/f6b300c))
- Light themes' cards sit closer to white ([8a5f1da](https://github.com/aelxxs/actual-budget-tweaks/commit/8a5f1da))
- Light themes' other months sit a step below the near-white current month, with one group row colour across months ([5fdedee](https://github.com/aelxxs/actual-budget-tweaks/commit/5fdedee))
- Select dropdowns draw the same chevron as ABT's other dropdowns ([8db35b5](https://github.com/aelxxs/actual-budget-tweaks/commit/8db35b5))
- Search fields share one clear button that follows the theme ([874a76c](https://github.com/aelxxs/actual-budget-tweaks/commit/874a76c))
- Loan payoff picks months and the interest payee with ABT's own pickers, and uses the shared number and slider styles ([7855e0f](https://github.com/aelxxs/actual-budget-tweaks/commit/7855e0f))
- Loan payoff's extra payments read as an amount in a month, and amounts tidy to the budget's number format when you leave a field ([44e4f2d](https://github.com/aelxxs/actual-budget-tweaks/commit/44e4f2d))
- The interest payee list is sized to the payoff panel's text ([c2ef110](https://github.com/aelxxs/actual-budget-tweaks/commit/c2ef110))
- The To Budget figure is one size at every width, with less space above it ([592ffc6](https://github.com/aelxxs/actual-budget-tweaks/commit/592ffc6))
- The home page lists a few highlights per release and leaves the release bot out of contributors ([9d2eb86](https://github.com/aelxxs/actual-budget-tweaks/commit/9d2eb86))
- The home page shows contributors as overlapping avatars with a line crediting them ([72fd8a9](https://github.com/aelxxs/actual-budget-tweaks/commit/72fd8a9))
- The landing page's feature cards show real screenshots on a dark backdrop, in a new order, with a fresh hero ([7308122](https://github.com/aelxxs/actual-budget-tweaks/commit/7308122))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>
- Junyuan Zheng ([@junyuanz1](https://github.com/junyuanz1))

## v0.1.111

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.110...v0.1.111)

### 🚀 Enhancements

- Show each category's net change on the Reassigned card, apart from To Budget covers ([f102b0e](https://github.com/aelxxs/actual-budget-tweaks/commit/f102b0e))
- Add background hex input to Theme Studio ([6d97160](https://github.com/aelxxs/actual-budget-tweaks/commit/6d97160))
- Let the Sync recap clear a transaction's category ([9b855c5](https://github.com/aelxxs/actual-budget-tweaks/commit/9b855c5))
- Leave category color dots off until turned on ([85dc577](https://github.com/aelxxs/actual-budget-tweaks/commit/85dc577))
- Let the sidebar hide account sync status ([a1df805](https://github.com/aelxxs/actual-budget-tweaks/commit/a1df805))
- Close a panel opened over another back to the one underneath ([dfc233a](https://github.com/aelxxs/actual-budget-tweaks/commit/dfc233a))
- Show the five biggest overspent categories in Insights, with the rest on request ([ea70ecb](https://github.com/aelxxs/actual-budget-tweaks/commit/ea70ecb))
- Match the calendar header to the budget page, keep day totals neutral, and add switches for the heat tint and category bars ([f8682b6](https://github.com/aelxxs/actual-budget-tweaks/commit/f8682b6))
- Say what To Budget's figure means in a line under it ([77dad07](https://github.com/aelxxs/actual-budget-tweaks/commit/77dad07))
- Give themes their own --theme-* roles for charts, data, the sidebar and borders, and have Theme Studio generate chart colours from its family setting ([f3cbf37](https://github.com/aelxxs/actual-budget-tweaks/commit/f3cbf37))
- Show an up-to-date state in Reconcile when nothing has changed since the last reconcile, and drop the toolbar's age badge then ([40b88c1](https://github.com/aelxxs/actual-budget-tweaks/commit/40b88c1))
- Add Keyboard shortcuts, single keys for the sidebar, Insights, Reconcile and Theme Studio, listed under the setting and shown in the command palette ([5ef75f5](https://github.com/aelxxs/actual-budget-tweaks/commit/5ef75f5))

### 🩹 Fixes

- Suggest applying templates before covering overspending ([cd37a62](https://github.com/aelxxs/actual-budget-tweaks/commit/cd37a62))
- Stop the Insights panel squeezing the page it's leaving ([d9fcc11](https://github.com/aelxxs/actual-budget-tweaks/commit/d9fcc11))
- Gracefully shut down the sidecar server ([2e34e1d](https://github.com/aelxxs/actual-budget-tweaks/commit/2e34e1d))
- Keep a zero balance on a met goal as a plain pill ([cb8f39f](https://github.com/aelxxs/actual-budget-tweaks/commit/cb8f39f))
- Build Studio themes from their recipe when applying them ([8052597](https://github.com/aelxxs/actual-budget-tweaks/commit/8052597))
- Keep the theme card menu from being clipped by the gallery ([5b4adcb](https://github.com/aelxxs/actual-budget-tweaks/commit/5b4adcb))
- Read "is between" schedule amounts as their midpoint, like Actual ([25649c1](https://github.com/aelxxs/actual-budget-tweaks/commit/25649c1))
- Line up the titlebar's divider with the side panel's in inset cards ([bbbe635](https://github.com/aelxxs/actual-budget-tweaks/commit/bbbe635))
- Open the theme gallery on all themes ([1d80bd3](https://github.com/aelxxs/actual-budget-tweaks/commit/1d80bd3))
- Base the calendar's heat tint on net spending, so same-day refunds cancel out ([3ed5136](https://github.com/aelxxs/actual-budget-tweaks/commit/3ed5136))
- Hold off dimming Insights until a refresh is actually slow ([9b76873](https://github.com/aelxxs/actual-budget-tweaks/commit/9b76873))
- Show a side panel's title as a tooltip only when it's cut off ([10f1717](https://github.com/aelxxs/actual-budget-tweaks/commit/10f1717))
- Remember month counts that fit for the visit only, so zooming out doesn't leave them for good ([28c6648](https://github.com/aelxxs/actual-budget-tweaks/commit/28c6648))
- Keep Theme Studio's preview up until the saved theme replaces it, so closing it doesn't flash ([d619238](https://github.com/aelxxs/actual-budget-tweaks/commit/d619238))
- Give only app side panels the page background with inset panels on, so page panels keep theirs ([c72f5ad](https://github.com/aelxxs/actual-budget-tweaks/commit/c72f5ad))
- Keep the command palette's Escape from also closing the Insights panel ([e7d5ae7](https://github.com/aelxxs/actual-budget-tweaks/commit/e7d5ae7))
- Pick a data colour from the theme's family that can't be read as a status, falling back to blue ([5c0b98c](https://github.com/aelxxs/actual-budget-tweaks/commit/5c0b98c))
- Use the spacing token for the collapsed rail tiles' inset ([8a69054](https://github.com/aelxxs/actual-budget-tweaks/commit/8a69054))
- Open the CSS override and theme editor panels with the gallery's scope, so they stay full height when it is ([b2cc34d](https://github.com/aelxxs/actual-budget-tweaks/commit/b2cc34d))

### 💅 Refactors

- Replace the token editor with a per-theme CSS override ([1cf5d17](https://github.com/aelxxs/actual-budget-tweaks/commit/1cf5d17))
- Type template kinds and budget sheet names ([31e0b40](https://github.com/aelxxs/actual-budget-tweaks/commit/31e0b40))
- Run the density, row height, pattern and corner pickers as select settings ([95edde4](https://github.com/aelxxs/actual-budget-tweaks/commit/95edde4))
- Use the shared clamp in tooltips ([fad0162](https://github.com/aelxxs/actual-budget-tweaks/commit/fad0162))
- Merge the Studio's accent and background hex fields ([d86c72c](https://github.com/aelxxs/actual-budget-tweaks/commit/d86c72c))
- Run column resizing from one DOM watcher ([bed3c3f](https://github.com/aelxxs/actual-budget-tweaks/commit/bed3c3f))
- Read settings in components through one storedValue helper ([ed4106f](https://github.com/aelxxs/actual-budget-tweaks/commit/ed4106f))
- Move Today and the month arrows into a shared MonthNav, giving Today square corners ([ce3244a](https://github.com/aelxxs/actual-budget-tweaks/commit/ce3244a))
- Drop single-colour gradients from the sidebar logo tiles ([be19691](https://github.com/aelxxs/actual-budget-tweaks/commit/be19691))
- Draw ABT's icons from Lucide, keeping hand-drawn SVG only for ABT's own glyphs and markup for Actual's pages ([bd1f8a8](https://github.com/aelxxs/actual-budget-tweaks/commit/bd1f8a8))
- Paint built-in and Studio themes through one palette mapping, with the sidebar and borders as palette keys ([586d34f](https://github.com/aelxxs/actual-budget-tweaks/commit/586d34f))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.110 ([be75242](https://github.com/aelxxs/actual-budget-tweaks/commit/be75242))
- Remove unused exports, dead helpers and devDependencies ([3319b43](https://github.com/aelxxs/actual-budget-tweaks/commit/3319b43))
- Drop the old column-width defaults migration ([d526f65](https://github.com/aelxxs/actual-budget-tweaks/commit/d526f65))

### 🎨 Styles

- Use sentence case and plain ink for side panel section titles ([e74f6bb](https://github.com/aelxxs/actual-budget-tweaks/commit/e74f6bb))
- Give the side panel its own background token, a step below dark pages ([e701b53](https://github.com/aelxxs/actual-budget-tweaks/commit/e701b53))
- Brighten the light-theme budget table and panel cards ([65c9890](https://github.com/aelxxs/actual-budget-tweaks/commit/65c9890))
- Give balance pills a light-theme style and a neutral pill for zero balances ([e9f018e](https://github.com/aelxxs/actual-budget-tweaks/commit/e9f018e))
- Add a data colour role and use it for the plan overview's bars ([0325157](https://github.com/aelxxs/actual-budget-tweaks/commit/0325157))
- Quiet section counts and chevrons, and show a recap batch's review button only beside other batches ([0b085a4](https://github.com/aelxxs/actual-budget-tweaks/commit/0b085a4))
- Soften control borders in page chrome ([3bd2595](https://github.com/aelxxs/actual-budget-tweaks/commit/3bd2595))
- Keep the overspending suggestion card neutral ([383691c](https://github.com/aelxxs/actual-budget-tweaks/commit/383691c))
- Show section counts as plain text again ([e3f4d2d](https://github.com/aelxxs/actual-budget-tweaks/commit/e3f4d2d))
- Shrink the spending calendar's category dots ([3aee62c](https://github.com/aelxxs/actual-budget-tweaks/commit/3aee62c))
- Keep spending amounts neutral in the calendar's day panel ([8c3b886](https://github.com/aelxxs/actual-budget-tweaks/commit/8c3b886))
- Drop the release notes' gradient bar and uppercase headings ([b0b852c](https://github.com/aelxxs/actual-budget-tweaks/commit/b0b852c))
- Replace the sparkles icon where nothing is AI ([e6784ac](https://github.com/aelxxs/actual-budget-tweaks/commit/e6784ac))
- Show the calendar's payee counts and overflow as plain text ([cdbae5e](https://github.com/aelxxs/actual-budget-tweaks/commit/cdbae5e))
- Use a link icon instead of an emoji for shortcut tiles without one ([8a6c929](https://github.com/aelxxs/actual-budget-tweaks/commit/8a6c929))
- Keep the corner wash and lit border for the suggestion card only, and weight To Budget's figure a step heavier ([dccfe12](https://github.com/aelxxs/actual-budget-tweaks/commit/dccfe12))
- Tighten the sidebar rail's top padding ([8ad3a4f](https://github.com/aelxxs/actual-budget-tweaks/commit/8ad3a4f))
- Match the calendar's stat labels to the account page's ([0e1c9e5](https://github.com/aelxxs/actual-budget-tweaks/commit/0e1c9e5))
- Title the reconcile panel Reconcile instead of repeating the account's name ([08baa70](https://github.com/aelxxs/actual-budget-tweaks/commit/08baa70))
- Put the category filter's counts in chips ([bb1a491](https://github.com/aelxxs/actual-budget-tweaks/commit/bb1a491))
- Give settings that shared an icon one of their own ([ff3b4d8](https://github.com/aelxxs/actual-budget-tweaks/commit/ff3b4d8))
- Drop the icon from the budget actions card, and its empty half in the multi-month header ([ef66ff3](https://github.com/aelxxs/actual-budget-tweaks/commit/ef66ff3))
- Give side panels the page background with inset panels on ([e62bb9c](https://github.com/aelxxs/actual-budget-tweaks/commit/e62bb9c))
- Put Studio light themes' cards on white, deepen light group rows and resting borders, and hover with the ink tint in every theme ([22dd9b2](https://github.com/aelxxs/actual-budget-tweaks/commit/22dd9b2))
- Tint Theme Studio's dark sidebar with a hint of the accent ([9de953c](https://github.com/aelxxs/actual-budget-tweaks/commit/9de953c))
- Match a light theme's plain sidebar to its cards as shown ([3a743e2](https://github.com/aelxxs/actual-budget-tweaks/commit/3a743e2))
- Weight To Budget's figure at 600 ([5d5c667](https://github.com/aelxxs/actual-budget-tweaks/commit/5d5c667))
- Use the settings-2 icon wherever the sliders icon was ([a7df61e](https://github.com/aelxxs/actual-budget-tweaks/commit/a7df61e))
- Weight To Budget's figure at 550 ([f6fb0e2](https://github.com/aelxxs/actual-budget-tweaks/commit/f6fb0e2))
- Put the budget actions chevron in the card's corner, showing its button on hover like the swap button ([ebb7c92](https://github.com/aelxxs/actual-budget-tweaks/commit/ebb7c92))
- Use tabular figures for the daily-available amount, income chart and Insights toolbar ([81f867e](https://github.com/aelxxs/actual-budget-tweaks/commit/81f867e))
- Polish the Insights overview: a calmer Income note mid-month, level headlines, a goals count without a zero, unsigned bills, and Next month's tidier strip and footer ([ee529d8](https://github.com/aelxxs/actual-budget-tweaks/commit/ee529d8))
- Set Studio budget colours' chroma as a share of each hue's gamut, and give muted ones more colour ([ea1cfc8](https://github.com/aelxxs/actual-budget-tweaks/commit/ea1cfc8))
- Rename the Insights Next month card to Months ahead, and match its headline's icon gap to the goal rows ([e377794](https://github.com/aelxxs/actual-budget-tweaks/commit/e377794))
- Calm Theme Studio's budget colours: cap their chroma, move green toward emerald, and give light themes more contrast with an amber yellow ([ade1588](https://github.com/aelxxs/actual-budget-tweaks/commit/ade1588))
- Keep budget group totals and zero balances out of Color amounts' green, and weight coloured balances at 450 ([cf00bb8](https://github.com/aelxxs/actual-budget-tweaks/commit/cf00bb8))
- Size the collapsed rail's account tiles and folders to match its nav buttons ([fce6ddf](https://github.com/aelxxs/actual-budget-tweaks/commit/fce6ddf))
- Calm Theme Studio's dark budget colours: a sage green and a softer gold yellow, so neither outshines red ([7a7a5a8](https://github.com/aelxxs/actual-budget-tweaks/commit/7a7a5a8))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.110

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.109...v0.1.110)

### 🚀 Enhancements

- Show the last Insights overview at once on reload while it refreshes ([02bf213](https://github.com/aelxxs/actual-budget-tweaks/commit/02bf213))

### 🩹 Fixes

- Use a long-term goal's current target, not the month's last applied one ([0f07d03](https://github.com/aelxxs/actual-budget-tweaks/commit/0f07d03))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.109 ([eea1d7b](https://github.com/aelxxs/actual-budget-tweaks/commit/eea1d7b))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.109

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.108...v0.1.109)

### 🚀 Enhancements

- Add a settings footer with what's new and a support popover, and tidy the settings menu ([a0425ca](https://github.com/aelxxs/actual-budget-tweaks/commit/a0425ca))
- Show when an account was last reconciled in its hover card ([9660c97](https://github.com/aelxxs/actual-budget-tweaks/commit/9660c97))
- Welcome new installs with a short setup card ([d7c1de5](https://github.com/aelxxs/actual-budget-tweaks/commit/d7c1de5))
- Show long-term goals and their progress in Insights ([9230306](https://github.com/aelxxs/actual-budget-tweaks/commit/9230306))
- Clearer Insights overview cards ([449f83b](https://github.com/aelxxs/actual-budget-tweaks/commit/449f83b))

### 🩹 Fixes

- Leave other sites' storage alone in the overlay preload ([2629fad](https://github.com/aelxxs/actual-budget-tweaks/commit/2629fad))
- Keep the page card's size and border colour when an app panel opens beside it ([b1da693](https://github.com/aelxxs/actual-budget-tweaks/commit/b1da693))
- Turn inset panels off while Actual's own sidebar is in use ([bdc0389](https://github.com/aelxxs/actual-budget-tweaks/commit/bdc0389))
- Keep the live sidebar docked when Actual's sidebar is unpinned ([f400acf](https://github.com/aelxxs/actual-budget-tweaks/commit/f400acf))
- Keep the budget icon in place when the sidebar collapses or expands ([d8d8b05](https://github.com/aelxxs/actual-budget-tweaks/commit/d8d8b05))
- Describe a balance cap as a cap in the template hover card ([d57b2b2](https://github.com/aelxxs/actual-budget-tweaks/commit/d57b2b2))
- Don't count long-term goals as targets due this month ([b5cca78](https://github.com/aelxxs/actual-budget-tweaks/commit/b5cca78))

### 💅 Refactors

- Move the sidecar server and browser shim to TypeScript ([c5a0b6d](https://github.com/aelxxs/actual-budget-tweaks/commit/c5a0b6d))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.108 ([7f7061b](https://github.com/aelxxs/actual-budget-tweaks/commit/7f7061b))
- Tidy wording across the README, app and website, and correct the privacy and self-hosting pages ([49c1ff9](https://github.com/aelxxs/actual-budget-tweaks/commit/49c1ff9))

### 🎨 Styles

- Lift popovers a step above the page they open over ([64c0053](https://github.com/aelxxs/actual-budget-tweaks/commit/64c0053))
- Ease popovers in as they open, and simplify the support popover ([b03eb46](https://github.com/aelxxs/actual-budget-tweaks/commit/b03eb46))
- Smaller logo and a dashed sign-off in the support popover ([30c8c6c](https://github.com/aelxxs/actual-budget-tweaks/commit/30c8c6c))
- Show each feature's icon in the welcome card's summary ([adbc106](https://github.com/aelxxs/actual-budget-tweaks/commit/adbc106))
- Tighten the standard sidebar's padding and spacing ([1671509](https://github.com/aelxxs/actual-budget-tweaks/commit/1671509))
- Title the Insights panel Insights unless several months are shown ([03b2693](https://github.com/aelxxs/actual-budget-tweaks/commit/03b2693))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.108

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.107...v0.1.108)

### 🚀 Enhancements

- Show custom category icons wherever ABT lists categories ([ebf976f](https://github.com/aelxxs/actual-budget-tweaks/commit/ebf976f))
- Apply settings synced from another device without a reload ([15a2c5c](https://github.com/aelxxs/actual-budget-tweaks/commit/15a2c5c))
- Give inset cards a frame in the sidebar's colour when the sidebar contrasts with the page ([6d851fd](https://github.com/aelxxs/actual-budget-tweaks/commit/6d851fd))
- Run app-wide side panels full height, as their own card with inset panels ([bea6b8e](https://github.com/aelxxs/actual-budget-tweaks/commit/bea6b8e))

### 🩹 Fixes

- Keep notice text green so plain notices stay readable ([3a82929](https://github.com/aelxxs/actual-budget-tweaks/commit/3a82929))
- Style Actual's page when ABT starts after it has rendered ([f47271c](https://github.com/aelxxs/actual-budget-tweaks/commit/f47271c))
- Keep synced settings when a feature saves one as it starts ([20d94b9](https://github.com/aelxxs/actual-budget-tweaks/commit/20d94b9))
- Open and leave the calendar and graph without the page underneath showing ([997fb5a](https://github.com/aelxxs/actual-budget-tweaks/commit/997fb5a))
- Let Vibrance tint the Studio's tinted sidebar across its whole range ([74623c1](https://github.com/aelxxs/actual-budget-tweaks/commit/74623c1))
- Carry glow and grain across the floating frame without a ring around the sidebar ([9f720b6](https://github.com/aelxxs/actual-budget-tweaks/commit/9f720b6))

### 💅 Refactors

- One table for graph highlights, shared payee stats ([e58df4d](https://github.com/aelxxs/actual-budget-tweaks/commit/e58df4d))
- Shared dialog, outside-click and hover card; split large components ([3ada2d2](https://github.com/aelxxs/actual-budget-tweaks/commit/3ada2d2))
- Split lib by what it touches and keep it free of feature imports ([70f46fd](https://github.com/aelxxs/actual-budget-tweaks/commit/70f46fd))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.107 ([f619e0e](https://github.com/aelxxs/actual-budget-tweaks/commit/f619e0e))
- Regenerate guide, home and README screenshots for the current UI ([37e1550](https://github.com/aelxxs/actual-budget-tweaks/commit/37e1550))

### 🎨 Styles

- Close the side panel without an animation ([b6efdf8](https://github.com/aelxxs/actual-budget-tweaks/commit/b6efdf8))
- Drop the sidebar's collapse animation ([620edb9](https://github.com/aelxxs/actual-budget-tweaks/commit/620edb9))
- Drop decorative entrance animations ([a96dc14](https://github.com/aelxxs/actual-budget-tweaks/commit/a96dc14))
- Mark only months that need attention in the month picker ([a5e70f5](https://github.com/aelxxs/actual-budget-tweaks/commit/a5e70f5))
- Finish the styling migration onto shared tokens ([9c07762](https://github.com/aelxxs/actual-budget-tweaks/commit/9c07762))
- Keep the calendar's top row border from being clipped ([d45dba8](https://github.com/aelxxs/actual-budget-tweaks/commit/d45dba8))
- Stronger panel borders on light themes ([181c529](https://github.com/aelxxs/actual-budget-tweaks/commit/181c529))
- Show the side panel's resize grip on hover, matching the sidebar's ([2aaa642](https://github.com/aelxxs/actual-budget-tweaks/commit/2aaa642))
- Drop the tile behind an image budget icon ([77dd589](https://github.com/aelxxs/actual-budget-tweaks/commit/77dd589))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.107

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.106...v0.1.107)

### 🚀 Enhancements

- Turn Category Template Insights off by default ([c2c3d04](https://github.com/aelxxs/actual-budget-tweaks/commit/c2c3d04))
- Hold Actual's goal ring inside underfunded balance pills, and hide the progress ring where Actual's goal ring shows ([09f1078](https://github.com/aelxxs/actual-budget-tweaks/commit/09f1078))
- Keep the reconcile panel open with a finished state and undo, reload the table in place, drop the confetti and stop collapsing the sidebar ([956a5f5](https://github.com/aelxxs/actual-budget-tweaks/commit/956a5f5))
- Show Privacy style as a compact segmented control beside its label ([f7677b9](https://github.com/aelxxs/actual-budget-tweaks/commit/f7677b9))
- List the bigger features in a Features section that starts collapsed when all are on, with guide links on their rows ([7adf902](https://github.com/aelxxs/actual-budget-tweaks/commit/7adf902))
- List ABT's settings sections under its tab in Settings even while it's closed ([9b3221c](https://github.com/aelxxs/actual-budget-tweaks/commit/9b3221c))
- Add an experimental Graph view of how accounts, categories and payees connect ([c8fb5dc](https://github.com/aelxxs/actual-budget-tweaks/commit/c8fb5dc))
- Mark experimental features in settings and website ([046b6d6](https://github.com/aelxxs/actual-budget-tweaks/commit/046b6d6))
- Firm up borders with a Theme Studio slider and the system's increase-contrast setting ([965e6a9](https://github.com/aelxxs/actual-budget-tweaks/commit/965e6a9))
- Show transfers between accounts in the graph view ([dae6348](https://github.com/aelxxs/actual-budget-tweaks/commit/dae6348))
- Flag possible duplicate charges in the graph view ([b4a660c](https://github.com/aelxxs/actual-budget-tweaks/commit/b4a660c))
- Flag bills that went up in the graph view ([b1948f1](https://github.com/aelxxs/actual-budget-tweaks/commit/b1948f1))
- Apply rule changes from the transaction inspector and give it clearer hierarchy ([6d539b1](https://github.com/aelxxs/actual-budget-tweaks/commit/6d539b1))
- Add a back link to stacked side panels ([85f73e6](https://github.com/aelxxs/actual-budget-tweaks/commit/85f73e6))
- Filter the graph view by flow, account and category ([c39c2e0](https://github.com/aelxxs/actual-budget-tweaks/commit/c39c2e0))

### 🩹 Fixes

- Name the Features section in the website's features manifest ([c68b0e3](https://github.com/aelxxs/actual-budget-tweaks/commit/c68b0e3))
- Mount ABT's settings panel without watching every attribute change ([2efacb0](https://github.com/aelxxs/actual-budget-tweaks/commit/2efacb0))
- Tint the selected pill background so text on it reads in Actual's rule editor ([de24fac](https://github.com/aelxxs/actual-budget-tweaks/commit/de24fac))
- Stop testing removed coverage method setting ([1604b5f](https://github.com/aelxxs/actual-budget-tweaks/commit/1604b5f))
- Update smoke checks for current settings panels ([c9bd755](https://github.com/aelxxs/actual-budget-tweaks/commit/c9bd755))
- Isolate budget settings and watch sidebar feature links ([d61e940](https://github.com/aelxxs/actual-budget-tweaks/commit/d61e940))
- Resend synced pref subscriptions once the bridge is ready ([441b19f](https://github.com/aelxxs/actual-budget-tweaks/commit/441b19f))
- Follow Actual's number and date formats, and update when they change ([d88f12a](https://github.com/aelxxs/actual-budget-tweaks/commit/d88f12a))
- Give charts hex colors so Actual's donut chart shades categories correctly ([0ef1912](https://github.com/aelxxs/actual-budget-tweaks/commit/0ef1912))
- Keep graph labels inside the zoomed view ([a77e0d1](https://github.com/aelxxs/actual-budget-tweaks/commit/a77e0d1))
- Keep the graph fitted above its legend when the page resizes ([612abd8](https://github.com/aelxxs/actual-budget-tweaks/commit/612abd8))

### 💅 Refactors

- Remove the Dark Report Cards setting ([b54d078](https://github.com/aelxxs/actual-budget-tweaks/commit/b54d078))
- Merge the header, budget page and report card borders into one Borders switch ([bf55972](https://github.com/aelxxs/actual-budget-tweaks/commit/bf55972))
- Remove the Taller Group Rows setting, and pick Next Month's target from whether the budget has templates ([d1293aa](https://github.com/aelxxs/actual-budget-tweaks/commit/d1293aa))
- Merge the budget and reports headers into Modern headers, merge Month Cards and Budget Card Styling into one Off/Light/Full setting, and remove Highlight Hovered Budget Row ([acea0c2](https://github.com/aelxxs/actual-budget-tweaks/commit/acea0c2))
- Simplify the budget settings: remove Goal Funding and Schedule Icon Details, fold Quiet Funded Bars into Category Template Insights and the totals label styling into Modern headers, and move Show Daily Available to Accounts ([b96aef0](https://github.com/aelxxs/actual-budget-tweaks/commit/b96aef0))
- Always theme the scrollbars, as a fix for Actual's low-contrast ones rather than a setting ([3835709](https://github.com/aelxxs/actual-budget-tweaks/commit/3835709))
- Fold the Theme Menu setting into Modern Titlebar ([9a07efe](https://github.com/aelxxs/actual-budget-tweaks/commit/9a07efe))
- Make Category Filter part of Modern headers, shown only in the month header ([99085d5](https://github.com/aelxxs/actual-budget-tweaks/commit/99085d5))
- Merge Dim Reconciled, Highlight Uncategorized and Quiet New Transactions into Row status, and move Modern Account Toolbar to Components ([423c30a](https://github.com/aelxxs/actual-budget-tweaks/commit/423c30a))
- Stop collapsing the sidebar when Transaction Inspector opens, and remove the shared auto-collapse ([c3383b6](https://github.com/aelxxs/actual-budget-tweaks/commit/c3383b6))
- Merge Color transactions, Color negative balances and the always-on group balance colours into Color amounts, and move it with Privacy style to General > Amounts ([3500b20](https://github.com/aelxxs/actual-budget-tweaks/commit/3500b20))
- Move Template bars into Readability and flatten Accounts & Transactions into one list ([f305704](https://github.com/aelxxs/actual-budget-tweaks/commit/f305704))
- Drop the Template bars toggle from the budget table header and leave the resize button hover-only ([dd5b042](https://github.com/aelxxs/actual-budget-tweaks/commit/dd5b042))
- Move the calendar's page overlay into a shared module so other ABT pages can use it ([038e8ae](https://github.com/aelxxs/actual-budget-tweaks/commit/038e8ae))
- Remove graph view minimap ([9534ee5](https://github.com/aelxxs/actual-budget-tweaks/commit/9534ee5))
- Move graph highlights into a menu ([ba5e036](https://github.com/aelxxs/actual-budget-tweaks/commit/ba5e036))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.106 ([b5aea16](https://github.com/aelxxs/actual-budget-tweaks/commit/b5aea16))
- Rename settings and shorten their descriptions, in sentence case ([812f621](https://github.com/aelxxs/actual-budget-tweaks/commit/812f621))
- Shorten the Inset panels and Spending calendar descriptions ([fdc2a3c](https://github.com/aelxxs/actual-budget-tweaks/commit/fdc2a3c))
- Drop the Modern prefix from setting names, and point the guides at the Features section ([692520f](https://github.com/aelxxs/actual-budget-tweaks/commit/692520f))

### 🎨 Styles

- Give every setting its own icon, and match the Customize sidebar row to the others ([b1c7c81](https://github.com/aelxxs/actual-budget-tweaks/commit/b1c7c81))
- Mute the settings nav icons and redraw Advanced's as a rounded gear ([6b951df](https://github.com/aelxxs/actual-budget-tweaks/commit/6b951df))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.106

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.105...v0.1.106)

### 🚀 Enhancements

- Show Next Month as a runway strip, and tidy the Income, Reassigned and Coming Up cards ([6cfe05b](https://github.com/aelxxs/actual-budget-tweaks/commit/6cfe05b))
- Choose the summary row's two middle cards, from six including Months ahead and a pinned category ([d895ffa](https://github.com/aelxxs/actual-budget-tweaks/commit/d895ffa))
- Pair the summary row's cards with Insights, keep card layouts per budget, and work out neighbouring months ahead ([436780d](https://github.com/aelxxs/actual-budget-tweaks/commit/436780d))
- Customize the live sidebar in place, from a panel beside it ([c022b77](https://github.com/aelxxs/actual-budget-tweaks/commit/c022b77))
- Close the Customize sidebar panel on a click outside the sidebar ([6416612](https://github.com/aelxxs/actual-budget-tweaks/commit/6416612))
- Rework the account hover card in ABT's style, with overdue items and a Review link ([2747500](https://github.com/aelxxs/actual-budget-tweaks/commit/2747500))
- Show the next account's hover card quickly once one has been waited for ([ddacd55](https://github.com/aelxxs/actual-budget-tweaks/commit/ddacd55))
- Catch a flipped statement balance in the reconcile panel, and date the last reconcile ([cd82e03](https://github.com/aelxxs/actual-budget-tweaks/commit/cd82e03))
- Let panel sections mute their title and keep trailing content visible in privacy mode ([f628373](https://github.com/aelxxs/actual-budget-tweaks/commit/f628373))
- Add Theme Studio, a side panel for building a theme against the live budget page ([77e8113](https://github.com/aelxxs/actual-budget-tweaks/commit/77e8113))
- Let panel sections drop the capitalized title for settings rows, and mark open sections ([1d12512](https://github.com/aelxxs/actual-budget-tweaks/commit/1d12512))
- Save and edit Theme Studio themes, open older palette themes in it, and simplify the panel ([a33d9dc](https://github.com/aelxxs/actual-budget-tweaks/commit/a33d9dc))
- Bring back Theme Studio's lock and reroll chips without the hover shift, shuffle the shade, and move Sidebar beside Color ([f959841](https://github.com/aelxxs/actual-budget-tweaks/commit/f959841))
- Redesign the theme picker: the settings page shows the current theme, and Change theme opens a gallery of theme thumbnails in the side panel ([e0fee4c](https://github.com/aelxxs/actual-budget-tweaks/commit/e0fee4c))
- Turn ABT off from its settings page or the popup, leaving Actual as it is with only the Tweaks tab to turn it back on ([3d15e59](https://github.com/aelxxs/actual-budget-tweaks/commit/3d15e59))
- Add a Floating page option to Inset Panels, which blends the sidebar into the frame so only the page stands out ([3ec0cdd](https://github.com/aelxxs/actual-budget-tweaks/commit/3ec0cdd))
- Put the Sidebar and Theme switches in their section headers, open the sidebar's settings from a Customize button, and color negative balances in the live sidebar too ([3b00957](https://github.com/aelxxs/actual-budget-tweaks/commit/3b00957))
- Support insights in tracking budgets ([60e2f45](https://github.com/aelxxs/actual-budget-tweaks/commit/60e2f45))
- Side panels stack, with app panels following you across pages ([7b74877](https://github.com/aelxxs/actual-budget-tweaks/commit/7b74877))
- Keep synced transactions to review until you mark them reviewed ([0ccb062](https://github.com/aelxxs/actual-budget-tweaks/commit/0ccb062))
- Open Theme Studio on the page you're on instead of the budget ([8c50ce0](https://github.com/aelxxs/actual-budget-tweaks/commit/8c50ce0))
- Theme menu in the titlebar, with the current theme, the gallery on any page, Style and Theme Studio ([d761f35](https://github.com/aelxxs/actual-budget-tweaks/commit/d761f35))
- Richer tooltips: instant while moving between controls, an arrow and fade-in, hint lines and shortcut keys, keyboard focus, hidden while dragging, and the sidebar on the same tooltip ([20eabfb](https://github.com/aelxxs/actual-budget-tweaks/commit/20eabfb))
- Shortcut keys and hint lines on undo, redo, search, sync and other ABT tooltips ([696ba25](https://github.com/aelxxs/actual-budget-tweaks/commit/696ba25))
- Keep every month count that has fit, greyed out while it doesn't, and mark the count you picked while it waits for room ([0ab1cde](https://github.com/aelxxs/actual-budget-tweaks/commit/0ab1cde))
- Review a sync per account: a line in the account card that opens the recap on that account, and account chips in the recap ([a16840c](https://github.com/aelxxs/actual-budget-tweaks/commit/a16840c))

### 🩹 Fixes

- Export stored settings on the sidecar, not just defaults ([264800e](https://github.com/aelxxs/actual-budget-tweaks/commit/264800e))
- Number new and renamed account groups when the name is taken ([c64ce68](https://github.com/aelxxs/actual-budget-tweaks/commit/c64ce68))
- Call account groups groups, not categories, in the sidebar ([5c84dbc](https://github.com/aelxxs/actual-budget-tweaks/commit/5c84dbc))
- Stop the month header's count buttons flashing when arriving on the budget page ([5afb914](https://github.com/aelxxs/actual-budget-tweaks/commit/5afb914))
- Keep the runway strip inside its card when the summary row is narrow ([a3bbcad](https://github.com/aelxxs/actual-budget-tweaks/commit/a3bbcad))
- Recolor the To Budget figure as soon as the theme changes ([15dfd25](https://github.com/aelxxs/actual-budget-tweaks/commit/15dfd25))
- Keep a saved studio theme's sidebar colors after a reload ([3824f7c](https://github.com/aelxxs/actual-budget-tweaks/commit/3824f7c))
- Give the smoke test's budget a rule, since newer Actual drops the rules table when the list is empty ([fb318db](https://github.com/aelxxs/actual-budget-tweaks/commit/fb318db))
- Sync the sidebar's add tile setting with the budget, so turning it off sticks across devices ([c167447](https://github.com/aelxxs/actual-budget-tweaks/commit/c167447))
- Set the settings card, settings nav and alternate row colors that ABT themes left to Actual ([baa51c0](https://github.com/aelxxs/actual-budget-tweaks/commit/baa51c0))
- Only highlight the Insights button while the side panel is closed, so it doesn't look open behind another panel ([3de2042](https://github.com/aelxxs/actual-budget-tweaks/commit/3de2042))
- Merge Dusk, Nocturne and Material into their closest built-in themes, give Cyberpunk a pink accent, and raise every built-in theme's text and accent colors to 4.5:1 ([35e2f18](https://github.com/aelxxs/actual-budget-tweaks/commit/35e2f18))
- Follow settings panels in smoke test ([4c7bf1a](https://github.com/aelxxs/actual-budget-tweaks/commit/4c7bf1a))
- Improve notice badge contrast ([3ba3fc3](https://github.com/aelxxs/actual-budget-tweaks/commit/3ba3fc3))
- Mute summary card supporting text ([409f509](https://github.com/aelxxs/actual-budget-tweaks/commit/409f509))
- Format the tracking row, mock onBudgetType in the template plan test, and regenerate the features manifest ([49162f7](https://github.com/aelxxs/actual-budget-tweaks/commit/49162f7))
- Keep success toasts green now that notice text is the badge colour ([dcc99ae](https://github.com/aelxxs/actual-budget-tweaks/commit/dcc99ae))
- Pin the reports header to its real scroller ([9abd18f](https://github.com/aelxxs/actual-budget-tweaks/commit/9abd18f))
- Keep the reports header flush under the titlebar with the side panel's page-column exclusion ([9953bf2](https://github.com/aelxxs/actual-budget-tweaks/commit/9953bf2))
- Colour the RSU tile's growth with the sidebar's gain and loss colours, like the stock tile ([c2a8d0c](https://github.com/aelxxs/actual-budget-tweaks/commit/c2a8d0c))

### 💅 Refactors

- Move the style settings to Theme → Style, with glow and grain for every theme in place of Ambient Glow and Ambient Grain ([4744bfc](https://github.com/aelxxs/actual-budget-tweaks/commit/4744bfc))
- Remove Hide Month Selection On Scroll ([cb6d705](https://github.com/aelxxs/actual-budget-tweaks/commit/cb6d705))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.105 ([e40425b](https://github.com/aelxxs/actual-budget-tweaks/commit/e40425b))
- Regenerate the features manifest for the closed accounts setting ([7c7d382](https://github.com/aelxxs/actual-budget-tweaks/commit/7c7d382))

### 🎨 Styles

- Simplify and pin settings toolbar ([9b32e2a](https://github.com/aelxxs/actual-budget-tweaks/commit/9b32e2a))
- Lay out the budget actions menu like ABT's other menus, and keep right-aligned popovers inside the window ([d09d64d](https://github.com/aelxxs/actual-budget-tweaks/commit/d09d64d))
- Shorten the budget header step by step and fill wrapped card rows ([42cdfa2](https://github.com/aelxxs/actual-budget-tweaks/commit/42cdfa2))
- Calm ABT's motion: a still error ring, faster rolling numbers, bars and card glows, and a reduced-motion flow bar ([63a32e8](https://github.com/aelxxs/actual-budget-tweaks/commit/63a32e8))
- Match Actual's text tooltips, like the titlebar's, to ABT's ([30ddb5f](https://github.com/aelxxs/actual-budget-tweaks/commit/30ddb5f))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.105

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.104...v0.1.105)

### 🚀 Enhancements

- Show account icons in the transaction table's Account column ([6cd72ab](https://github.com/aelxxs/actual-budget-tweaks/commit/6cd72ab))
- Arrange sidebar shortcuts in saved rows with live drag and drop ([34740c4](https://github.com/aelxxs/actual-budget-tweaks/commit/34740c4))
- Publish a nightly edge build of the sidecar ([4e8abe6](https://github.com/aelxxs/actual-budget-tweaks/commit/4e8abe6))
- Add tools, math, ABT pages and settings to the command palette ([b219ddc](https://github.com/aelxxs/actual-budget-tweaks/commit/b219ddc))
- Make shortcut tools draggable and keep the page usable behind them ([0238e12](https://github.com/aelxxs/actual-budget-tweaks/commit/0238e12))
- Reconcile an account from the command palette ([088f6af](https://github.com/aelxxs/actual-budget-tweaks/commit/088f6af))
- Add a guides section with a Modern Reconcile guide ([b826f1b](https://github.com/aelxxs/actual-budget-tweaks/commit/b826f1b))
- Add command palette and Live sidebar guides ([377742c](https://github.com/aelxxs/actual-budget-tweaks/commit/377742c))
- Add a Budget Insights guide and restage the command palette guide ([121eb70](https://github.com/aelxxs/actual-budget-tweaks/commit/121eb70))
- Add Sync recap and Transaction Inspector guides ([f41d371](https://github.com/aelxxs/actual-budget-tweaks/commit/f41d371))
- Refresh the home page demos with sidebar, palette, reconcile and budget cards ([eed42a7](https://github.com/aelxxs/actual-budget-tweaks/commit/eed42a7))
- Add a before and after hero slider and reseed the demo budget ([ee06ac0](https://github.com/aelxxs/actual-budget-tweaks/commit/ee06ac0))
- Rewrite the guides as short steps and add an annotated sidebar shot ([9adf93d](https://github.com/aelxxs/actual-budget-tweaks/commit/9adf93d))
- Add Ambient Glow and Ambient Grain style options ([a7e3a92](https://github.com/aelxxs/actual-budget-tweaks/commit/a7e3a92))
- Add Inset Panels style option ([6849c8c](https://github.com/aelxxs/actual-budget-tweaks/commit/6849c8c))
- Name the overspent category on the suggestion card and cover it from another category when To Budget is empty ([c584f30](https://github.com/aelxxs/actual-budget-tweaks/commit/c584f30))
- Flag category groups that hold overspent categories, even collapsed ([c5478ae](https://github.com/aelxxs/actual-budget-tweaks/commit/c5478ae))
- Add Taller Group Rows to set category groups apart from their categories ([7f5d308](https://github.com/aelxxs/actual-budget-tweaks/commit/7f5d308))
- Chart each month over or under budget in Insights, the running month by its pace ([7894c2d](https://github.com/aelxxs/actual-budget-tweaks/commit/7894c2d))
- Show how far the money held for next month lasts in Insights ([1aa67aa](https://github.com/aelxxs/actual-budget-tweaks/commit/1aa67aa))
- Reorder and hide Insights Overview cards from a menu linked to the panel ([4ff4c9e](https://github.com/aelxxs/actual-budget-tweaks/commit/4ff4c9e))
- Add Income and Money Moves cards to Insights Overview ([12cb4f8](https://github.com/aelxxs/actual-budget-tweaks/commit/12cb4f8))
- Show the update toast to sidecar users, and keep it to the top features and a count of fixes ([3d6bfaa](https://github.com/aelxxs/actual-budget-tweaks/commit/3d6bfaa))

### 🩹 Fixes

- Quiet new transactions in the Uncategorized view and as soon as they're marked ([805f653](https://github.com/aelxxs/actual-budget-tweaks/commit/805f653))
- Stop the sidecar loading ABT's stylesheets twice ([36f44f6](https://github.com/aelxxs/actual-budget-tweaks/commit/36f44f6))
- Stop hidden Insights overwriting the side panel title ([6de3fba](https://github.com/aelxxs/actual-budget-tweaks/commit/6de3fba))
- Center emoji account icons in the collapsed sidebar ([1816996](https://github.com/aelxxs/actual-budget-tweaks/commit/1816996))
- Show real cleared and uncleared amounts in the account hover card ([8bdde72](https://github.com/aelxxs/actual-budget-tweaks/commit/8bdde72))
- Keep syncing accounts' spinner steady when the account list reloads ([bf517b6](https://github.com/aelxxs/actual-budget-tweaks/commit/bf517b6))
- Paint the calendar's weekday row with the ambient glow and grain ([72f3d15](https://github.com/aelxxs/actual-budget-tweaks/commit/72f3d15))
- Keep the accounts panel and its shortcuts steady while it opens and closes ([e015046](https://github.com/aelxxs/actual-budget-tweaks/commit/e015046))
- Paint the Tweaks page with the ambient glow and grain ([2f30b26](https://github.com/aelxxs/actual-budget-tweaks/commit/2f30b26))
- Match the window's title bar to the applied ABT theme ([fbe8cb1](https://github.com/aelxxs/actual-budget-tweaks/commit/fbe8cb1))
- Keep the window's title bar on the theme when Actual sets it first ([3b15224](https://github.com/aelxxs/actual-budget-tweaks/commit/3b15224))
- Repaint the calendar's weekday row after a month slides in ([e74faeb](https://github.com/aelxxs/actual-budget-tweaks/commit/e74faeb))
- Re-measure shortcut tiles once when the sidebar's animation ends ([d9840b7](https://github.com/aelxxs/actual-budget-tweaks/commit/d9840b7))
- Keep the inset sidebar's border and corners whole with the accounts panel collapsed ([0aa7242](https://github.com/aelxxs/actual-budget-tweaks/commit/0aa7242))
- Restore the sidebar at its saved size from the first frame, without animating ([331ae54](https://github.com/aelxxs/actual-budget-tweaks/commit/331ae54))
- Count Insights goals the way Actual and Targets funded do ([732edb3](https://github.com/aelxxs/actual-budget-tweaks/commit/732edb3))
- Stop month changes counting as edits in Insights, and dim only slow refreshes ([958ef13](https://github.com/aelxxs/actual-budget-tweaks/commit/958ef13))
- Start the sidebar from what it showed last time, so it doesn't shift on load ([24f7437](https://github.com/aelxxs/actual-budget-tweaks/commit/24f7437))
- Don't open Insights under the calendar when reloading on it ([75f1a9d](https://github.com/aelxxs/actual-budget-tweaks/commit/75f1a9d))
- Keep the calendar's background and weekdays still while months slide, and show the first month without fading in ([53aaa97](https://github.com/aelxxs/actual-budget-tweaks/commit/53aaa97))
- Call the Money Moves card Reassigned, as Actual's notes do ([0335bd9](https://github.com/aelxxs/actual-budget-tweaks/commit/0335bd9))
- Give the Insights lifecycle test a watchValue stand-in ([085a939](https://github.com/aelxxs/actual-budget-tweaks/commit/085a939))
- Drag Insights cards with the pointer and keep the moved card and its edge in view ([aa52110](https://github.com/aelxxs/actual-budget-tweaks/commit/aa52110))
- Give calendar cells their solid table background again ([bb73c7c](https://github.com/aelxxs/actual-budget-tweaks/commit/bb73c7c))
- Give the calendar skeleton's cells their solid background again ([f1e85e3](https://github.com/aelxxs/actual-budget-tweaks/commit/f1e85e3))
- Skip the update toast on nightly edge builds ([d73d576](https://github.com/aelxxs/actual-budget-tweaks/commit/d73d576))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.104 ([96eef51](https://github.com/aelxxs/actual-budget-tweaks/commit/96eef51))
- Rewrite the website copy and correct its claims ([c55286a](https://github.com/aelxxs/actual-budget-tweaks/commit/c55286a))
- Generate annotated guide screenshots from a seeded budget ([61a372a](https://github.com/aelxxs/actual-budget-tweaks/commit/61a372a))
- Replace the README screenshots with the seeded demo budget ([2c9af4e](https://github.com/aelxxs/actual-budget-tweaks/commit/2c9af4e))
- Export the seeded demo budget with docs-shots --export ([16cb910](https://github.com/aelxxs/actual-budget-tweaks/commit/16cb910))

### 🎨 Styles

- Slim the sidebar search bar and shortcut tiles, and drop their hover tooltips ([071e3a0](https://github.com/aelxxs/actual-budget-tweaks/commit/071e3a0))
- Match the sidebar search bar's corners to the shortcut tiles ([c9cb86a](https://github.com/aelxxs/actual-budget-tweaks/commit/c9cb86a))
- Share the docs page styles with the privacy page ([52403d0](https://github.com/aelxxs/actual-budget-tweaks/commit/52403d0))
- Turn the guides page into preview cards and restage the reconcile shot ([9f77fa3](https://github.com/aelxxs/actual-budget-tweaks/commit/9f77fa3))
- Add entrance animations and a page glow to the website ([3b26a22](https://github.com/aelxxs/actual-budget-tweaks/commit/3b26a22))
- Restore the back arrow on website back links ([ca812bc](https://github.com/aelxxs/actual-budget-tweaks/commit/ca812bc))
- Remove the eyebrow line from the home page hero ([80bd624](https://github.com/aelxxs/actual-budget-tweaks/commit/80bd624))
- Fix the inset panel corners and put the resize line in the gap ([6cbb032](https://github.com/aelxxs/actual-budget-tweaks/commit/6cbb032))
- Keep the inset panels' top gap in a browser tab ([19f622a](https://github.com/aelxxs/actual-budget-tweaks/commit/19f622a))
- Brighten the budget table's headings, summary subtext and sidebar sub-groups ([9e363bb](https://github.com/aelxxs/actual-budget-tweaks/commit/9e363bb))
- Show uncategorized transactions in amber, as a to-do rather than an error ([54e255f](https://github.com/aelxxs/actual-budget-tweaks/commit/54e255f))
- Show a month near its whole budget as neutral, not green ([71fdc73](https://github.com/aelxxs/actual-budget-tweaks/commit/71fdc73))
- Drop italic from upcoming totals, scheduled rows and row notes ([9a3ea84](https://github.com/aelxxs/actual-budget-tweaks/commit/9a3ea84))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.104

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.103...v0.1.104)

### 🚀 Enhancements

- Show the summary row's budget actions in Insights Breakdown ([81f1793](https://github.com/aelxxs/actual-budget-tweaks/commit/81f1793))
- Show custom category icons in the transaction table and dropdowns ([2ea16fd](https://github.com/aelxxs/actual-budget-tweaks/commit/2ea16fd))

### 🩹 Fixes

- Apply the Income Breakdown widget's end date ([b8589b2](https://github.com/aelxxs/actual-budget-tweaks/commit/b8589b2))
- Fund targets only from To Budget, never from other categories ([cce9425](https://github.com/aelxxs/actual-budget-tweaks/commit/cce9425))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.103 ([4e10979](https://github.com/aelxxs/actual-budget-tweaks/commit/4e10979))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>
- Andy Su <andysu1551@gmail.com>

## v0.1.103

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.102...v0.1.103)

### 🚀 Enhancements

- Store sidebar account groups in Actual's budget when it supports them ([64cda29](https://github.com/aelxxs/actual-budget-tweaks/commit/64cda29))
- Reorder account groups by dragging in the sidebar and the groups dialog ([de3ac70](https://github.com/aelxxs/actual-budget-tweaks/commit/de3ac70))
- Follow Actual's sidebar page order and visibility in the live sidebar ([8e57b38](https://github.com/aelxxs/actual-budget-tweaks/commit/8e57b38))
- Unlock budget months as soon as Actual extends its range ([fd936ab](https://github.com/aelxxs/actual-budget-tweaks/commit/fd936ab))
- Hide the goal funding section when Actual shows its own goal status ([2af68f5](https://github.com/aelxxs/actual-budget-tweaks/commit/2af68f5))

### 🩹 Fixes

- Suggest Apply whenever it would add money, and count past months' moved-out targets as met ([7d76348](https://github.com/aelxxs/actual-budget-tweaks/commit/7d76348))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.102 ([5519d40](https://github.com/aelxxs/actual-budget-tweaks/commit/5519d40))
- Update branding images ([96ad66a](https://github.com/aelxxs/actual-budget-tweaks/commit/96ad66a))
- Regenerate features manifest ([d655c9e](https://github.com/aelxxs/actual-budget-tweaks/commit/d655c9e))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.102

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.101...v0.1.102)

### 🚀 Enhancements

- Show where the month's money went, whether next month is covered, and spent against budgeted in Insights ([02ff887](https://github.com/aelxxs/actual-budget-tweaks/commit/02ff887))
- Suggest applying templates in Budget Actions for months they haven't run ([b5c88c8](https://github.com/aelxxs/actual-budget-tweaks/commit/b5c88c8))
- Split the next month bar into what's needed and what's spare ([4a56b92](https://github.com/aelxxs/actual-budget-tweaks/commit/4a56b92))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.101 ([b3e89c7](https://github.com/aelxxs/actual-budget-tweaks/commit/b3e89c7))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.101

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.100...v0.1.101)

### 🚀 Enhancements

- Make month header, month cards and category filter stable ([4c21b64](https://github.com/aelxxs/actual-budget-tweaks/commit/4c21b64))
- Celebrate a finished reconcile with confetti ([a14bd8b](https://github.com/aelxxs/actual-budget-tweaks/commit/a14bd8b))
- Show balance pills for categories without templates ([385cfd7](https://github.com/aelxxs/actual-budget-tweaks/commit/385cfd7))
- Add schedule icon details with a hover card per schedule ([673e03f](https://github.com/aelxxs/actual-budget-tweaks/commit/673e03f))
- Show category template and notes icons on hover ([9319e11](https://github.com/aelxxs/actual-budget-tweaks/commit/9319e11))
- List schedule icon details and quiet category icons in budget settings ([7b3823c](https://github.com/aelxxs/actual-budget-tweaks/commit/7b3823c))
- Highlight the hovered budget row ([9b61c75](https://github.com/aelxxs/actual-budget-tweaks/commit/9b61c75))
- Explain target shortfalls caused by moving money ([9e74e2c](https://github.com/aelxxs/actual-budget-tweaks/commit/9e74e2c))
- List goal funding in budget settings ([883d710](https://github.com/aelxxs/actual-budget-tweaks/commit/883d710))
- Show spending pace and next month's readiness in Insights as two simpler cards ([9152b20](https://github.com/aelxxs/actual-budget-tweaks/commit/9152b20))

### 🩹 Fixes

- Show scheduled transfers in the calendar when only their payee account is shown ([be85bcb](https://github.com/aelxxs/actual-budget-tweaks/commit/be85bcb))
- Keep the status colours of schedule icons in the budget table ([85523c6](https://github.com/aelxxs/actual-budget-tweaks/commit/85523c6))
- Set the budget type attribute only on Actual pages ([3097ab3](https://github.com/aelxxs/actual-budget-tweaks/commit/3097ab3))
- Mirror Actual's live sync status under the budget name ([ddf0f7c](https://github.com/aelxxs/actual-budget-tweaks/commit/ddf0f7c))
- Call the filter's funded pill "On track" ([ed61e72](https://github.com/aelxxs/actual-budget-tweaks/commit/ed61e72))

### 💅 Refactors

- Read computed styles only when the sync button or notes buttons change ([3a0992a](https://github.com/aelxxs/actual-budget-tweaks/commit/3a0992a))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.100 ([a92d4ea](https://github.com/aelxxs/actual-budget-tweaks/commit/a92d4ea))
- Release by hand, after CI and the smoke test pass ([277265d](https://github.com/aelxxs/actual-budget-tweaks/commit/277265d))
- Note why group balance colours stay always on ([4137c69](https://github.com/aelxxs/actual-budget-tweaks/commit/4137c69))

### 🎨 Styles

- Sort quiet category icons imports ([ed43564](https://github.com/aelxxs/actual-budget-tweaks/commit/ed43564))
- Align To Budget's label with the other cards and give Budget Actions a hover ([8067b45](https://github.com/aelxxs/actual-budget-tweaks/commit/8067b45))
- Move the category width toggle beside the header icons and match the category label to the totals labels ([84451c0](https://github.com/aelxxs/actual-budget-tweaks/commit/84451c0))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.100

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.99...v0.1.100)

### 💅 Refactors

- Centralize Actual's test ids and check them in the smoke test ([6b25580](https://github.com/aelxxs/actual-budget-tweaks/commit/6b25580))
- Move Actual's roles, links, layout and cell selectors into actual-dom ([8a69bf3](https://github.com/aelxxs/actual-budget-tweaks/commit/8a69bf3))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.99 ([53d4856](https://github.com/aelxxs/actual-budget-tweaks/commit/53d4856))
- Gate releases on CI and smoke test ABT against Actual latest and edge ([973ec53](https://github.com/aelxxs/actual-budget-tweaks/commit/973ec53))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.99

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.98...v0.1.99)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.98 ([8dd308c](https://github.com/aelxxs/actual-budget-tweaks/commit/8dd308c))
- Add a privacy policy page to the website ([f0e6a8d](https://github.com/aelxxs/actual-budget-tweaks/commit/f0e6a8d))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.98

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.97...v0.1.98)

### 🩹 Fixes

- Keep accounts visible in the live sidebar when their group is in the other section ([58c7926](https://github.com/aelxxs/actual-budget-tweaks/commit/58c7926))
- Let the month picker step forward from years before the budget starts ([71cff66](https://github.com/aelxxs/actual-budget-tweaks/commit/71cff66))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.97 ([b6a5fba](https://github.com/aelxxs/actual-budget-tweaks/commit/b6a5fba))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.97

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.96...v0.1.97)

### 🚀 Enhancements

- Keep the spending calendar open across reloads with a #calendar address ([3fff459](https://github.com/aelxxs/actual-budget-tweaks/commit/3fff459))
- Give Actual's settings nav the live sidebar's icons ([6074d99](https://github.com/aelxxs/actual-budget-tweaks/commit/6074d99))
- Move ABT's settings into a Tweaks tab on Actual's paged settings ([b32a0a6](https://github.com/aelxxs/actual-budget-tweaks/commit/b32a0a6))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.96 ([695fb3a](https://github.com/aelxxs/actual-budget-tweaks/commit/695fb3a))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.96

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.95...v0.1.96)

### 🚀 Enhancements

- Show collapsed account groups as folders in the sidebar rail ([2cb1937](https://github.com/aelxxs/actual-budget-tweaks/commit/2cb1937))
- Slide month count options in and out as they change ([12a5a35](https://github.com/aelxxs/actual-budget-tweaks/commit/12a5a35))
- List only the settings that run in the current view, and keep Privacy Style to desktop ([c9fc2dd](https://github.com/aelxxs/actual-budget-tweaks/commit/c9fc2dd))
- Snap the side panel open ([6d8ca42](https://github.com/aelxxs/actual-budget-tweaks/commit/6d8ca42))
- Keep each person's ABT look and feel to themselves on a shared budget ([a4f1003](https://github.com/aelxxs/actual-budget-tweaks/commit/a4f1003))

### 🩹 Fixes

- Set the scrollbar colour where its tint changes, not on every element ([8b63637](https://github.com/aelxxs/actual-budget-tweaks/commit/8b63637))
- Re-read only the budget categories that changed, and don't let reads pile up while a large budget loads ([e2caa8e](https://github.com/aelxxs/actual-budget-tweaks/commit/e2caa8e))
- Cut per-frame work on the budget and transaction pages ([57f9a7d](https://github.com/aelxxs/actual-budget-tweaks/commit/57f9a7d))
- Keep the calendar day's balance right-aligned while privacy mode hides it ([54ef262](https://github.com/aelxxs/actual-budget-tweaks/commit/54ef262))
- Keep each page's markers until Actual swaps the page, not when the path changes ([04ff23c](https://github.com/aelxxs/actual-budget-tweaks/commit/04ff23c))
- Reopen Insights only once the budget page has rendered ([1ea7b17](https://github.com/aelxxs/actual-budget-tweaks/commit/1ea7b17))
- Slide the sidebar over the budget and reports pages, so they re-lay out once ([0336ea4](https://github.com/aelxxs/actual-budget-tweaks/commit/0336ea4))
- Size the budget table to the page in CSS, so it doesn't centre for a frame on resize ([934767e](https://github.com/aelxxs/actual-budget-tweaks/commit/934767e))
- Separate the month count animation's fade from the slide's last declaration ([78a9977](https://github.com/aelxxs/actual-budget-tweaks/commit/78a9977))
- Hide the sidebar tooltip outside Svelte's render when a focused button is removed ([942f7e0](https://github.com/aelxxs/actual-budget-tweaks/commit/942f7e0))
- Refresh the sidecar's app shell in browsers that cached Actual without it ([804dda6](https://github.com/aelxxs/actual-budget-tweaks/commit/804dda6))

### 💅 Refactors

- Share one route signal across the sidebar instead of a DOM watcher per row ([d4bfd04](https://github.com/aelxxs/actual-budget-tweaks/commit/d4bfd04))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.95 ([71d6dc0](https://github.com/aelxxs/actual-budget-tweaks/commit/71d6dc0))
- Add dev-only timings for DOM watchers and stylesheets ([386bd18](https://github.com/aelxxs/actual-budget-tweaks/commit/386bd18))
- Add a huge preset to the test budget generator ([4948655](https://github.com/aelxxs/actual-budget-tweaks/commit/4948655))
- Count bridge requests in the dev timings ([c3fdfe8](https://github.com/aelxxs/actual-budget-tweaks/commit/c3fdfe8))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.95

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.94...v0.1.95)

### 🚀 Enhancements

- Show account icons on Actual's mobile accounts list ([e125614](https://github.com/aelxxs/actual-budget-tweaks/commit/e125614))
- Add a mobile accounts list with sidebar groups, icons and totals ([4607e33](https://github.com/aelxxs/actual-budget-tweaks/commit/4607e33))
- Add mobile page transitions: fade, slide up or zoom ([305e6cf](https://github.com/aelxxs/actual-budget-tweaks/commit/305e6cf))

### 🩹 Fixes

- Ignore malformed bridge events instead of throwing ([ba9b577](https://github.com/aelxxs/actual-budget-tweaks/commit/ba9b577))
- Keep the mobile account sync dot before the name ([0b52f58](https://github.com/aelxxs/actual-budget-tweaks/commit/0b52f58))
- Register scaffolded features in their settings section, mobile included ([e11aaf9](https://github.com/aelxxs/actual-budget-tweaks/commit/e11aaf9))
- Fill the space under iOS's keyboard with the sheet's colour ([2cf1e24](https://github.com/aelxxs/actual-budget-tweaks/commit/2cf1e24))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.94 ([d242704](https://github.com/aelxxs/actual-budget-tweaks/commit/d242704))
- Describe the mobile tweaks on the website and in the contributing guide ([1e4c3f9](https://github.com/aelxxs/actual-budget-tweaks/commit/1e4c3f9))
- Refresh the website's feature list ([e73b13d](https://github.com/aelxxs/actual-budget-tweaks/commit/e73b13d))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.94

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.93...v0.1.94)

### 🚀 Enhancements

- List on-budget transfers in the calendar when only one side is shown ([d2500f1](https://github.com/aelxxs/actual-budget-tweaks/commit/d2500f1))
- Add a balance sparkline and spending split to the calendar's day view ([76a7674](https://github.com/aelxxs/actual-budget-tweaks/commit/76a7674))
- Add mobile tweaks for the tab bar, header, cards, banners, sheets, toasts and transactions ([f461425](https://github.com/aelxxs/actual-budget-tweaks/commit/f461425))
- Style tags in the mobile transaction list ([d5a8856](https://github.com/aelxxs/actual-budget-tweaks/commit/d5a8856))

### 🩹 Fixes

- Hide amounts' decimals when Actual's Hide decimal places is on ([0564010](https://github.com/aelxxs/actual-budget-tweaks/commit/0564010))
- Show sidebar shortcuts as soon as the budget is known, without the add animation ([9c3742c](https://github.com/aelxxs/actual-budget-tweaks/commit/9c3742c))

### 💅 Refactors

- Let settings target Actual's desktop view, mobile view or both ([a4f3d39](https://github.com/aelxxs/actual-budget-tweaks/commit/a4f3d39))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.93 ([07dea92](https://github.com/aelxxs/actual-budget-tweaks/commit/07dea92))

### 🎨 Styles

- Give the mobile page and header the desktop page's colour ([7807983](https://github.com/aelxxs/actual-budget-tweaks/commit/7807983))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.93

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.92...v0.1.93)

### 🚀 Enhancements

- Stand envelope-only features down on tracking budgets ([61e96a0](https://github.com/aelxxs/actual-budget-tweaks/commit/61e96a0))
- Month cards for tracking budgets ([36ff3e4](https://github.com/aelxxs/actual-budget-tweaks/commit/36ff3e4))
- Follow Actual's account, category and payee changes as they happen ([1bdc9b4](https://github.com/aelxxs/actual-budget-tweaks/commit/1bdc9b4))

### 🩹 Fixes

- Keep account icons when an account moves to another group ([01d1ee8](https://github.com/aelxxs/actual-budget-tweaks/commit/01d1ee8))
- Bring the template plan tests up to date ([753c102](https://github.com/aelxxs/actual-budget-tweaks/commit/753c102))
- Pause stock and RSU refreshes while the tab is hidden ([d788006](https://github.com/aelxxs/actual-budget-tweaks/commit/d788006))
- Show Income Breakdown's load error as text, not HTML ([81db538](https://github.com/aelxxs/actual-budget-tweaks/commit/81db538))
- Give interactive elements real roles instead of hiding a11y warnings ([843b10f](https://github.com/aelxxs/actual-budget-tweaks/commit/843b10f))
- Keep settings section refs reactive ([81b3532](https://github.com/aelxxs/actual-budget-tweaks/commit/81b3532))

### 💅 Refactors

- Route console warnings through the scoped logger ([b94f451](https://github.com/aelxxs/actual-budget-tweaks/commit/b94f451))
- Group stray files with their features ([085fd3f](https://github.com/aelxxs/actual-budget-tweaks/commit/085fd3f))
- Seed local state with writable $derived instead of ignoring the warning ([36ea544](https://github.com/aelxxs/actual-budget-tweaks/commit/36ea544))
- Rebuild Income Breakdown as a content-script feature ([c363ffc](https://github.com/aelxxs/actual-budget-tweaks/commit/c363ffc))
- Drop the account type Actual no longer sets ([2052f12](https://github.com/aelxxs/actual-budget-tweaks/commit/2052f12))
- Take bank sync state from Actual's store, not its sidebar ([73c950c](https://github.com/aelxxs/actual-budget-tweaks/commit/73c950c))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.92 ([9136aff](https://github.com/aelxxs/actual-budget-tweaks/commit/9136aff))
- Enforce braces on every if ([198b03a](https://github.com/aelxxs/actual-budget-tweaks/commit/198b03a))
- Refresh the website's feature list ([b970d15](https://github.com/aelxxs/actual-budget-tweaks/commit/b970d15))
- Move from deprecated lucide-svelte to @lucide/svelte ([b386aa5](https://github.com/aelxxs/actual-budget-tweaks/commit/b386aa5))
- Update Svelte and lint tooling ([694b0a0](https://github.com/aelxxs/actual-budget-tweaks/commit/694b0a0))

### 🎨 Styles

- Brace every if ([9f8f1f2](https://github.com/aelxxs/actual-budget-tweaks/commit/9f8f1f2))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.92

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.91...v0.1.92)

### 🚀 Enhancements

- Filter the calendar by account, category, flow and scheduled bills ([497c9dc](https://github.com/aelxxs/actual-budget-tweaks/commit/497c9dc))
- Show each day's balance on the calendar for the accounts shown ([44ee051](https://github.com/aelxxs/actual-budget-tweaks/commit/44ee051))
- Edit a scheduled bill from the calendar's day panel ([ed1975d](https://github.com/aelxxs/actual-budget-tweaks/commit/ed1975d))

### 🩹 Fixes

- Let Escape leave the calendar open, like any other page ([1eb07fa](https://github.com/aelxxs/actual-budget-tweaks/commit/1eb07fa))
- Keep ABT's dashboard styling off single reports ([81dcb14](https://github.com/aelxxs/actual-budget-tweaks/commit/81dcb14))
- Count uncategorized transactions as Actual does, not split parents ([bbc1049](https://github.com/aelxxs/actual-budget-tweaks/commit/bbc1049))
- Show live sidebar balances for accounts in collapsed native groups ([ac7022d](https://github.com/aelxxs/actual-budget-tweaks/commit/ac7022d))

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.91 ([c1f4819](https://github.com/aelxxs/actual-budget-tweaks/commit/c1f4819))

### 🎨 Styles

- Match the calendar's month button and weekday bar to the page ([46c18e6](https://github.com/aelxxs/actual-budget-tweaks/commit/46c18e6))

### ❤️ Contributors

- Alexis Vielma <alexis.vielma.us@gmail.com>

## v0.1.91

[compare changes](https://github.com/aelxxs/actual-budget-tweaks/compare/v0.1.90...v0.1.91)

### 🏡 Chore

- Update Firefox auto-update manifest for v0.1.90 ([f95b812](https://github.com/aelxxs/actual-budget-tweaks/commit/f95b812))

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

