<script lang="ts">
	import { type Generated, grainImage, type GrainSize } from "./generator";
	import { studio } from "./state.svelte";

	const { g }: { g: Generated } = $props();

	const grain = $derived(studio.recipe.grain);
	// The track is the texture itself, heavier towards the right.
	const track = $derived(grainImage(100, grain.size));
	const SIZES: [GrainSize, string][] = [
		["fine", "Fine"],
		["medium", "Medium"],
		["coarse", "Coarse"],
	];
</script>

<div class="amount">
	<span class="track" style:--grain={track} style:--page={g.colors.crust} aria-hidden="true"></span>
	<input
		type="range"
		min="0"
		max="100"
		value={grain.amount}
		aria-label="Grain amount"
		aria-valuetext={grain.amount ? `${grain.amount}%` : "Off"}
		oninput={(e) => (studio.recipe.grain.amount = Number(e.currentTarget.value))}
	/>
	<span class="value">{grain.amount ? grain.amount : "Off"}</span>
</div>
<div
	class="abt-seg abt-seg--sm sizes"
	class:off={!grain.amount}
	role="group"
	aria-label="Grain size"
>
	{#each SIZES as [value, label] (value)}
		<button
			type="button"
			aria-pressed={grain.size === value}
			disabled={!grain.amount}
			title={grain.amount ? undefined : "Add some grain first"}
			onclick={() => (studio.recipe.grain.size = value)}>{label}</button
		>
	{/each}
</div>

<style>
	.amount {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 30px;
		align-items: center;
		gap: var(--abt-space-3);
	}
	/*
	 * The noise drawn plainly (an overlay blend all but vanishes on a dark page), with the page
	 * color over it fading out towards the right, under a transparent range input.
	 */
	.track {
		grid-area: 1 / 1;
		height: 18px;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		background:
			linear-gradient(to right, var(--page) 4%, color-mix(in srgb, var(--page) 35%, transparent)),
			var(--grain);
		background-size:
			100% 100%,
			220px 220px;
		/* From the outer edge, or the fade repeats under the border with its noisy end. */
		background-origin: border-box;
		background-repeat: no-repeat, repeat;
	}
	input {
		grid-area: 1 / 1;
		width: 100%;
		margin: 0;
		background: none;
		accent-color: var(--abt-accent);
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}
	input::-webkit-slider-runnable-track {
		height: 18px;
		background: none;
	}
	input::-moz-range-track {
		height: 18px;
		background: none;
	}
	input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 8px;
		height: 22px;
		margin-top: -2px;
		border: 2px solid white;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-accent);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
	}
	input::-moz-range-thumb {
		width: 6px;
		height: 20px;
		border: 2px solid white;
		border-radius: var(--abt-radius-sm);
		background: var(--abt-accent);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
	}
	.value {
		font-size: var(--abt-text-sm);
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--abt-muted);
	}
	.sizes {
		display: flex;
	}
	/* No size to choose while there's no grain. */
	.sizes.off {
		opacity: 0.45;
	}
	.sizes.off > button {
		cursor: default;
	}
	.sizes > button {
		flex: 1;
		justify-content: center;
	}
</style>
