<script lang="ts">
	// Its own header, so features that retitle the panel (the month's name) leave this one alone.
	import { saveStudioTheme } from "./save";
	import { studio } from "./state.svelte";

	let saving = $state(false);

	async function save(asNew: boolean) {
		saving = true;
		try {
			await saveStudioTheme(asNew);
		} finally {
			saving = false;
		}
	}
</script>

<div class="head">
	<h2 class="title">Theme Studio</h2>
	{#if studio.editing}
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--ghost"
			disabled={saving}
			title="Keep the original and save this as another theme"
			onclick={() => save(true)}>Save as new</button
		>
	{/if}
	<button
		type="button"
		class="abt-btn abt-btn--sm abt-tone-accent"
		disabled={saving}
		title={studio.editing ? "Update this theme and use it" : "Save this theme and use it"}
		onclick={() => save(false)}>Save</button
	>
</div>

<style>
	.head {
		display: flex;
		flex: 1;
		width: 100%;
		align-items: center;
		gap: var(--abt-space-2);
		min-width: 0;
	}
	.title {
		flex: 1;
		margin: 0;
		font-size: var(--abt-text-lg);
		line-height: 1.3;
		font-weight: 700;
		color: var(--color-pageText);
	}
</style>
