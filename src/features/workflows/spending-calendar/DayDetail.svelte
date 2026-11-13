<script lang="ts">
	import { categoryIconUrl, useCategoryIcons } from "@lib/category-icons.svelte";
	import CategoryIcon from "@lib/components/CategoryIcon.svelte";
	import { ArrowLeftRight } from "@lucide/svelte";
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import BalanceSpark from "./BalanceSpark.svelte";
	import { getCategoryColor } from "@lib/category-colors";
	import { fmtMoney } from "@lib/format/currency";
	import { editSchedule } from "./schedules";
	import type { DayTransaction } from "./types";

	const {
		transactions,
		balances,
		dayIndex,
	}: {
		date: Date;
		transactions: DayTransaction[];
		/** The month's closing balances, when the calendar shows them. */
		balances?: { balance: number; future: boolean }[];
		dayIndex: number;
	} = $props();

	// A transfer's payee is the other account; both ends, in the direction the money went.
	function payeeOf(tx: DayTransaction): string {
		if (!tx.transfer) {
			return tx.payee;
		}
		return tx.amount < 0 ? `${tx.accountName} → ${tx.payee}` : `${tx.payee} → ${tx.accountName}`;
	}

	function catColor(id: string): string {
		return getCategoryColor(id);
	}

	const categoryBreakdown = $derived.by(() => {
		const map = new Map<string, { name: string; amount: number; id: string }>();
		for (const t of transactions) {
			if (t.amount >= 0 || t.upcoming || t.missed || t.transfer) {
				continue;
			}
			const key = t.categoryId || "__uncategorized";
			const existing = map.get(key);
			if (existing) {
				existing.amount += Math.abs(t.amount);
			} else {
				map.set(key, {
					name: t.categoryName || "Uncategorized",
					amount: Math.abs(t.amount),
					id: t.categoryId,
				});
			}
		}
		return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
	});

	const totalSpent = $derived(categoryBreakdown.reduce((s, c) => s + c.amount, 0));
	const actualTxs = $derived(transactions.filter((t) => !t.upcoming && !t.missed));
	const upcomingTxs = $derived(transactions.filter((t) => t.upcoming));
	const missedTxs = $derived(transactions.filter((t) => t.missed));

	$effect(() => useCategoryIcons());
</script>

{#snippet txDetails(tx: DayTransaction, showCategory: boolean)}
	{#if (showCategory && tx.categoryName) || (tx.accountName && !tx.transfer) || tx.outsideBalance || tx.scheduleId}
		<div class="dd__tx-meta">
			{#if showCategory && tx.categoryName}
				<span class="dd__cat" style="color: {catColor(tx.categoryId)}"
					><CategoryIcon id={tx.categoryId} size={12} />{tx.categoryName}</span
				>
			{/if}
			{#if tx.accountName && !tx.transfer}
				<span>{tx.accountName}</span>
			{/if}
			{#if tx.outsideBalance}
				<span title="Pick a single account to count it">No account, not in balance</span>
			{/if}
			{#if tx.scheduleId}
				<button type="button" class="dd__edit" onclick={() => editSchedule(tx.scheduleId!)}
					>Edit schedule</button
				>
			{/if}
		</div>
	{/if}
	{#if showCategory && tx.notes}
		<div class="dd__tx-notes abt-privacy-number">{tx.notes}</div>
	{/if}
{/snippet}

<div>
	{#if balances?.[dayIndex]}
		<Section title="Balance">
			{#snippet trailing()}<span class="abt-privacy-number"
					>{fmtMoney(balances[dayIndex].balance)}</span
				>{/snippet}
			<BalanceSpark points={balances} selected={dayIndex} />
		</Section>
	{/if}

	{#if categoryBreakdown.length > 0}
		<Section title="Spending">
			{#snippet trailing()}{fmtMoney(-totalSpent)}{/snippet}
			{#if categoryBreakdown.length > 1}
				<div class="dd__split" aria-hidden="true">
					{#each categoryBreakdown as cat (cat.id || cat.name)}
						<span style:flex-grow={cat.amount} style:background={catColor(cat.id)}></span>
					{/each}
				</div>
			{/if}
			{#each categoryBreakdown as cat (cat.id || cat.name)}
				{@const pct = totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0}
				<Row name={cat.name} meta={`${pct}%`} value={fmtMoney(-cat.amount)}>
					{#snippet leading()}
						{#if categoryIconUrl(cat.id)}
							<CategoryIcon id={cat.id} />
						{:else}
							<span class="dd__cat-dot" style="background: {catColor(cat.id)}"></span>
						{/if}
					{/snippet}
				</Row>
			{/each}
		</Section>
	{/if}

	{#if actualTxs.length > 0}
		<Section title="Transactions" count={actualTxs.length}>
			{#each actualTxs as tx, i (i)}
				<Row
					name={payeeOf(tx)}
					sensitive
					value={fmtMoney(tx.amount)}
					tone={tx.amount < 0 ? "negative" : tx.amount > 0 ? "positive" : undefined}
				>
					{#snippet leading()}
						<span class="dd__tx-lead">
							{#if tx.transfer}
								<ArrowLeftRight size={12} aria-label="Transfer" />
							{:else if tx.categoryId}
								<span class="dd__tx-dot" style="background: {catColor(tx.categoryId)}"></span>
							{/if}
						</span>
					{/snippet}
					{@render txDetails(tx, true)}
				</Row>
			{/each}
		</Section>
	{/if}

	{#if missedTxs.length > 0}
		<Section title="Missed" tone="error" count={missedTxs.length}>
			{#each missedTxs as tx, i (i)}
				<Row name={payeeOf(tx)} sensitive value={fmtMoney(tx.amount)} tone="negative">
					{@render txDetails(tx, false)}
				</Row>
			{/each}
		</Section>
	{/if}

	{#if upcomingTxs.length > 0}
		<Section title="Upcoming" count={upcomingTxs.length}>
			{#each upcomingTxs as tx, i (i)}
				<Row name={payeeOf(tx)} sensitive dim value={fmtMoney(tx.amount)} tone="negative">
					{@render txDetails(tx, false)}
				</Row>
			{/each}
		</Section>
	{/if}
</div>

<style>
	.dd__split {
		display: flex;
		gap: var(--abt-space-1);
		height: 8px;
		margin-bottom: var(--abt-space-2);
		overflow: hidden;
		border-radius: var(--abt-radius-sm);
	}

	.dd__split span {
		flex-basis: 0;
		min-width: 2px;
	}

	.dd__cat-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.dd__tx-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		flex-shrink: 0;
	}

	.dd__tx-meta {
		display: flex;
		align-items: baseline;
		gap: 6px;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	/* One width for the dot and the transfer icon, so every name starts in line. */
	.dd__tx-lead {
		display: grid;
		place-items: center;
		width: 12px;
		flex-shrink: 0;
		color: var(--abt-muted);
	}

	.dd__edit {
		margin-left: auto;
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-accent-text);
		font: inherit;
		cursor: pointer;
	}

	.dd__edit:hover {
		text-decoration: underline;
	}

	.dd__tx-notes {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
		opacity: 0.7;
	}

	.dd__cat {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
	}
</style>
