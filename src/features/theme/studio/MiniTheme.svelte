<script lang="ts">
	import ThemeThumb from "../picker/ThemeThumb.svelte";
	import type { Generated } from "./generator";

	const { g }: { g: Generated } = $props();
</script>

<span class="mini">
	<ThemeThumb
		thumb={{
			side: g.sidebar.bg,
			page: g.colors.crust,
			card: g.colors.mantle,
			text: g.colors.text,
			accent: g.sidebar.sel,
		}}
	/>
</span>

<style>
	.mini {
		display: block;
		overflow: hidden;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
	}
</style>
