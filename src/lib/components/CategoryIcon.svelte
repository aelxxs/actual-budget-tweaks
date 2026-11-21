<script lang="ts">
	import { categoryIconUrl, useCategoryIcons } from "@lib/category-icons.svelte";
	import { glyphNamed } from "@lib/glyph-icons";
	import GlyphIcon from "./GlyphIcon.svelte";

	const { id, size = 14 }: { id: string | null | undefined; size?: number } = $props();

	$effect(() => useCategoryIcons());
	const src = $derived(categoryIconUrl(id));
	const glyph = $derived(glyphNamed(src));
</script>

{#if glyph}
	<!-- The same class as an image, so each place's sizing and spacing for the icon applies. -->
	<GlyphIcon {glyph} {size} class="category-icon" />
{:else if src}
	<img class="category-icon" {src} alt="" style:width="{size}px" style:height="{size}px" />
{/if}

<style>
	.category-icon {
		flex: none;
		object-fit: contain;
		border-radius: 2px; /* raw: a small mark */
		vertical-align: middle;
	}
</style>
