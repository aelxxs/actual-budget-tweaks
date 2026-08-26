<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import { loadIconCache } from "@features/appearance/account-icon-picker";
	import { loadCurrency } from "@lib/utilities/currency";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { getValue, setValue } from "@lib/utilities/store";
	import { Search } from "lucide-svelte";
	import { onMount } from "svelte";
	import ShortcutsBar from "../../appearance/sidebar-shortcuts/ShortcutsBar.svelte";
	import { portal, syncPortalColors } from "./actions/portal";
	import { tipState, tooltip } from "./actions/tooltip.svelte";
	import AccountList from "./components/AccountList.svelte";
	import AccountListSkeleton from "./components/AccountListSkeleton.svelte";
	import BudgetHeader from "./components/BudgetHeader.svelte";
	import CommandPalette from "./components/CommandPalette.svelte";
	import Footer from "./components/Footer.svelte";
	import PrimaryNav from "./components/PrimaryNav.svelte";
	import Rail from "./components/Rail.svelte";
	import { invalidateAccountDetail } from "./lib/account-detail";
	import { loadCurrentBudgetId, loadCurrentBudgetName } from "./lib/budgets";
	import { applyComputedForeground } from "./lib/contrast";
	import type { SidebarAccount } from "./lib/data";
	import {
		closeAccount,
		loadSidebarAccounts,
		readNativeAccountBalanceTexts,
		readNativeSyncingAccountIds,
		readNativeUncategorizedButtonText,
		refreshBalances,
		refreshSyncStatuses,
		refreshUncategorizedCounts,
		renameAccount,
	} from "./lib/data";
	import { isMac } from "./lib/search";
	import "./sidebar.css";

	let paletteRef: CommandPalette | undefined = $state();
	function openPalette(): void {
		paletteRef?.openPalette();
	}

	let loading = $state(true);
	let failed = $state(false);
	let budgetName = $state("Budget");
	let budgetId = $state<string | undefined>(undefined);
	let accounts = $state<SidebarAccount[]>([]);
	let icons = $state<Record<string, AccountIconData>>({});

	// ---- grouped (sub-categories) vs flat accounts list ----
	const GROUP_MODE_KEY = "experimental-sidebar-group-mode";
	let groupAccounts = $state(true);

	function toggleGroupMode() {
		groupAccounts = !groupAccounts;
		setValue(GROUP_MODE_KEY, groupAccounts);
	}

	// ---- collapsed rail ----
	const COLLAPSED_KEY = "experimental-sidebar-collapsed";
	const RAIL_WIDTH = "4.25rem"; // matches .activity-bar's width in sidebar.css
	let collapsed = $state(false);

	// Gates .sidebar.transitions-ready (sidebar.css) so hydrating a persisted
	// collapsed/width value on mount doesn't itself animate.
	let transitionsReady = $state(false);

	function expandSidebar() {
		collapsed = false;
		setValue(COLLAPSED_KEY, false);
	}
	function collapseSidebar() {
		collapsed = true;
		setValue(COLLAPSED_KEY, true);
	}

	// ---- layout mode: "full" (text nav + accounts, the original design) vs
	// "vscode" (icon-only activity bar + a dedicated accounts subsidebar,
	// mirroring VS Code's activity bar + file tree split) ----
	const LAYOUT_MODE_KEY = "experimental-sidebar-layout-mode";
	const ACTIVITY_BAR_WIDTH = RAIL_WIDTH;
	let layoutMode = $state<"full" | "vscode">("full");

	function toggleLayoutMode() {
		layoutMode = layoutMode === "full" ? "vscode" : "full";
		setValue(LAYOUT_MODE_KEY, layoutMode);
	}

	// ---- resize ----
	const MIN_WIDTH = 240;
	const MAX_WIDTH = 560;
	const DEFAULT_WIDTH = 325;
	const WIDTH_KEY = "experimental-sidebar-width";
	let sidebarWidth = $state(DEFAULT_WIDTH);
	// total on-screen width covers both modes: the classic single-column
	// rail/expanded sidebar, and vscode mode's fixed activity bar plus its
	// optional (collapsible) resizable accounts panel.
	const sidebarTotalWidth = $derived(
		layoutMode === "vscode"
			? collapsed
				? ACTIVITY_BAR_WIDTH
				: `calc(${ACTIVITY_BAR_WIDTH} + ${sidebarWidth}px)`
			: collapsed
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
		if (!resizing) return;
		const next = dragStartWidth + (e.clientX - dragStartX);
		sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
	}
	function endResize(e: PointerEvent) {
		if (!resizing) return;
		resizing = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
		setValue(WIDTH_KEY, sidebarWidth);
	}
	function resetWidth() {
		sidebarWidth = DEFAULT_WIDTH;
		setValue(WIDTH_KEY, DEFAULT_WIDTH);
	}

	let sidebarEl: HTMLDivElement | undefined = $state();

	// Recompute if the resolved background ever changes (theme switch while
	// mounted) — DOM-mutation-driven for the same cross-world reason as the
	// route-active state elsewhere in this feature (see PrimaryNav.svelte).
	//
	// Two separate observers are needed: Actual's own native theme swap
	// rewrites a style element's text content somewhere inside the body
	// element, which the default childList/subtree watch (scoped to
	// document.body) already sees. This extension's own Catppuccin theme
	// system, though, applies its colors via `root.style.setProperty()` on
	// document.documentElement (the html element) — an *attribute* mutation
	// on a node that's a body ancestor, not a descendant, so it's outside the
	// body observer's subtree and invisible to it. Without this second
	// observer, switching this extension's own custom themes silently left
	// the sidebar's derived colors stale.
	$effect(() => {
		if (!sidebarEl) return;
		const recompute = () => {
			applyComputedForeground(sidebarEl!);
			// Keeps the portaled tooltip/context-menu overlays (see ./portal)
			// in the same dark/light state as the real sidebar element.
			syncPortalColors();
		};
		const stopBody = watchDom(recompute);
		const stopRoot = watchDom(recompute, document.documentElement, {
			attributes: true,
			attributeFilter: ["style"],
		});
		return () => {
			stopBody();
			stopRoot();
		};
	});

	let shortcutsFeatureEnabled = $state(false);

	$effect(() => {
		getValue<boolean>("sidebar-shortcuts-enabled", false).then(
			(v) => (shortcutsFeatureEnabled = v),
		);
	});

	// A bank sync happens server-side over time (synced → syncing → synced/
	// error) with no push/event this bridge can subscribe to, and `bank_sync_status`
	// is a persisted DB column that a fast sync may never actually pass through
	// "pending" on its way from "ok" back to "ok" — polling that field alone
	// can miss it. The real per-account "syncing" signal only exists as
	// Redux's ephemeral `accountsSyncing` list, which this bridge has no
	// direct access to — but Actual's own native sidebar (hidden, not
	// unmounted — see experimental/sidebar/index.ts) renders that exact state
	// as each row's `.dot` color, so reading it back from the DOM is exact and
	// event-driven off the same shared body-level watchDom observer, instead
	// of guessing from a global banner or sampling on a timer.
	let syncingIds = new Set<string>();

	$effect(() => {
		return watchDom(() => {
			const nowSyncing = readNativeSyncingAccountIds();

			for (const account of accounts) {
				if (nowSyncing.has(account.id) && account.status !== "syncing") {
					account.status = "syncing";
				}
			}

			// The dot only distinguishes pending vs. not — re-check the accounts
			// that just stopped to learn their real end state (ok vs. which error),
			// and pick up any transactions the sync just brought in.
			const justFinished = [...syncingIds].filter((id) => !nowSyncing.has(id));
			if (justFinished.length) {
				const finished = accounts.filter((a) => justFinished.includes(a.id));
				refreshSyncStatuses(finished).then((changed) => {
					for (const id of changed) invalidateAccountDetail(id);
				});
				refreshUncategorizedCounts(finished);
			}

			syncingIds = nowSyncing;
		});
	});

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
			if (text === lastUncatButtonText) return;
			lastUncatButtonText = text;
			refreshUncategorizedCounts(accounts);
		});
	});

	// null until the first run, which just seeds the baseline.
	let lastBalanceTexts: Map<string, string> | null = null;

	$effect(() => {
		return watchDom(() => {
			const nowTexts = readNativeAccountBalanceTexts();
			if (!lastBalanceTexts) {
				lastBalanceTexts = nowTexts;
				return;
			}
			const prevTexts = lastBalanceTexts;
			lastBalanceTexts = nowTexts;

			const changedAccounts = accounts.filter((a) => {
				const text = nowTexts.get(a.id);
				return text !== undefined && prevTexts.get(a.id) !== text;
			});
			if (!changedAccounts.length) return;
			refreshBalances(changedAccounts).then((changed) => {
				for (const id of changed) invalidateAccountDetail(id);
			});
		});
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
		const [name, id] = await Promise.all([loadCurrentBudgetName(), loadCurrentBudgetId()]);
		budgetName = name;
		budgetId = id;
	}

	// Real, direct RPC (see data.ts) — safe to update the local list optimistically.
	async function handleRenameAccount(accountId: string, name: string) {
		await renameAccount(accountId, name);
		const account = accounts.find((a) => a.id === accountId);
		if (account) account.name = name;
	}

	// Closing routes through Actual's real native modal (balance transfer /
	// category prompts are its job, not ours) — see data.ts's closeAccount().
	// We can't know synchronously whether the user confirmed or cancelled, but
	// the modal element is a real DOM node (`[data-testid="close-account-modal"]`)
	// that mounts and unmounts for real, so once it's gone we just refetch —
	// harmless no-op if nothing actually changed.
	async function handleCloseAccount(accountId: string) {
		await closeAccount(accountId);

		let modalSeen = false;
		const stop = watchDom(() => {
			const open = !!document.querySelector('[data-testid="close-account-modal"]');
			if (open) {
				modalSeen = true;
				return;
			}
			if (!modalSeen) return;
			stop();
			loadSidebarAccounts().then((next) => (accounts = next));
		});
	}

	onMount(async () => {
		const [storedCollapsed, storedWidth, storedGroupMode, storedLayoutMode] = await Promise.all([
			getValue<boolean>(COLLAPSED_KEY, false),
			getValue<number>(WIDTH_KEY, DEFAULT_WIDTH),
			getValue<boolean>(GROUP_MODE_KEY, true),
			getValue<"full" | "vscode">(LAYOUT_MODE_KEY, "full"),
		]);
		collapsed = storedCollapsed;
		sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, storedWidth));
		groupAccounts = storedGroupMode;
		layoutMode = storedLayoutMode;
		requestAnimationFrame(() => (transitionsReady = true));

		try {
			await loadCurrency();
			const [, loadedAccounts, loadedIcons] = await Promise.all([
				refreshBudgetContext(),
				loadSidebarAccounts(),
				loadIconCache(),
			]);
			accounts = loadedAccounts;
			icons = loadedIcons;
		} catch (err) {
			console.error("[ABT experimental sidebar] failed to load live data", err);
			failed = true;
		} finally {
			loading = false;
		}
	});
</script>

<div
	class="sidebar"
	class:resizing
	class:transitions-ready={transitionsReady}
	class:vscode={layoutMode === "vscode"}
	class:collapsed={collapsed && layoutMode === "full"}
	bind:this={sidebarEl}
	style="width: {sidebarTotalWidth}"
>
	{#if layoutMode === "vscode"}
		<div class="activity-bar">
			<Rail
				{budgetName}
				{budgetId}
				{accounts}
				{icons}
				onExpand={expandSidebar}
				onSearch={openPalette}
				vscode
				panelCollapsed={collapsed}
				onTogglePanel={() => (collapsed ? expandSidebar() : collapseSidebar())}
				onSwitchLayout={toggleLayoutMode}
			/>
		</div>
		{#if !collapsed}
			<div class="vscode-panel">
				<BudgetHeader
					name={budgetName}
					showBudgetIcon={false}
					onBudgetChange={refreshBudgetContext}
				/>
				<div
					style="padding-inline: 0.65rem; padding-block: 0.65rem; display: flex; gap: 0.5rem; flex-direction: column;"
				>
					<button type="button" class="search" onclick={openPalette}>
						<span class="search-left">
							<Search class="search-icon" color="var(--sb-fg-muted)" strokeWidth={1.75} />
							<span class="search-placeholder">Search...</span>
						</span>
						<span class="search-kbd">{isMac() ? "⌘K" : "Ctrl+K"}</span>
					</button>
					{#if shortcutsFeatureEnabled}
						<ShortcutsBar noPadding />
					{/if}
				</div>
				{#if loading}
					<AccountListSkeleton />
				{:else if failed}
					<div class="load-status">Couldn't load account data.</div>
				{:else}
					<AccountList
						{accounts}
						{icons}
						{groupAccounts}
						{budgetId}
						vscode
						onToggleGroupMode={toggleGroupMode}
						onRenameAccount={handleRenameAccount}
						onCloseAccount={handleCloseAccount}
					/>
				{/if}
				<div style="padding-bottom: 0.65rem">
					<Footer />
				</div>
			</div>
		{/if}
	{:else if collapsed}
		<Rail
			{budgetName}
			{budgetId}
			{accounts}
			{icons}
			onExpand={expandSidebar}
			onSearch={openPalette}
		/>
	{:else}
		<BudgetHeader name={budgetName} onBudgetChange={refreshBudgetContext} />
		<div class="body">
			<button type="button" class="search" onclick={openPalette}>
				<span class="search-left">
					<Search class="search-icon" color="var(--sb-fg-muted)" strokeWidth={1.75} />
					<span class="search-placeholder">Search...</span>
				</span>
				<span class="search-kbd">{isMac() ? "⌘K" : "Ctrl+K"}</span>
			</button>
			<PrimaryNav />
			{#if shortcutsFeatureEnabled}
				<ShortcutsBar noPadding />
			{/if}
			<div class="divider"></div>
			{#if loading}
				<AccountListSkeleton />
			{:else if failed}
				<div class="load-status">Couldn't load account data.</div>
			{:else}
				<AccountList
					{accounts}
					{icons}
					{groupAccounts}
					{budgetId}
					onToggleGroupMode={toggleGroupMode}
					onRenameAccount={handleRenameAccount}
					onCloseAccount={handleCloseAccount}
				/>
			{/if}
			<Footer onCollapse={collapseSidebar} onSwitchLayout={toggleLayoutMode} />
		</div>
	{/if}

	{#if !collapsed}
		<div
			class="resize-handle"
			class:active={resizing}
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize sidebar"
			use:tooltip={{ text: "Drag to resize · double-click to reset", placement: "left" }}
			onpointerdown={startResize}
			onpointermove={onResizeMove}
			onpointerup={endResize}
			onpointercancel={endResize}
			ondblclick={resetWidth}
		></div>
	{/if}

	<CommandPalette bind:this={paletteRef} {accounts} {icons} />

	{#if tipState.value}
		<div
			use:portal
			class="tooltip tip-{tipState.value.placement}"
			style="left: {tipState.value.x}px; top: {tipState.value.y}px"
			role="tooltip"
		>
			{tipState.value.text}
		</div>
	{/if}
</div>

<style>
	.load-status {
		padding: 12px 14px;
		font-size: 13px;
		color: var(--sb-fg-subtle);
	}
</style>
