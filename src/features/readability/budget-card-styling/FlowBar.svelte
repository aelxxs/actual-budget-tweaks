<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";

	const { available, budgeted, overspent, forNext } = $props<{
		available: number;
		budgeted: number;
		overspent: number;
		forNext: number;
	}>();

	const toBudget = $derived(available - budgeted - overspent - forNext);
	const total = $derived(Math.max(available, budgeted + overspent + forNext) || 1);

	function fmt(n: number): string {
		return fmtMoney(n);
	}

	function pct(value: number): string {
		return `${Math.max((value / total) * 100, 1)}%`;
	}

	type LegendEntry = { label: string; value: number; color: string; negative?: boolean };

	const legend = $derived.by(() => {
		const items: LegendEntry[] = [];
		items.push({ label: "Budgeted", value: budgeted, color: "var(--color-sidebarItemAccentSelected)" });
		items.push({ label: "Overspent", value: overspent, color: "var(--color-errorText)" });
		items.push({ label: "For next month", value: forNext, color: "var(--color-warningText)" });
		items.push({
			label: "Remaining",
			value: toBudget,
			color: "color-mix(in srgb, var(--color-pageText) 15%, transparent)",
			negative: toBudget < 0,
		});
		return items;
	});
</script>

<div class="flow__container">
	<div class="flow__body">
		<div class="flow__available">
			<span class="flow__available-val abt-privacy-number">{fmt(available)}</span> available
		</div>

		<div class="flow__legend">
			{#each legend as item}
				<div
					class="flow__item"
					class:flow__item--negative={item.negative}
					class:flow__item--zero={item.value === 0}
				>
					<span class="flow__dot" style="background: {item.color}"></span>
					<span>{item.label}</span>
					<span class="flow__item-val abt-privacy-number">{item.negative ? "-" : ""}{fmt(item.value)}</span>
				</div>
			{/each}
		</div>
	</div>
	<div class="flow__bar">
		{#if budgeted > 0}
			<div class="flow__seg flow__seg--budgeted" style="width: {pct(budgeted)}"></div>
		{/if}
		{#if overspent > 0}
			<div class="flow__seg flow__seg--overspent" style="width: {pct(overspent)}"></div>
		{/if}
		{#if forNext > 0}
			<div class="flow__seg flow__seg--for-next" style="width: {pct(forNext)}"></div>
		{/if}
	</div>
</div>

<style>
	.flow__container {
		display: flex;
		flex-direction: column;
		margin: 17px 0 0;
		background-color: var(--color-budgetHeaderCurrentMonth);
		border-width: 1px 0;
		border-style: solid;
		border-color: var(--color-tableBorder);
		box-sizing: border-box;
	}

	.flow__body {
		padding: 10px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background-color: var(--color-budgetHeaderCurrentMonth);
		box-sizing: border-box;
	}

	.flow__available {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.flow__available-val {
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-pageText);
	}

	.flow__bar {
		height: 6px;
		background: color-mix(in srgb, var(--color-pageText) 8%, transparent);
		display: flex;
		overflow: hidden;
	}

	.flow__seg {
		height: 100%;
		min-width: 2px;
		transition: width 0.3s ease;
	}

	.flow__seg--budgeted {
		background: var(--color-sidebarItemAccentSelected);
	}

	.flow__seg--overspent {
		background: var(--color-errorText);
	}

	.flow__seg--for-next {
		background: var(--color-warningText);
	}

	.flow__legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}

	.flow__item {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		color: var(--color-pageTextSubdued);
	}

	.flow__dot {
		width: 6px;
		height: 6px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.flow__item-val {
		font-variant-numeric: tabular-nums;
		color: var(--color-pageText);
		font-weight: 500;
	}

	.flow__item--negative .flow__item-val {
		color: var(--color-errorText);
	}

	.flow__item--zero {
		opacity: 0.8;
	}
</style>
