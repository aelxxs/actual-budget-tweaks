<script lang="ts">
	import { filterState, type CategoryFilter } from "./state.svelte";

	const { onpick }: { onpick: (filter: CategoryFilter) => void } = $props();

	const options = $derived([
		{ key: "all" as const, label: "All", short: "", count: null, empty: "" },
		{
			key: "attention" as const,
			label: "Needs attention",
			short: "Attention",
			count: filterState.counts.attention,
			empty: "Nothing needs attention",
		},
		{
			key: "funded" as const,
			label: "On track",
			short: "",
			count: filterState.counts.funded,
			empty: "No categories on track",
		},
	]);
</script>

<div class="abt-seg" role="group" aria-label="Filter categories">
	{#each options as o (o.key)}
		<button
			type="button"
			aria-pressed={filterState.filter === o.key}
			disabled={o.count === 0 && filterState.filter !== o.key}
			title={o.count === 0 ? o.empty : undefined}
			onclick={() => onpick(o.key)}
		>
			{#if o.short}
				<span class="cf__long">{o.label}</span><span class="cf__short">{o.short}</span>
			{:else}
				{o.label}
			{/if}
			{#if o.count !== null}
				<span class="cf__count" class:is-alert={o.key === "attention" && o.count > 0}
					>{o.count}</span
				>
			{/if}
		</button>
	{/each}
</div>

<style>
	.cf__short {
		display: none;
	}

	/* Shorter labels when the month header runs out of room; full ones elsewhere. */
	:global(.bmh--squeeze-2) .cf__long {
		display: none;
	}
	:global(.bmh--squeeze-2) .cf__short {
		display: inline;
	}

	/* A chip, so the count reads as a number beside the label rather than more of its words. */
	.cf__count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		box-sizing: border-box;
		padding: 0 var(--abt-space-2);
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-2);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 18px;
	}

	.cf__count.is-alert {
		background: var(--abt-warning-2);
		color: var(--color-warningText);
	}

	button[aria-pressed="true"] .cf__count:not(.is-alert) {
		background: var(--abt-accent-2);
	}
</style>
