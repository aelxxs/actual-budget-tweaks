<script lang="ts">
	import { pendingIds } from "./queue";
	import { reviewState } from "./queue-state.svelte";

	/** "N to review" in the titlebar, beside Actual's uncategorized count; hidden at zero. */
	const { onOpen }: { onOpen: () => void } = $props();

	const count = $derived(pendingIds(reviewState.queue).length);
</script>

{#if count}
	<button type="button" class="review" onclick={onOpen} title="Review imported transactions">
		{count} to review
	</button>
{/if}

<style>
	.review {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 var(--abt-space-3);
		border: 0;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-accent-2);
		color: var(--abt-accent-text);
		font: inherit;
		font-size: var(--abt-text-base);
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
	}
	.review::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: var(--abt-radius-pill);
		background: currentColor;
	}
	.review:hover {
		background: var(--abt-accent-3);
	}
	/* The review count takes over Actual's auto margin, which would push it to the far right. */
	:global([data-abt-review-after]) {
		margin-right: var(--abt-space-2) !important;
	}
</style>
