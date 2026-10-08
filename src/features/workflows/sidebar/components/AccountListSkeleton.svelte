<script lang="ts">
	// Fixed, varied widths so the placeholder rows read as text rather than a
	// uniform grid — real account names aren't all the same length either.
	const rowWidths = [72, 54, 85, 46, 66, 60, 55, 80, 62, 58];
</script>

<div class="skel-list" aria-hidden="true">
	{#each rowWidths as width, i (i)}
		<div class="skel-row">
			<span class="skel-glyph"></span>
			<span class="skel-name" style="width: {width}%"></span>
			<span class="skel-amount"></span>
		</div>
	{/each}
</div>

<style>
	:global(.split) .skel-row {
		border-radius: 0;
		padding-right: calc(8px + var(--sb-panel-room));
	}
	.skel-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 2px 0;
		flex: 1 1 auto;
	}
	/* row dimensions mirror .account exactly so the real list doesn't jump when
	   it replaces this. */
	.skel-row {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		box-sizing: border-box;
		padding: var(--sb-row-pad-y, 5px) 8px var(--sb-row-pad-y, 5px) 13px;
	}
	.skel-glyph {
		width: 17px;
		height: 17px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--abt-ink-3);
	}
	.skel-name {
		height: 9px;
		border-radius: 4px;
		background: var(--abt-ink-3);
	}
	.skel-amount {
		width: 34px;
		height: 9px;
		border-radius: 4px;
		flex-shrink: 0;
		background: var(--abt-ink-3);
	}
	.skel-glyph,
	.skel-name,
	.skel-amount {
		animation: skel-pulse 1.4s ease-in-out infinite;
	}
	@media (prefers-reduced-motion: reduce) {
		.skel-glyph,
		.skel-name,
		.skel-amount {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
