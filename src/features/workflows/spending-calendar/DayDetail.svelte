<script lang="ts">
	import { getCategoryColor } from "@lib/utilities/category-colors";
	import { fmtMoney } from "@lib/utilities/currency";
	import type { DayTransaction } from "./types";

	const { transactions } = $props<{
		date: Date;
		transactions: DayTransaction[];
	}>();

	function fmt(cents: number): string {
		return fmtMoney(cents);
	}

	function catColor(id: string): string {
		return getCategoryColor(id);
	}

	const categoryBreakdown = $derived.by(() => {
		const map = new Map<string, { name: string; amount: number; id: string }>();
		for (const t of transactions) {
			if (t.amount >= 0 || t.upcoming) continue;
			const key = t.categoryId || "__uncategorized";
			const existing = map.get(key);
			if (existing) {
				existing.amount += Math.abs(t.amount);
			} else {
				map.set(key, { name: t.categoryName || "Uncategorized", amount: Math.abs(t.amount), id: t.categoryId });
			}
		}
		return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
	});

	const totalSpent = $derived(categoryBreakdown.reduce((s, c) => s + c.amount, 0));
	const actualTxs = $derived(transactions.filter((t) => !t.upcoming));
	const upcomingTxs = $derived(transactions.filter((t) => t.upcoming));
</script>

<div class="dd">
	{#if categoryBreakdown.length > 0}
		<div class="dd__cats">
			{#each categoryBreakdown as cat}
				{@const pct = totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0}
				<div class="dd__cat">
					<span class="dd__cat-dot" style="background: {catColor(cat.id)}"></span>
					<span class="dd__cat-name">{cat.name}</span>
					<span class="dd__cat-amount abt-privacy-number">{fmt(-cat.amount)}</span>
					<span class="dd__cat-pct">{pct}%</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if actualTxs.length > 0}
		<div class="dd__section">
			<div class="dd__section-title">Transactions</div>
			<div class="dd__list">
				{#each actualTxs as tx}
					<div class="dd__tx">
						<div class="dd__tx-row">
							{#if tx.categoryId}
								<span class="dd__tx-dot" style="background: {catColor(tx.categoryId)}"></span>
							{/if}
							<span class="dd__tx-payee abt-privacy-number">{tx.payee}</span>
							<span
								class="dd__tx-amount abt-privacy-number"
								class:is-neg={tx.amount < 0}
								class:is-pos={tx.amount > 0}
							>
								{fmt(tx.amount)}
							</span>
						</div>
						<div class="dd__tx-meta">
							{#if tx.categoryName}
								<span style="color: {catColor(tx.categoryId)}">{tx.categoryName}</span>
							{/if}
							{#if tx.accountName}
								<span>{tx.accountName}</span>
							{/if}
						</div>
						{#if tx.notes}
							<div class="dd__tx-notes abt-privacy-number">{tx.notes}</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if upcomingTxs.length > 0}
		<div class="dd__section">
			<div class="dd__section-title">Upcoming</div>
			<div class="dd__list">
				{#each upcomingTxs as tx}
					<div class="dd__tx dd__tx--upcoming">
						<div class="dd__tx-row">
							<span class="dd__tx-payee abt-privacy-number">{tx.payee}</span>
							<span class="dd__tx-amount abt-privacy-number is-neg">{fmt(tx.amount)}</span>
						</div>
						{#if tx.accountName}
							<div class="dd__tx-meta">
								<span>{tx.accountName}</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.dd {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		font-size: 13px;
		color: var(--color-pageText);
	}

	/* ── Category breakdown ── */
	.dd__cats {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		background: color-mix(in srgb, var(--color-pageText) 3%, transparent);
		border-radius: 8px;
	}

	.dd__cat {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}

	.dd__cat-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.dd__cat-name {
		flex: 1;
		font-weight: 500;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dd__cat-amount {
		font-variant-numeric: tabular-nums;
		font-weight: 400;
		flex-shrink: 0;
	}

	.dd__cat-pct {
		font-size: 10px;
		color: var(--color-pageTextSubdued);
		min-width: 28px;
		text-align: right;
		flex-shrink: 0;
	}

	/* ── Section ── */
	.dd__section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.dd__section-title {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-pageTextSubdued);
	}

	.dd__list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* ── Transaction card ── */
	.dd__tx {
		padding: 8px 10px;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: color-mix(in srgb, var(--color-pageText) 3%, transparent);
		transition: background 0.08s;
	}

	.dd__tx:hover {
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
	}

	.dd__tx-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.dd__tx-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dd__tx-payee {
		flex: 1;
		font-weight: 400;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dd__tx-amount {
		font-variant-numeric: tabular-nums;
		font-weight: 400;
		font-size: 12px;
		flex-shrink: 0;
	}

	.dd__tx-amount.is-neg { color: var(--color-errorText); }
	.dd__tx-amount.is-pos { color: var(--color-noticeTextLight); }

	.dd__tx-meta {
		display: flex;
		gap: 6px;
		font-size: 11px;
		color: var(--color-pageTextSubdued);
	}

	.dd__tx-notes {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		opacity: 0.7;
	}

	/* ── Upcoming ── */
	.dd__tx--upcoming {
		opacity: 0.5;
		font-style: italic;
	}
</style>
