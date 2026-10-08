<script lang="ts">
	import { cellCorner } from "./month-data";

	const CELLS = 35;
</script>

{#each { length: CELLS } as _, idx (idx)}
	<div class="cell" data-corner={cellCorner(idx, CELLS)}>
		<span class="bar bar--date"></span>
		{#if idx % 3 !== 1}
			<span class="bar" style="width: {40 + ((idx * 37) % 45)}%"></span>
		{/if}
	</div>
{/each}

<style>
	.cell {
		min-height: 100px;
		border: 1px solid var(--color-tableBorder);
		margin: -0.5px;
		padding: 6px;
		background: var(--color-tableBackground);
	}
	.cell[data-corner="tl"] {
		border-top-left-radius: var(--abt-radius);
	}
	.cell[data-corner="tr"] {
		border-top-right-radius: var(--abt-radius);
	}
	.cell[data-corner="bl"] {
		border-bottom-left-radius: var(--abt-radius);
	}
	.cell[data-corner="br"] {
		border-bottom-right-radius: var(--abt-radius);
	}

	.bar {
		display: block;
		height: 8px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-2);
	}
	.bar--date {
		width: 14px;
		height: 10px;
		margin-bottom: 6px;
	}
	@media (prefers-reduced-motion: no-preference) {
		.bar {
			animation: pulse 1.2s ease-in-out infinite;
		}
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
</style>
