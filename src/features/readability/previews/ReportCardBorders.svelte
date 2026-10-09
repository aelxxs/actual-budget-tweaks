<script lang="ts">
	import PreviewPair from "./PreviewPair.svelte";

	const BARS = [40, 65, 50, 85, 60];
</script>

<PreviewPair>
	{#snippet sample(on)}
		<div class="grid">
			{#each ["Net worth", "Spending"] as title (title)}
				<div class="widget" class:bordered={on}>
					<span class="widget__title">{title}</span>
					<div class="widget__bars">
						{#each BARS as h, i (i)}
							<span style:height="{h}%"></span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
</PreviewPair>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3);
		border-radius: var(--abt-radius-sm);
		background: var(--color-pageBackground);
	}

	.widget {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
		padding: var(--abt-space-3);
		border: 1px solid transparent;
		border-radius: var(--abt-radius-sm);
		background: var(--color-tableBackground);
	}

	.widget.bordered {
		border-color: var(--color-tableBorder);
	}

	.widget__title {
		font-size: var(--abt-text-2xs);
		font-weight: 600;
		color: var(--color-pageTextSubdued);
	}

	.widget__bars {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 32px;
	}

	.widget__bars span {
		flex: 1;
		border-radius: 2px 2px 0 0;
		background: var(--abt-accent-3);
	}
</style>
