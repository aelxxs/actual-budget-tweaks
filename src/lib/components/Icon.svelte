<script lang="ts">
	import { icon, lucideIcon, type DrawnIconName, type IconName } from "@lib/icons";

	const {
		name,
		size = 16,
		strokeWidth,
		class: className,
	}: {
		name: IconName;
		size?: number;
		strokeWidth?: number;
		class?: string;
	} = $props();

	const lucide = $derived(lucideIcon(name));
</script>

{#if lucide}
	<lucide.component
		{size}
		strokeWidth={strokeWidth ?? lucide.strokeWidth ?? 2}
		class={className}
		aria-hidden="true"
	/>
{:else}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- name is a closed IconName union, not user input -->
	{@html icon(name as DrawnIconName, { size, strokeWidth, class: className })}
{/if}
