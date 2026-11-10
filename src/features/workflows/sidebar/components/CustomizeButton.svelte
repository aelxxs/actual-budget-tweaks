<script lang="ts">
	import { SlidersHorizontal } from "@lucide/svelte";
	import { customizeSidebar, customizeState, finishCustomizing } from "../lib/customize.svelte";

	// Custom settings get their context; this one needs none.
	const _: { ctx: unknown } = $props();
</script>

<div class="row">
	<span class="text">
		<span class="name">Customize sidebar</span>
		<span class="desc">Layout, density, shortcuts and account details</span>
	</span>
	<button
		type="button"
		class="abt-btn abt-btn--sm"
		class:abt-tone-accent={customizeState.editing}
		data-abt-customize-trigger
		aria-expanded={customizeState.editing}
		onclick={() => (customizeState.editing ? finishCustomizing() : customizeSidebar())}
	>
		<SlidersHorizontal size={14} /> Customize
	</button>
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--abt-space-3) var(--abt-space-5);
	}
	.text {
		display: flex;
		flex: 1 1 200px;
		flex-direction: column;
		gap: var(--abt-space-1);
		min-width: 0;
	}
	.name {
		font-weight: 600;
	}
	.desc {
		font-size: var(--abt-text-xs);
		color: var(--abt-soft);
	}
	button {
		gap: var(--abt-space-2);
	}
</style>
