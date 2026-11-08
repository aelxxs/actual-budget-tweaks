<script lang="ts">
	import { getCategoryColor } from "@lib/utilities/category-colors";
	import { fmtMoney } from "@lib/utilities/currency";
	import { hasTransactions } from "./month-data";
	import { groupByPayee, spendingByCategory, type GroupedTransaction } from "./summary";
	import type { DayData } from "./types";

	const {
		day,
		corner,
		heat,
		selected,
		tabbable,
		categoryNames,
		onopen,
		onfocus,
	}: {
		day: DayData;
		corner: string | undefined;
		heat: number;
		selected: boolean;
		tabbable: boolean;
		categoryNames: Map<string, string>;
		onopen: () => void;
		onfocus: () => void;
	} = $props();

	const clickable = $derived(hasTransactions(day));
	const grouped = $derived(clickable ? groupByPayee(day.transactions) : []);

	function moreTitle(hidden: GroupedTransaction[]): string | undefined {
		if (document.body.classList.contains("abt-privacy-enabled")) {
			return undefined;
		}
		return hidden.map((t) => (t.count > 1 ? `${t.payee} ×${t.count}` : t.payee)).join("\n");
	}
</script>

<!-- Roving tabindex: in-month days take arrow-key focus. Each day is a button, disabled when
     there's nothing to open. -->
<div
	class="cal-cell"
	class:is-today={day.isToday}
	class:is-selected={selected}
	class:is-future={day.isFuture}
	class:is-muted={!day.isCurrentMonth}
	class:is-clickable={clickable}
	style={heat > 0 ? `--heat-raw: ${heat.toFixed(3)}` : undefined}
	data-corner={corner}
	data-iso={day.isCurrentMonth ? day.iso : undefined}
	role="button"
	aria-pressed={clickable ? selected : undefined}
	aria-disabled={!clickable}
	tabindex={day.isCurrentMonth && tabbable ? 0 : -1}
	onfocus={() => {
		if (day.isCurrentMonth) {
			onfocus();
		}
	}}
	onclick={onopen}
	onkeydown={(e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onopen();
		}
	}}
>
	<div class="cal-cell__header">
		<span class="cal-cell__datewrap">
			<span class="cal-cell__date" class:is-today={day.isToday}>{day.date}</span>
			{#if day.hasMissed}
				<span class="cal-cell__missed" title="Missed schedule"></span>
			{/if}
		</span>
		{#if day.total !== 0 && day.isCurrentMonth}
			<span
				class="cal-cell__total abt-privacy-number"
				class:is-neg={day.total < 0}
				class:is-pos={day.total > 0}
			>
				{fmtMoney(day.total, { short: true, sign: true })}
			</span>
		{/if}
	</div>

	{#if clickable}
		<div class="cal-cell__txs">
			{#each grouped.slice(0, 3) as tx, i (i)}
				<div class="cal-tx" class:is-upcoming={tx.upcoming} class:is-missed={tx.missed}>
					<span
						class="cal-tx__dot"
						style="background: {tx.upcoming
							? 'var(--color-pageTextSubdued)'
							: tx.missed
								? 'var(--color-errorText)'
								: getCategoryColor(tx.categoryId)}"
					></span>
					<span class="cal-tx__payee abt-privacy-number">{tx.payee}</span>
					{#if tx.count > 1}
						<span class="abt-count">×{tx.count}</span>
					{/if}
				</div>
			{/each}
			{#if grouped.length > 3}
				<div class="cal-tx">
					<span class="cal-more" title={moreTitle(grouped.slice(3))}
						>+{grouped.length - 3} more</span
					>
				</div>
			{/if}
		</div>

		<div class="cal-cell__bars">
			{#each spendingByCategory(day.transactions) as [catId, amount] (catId)}
				{@const pct = Math.max(8, (amount / Math.abs(day.total || 1)) * 100)}
				<div
					class="cal-bar"
					style="width: {pct}%; background: {getCategoryColor(catId)}"
					title="{categoryNames.get(catId) || 'Uncategorized'}: {fmtMoney(-amount)}"
				></div>
			{/each}
		</div>
	{/if}

	{#if day.balance !== undefined && day.isCurrentMonth}
		<div
			class="cal-cell__balance abt-privacy-number"
			class:is-neg={day.balance < 0}
			class:is-flat={day.balanceFlat}
			title="Balance at the end of the day{day.isFuture ? ', with scheduled bills' : ''}"
		>
			{fmtMoney(day.balance)}
		</div>
	{/if}
</div>

<style>
	.cal-cell {
		min-height: 100px;
		border: 1px solid var(--color-tableBorder);
		margin: -0.5px;
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow: hidden;
		transition: background 0.1s;
		--heat: var(--heat-raw, 0);
		/* Over the page's own background, so the cells don't repaint it as they slide. */
		--cell-bg: color-mix(in srgb, var(--color-errorText) calc(var(--heat) * 10%), transparent);
		background: var(--cell-bg);
	}
	/* The tint would reveal spending patterns that privacy mode blurs. */
	:global(body.abt-privacy-enabled) .cal-cell {
		--heat: 0;
	}

	.cal-cell[data-corner="tl"] {
		border-top-left-radius: var(--abt-radius);
	}
	.cal-cell[data-corner="tr"] {
		border-top-right-radius: var(--abt-radius);
	}
	.cal-cell[data-corner="bl"] {
		border-bottom-left-radius: var(--abt-radius);
	}
	.cal-cell[data-corner="br"] {
		border-bottom-right-radius: var(--abt-radius);
	}

	.cal-cell.is-clickable {
		cursor: pointer;
	}

	.cal-cell.is-clickable:hover,
	.cal-cell.is-today {
		background: color-mix(in srgb, var(--abt-accent) 6%, var(--cell-bg));
	}

	.cal-cell.is-selected,
	.cal-cell.is-selected:hover {
		background: color-mix(in srgb, var(--abt-accent) 12%, var(--cell-bg));
		box-shadow: inset 0 0 0 1.5px var(--abt-accent);
	}

	.cal-cell:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 1.5px var(--abt-accent-4);
	}

	.cal-cell.is-selected .cal-cell__date:not(.is-today) {
		color: var(--abt-accent);
		font-weight: 700;
		opacity: 1;
	}

	.cal-cell.is-muted {
		border-color: color-mix(in srgb, var(--color-tableBorder) 50%, var(--color-pageBackground));
	}
	.cal-cell.is-muted > * {
		opacity: 0.5;
	}

	.cal-cell__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 2px;
	}

	.cal-cell__datewrap {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.cal-cell__date {
		font-size: var(--abt-text-base);
		font-weight: 500;
		opacity: 0.6;
	}
	.cal-cell.is-future .cal-cell__date {
		opacity: 0.35;
	}

	.cal-cell__missed {
		width: 5px;
		height: 5px;
		border-radius: var(--abt-radius-pill);
		background: var(--color-errorText);
	}

	.cal-cell__date.is-today {
		background: var(--abt-accent-3);
		color: var(--abt-accent);
		width: 22px;
		height: 22px;
		border-radius: var(--abt-radius-pill);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--abt-text-sm);
		font-weight: 700;
		opacity: 1;
		color: color-contrast(var(--abt-accent)) !important;
	}

	.cal-cell__total {
		font-size: var(--abt-text-xs);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.cal-cell__total.is-neg {
		color: var(--color-errorText);
	}

	.cal-cell__total.is-pos {
		color: var(--color-noticeTextLight);
	}

	.cal-cell__txs {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow: hidden;
	}

	.cal-tx {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--abt-text-sm);
		line-height: 1.5;
		min-width: 0;
	}

	.cal-tx__dot {
		width: 7px;
		height: 7px;
		border-radius: var(--abt-radius-pill);
		flex-shrink: 0;
	}

	.cal-tx__payee {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		opacity: 0.8;
	}

	.cal-more {
		margin-left: 9px;
		padding: 0 6px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-2);
		color: var(--color-pageTextSubdued);
		font-size: var(--abt-text-2xs);
		font-weight: 600;
		line-height: 1.6;
	}

	.cal-tx.is-upcoming {
		opacity: 0.45;
		font-style: italic;
	}

	.cal-tx.is-missed {
		opacity: 0.75;
	}

	.cal-tx.is-missed .cal-tx__payee {
		color: var(--color-errorText);
		text-decoration: line-through;
		text-decoration-color: color-mix(in srgb, var(--color-errorText) 45%, transparent);
	}

	.cal-tx.is-upcoming .cal-tx__dot {
		border: 1px dashed var(--color-pageTextSubdued);
		background: transparent !important;
		width: 7px;
		height: 7px;
	}

	.cal-cell__bars {
		display: flex;
		gap: 1px;
		margin-top: auto;
		padding-top: 4px;
	}

	.cal-cell__balance {
		margin-top: auto;
		padding-top: 4px;
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
		align-self: flex-end;
	}

	.cal-cell__bars + .cal-cell__balance {
		margin-top: 0;
	}

	.cal-cell__balance.is-flat {
		color: var(--abt-subtle);
	}

	.cal-cell__balance.is-neg {
		color: var(--color-errorText);
		font-weight: 600;
	}

	.cal-bar {
		height: 3px;
		border-radius: 1.5px;
		min-width: 4px;
		opacity: 0.7;
	}
</style>
