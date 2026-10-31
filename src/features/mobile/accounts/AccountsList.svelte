<script lang="ts">
	import {
		type AccountIconData,
		getEmojiAssetUrl,
		loadIconCache,
		watchAccountIcons,
	} from "@features/appearance/account-icon-picker";
	import StatusIcon from "@features/workflows/sidebar/components/StatusIcon.svelte";
	import { type SidebarAccount, loadSidebarAccounts } from "@features/workflows/sidebar/lib/data";
	import {
		type AccountGroup,
		type GroupState,
		groupOf as bucketOf,
		groupsIn,
		watchGroupState,
	} from "@features/workflows/sidebar/lib/groups";
	import {
		applyOrder,
		loadAccountOrder,
		watchAccountOrder,
	} from "@features/workflows/sidebar/lib/order";
	import {
		loadCurrentBudgetId,
		navigate,
		onListChange,
		onSyncingAccounts,
	} from "@lib/utilities/actual-api";
	import { fmtMoney, loadCurrency } from "@lib/utilities/currency";
	import { ChevronDown, ChevronRight } from "@lucide/svelte";
	import { onMount, untrack } from "svelte";

	type Section = { kind: "onbudget" | "offbudget"; label: string; items: SidebarAccount[] };

	let accounts = $state<SidebarAccount[]>([]);
	let loaded = $state(false);
	let budgetId = $state<string | undefined>(undefined);
	let groupState = $state<GroupState>({
		groups: {},
		assignments: {},
		native: false,
		importable: false,
	});
	let order = $state<string[]>([]);
	let icons = $state<Record<string, AccountIconData>>({});
	let syncing = $state(new Set<string>());
	let showClosed = $state(false);

	let reloadSeq = 0;
	async function reload() {
		const seq = ++reloadSeq;
		const next = await loadSidebarAccounts(untrack(() => $state.snapshot(accounts)));
		if (seq === reloadSeq) {
			accounts = next;
			loaded = true;
		}
	}

	// The bridge answers some subscriptions synchronously, so setup stays out of any effect's
	// tracking: reading state there made the effect depend on what it writes, and loop.
	onMount(() => {
		void loadCurrency().then(reload);
		void loadCurrentBudgetId().then((id) => (budgetId = id));
		void loadIconCache().then((stored) => (icons = { ...stored }));
		const stopIcons = watchAccountIcons((stored) => (icons = { ...stored }));
		const stopList = onListChange("accounts", () => void reload());
		// A bank sync changes balances; reload once it finishes.
		let wasSyncing = new Set<string>();
		const stopSync = onSyncingAccounts((ids) => {
			const finished = [...wasSyncing].some((id) => !ids.has(id));
			wasSyncing = ids;
			syncing = ids;
			if (finished) {
				void reload();
			}
		});
		return () => {
			stopIcons();
			stopList();
			stopSync();
		};
	});

	// Groups and order are kept per budget, as the sidebar keeps them.
	$effect(() => {
		const id = budgetId;
		if (!id) {
			return;
		}
		void loadAccountOrder(id).then((stored) => (order = stored));
		const stops = [
			watchGroupState(id, (state) => (groupState = state)),
			watchAccountOrder(id, (stored) => (order = stored)),
		];
		return () => stops.forEach((stop) => stop());
	});

	const ordered = $derived(applyOrder(accounts, order));
	const open = $derived(ordered.filter((a) => !a.closed));
	const closed = $derived(ordered.filter((a) => a.closed));
	const sections = $derived<Section[]>(
		[
			{ kind: "onbudget" as const, label: "On budget", items: open.filter((a) => !a.offbudget) },
			{ kind: "offbudget" as const, label: "Off budget", items: open.filter((a) => a.offbudget) },
		].filter((s) => s.items.length),
	);

	const total = (items: SidebarAccount[]) => items.reduce((sum, a) => sum + a.balance, 0);

	function groupsOf(kind: Section["kind"]): AccountGroup[] {
		return groupsIn(kind, groupState, accounts);
	}

	function groupOf(account: SidebarAccount): string | null {
		return bucketOf(account, groupState.assignments, groupState.groups);
	}

	function iconUrl(icon: AccountIconData | undefined): string | null {
		if (!icon) {
			return null;
		}
		return icon.type === "emoji" ? getEmojiAssetUrl(icon.value) : icon.value;
	}

	function tone(amount: number): string {
		return amount > 0 ? "positive" : amount < 0 ? "negative" : "zero";
	}
</script>

{#snippet amount(value: number, strong = false)}
	<span class="acct-amount" class:is-strong={strong} data-tone={tone(value)}>{fmtMoney(value)}</span
	>
{/snippet}

{#snippet row(account: SidebarAccount)}
	{@const url = iconUrl(icons[account.id])}
	<button type="button" class="acct-row" onclick={() => navigate(`/accounts/${account.id}`)}>
		<span class="acct-status">
			{#if account.status !== "manual"}
				<StatusIcon status={syncing.has(account.id) ? "syncing" : account.status} />
			{/if}
		</span>
		{#if url}
			<img class="acct-icon" src={url} alt="" />
		{/if}
		<span class="acct-name">{account.name}</span>
		{@render amount(account.balance)}
	</button>
{/snippet}

{#snippet heading(label: string, value: number, path: string)}
	<button type="button" class="acct-heading" onclick={() => navigate(path)}>
		<span class="acct-heading__label">{label}</span>
		<ChevronRight size={16} class="acct-chevron" />
		{@render amount(value, true)}
	</button>
{/snippet}

{#if loaded}
	<div class="accts">
		<section class="acct-card">
			{@render heading("All accounts", total(open), "/accounts/all")}
		</section>

		{#each sections as section (section.kind)}
			{@const ungrouped = section.items.filter((a) => !groupOf(a))}
			<section class="acct-card">
				{@render heading(section.label, total(section.items), `/accounts/${section.kind}`)}
				{#each ungrouped as account (account.id)}
					{@render row(account)}
				{/each}
				{#each groupsOf(section.kind) as group (group.id)}
					{@const items = section.items.filter((a) => groupOf(a) === group.id)}
					{#if items.length}
						<div class="acct-group">
							<span class="acct-group__label">{group.label}</span>
							{@render amount(total(items))}
						</div>
						{#each items as account (account.id)}
							{@render row(account)}
						{/each}
					{/if}
				{/each}
			</section>
		{/each}

		{#if closed.length}
			<section class="acct-card">
				<button
					type="button"
					class="acct-heading"
					aria-expanded={showClosed}
					onclick={() => (showClosed = !showClosed)}
				>
					<span class="acct-heading__label">Closed</span>
					<ChevronDown size={16} class="acct-chevron {showClosed ? 'is-open' : ''}" />
					{@render amount(total(closed), true)}
				</button>
				{#if showClosed}
					{#each closed as account (account.id)}
						{@render row(account)}
					{/each}
				{/if}
			</section>
		{/if}
	</div>
{/if}

<style>
	.accts {
		/* The sidebar's status colours, which StatusIcon reads; they're the ones Actual's own dots use. */
		--sb-success: var(--color-sidebarItemBackgroundPositive);
		--sb-danger: var(--color-sidebarItemBackgroundFailed);
		--sb-attention: var(--color-sidebarItemBackgroundPending);
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) var(--abt-space-4) var(--abt-space-6);
	}

	.acct-card {
		overflow: hidden;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius-lg);
		background: var(--color-tableBackground);
	}

	.acct-heading,
	.acct-row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		width: 100%;
		min-height: 52px;
		box-sizing: border-box;
		padding: 0 var(--abt-space-4);
		border: 0;
		background: none;
		color: var(--color-pageText);
		font: inherit;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
	}

	.acct-heading:active,
	.acct-row:active {
		background: var(--abt-ink-2);
	}

	.acct-heading {
		background: var(--color-budgetHeaderCurrentMonth);
		font-size: var(--abt-text-xl);
		font-weight: 600;
	}

	.acct-card > * + * {
		border-top: 1px solid var(--color-tableBorder);
	}

	.acct-heading__label,
	.acct-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.acct-name {
		flex: 1;
		font-size: var(--abt-text-xl);
		font-weight: 500;
	}

	.acct-heading :global(.acct-chevron) {
		flex-shrink: 0;
		margin-right: auto;
		color: var(--color-pageTextSubdued);
		transition: transform 0.15s ease;
	}

	.acct-heading :global(.acct-chevron.is-open) {
		transform: rotate(180deg);
	}

	/* A fixed slot, so names line up whether or not an account syncs. */
	.acct-status {
		display: grid;
		place-items: center;
		width: 17px;
		flex-shrink: 0;
		margin: 0 calc(-1 * var(--abt-space-2));
	}

	.acct-icon {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		object-fit: contain;
		border-radius: var(--abt-radius-sm);
	}

	/* A tinted band, so each group reads as its own block under the section's heading. */
	.acct-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		min-height: 36px;
		padding: 0 var(--abt-space-4);
		background: var(--abt-ink-2);
		color: var(--abt-muted);
		font-size: var(--abt-text-sm);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.acct-group .acct-amount {
		font-size: var(--abt-text-md);
		font-weight: 600;
		letter-spacing: 0;
	}

	.acct-amount {
		flex-shrink: 0;
		font-size: var(--abt-text-lg);
		font-variant-numeric: tabular-nums;
	}

	.acct-amount.is-strong {
		font-weight: 600;
	}

	.acct-row .acct-amount[data-tone="positive"] {
		color: var(--color-numberPositive);
	}

	.acct-row .acct-amount[data-tone="negative"],
	.acct-amount[data-tone="negative"] {
		color: var(--color-numberNegative);
	}

	.acct-row .acct-amount[data-tone="zero"] {
		color: var(--color-numberNeutral);
	}
</style>
