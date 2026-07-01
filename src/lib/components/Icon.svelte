<script lang="ts">
	import { icon, type IconName } from "../icons";

	const { name, size, strokeWidth, class: className }: {
		name: IconName;
		size?: number;
		strokeWidth?: number;
		class?: string;
	} = $props();
</script>

{@html icon(name, { size, strokeWidth, class: className })}
