<script lang="ts">
	import { categoryIconUrl, useCategoryIcons } from "@lib/category-icons.svelte";

	const { id, size = 14 }: { id: string | null | undefined; size?: number } = $props();

	$effect(() => useCategoryIcons());
	const src = $derived(categoryIconUrl(id));
</script>

{#if src}
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
