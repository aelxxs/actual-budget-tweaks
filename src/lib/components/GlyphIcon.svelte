<script lang="ts">
	import type { Glyph } from "@lib/glyphs";

	const {
		glyph,
		size = 14,
		class: className = "",
	}: { glyph: Glyph; size?: number; class?: string } = $props();
</script>

<svg
	class="glyph-icon {className}"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.85"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each glyph.node as [tag, attrs], i (i)}
		<svelte:element this={tag} {...attrs} />
	{/each}
</svg>

<style>
	/* A marker beside a name, a step quieter than the name itself. */
	.glyph-icon {
		flex: none;
		vertical-align: middle;
		color: var(--abt-muted);
	}
</style>
