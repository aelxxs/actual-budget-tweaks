<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { calculate, send } from "@lib/utilities/actual-api";
	import { openPanel } from "./panel";
	import { relativeTime } from "./relative-time";
	import { reconcile } from "./state.svelte";

	const { accountId }: { accountId: string } = $props();

	const DAY = 24 * 3600e3;
	const OVERDUE_DAYS = 30;

	let lastReconciled = $state<number | null>(null);
	let uncleared = $state(0);
	let loaded = $state(false);

	const active = $derived(reconcile.target != null && reconcile.accountId === accountId);
	const days = $derived(lastReconciled == null ? null : (Date.now() - lastReconciled) / DAY);
	const overdue = $derived(loaded && (days == null || days > OVERDUE_DAYS));
	const age = $derived(days == null ? "never" : compactAge(days));
	const title = $derived(
		!loaded
			? "Reconcile"
			: `${lastReconciled ? `Last reconciled ${relativeTime(lastReconciled)}` : "Never reconciled"}` +
					` · ${uncleared === 1 ? "1 transaction" : `${uncleared} transactions`} not cleared`,
	);

	function compactAge(d: number): string {
		if (d < 1) return "today";
		if (d < 30) return `${Math.floor(d)}d`;
		if (d < 365) return `${Math.floor(d / 30)}mo`;
		return `${Math.floor(d / 365)}y`;
	}

	// Refetched when a reconcile here starts or finishes, which is when these change.
	$effect(() => {
		void reconcile.lastReconciled;
		void reconcile.target;
		let stale = false;
		void Promise.all([
			send<{ id: string; last_reconciled: string | null }[]>("accounts-get"),
			calculate<number>(
				"transactions",
				{ $count: "$id" },
				{ filter: { account: accountId, cleared: false }, options: { splits: "none" } },
			),
		]).then(([accounts, count]) => {
			if (stale) return;
			const raw = accounts.find((a) => a.id === accountId)?.last_reconciled;
			lastReconciled = raw ? Number(raw) : null;
			uncleared = count ?? 0;
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
	onclick={() => openPanel(accountId)}
>
	<Icon name="listChecks" size={15} />
	{#if active}
		<span>Reconciling…</span>
	{:else}
		<span>Reconcile</span>
		{#if loaded}<span class="rb__age">{age}</span>{/if}
	{/if}
</button>

<style>
	.rb__age {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: 2px;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--abt-fill);
		color: var(--abt-muted);
		font-size: var(--abt-text-xs);
		font-variant-numeric: tabular-nums;
	}

	.rb.is-overdue .rb__age {
		background: color-mix(in srgb, var(--color-warningText) 16%, transparent);
		color: var(--color-warningText);
	}

	.rb.is-overdue .rb__age::before {
		content: "";
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: currentColor;
	}

	/* Mid-reconcile, so it reads as in progress even with the panel closed. */
	.rb.is-active {
		border-color: color-mix(in srgb, var(--abt-accent) 35%, transparent) !important;
		background: color-mix(in srgb, var(--abt-accent) 16%, transparent) !important;
		color: var(--abt-accent-text) !important;
	}
</style>
