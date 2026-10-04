<script lang="ts">
	import { filterState, type CategoryFilter } from "./state.svelte";

	const { onpick }: { onpick: (filter: CategoryFilter) => void } = $props();

	const options = $derived([
		{ key: "all" as const, label: "All", count: null, empty: "" },
		{
			key: "attention" as const,
			label: "Needs attention",
			count: filterState.counts.attention,
			empty: "Nothing needs attention",
		},
		{
			key: "funded" as const,
			label: "Funded",
			count: filterState.counts.funded,
			empty: "No funded categories",
		},
	]);
</script>

<div class="cf" role="group" aria-label="Filter categories">
	{#each options as o (o.key)}
		<button
			type="button"
			class:is-active={filterState.filter === o.key}
			aria-pressed={filterState.filter === o.key}
			disabled={o.count === 0 && filterState.filter !== o.key}
			title={o.count === 0 ? o.empty : undefined}
			onclick={() => onpick(o.key)}
		>
			{o.label}
			{#if o.count !== null}
				<span class="cf__count" class:is-alert={o.key === "attention" && o.count > 0}
					>{o.count}</span
				>
			{/if}
		</button>
	{/each}
</div>

<style>
	.cf {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		box-sizing: border-box;
		height: 24px;
		margin-right: 6px;
		padding: 2px;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--border-radius, 6px);
	}

	/* Same size as the month header's Months control beside it. */
	:global([data-abt-month-header-slot]) .cf {
		height: 30px;
		margin-right: 0;
	}

	:global([data-abt-month-header-slot]) .cf button {
		padding: 0 10px;
		font-size: 12.5px;
	}

	.cf button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 100%;
		padding: 0 8px;
		border: none;
		border-radius: calc(var(--border-radius, 6px) - 2px);
		background: none;
		color: var(--color-pageTextSubdued);
		font: inherit;
		font-size: 11.5px;
		font-weight: 550;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.cf button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.cf button:hover:not(.is-active, :disabled) {
		color: var(--color-pageText);
	}

	.cf button.is-active {
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 24%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		font-weight: 650;
	}

	.cf__count {
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	.cf__count.is-alert {
		color: var(--color-warningText);
		opacity: 1;
	}
</style>
