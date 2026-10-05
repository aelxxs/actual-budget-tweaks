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
		<div class="sk__actions">
			<span class="abt-skeleton" style:width="45%" style:height="9px"></span>
			<span class="abt-skeleton" style:width="64px" style:height="26px" style:margin-left="auto"
			></span>
			<span class="abt-skeleton" style:width="26px" style:height="26px"></span>
		</div>
		<Section title="Month Breakdown" collapsible={false}>
			<div class="sk__hero">
				<span class="abt-skeleton sk__ring"></span>
				<div class="sk__stack">
					<span class="abt-skeleton" style:width="45%" style:height="9px"></span>
					<span class="abt-skeleton" style:width="60%" style:height="18px"></span>
				</div>
			</div>
			<span class="abt-skeleton" style:width="100%" style:height="6px"></span>
			{@render rows(4)}
		</Section>
		<Section title="Spending Pace" collapsible={false}>
			<span class="abt-skeleton" style:width="100%" style:height="6px"></span>
			{@render rows(2)}
		</Section>
		<Section title="Next Month Coverage" collapsible={false}>
			{@render rows(2)}
		</Section>
		<Section title="Spending Trend" collapsible={false}>
			<span class="abt-skeleton" style:width="100%" style:height="96px"></span>
		</Section>
		<Section title="Budgeting Trend" collapsible={false}>
			<span class="abt-skeleton" style:width="100%" style:height="96px"></span>
		</Section>
		<Section title="Goals" collapsible={false}>
			{@render rows(3)}
		</Section>
		<Section title="Scheduled Transactions" collapsible={false}>
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
	.sk__actions {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px 12px;
	}

	.sk__hero {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.sk__ring {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		border-radius: 50%;
	}

	.sk__stack {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 6px;
	}

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
