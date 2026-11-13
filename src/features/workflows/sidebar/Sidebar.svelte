<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import {
		accountIconPicker,
		loadIconCache,
		watchAccountIcons,
	} from "@features/appearance/account-icon-picker";
	import { sidebarSearch } from "@features/appearance/sidebar-search";
	import { sidebarShortcuts } from "@features/appearance/sidebar-shortcuts";
	import { loadCurrentBudgetId, onListChange, onSyncingAccounts } from "@lib/utilities/actual-api";
	import { loadCurrency } from "@lib/utilities/currency";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { createLogger } from "@lib/utilities/logger";
	import { getValue, removeValue, setValue } from "@lib/utilities/store";
	import { lastShown, rememberShown } from "@lib/utilities/last-shown";
	import { Search, SlidersHorizontal } from "@lucide/svelte";
	import { onMount, untrack } from "svelte";
	import ShortcutsBar from "../../appearance/sidebar-shortcuts/ShortcutsBar.svelte";
	import { portal } from "./actions/portal";
	import AccountList from "./components/AccountList.svelte";
	import AccountListSkeleton from "./components/AccountListSkeleton.svelte";
	import BudgetHeader from "./components/BudgetHeader.svelte";
	import CommandPalette from "./components/CommandPalette.svelte";
	import CustomizePanel from "./components/CustomizePanel.svelte";
	import Footer from "./components/Footer.svelte";
	import PrimaryNav from "./components/PrimaryNav.svelte";
	import Rail from "./components/Rail.svelte";
	import { invalidateAccountDetail } from "./lib/account-detail";
	import { customizeSidebar, customizeState, finishCustomizing } from "./lib/customize.svelte";
	import { loadCurrentBudgetName } from "./lib/budgets";
	import {
		adoptOldCollapsed,
		isSidebarCollapsed,
		setSidebarCollapsed,
		undoAutoCollapse,
		watchSidebarCollapsed,
	} from "./lib/collapse";
	import type { SidebarAccount } from "./lib/data";
	import {
		closeAccount,
		loadSidebarAccounts,
		NATIVE_ROOT_ATTR,
		readNativeAccountBalanceTexts,
		readNativeTotalsText,
		readNativeUncategorizedButtonText,
		refreshBalances,
		refreshSyncStatuses,
		refreshUncategorizedCounts,
		renameAccount,
	} from "./lib/data";
	import { LAYOUT_KEY, toLayout, type SidebarLayout } from "./lib/layout";
	import { isMac } from "./lib/search";
	import "./styles/layout.css";
	import "./styles/shared.css";

	const log = createLogger("sidebar");

	let paletteRef: CommandPalette | undefined = $state();
	function openPalette(): void {
		paletteRef?.openPalette();
	}

	// The last load's accounts and name show until this one's arrive, so nothing shifts as they do.
	const shownAccounts = lastShown<SidebarAccount[]>("sidebar-accounts", []);
	let accounts = $state(shownAccounts);
	let loading = $state(shownAccounts.length === 0);
	let failed = $state(false);
	let budgetName = $state(lastShown("sidebar-budget-name", "Budget"));
	let budgetId = $state<string | undefined>(undefined);
	// Set once the open budget's id has been asked for, so its groups and order load for it alone.
	let budgetReady = $state(false);

	let icons = $state<Record<string, AccountIconData>>({});

	// ---- grouped (sub-categories) vs flat accounts list ----
	const GROUP_MODE_KEY = "experimental-sidebar-group-mode";
	let groupAccounts = $state(lastShown("sidebar-group-mode", true));

	function toggleGroupMode() {
		groupAccounts = !groupAccounts;
		setValue(GROUP_MODE_KEY, groupAccounts);
	}

	// ---- collapsed rail ----
	const RAIL_WIDTH = "4rem"; // matches .activity-bar's width in styles/layout.css
	let collapsed = $state(isSidebarCollapsed());

	$effect(() => watchSidebarCollapsed((v) => (collapsed = v)));
	$effect(() => watchAccountIcons((v) => (icons = v)));

	// Narrow windows show just the rail; opening it there doesn't change the saved choice.
	const NARROW_QUERY = "(max-width: 960px)";
	let narrow = $state(false);
	let openWhileNarrow = $state(false);
	const isCollapsed = $derived(narrow ? !openWhileNarrow : collapsed);
	$effect(() => {
		const mq = window.matchMedia(NARROW_QUERY);
		const update = () => {
			narrow = mq.matches;
			openWhileNarrow = false;
		};
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	});

	function expandSidebar() {
		if (narrow) {
			openWhileNarrow = true;
			return;
		}
		setSidebarCollapsed(false);
	}
	function collapseSidebar() {
		if (narrow) {
			openWhileNarrow = false;
			return;
		}
		setSidebarCollapsed(true);
	}

	// ---- layout: "standard" (text nav + accounts, the original design) vs
	// "split" (icon-only activity bar + a dedicated accounts panel). Chosen
	// from the extension settings (see ./layout) ----
	const ACTIVITY_BAR_WIDTH = RAIL_WIDTH;
	let layoutMode = $state<SidebarLayout>(toLayout(lastShown("sidebar-layout", "split")));

	// ---- resize ----
	const MIN_WIDTH = 240;
	const MAX_WIDTH = 560;
	// Split's accounts panel sits beside the rail, so it needs less than the single column.
	const defaultWidth = (mode: SidebarLayout) => (mode === "split" ? 260 : 325);
	// In the page's own storage, like Actual's sidebar width: read synchronously, so the first frame
	// is already the saved size. Per browser, as it was in the extension's storage.
	const WIDTH_KEY = "abt-sidebar-width";
	const OLD_WIDTH_KEY = "experimental-sidebar-width";
	function readWidth(): number | null {
		try {
			const width = Number(localStorage.getItem(WIDTH_KEY));
			return width > 0 ? width : null;
		} catch {
			return null;
		}
	}
	function saveWidth(width: number): void {
		try {
			localStorage.setItem(WIDTH_KEY, String(width));
		} catch {
			// Kept for this page, just not remembered.
		}
	}
	let sidebarWidth = $state(readWidth() ?? defaultWidth("split"));
	// Until the user sizes it, the width follows the layout's default.
	let widthStored = readWidth() !== null;
	// total on-screen width covers both modes: the classic single-column
	// rail/expanded sidebar, and split mode's fixed activity bar plus its
	// optional (collapsible) resizable accounts panel.
	const sidebarTotalWidth = $derived(
		layoutMode === "split"
			? isCollapsed
				? ACTIVITY_BAR_WIDTH
				: `calc(${ACTIVITY_BAR_WIDTH} + ${sidebarWidth}px)`
			: isCollapsed
				? RAIL_WIDTH
				: `${sidebarWidth}px`,
	);
	let resizing = $state(false);

	let dragStartX = 0;
	let dragStartWidth = 0;

	function startResize(e: PointerEvent) {
		resizing = true;
		dragStartX = e.clientX;
		dragStartWidth = sidebarWidth;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* synthetic events may lack a capturable pointer id */
		}
	}
	function onResizeMove(e: PointerEvent) {
		if (!resizing) {
			return;
		}
		const next = dragStartWidth + (e.clientX - dragStartX);
		sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
	}
	function endResize(e: PointerEvent) {
		if (!resizing) {
			return;
		}
		resizing = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
		widthStored = true;
		saveWidth(sidebarWidth);
	}
	function resetWidth() {
		sidebarWidth = defaultWidth(layoutMode);
		saveWidth(sidebarWidth);
	}

	let sidebarEl: HTMLDivElement | undefined = $state();

	// The features' own keys and defaults, so a changed default reaches the Live sidebar too.
	const { key: SEARCH_KEY, defaultValue: SEARCH_DEFAULT } = sidebarSearch.context;
	const { key: SHORTCUTS_KEY, defaultValue: SHORTCUTS_DEFAULT } = sidebarShortcuts.context;
	const { key: ICONS_KEY, defaultValue: ICONS_DEFAULT } = accountIconPicker.context;

	let shortcutsFeatureEnabled = $state(lastShown("sidebar-shortcuts-on", SHORTCUTS_DEFAULT));
	let searchEnabled = $state(lastShown("sidebar-search-on", SEARCH_DEFAULT));
	let iconsEnabled = $state(ICONS_DEFAULT);
	$effect(() => {
		rememberShown("sidebar-shortcuts-on", shortcutsFeatureEnabled);
		rememberShown("sidebar-search-on", searchEnabled);
		rememberShown("sidebar-group-mode", groupAccounts);
		rememberShown("sidebar-layout", layoutMode);
		rememberShown("sidebar-budget-name", budgetName);
	});
	$effect(() => {
		if (!loading) {
			rememberShown("sidebar-accounts", $state.snapshot(accounts));
		}
	});
	const shownIcons = $derived(iconsEnabled ? icons : {});

	$effect(() => {
		getValue<boolean>(SHORTCUTS_KEY, SHORTCUTS_DEFAULT).then((v) => (shortcutsFeatureEnabled = v));
		getValue<boolean>(SEARCH_KEY, SEARCH_DEFAULT).then((v) => (searchEnabled = v));
		getValue<boolean>(ICONS_KEY, ICONS_DEFAULT).then((v) => (iconsEnabled = v));

		const onStorageChange = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
			if (areaName !== "local") {
				return;
			}
			if (`local:${SHORTCUTS_KEY}` in changes) {
				shortcutsFeatureEnabled = Boolean(
					changes[`local:${SHORTCUTS_KEY}`].newValue ?? SHORTCUTS_DEFAULT,
				);
			}
			if (`local:${SEARCH_KEY}` in changes) {
				searchEnabled = Boolean(changes[`local:${SEARCH_KEY}`].newValue ?? SEARCH_DEFAULT);
			}
			if (`local:${ICONS_KEY}` in changes) {
				iconsEnabled = Boolean(changes[`local:${ICONS_KEY}`].newValue ?? ICONS_DEFAULT);
			}
			if (`local:${LAYOUT_KEY}` in changes) {
				layoutMode = toLayout(changes[`local:${LAYOUT_KEY}`].newValue);
				if (!widthStored) {
					sidebarWidth = defaultWidth(layoutMode);
				}
			}
		};
		browser.storage.onChanged.addListener(onStorageChange);
		return () => browser.storage.onChanged.removeListener(onStorageChange);
	});

	// Which accounts are syncing comes from Actual's store; how each sync ended (ok, or which
	// error) is saved to the account, so it's read back once one finishes.
	let syncingIds = new Set<string>();

	// The table still says "ok" for an account mid-sync, so a reload would flip it back and
	// restart its spinner.
	function withSyncing(list: SidebarAccount[]): SidebarAccount[] {
		for (const account of list) {
			if (syncingIds.has(account.id)) {
				account.status = "syncing";
			}
		}
		return list;
	}

	$effect(() =>
		onSyncingAccounts((nowSyncing) => {
			for (const account of accounts) {
				if (nowSyncing.has(account.id) && account.status !== "syncing") {
					account.status = "syncing";
				}
			}
			const finished = accounts.filter((a) => syncingIds.has(a.id) && !nowSyncing.has(a.id));
			if (finished.length) {
				refreshSyncStatuses(finished).then((changed) => {
					for (const id of changed) {
						invalidateAccountDetail(id);
					}
				});
				// A sync brings in transactions, some without categories.
				refreshUncategorizedCounts(finished);
			}
			syncingIds = nowSyncing;
		}),
	);

	// This bridge has no push event for "a transaction was (un)categorized"
	// either — same shape as the syncing-status effect above, but keyed off
	// Actual's own native "N uncategorized transactions" call-to-action
	// button instead of the sync dot, since categorizing a transaction
	// doesn't touch that at all — reusing the same shared body-level
	// watchDom observer.
	let lastUncatButtonText = "";

	$effect(() => {
		return watchDom(() => {
			const text = readNativeUncategorizedButtonText();
			if (text === lastUncatButtonText) {
				return;
			}
			lastUncatButtonText = text;
			refreshUncategorizedCounts(accounts);
		});
	});

	// Each account's native balance text when we last read its balance. An account counts as
	// changed the first time it's seen too, since the first load can run before the sheet is ready.
	const lastBalanceTexts = new Map<string, string>();
	// Accounts in a collapsed native group have no row to watch, so a change to the native
	// totals re-reads them instead.
	let lastTotalsText = "";

	// While Actual fills a large budget's balances each one is a change; a check still reading
	// holds the next back, which then runs once with everything that changed meanwhile.
	let checking = false;
	let recheck = false;

	function checkBalances() {
		if (checking) {
			recheck = true;
			return;
		}
		const nowTexts = readNativeAccountBalanceTexts();
		const totals = readNativeTotalsText();
		const totalsChanged = totals !== lastTotalsText;
		lastTotalsText = totals;
		const changedAccounts = accounts.filter((a) => {
			const text = nowTexts.get(a.id);
			if (text === undefined) {
				return totalsChanged;
			}
			return lastBalanceTexts.get(a.id) !== text;
		});
		const withRows = new Set(nowTexts.keys());
		if (!changedAccounts.length) {
			return;
		}
		for (const a of changedAccounts) {
			const text = nowTexts.get(a.id);
			if (text !== undefined) {
				lastBalanceTexts.set(a.id, text);
			}
		}
		checking = true;
		refreshBalances(changedAccounts, withRows)
			.then(({ changed, failed }) => {
				for (const id of changed) {
					invalidateAccountDetail(id);
				}
				// Forgotten, so the next DOM change tries again.
				for (const id of failed) {
					lastBalanceTexts.delete(id);
				}
				if (failed.some((id) => !nowTexts.has(id))) {
					lastTotalsText = "";
				}
			})
			.finally(() => {
				checking = false;
				if (recheck) {
					recheck = false;
					checkBalances();
				}
			});
	}

	// Actual rewrites a balance's text in place, which the page-wide watcher (new elements only)
	// misses, so the native sidebar gets its own watcher for text; the page one only finds it.
	$effect(() => {
		let root: Element | null = null;
		let stopRoot: (() => void) | null = null;
		const stopPage = watchDom(() => {
			const current = document.querySelector(`[${NATIVE_ROOT_ATTR}]`);
			if (current === root) {
				// Without the native sidebar marked, fall back to checking on every page change.
				if (!root) {
					checkBalances();
				}
				return;
			}
			stopRoot?.();
			root = current;
			// Checks once on attaching, then on each change inside it.
			stopRoot = root
				? watchDom(checkBalances, root, { childList: true, subtree: true, characterData: true })
				: null;
		});
		return () => {
			stopPage();
			stopRoot?.();
		};
	});

	// This sidebar persists across a budget switch (never remounts), so
	// budgetName/budgetId need an explicit refresh on switch — BudgetHeader
	// calls this once selectBudgetFile() resolves (see its onBudgetChange
	// prop). budgetId flows down to AccountList, which scopes its
	// groups/order storage by it (see lib/groups.ts, lib/order.ts) — account
	// ids aren't unique across budget files, and without that scoping,
	// switching budgets kept showing the previous budget's categories, now
	// empty since none of the new budget's accounts are assigned to them.
	async function refreshBudgetContext() {
		await Promise.all([
			loadCurrency(true),
			loadCurrentBudgetName().then((name) => (budgetName = name)),
			// Shortcuts and groups wait on the id alone, so it isn't held back by the rest.
			loadCurrentBudgetId()
				.then((id) => (budgetId = id))
				.finally(() => (budgetReady = true)),
		]);
	}

	// Real, direct RPC (see data.ts) — safe to update the local list optimistically.
	async function handleRenameAccount(accountId: string, name: string) {
		await renameAccount(accountId, name);
		const account = accounts.find((a) => a.id === accountId);
		if (account) {
			account.name = name;
		}
	}

	let reloadSeq = 0;
	async function reloadAccounts() {
		const seq = ++reloadSeq;
		const loaded = await loadSidebarAccounts(accounts);
		// A later reload may have finished first; its list is newer.
		if (seq !== reloadSeq) {
			return;
		}
		accounts = withSyncing(loaded);
		await refreshUncategorizedCounts(accounts);
	}

	// Any change to the accounts table: Actual's own UI, a bank sync, another device, or closing
	// one through Actual's modal from here.
	$effect(() => onListChange("accounts", () => void reloadAccounts()));

	onMount(async () => {
		await undoAutoCollapse();
		const [oldWidth, storedGroupMode, storedLayoutMode, loadedIcons] = await Promise.all([
			// Saved in the extension's storage before; moved here once.
			getValue<number | null>(OLD_WIDTH_KEY, null),
			getValue<boolean>(GROUP_MODE_KEY, true),
			getValue<unknown>(LAYOUT_KEY, "split"),
			loadIconCache(),
			adoptOldCollapsed(),
		]);
		if (oldWidth != null) {
			saveWidth(oldWidth);
			void removeValue(OLD_WIDTH_KEY);
		}
		groupAccounts = storedGroupMode;
		layoutMode = toLayout(storedLayoutMode);
		const stored = readWidth();
		widthStored = stored !== null;
		sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, stored ?? defaultWidth(layoutMode)));
		icons = loadedIcons;

		try {
			const [, , loadedAccounts] = await Promise.all([
				loadCurrency(),
				refreshBudgetContext(),
				loadSidebarAccounts(),
			]);
			accounts = withSyncing(loadedAccounts);
			loading = false;
			await refreshUncategorizedCounts(accounts);
		} catch (err) {
			log.error("failed to load live data", err);
			if (loading) {
				failed = true;
			}
		} finally {
			loading = false;
		}
	});

	// Right-click anywhere without a menu of its own (accounts and groups stop the event).
	let settingsMenu = $state<{ x: number; y: number } | null>(null);

	function openSettingsMenu(e: MouseEvent) {
		if ((e.target as Element).closest("input, textarea")) {
			return;
		}
		e.preventDefault();
		settingsMenu = {
			x: Math.min(e.clientX, window.innerWidth - 208),
			y: Math.min(e.clientY, window.innerHeight - 120),
		};
	}

	const editing = $derived(customizeState.editing);
	// Edit mode works on the full sidebar, so a collapsed one opens for it.
	$effect(() => {
		if (editing && untrack(() => isCollapsed)) {
			untrack(expandSidebar);
		}
	});
	$effect(() => () => finishCustomizing());
</script>

{#snippet searchBar()}
	<button type="button" class="search" onclick={editing ? undefined : openPalette}>
		<span class="search-left">
			<Search class="search-icon" color="var(--abt-soft)" strokeWidth={1.75} />
			<span class="search-placeholder">Search...</span>
		</span>
		<span class="search-kbd">{isMac() ? "⌘K" : "Ctrl+K"}</span>
	</button>
{/snippet}

{#snippet top(withNav: boolean)}
	{#if searchEnabled || editing}
		<div data-abt-part data-off={!searchEnabled || undefined}>
			{@render searchBar()}
		</div>
	{/if}
	{#if withNav}
		<PrimaryNav />
	{/if}
	{#if shortcutsFeatureEnabled || editing}
		<div data-abt-part data-off={!shortcutsFeatureEnabled || undefined}>
			<ShortcutsBar noPadding {budgetId} {editing} />
		</div>
	{/if}
{/snippet}

<svelte:window onclick={() => (settingsMenu = null)} />

<div
	class="sidebar"
	class:resizing
	class:split={layoutMode === "split"}
	class:collapsed={isCollapsed && layoutMode === "standard"}
	class:rail-only={isCollapsed && layoutMode === "split"}
	bind:this={sidebarEl}
	style="width: {sidebarTotalWidth}"
	oncontextmenu={openSettingsMenu}
	role="presentation"
>
	{#if layoutMode === "split"}
		<div class="activity-bar">
			<Rail
				{budgetName}
				{budgetId}
				{budgetReady}
				{accounts}
				icons={shownIcons}
				onExpand={expandSidebar}
				onSearch={openPalette}
				split
				panelCollapsed={isCollapsed}
				{groupAccounts}
				onTogglePanel={() => (isCollapsed ? expandSidebar() : collapseSidebar())}
			/>
		</div>
		<!-- Hidden rather than removed, so reopening it doesn't rebuild its groups and shortcut rows. -->
		<div class="split-panel" style:display={isCollapsed ? "none" : null}>
			<BudgetHeader
				name={budgetName}
				showBudgetIcon={false}
				onBudgetChange={refreshBudgetContext}
			/>
			{#if searchEnabled || shortcutsFeatureEnabled || editing}
				<div
					style="padding-inline: 0.65rem; padding-block: 0.65rem; display: flex; gap: 0.5rem; flex-direction: column;"
				>
					{@render top(false)}
				</div>
			{/if}
			{#if loading}
				<AccountListSkeleton />
			{:else if failed}
				<div class="load-status">Couldn't load account data.</div>
			{:else}
				<AccountList
					{accounts}
					icons={shownIcons}
					iconPicker={iconsEnabled}
					{groupAccounts}
					{budgetId}
					{budgetReady}
					{editing}
					split
					onToggleGroupMode={toggleGroupMode}
					onRenameAccount={handleRenameAccount}
					onCloseAccount={closeAccount}
				/>
			{/if}
			<Footer {accounts} />
		</div>
	{:else if isCollapsed}
		<Rail
			{budgetName}
			{budgetId}
			{budgetReady}
			{accounts}
			icons={shownIcons}
			onExpand={expandSidebar}
			onSearch={openPalette}
			{groupAccounts}
		/>
	{:else}
		<BudgetHeader name={budgetName} onBudgetChange={refreshBudgetContext} />
		<div class="body">
			{@render top(true)}
			<div class="divider"></div>
			{#if loading}
				<AccountListSkeleton />
			{:else if failed}
				<div class="load-status">Couldn't load account data.</div>
			{:else}
				<AccountList
					{accounts}
					icons={shownIcons}
					iconPicker={iconsEnabled}
					{groupAccounts}
					{budgetId}
					{budgetReady}
					{editing}
					onToggleGroupMode={toggleGroupMode}
					onRenameAccount={handleRenameAccount}
					onCloseAccount={closeAccount}
				/>
			{/if}
			<Footer {accounts} onCollapse={collapseSidebar} />
		</div>
	{/if}

	{#if !isCollapsed}
		<div
			class="resize-handle"
			class:active={resizing}
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize sidebar (double-click to reset)"
			onpointerdown={startResize}
			onpointermove={onResizeMove}
			onpointerup={endResize}
			onpointercancel={endResize}
			ondblclick={resetWidth}
		>
			<span class="resize-grip"></span>
		</div>
	{/if}

	<CommandPalette bind:this={paletteRef} {accounts} icons={shownIcons} />
</div>

{#if settingsMenu}
	<div use:portal class="ctx" style="top: {settingsMenu.y}px; left: {settingsMenu.x}px">
		<button
			type="button"
			class="ctx-item"
			onclick={() => {
				settingsMenu = null;
				customizeSidebar();
			}}
		>
			<SlidersHorizontal strokeWidth={1.5} />
			<span>Customize sidebar…</span>
		</button>
	</div>
{/if}

{#if editing && sidebarEl}
	<CustomizePanel sidebar={sidebarEl} {budgetId} />
{/if}

<style>
	/* Edit mode: a switched-off part stays on screen, faded, until Done. */
	.sidebar :global([data-abt-part]) {
		transition: opacity 0.2s;
	}
	.sidebar :global([data-abt-part][data-off]) {
		opacity: 0.35;
	}

	.load-status {
		padding: 12px 14px;
		font-size: var(--abt-text-md);
		color: var(--abt-soft);
	}

	.search {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		box-sizing: border-box;
		padding: calc(var(--sb-row-pad-y, 5px) + 1px) 13px;
		background: var(--abt-ink-1);
		border: 1px solid var(--sb-line, var(--abt-ink-2));
		border-radius: 10px; /* raw: fixed, with the shortcut tiles beside it */
		transition: border-color 0.12s ease;
	}
	.search:hover {
		border-color: var(--abt-ink-5);
		background: var(--sb-surface-hover);
	}
	.search:focus-visible {
		border-color: var(--abt-accent);
		outline: none;
	}
	.search-left {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1 1 auto;
		min-width: 0;
	}
	.search :global(.search-icon) {
		width: 12.5px;
		height: 12.5px;
		flex-shrink: 0;
	}
	/* placeholder look-alike: the box is a launcher, typing happens in the palette */
	.search-placeholder {
		font-size: var(--abt-text-lg);
		font-weight: 400;
		letter-spacing: 0.15px;
		color: var(--abt-subtle);
	}
	.search-kbd {
		flex-shrink: 0;
		padding: 1px 5px;
		background: var(--abt-ink-3);
		border-radius: var(--abt-radius-sm);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.11px;
		color: var(--abt-subtle);
	}

	.divider {
		height: 1px;
		width: 100%;
		background: var(--sb-line, var(--abt-ink-2));
		flex-shrink: 0;
	}
</style>
