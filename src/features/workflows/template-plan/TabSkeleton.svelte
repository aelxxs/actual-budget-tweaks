<script lang="ts">
	import Section from "@lib/components/panel/Section.svelte";

	const { tab }: { tab: "overview" | "priority" | "breakdown" } = $props();

	const label = $derived(
		tab === "overview"
			? "Loading overview"
			: tab === "priority"
				? "Computing template plan"
				: "Computing breakdown",
	);
</script>

<!-- Laid out like the tab it stands in for, so the content arrives without a jump. -->
<div class="sk" role="status" aria-busy="true" aria-label={label}>
	{#if tab === "overview"}
		<Section title="This Month" collapsible={false}>
			{@render rows(4)}
		</Section>
		<Section title="Next Month" collapsible={false}>
			{@render rows(4)}
		</Section>
		<Section title="Spent vs Budgeted" collapsible={false}>
			<span class="abt-skeleton" style:width="100%" style:height="96px"></span>
		</Section>
		<Section title="Coming Up" collapsible={false}>
			{@render rows(3)}
		</Section>
	{:else}
		<Section title={tab === "priority" ? "Plan Summary" : "Priority Movement"} collapsible={false}>
			{@render rows(tab === "priority" ? 4 : 3)}
		</Section>
		<!-- Named per priority tier or category group, so their titles are placeholders too. -->
		{#each [4, 3] as count, i (i)}
			<Section title="" collapsible={false}>
				{#snippet badges()}<span class="abt-skeleton" style:width="96px" style:height="9px"
					></span>{/snippet}
				{@render rows(count)}
			</Section>
		{/each}
	{/if}
</div>

{#snippet rows(count: number)}
	<div class="sk__rows">
		{#each { length: count }, i (i)}
			<div class="sk__row">
				<span class="abt-skeleton" style:width="{[52, 38, 46, 34, 42][i % 5]}%" style:height="9px"
				></span>
				<span class="abt-skeleton" style:width="52px" style:height="9px"></span>
			</div>
		{/each}
	</div>
{/snippet}

<style>
	/* Spacing matches the tabs' own cards (css.ts), so nothing shifts when they load. */
	.sk__rows {
		display: flex;
		flex-direction: column;
		gap: 9px;
		margin-top: 10px;
	}

	.sk__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
</style>
