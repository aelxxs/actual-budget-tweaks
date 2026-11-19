<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { calculate, send } from "@lib/actual/actual-api";
	import { openPanel } from "./panel";
	import { compactAge, reconciledOn } from "./relative-time";
	import { isUpToDate, reconcile } from "./state.svelte";

	const { accountId }: { accountId: string } = $props();

	const DAY = 24 * 3600e3;
	const OVERDUE_DAYS = 30;

	let lastReconciled = $state<number | null>(null);
	let uncleared = $state(0);
	let newlyCleared = $state(0);
	let cleared = $state(0);
	let bankBalance = $state<number | null>(null);
	let loaded = $state(false);

	const active = $derived(reconcile.target != null && reconcile.accountId === accountId);
	const days = $derived(lastReconciled == null ? null : (Date.now() - lastReconciled) / DAY);
	// Age alone isn't a reason: an account with nothing new since its last reconcile isn't overdue.
	const upToDate = $derived(
		loaded &&
			lastReconciled != null &&
			isUpToDate({ newlyCleared, uncleared, cleared, bankBalance }),
	);
	const overdue = $derived(loaded && !upToDate && (days == null || days > OVERDUE_DAYS));
	const age = $derived(days == null ? "never" : compactAge(days));
	const title = $derived(
		!loaded
			? "Reconcile"
			: upToDate
				? `Up to date · last reconciled ${reconciledOn(lastReconciled ?? 0)}`
				: `${lastReconciled ? `Last reconciled ${reconciledOn(lastReconciled)}` : "Never reconciled"}` +
					` · ${uncleared === 1 ? "1 transaction" : `${uncleared} transactions`} not cleared`,
	);

	// Refetched when a reconcile here starts or finishes, which is when these change.
	$effect(() => {
		void reconcile.lastReconciled;
		void reconcile.target;
		let stale = false;
		const splits = { splits: "none" } as const;
		void Promise.all([
			send<{ id: string; last_reconciled: string | null; balance_current: number | null }[]>(
				"accounts-get",
			),
			calculate<number>(
				"transactions",
				{ $count: "$id" },
				{ filter: { account: accountId, cleared: false }, options: splits },
			),
			calculate<number>(
				"transactions",
				{ $count: "$id" },
				{ filter: { account: accountId, cleared: true, reconciled: false }, options: splits },
			),
			calculate<number>(
				"transactions",
				{ $sum: "$amount" },
				{ filter: { account: accountId, cleared: true }, options: splits },
			),
		]).then(([accounts, notCleared, fresh, clearedSum]) => {
			if (stale) {
				return;
			}
			const account = accounts.find((a) => a.id === accountId);
			lastReconciled = account?.last_reconciled ? Number(account.last_reconciled) : null;
			bankBalance = account?.balance_current ?? null;
			uncleared = notCleared ?? 0;
			newlyCleared = fresh ?? 0;
			cleared = clearedSum ?? 0;
			loaded = true;
		});
		return () => {
			stale = true;
		};
	});
</script>

<button
	type="button"
	class="rb abt-btn abt-btn--sm abt-btn--ghost"
	class:is-active={active}
	class:is-overdue={overdue && !active}
	{title}
	onclick={() => {
		openPanel(accountId);
	}}
>
	<Icon name="listChecks" size={15} />
	{#if active}
		<span>Reconciling…</span>
	{:else}
		<span>Reconcile</span>
		{#if loaded && !upToDate}<span class="rb__age">{age}</span>{/if}
	{/if}
</button>

<style>
	.rb__age {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		margin-left: var(--abt-space-1);
		padding: 1px 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-fill);
		color: var(--abt-muted);
		font-size: var(--abt-text-xs);
		font-variant-numeric: tabular-nums;
	}

	.rb.is-overdue .rb__age {
		background: var(--abt-warning-2);
		color: var(--color-warningText);
	}

	.rb.is-overdue .rb__age::before {
		content: "";
		width: 5px;
		height: 5px;
		border-radius: var(--abt-radius-pill);
		background: currentColor;
	}

	/* Mid-reconcile, so it reads as in progress even with the panel closed. */
	.rb.is-active {
		border-color: var(--abt-accent-3) !important;
		background: var(--abt-accent-2) !important;
		color: var(--abt-accent-text) !important;
	}
</style>
