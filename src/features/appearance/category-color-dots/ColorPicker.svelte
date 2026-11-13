<script lang="ts">
	import { PRESET_COLORS } from "@lib/category-colors.svelte";

	const {
		currentColor,
		onSelect,
		// Closing is handled by the parent popover's own backdrop/outside-click
		// logic; this component doesn't need to trigger it itself.
		onClose: _onClose,
	} = $props<{
		currentColor: string;
		onSelect: (color: string) => void;
		onClose: () => void;
	}>();

	let custom = $derived(currentColor);
</script>

<div class="cp">
	<div class="cp__grid">
		{#each PRESET_COLORS as color (color)}
			<button
				class="cp__swatch"
				class:is-active={currentColor === color}
				style="background: {color}"
				aria-label="Select color {color}"
				onclick={() => onSelect(color)}
			></button>
		{/each}
	</div>
	<div class="cp__custom">
		<input class="cp__input" type="color" bind:value={custom} onchange={() => onSelect(custom)} />
		<span class="cp__label">Custom</span>
	</div>
</div>

<style>
	.cp {
		padding: var(--abt-space-3);
		width: 180px;
	}

	.cp__grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: var(--abt-space-2);
	}

	.cp__swatch {
		width: 100%;
		aspect-ratio: 1;
		border: 2px solid transparent;
		border-radius: var(--abt-radius-sm);
		cursor: pointer;
		transition:
			border-color 0.08s,
			transform 0.08s;
		padding: 0;
	}

	.cp__swatch:hover {
		transform: scale(1.15);
	}

	.cp__swatch.is-active {
		border-color: white;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
	}

	.cp__custom {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-ink-2);
	}

	.cp__input {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--abt-radius-sm);
		padding: 0;
		cursor: pointer;
		background: none;
	}

	.cp__input::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.cp__input::-webkit-color-swatch {
		border: none;
		border-radius: var(--abt-radius-sm);
	}

	.cp__input::-moz-color-swatch {
		border: none;
		border-radius: var(--abt-radius-sm);
	}

	.cp__label {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
</style>
