<script lang="ts">
	import PreviewPair from "./PreviewPair.svelte";

	const R = 4.5;
	const C = 2 * Math.PI * R;
	const ROWS = [
		{ name: "Groceries", balance: "120.00", pct: 1, tone: "var(--color-noticeTextLight)" },
		{ name: "Car fund", balance: "40.00", pct: 0.6, tone: "var(--color-noticeTextLight)" },
		{ name: "Dining", balance: "-18.50", pct: 1, tone: "var(--color-errorText)" },
	];
</script>

<PreviewPair>
	{#snippet sample(on)}
		<div class="rows">
			{#each ROWS as row (row.name)}
				<div class="row">
					<span class="name">{row.name}</span>
					<span class="balance">{row.balance}</span>
					{#if on}
						<svg class="ring" viewBox="0 0 12 12" aria-hidden="true">
							<circle class="track" cx="6" cy="6" r={R} />
							<circle
								class="fill"
								cx="6"
								cy="6"
								r={R}
								stroke={row.tone}
								stroke-dasharray="{row.pct * C} {C}"
								transform="rotate(-90 6 6)"
							/>
						</svg>
					{/if}
				</div>
			{/each}
		</div>
	{/snippet}
</PreviewPair>

<style>
	.rows {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius-sm);
		background: var(--color-tableBackground);
		font-size: var(--abt-text-xs);
		color: var(--color-tableText);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-2);
		min-height: 24px;
		padding: var(--abt-space-1) var(--abt-space-3);
		border-top: 1px solid var(--color-tableBorder);
	}

	.row:first-child {
		border-top: none;
	}

	.name {
		flex: 1;
	}

	.balance {
		font-variant-numeric: tabular-nums;
	}

	.ring {
		width: 12px;
		height: 12px;
		opacity: 0.85;
	}

	.track {
		fill: none;
		stroke: color-mix(in srgb, currentColor 22%, transparent);
		stroke-width: 2.5;
	}

	.fill {
		fill: none;
		stroke-width: 2.5;
		stroke-linecap: round;
	}
</style>
