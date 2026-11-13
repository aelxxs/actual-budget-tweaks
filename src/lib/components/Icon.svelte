<script lang="ts">
	import { icon, type IconName } from "@lib/icons";

	const {
		name,
		size,
		strokeWidth,
		class: className,
	}: {
		name: IconName;
		size?: number;
		strokeWidth?: number;
		class?: string;
	} = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- name is a closed IconName union, not user input -->
{@html icon(name, { size, strokeWidth, class: className })}
