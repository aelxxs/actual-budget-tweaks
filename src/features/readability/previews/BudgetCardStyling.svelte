<script lang="ts">
	import PreviewPair from "./PreviewPair.svelte";

	const LINES = [
		{ label: "Available funds", value: "3,200.00" },
		{ label: "Overspent in Sep", value: "-40.00" },
		{ label: "Budgeted", value: "-2,400.00" },
		{ label: "For next month", value: "-300.00" },
	];
	const LEGEND = [
		{ label: "Budgeted", color: "var(--abt-accent)", pct: 75 },
		{ label: "Overspent", color: "var(--color-errorText)", pct: 1.25 },
		{ label: "For next month", color: "var(--color-warningText)", pct: 9.4 },
	];
</script>

<PreviewPair>
	{#snippet sample(on)}
		<div class="card">
			<div class="card__to-budget" class:styled={on}>
				<span class="card__label">To Budget:</span>
				<span class="card__value">460.00</span>
			</div>
			{#if on}
				<div class="flow">
					<span class="flow__available"><b>3,200.00</b> available</span>
					<div class="flow__bar">
						{#each LEGEND as seg (seg.label)}
							<span style:width="{seg.pct}%" style:background={seg.color}></span>
						{/each}
					</div>
					<div class="flow__legend">
						{#each LEGEND as seg (seg.label)}
							<span><i style:background={seg.color}></i>{seg.label}</span>
						{/each}
					</div>
				</div>
			{:else}
				<div class="lines">
					{#each LINES as line (line.label)}
						<span>{line.value}</span><span>{line.label}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/snippet}
</PreviewPair>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3);
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius-sm);
		background: var(--color-tableBackground);
		font-size: var(--abt-text-xs);
		color: var(--color-tableText);
	}

	.card__to-budget {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.card__value {
		font-size: var(--abt-text-lg);
		color: var(--color-noticeTextLight);
	}

	.card__to-budget.styled .card__label {
		align-self: flex-start;
		font-size: var(--abt-text-2xs);
		color: var(--color-pageTextSubdued);
	}

	.card__to-budget.styled .card__value {
		font-weight: 600;
	}

	.lines {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 2px var(--abt-space-3);
		color: var(--color-pageTextSubdued);
	}

	.lines > span:nth-child(odd) {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--color-tableText);
	}

	.flow {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	.flow__available {
		color: var(--color-pageTextSubdued);
	}

	.flow__available b {
		color: var(--color-tableText);
		font-weight: 600;
	}

	.flow__bar {
		display: flex;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		overflow: hidden;
		background: var(--abt-ink-4);
	}

	.flow__legend {
		display: flex;
		flex-wrap: wrap;
		gap: 2px var(--abt-space-3);
		font-size: var(--abt-text-2xs);
		color: var(--color-pageTextSubdued);
	}

	.flow__legend i {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 4px;
		border-radius: var(--abt-radius-pill);
	}
</style>
