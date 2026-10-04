<script lang="ts">
	import { filterState, type CategoryFilter } from "./state.svelte";

	const {
		onpick,
		size = "md",
	}: {
		onpick: (filter: CategoryFilter) => void;
		/** Small in Actual's category column header, full size in the month header. */
		size?: "sm" | "md";
	} = $props();

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

<div class="abt-seg" class:abt-seg--sm={size === "sm"} role="group" aria-label="Filter categories">
	{#each options as o (o.key)}
		<button
			type="button"
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
	.cf__count {
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	.cf__count.is-alert {
		color: var(--color-warningText);
		opacity: 1;
	}
</style>
