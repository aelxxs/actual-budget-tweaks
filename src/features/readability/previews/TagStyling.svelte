<script lang="ts">
	import PreviewPair from "./PreviewPair.svelte";

	const TAGS = [
		{ name: "food", color: "var(--color-noticeTextLight)" },
		{ name: "trip", color: "var(--abt-accent)" },
	];
</script>

<PreviewPair>
	{#snippet sample(on)}
		<div class="notes">
			<span class="notes__text">Dinner with Sam</span>
			{#each TAGS as tag (tag.name)}
				<span class="tag" class:styled={on} style:--tag={tag.color}>
					{#if on}<span class="tag__hash">#</span>{tag.name}{:else}#{tag.name}{/if}
				</span>
			{/each}
		</div>
	{/snippet}
</PreviewPair>

<style>
	.notes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--abt-space-2);
		padding: var(--abt-space-3);
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius-sm);
		background: var(--color-tableBackground);
		font-size: var(--abt-text-xs);
		color: var(--color-tableText);
	}

	/* Actual's own tag: a solid chip in the tag's colour. */
	.tag {
		padding: 1px 6px;
		border-radius: var(--abt-radius-sm);
		background: var(--tag);
		color: var(--color-buttonPrimaryText);
	}

	.tag.styled {
		padding: 1px 8px 1px 6px;
		background: color-mix(in srgb, var(--tag) 15%, transparent);
		color: color-mix(in srgb, var(--tag) 50%, var(--color-pageText));
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.tag__hash {
		margin-right: 1px;
		font-weight: 400;
		opacity: 0.45;
	}
</style>
