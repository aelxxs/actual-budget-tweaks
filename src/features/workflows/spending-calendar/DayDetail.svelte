<script lang="ts">
	import Row from "@lib/components/panel/Row.svelte";
	import Section from "@lib/components/panel/Section.svelte";
	import { getCategoryColor } from "@lib/utilities/category-colors";
	import { fmtMoney } from "@lib/utilities/currency";
	import type { DayTransaction } from "./types";

	const {
		transactions,
	}: {
		date: Date;
		transactions: DayTransaction[];
	} = $props();

	function fmt(cents: number): string {
		return fmtMoney(cents);
	}

	function catColor(id: string): string {
		return getCategoryColor(id);
	}

	const categoryBreakdown = $derived.by(() => {
		const map = new Map<string, { name: string; amount: number; id: string }>();
		for (const t of transactions) {
			if (t.amount >= 0 || t.upcoming || t.missed) continue;
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
</script>

{#snippet txDetails(tx: DayTransaction, showCategory: boolean)}
	{#if (showCategory && tx.categoryName) || tx.accountName}
		<div class="dd__tx-meta">
			{#if showCategory && tx.categoryName}
				<span style="color: {catColor(tx.categoryId)}">{tx.categoryName}</span>
			{/if}
			{#if tx.accountName}
				<span>{tx.accountName}</span>
			{/if}
		</div>
	{/if}
	{#if showCategory && tx.notes}
		<div class="dd__tx-notes abt-privacy-number">{tx.notes}</div>
	{/if}
{/snippet}

<div>
	{#if categoryBreakdown.length > 0}
		<Section title="Spending">
			{#snippet trailing()}{fmt(-totalSpent)}{/snippet}
			{#each categoryBreakdown as cat (cat.id || cat.name)}
				{@const pct = totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0}
				<Row name={cat.name} meta={`${pct}%`} value={fmt(-cat.amount)}>
					{#snippet leading()}
						<span class="dd__cat-dot" style="background: {catColor(cat.id)}"></span>
					{/snippet}
				</Row>
			{/each}
		</Section>
	{/if}

	{#if actualTxs.length > 0}
		<Section title="Transactions" count={actualTxs.length}>
			{#each actualTxs as tx, i (i)}
				<Row
					name={tx.payee}
					sensitive
					value={fmt(tx.amount)}
					tone={tx.amount < 0 ? "negative" : tx.amount > 0 ? "positive" : undefined}
				>
					{#snippet leading()}
						{#if tx.categoryId}
							<span class="dd__tx-dot" style="background: {catColor(tx.categoryId)}"></span>
						{/if}
					{/snippet}
					{@render txDetails(tx, true)}
				</Row>
			{/each}
		</Section>
	{/if}

	{#if missedTxs.length > 0}
		<Section title="Missed" tone="error" count={missedTxs.length}>
			{#each missedTxs as tx, i (i)}
				<Row name={tx.payee} sensitive value={fmt(tx.amount)} tone="negative">
					{@render txDetails(tx, false)}
				</Row>
			{/each}
		</Section>
	{/if}

	{#if upcomingTxs.length > 0}
		<Section title="Upcoming" count={upcomingTxs.length}>
			{#each upcomingTxs as tx, i (i)}
				<Row name={tx.payee} sensitive dim value={fmt(tx.amount)} tone="negative">
					{@render txDetails(tx, false)}
				</Row>
			{/each}
		</Section>
	{/if}
</div>

<style>
	.dd__cat-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.dd__tx-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dd__tx-meta {
		display: flex;
		gap: 6px;
		font-size: 10.5px;
		color: var(--color-pageTextSubdued);
	}

	.dd__tx-notes {
		font-size: 10.5px;
		color: var(--color-pageTextSubdued);
		opacity: 0.7;
	}
</style>
