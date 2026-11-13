<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { customizeSidebar, customizeState, finishCustomizing } from "../lib/customize.svelte";

	// Custom settings get their context; this one needs none.
	const _: { ctx: unknown } = $props();
</script>

<div class="abt-setting">
	<span class="abt-setting__head">
		<span class="abt-setting__icon"><Icon name="sliders" size={15} /></span>
		<span class="abt-setting__text">
			<span class="abt-setting__label">Customize sidebar</span>
			<span class="abt-setting__desc"
				>Opens the sidebar's layout, density, search and shortcut settings.</span
			>
		</span>
	</span>
	<button
		type="button"
		class="abt-btn abt-btn--sm"
		class:abt-tone-accent={customizeState.editing}
		data-abt-customize-trigger
		aria-expanded={customizeState.editing}
		onclick={() => (customizeState.editing ? finishCustomizing() : customizeSidebar())}
	>
		Customize
	</button>
</div>

<style>
	button {
		flex-shrink: 0;
	}
</style>
